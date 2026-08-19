/**
 * POST /api/chat
 *
 * 1. Auth-guard via Supabase server session
 * 2. Run input compression on the user message
 * 3. Fetch conversation history from DB
 * 4. Build LLM request with output-compression system prompt
 * 5. Stream response back to client via ReadableStream
 * 6. Log token counts + savings to messages + usage_logs
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  compressInput,
  getCompressionSystemPrompt,
  UNCOMPRESSED_SYSTEM_PROMPT,
  countTokens,
  computeSavings,
  estimateCost,
  DEFAULT_PRICE_PER_MILLION,
} from "@/lib/compression";
import type { CompressionLevel } from "@/types/database";

const LLM_BASE_URL =
  process.env.LLM_API_BASE_URL ?? "https://openrouter.ai/api/v1";
const LLM_API_KEY = process.env.LLM_API_KEY ?? "";
const LLM_MODEL = process.env.LLM_MODEL ?? "mistralai/mistral-7b-instruct";
const PRICE_PER_MILLION = parseFloat(
  process.env.LLM_PRICE_PER_MILLION_TOKENS ?? String(DEFAULT_PRICE_PER_MILLION)
);

export async function POST(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ──────────────────────────────────────────────────────────
  let body: {
    message: string;
    conversationId?: string;
    compressionEnabled?: boolean;
    compressionLevel?: CompressionLevel;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    message,
    conversationId,
    compressionEnabled = true,
    compressionLevel = "full",
  } = body;

  if (!message?.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  // ── Ensure conversation exists ───────────────────────────────────────────
  let convId = conversationId;
  if (!convId) {
    const title = message.slice(0, 60);
    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title })
      .select("id")
      .single();

    if (convErr || !conv) {
      return NextResponse.json(
        { error: "Failed to create conversation" },
        { status: 500 }
      );
    }
    convId = conv.id;
  }

  // ── Fetch conversation history (last 20 messages) ────────────────────────
  const { data: history } = await supabase
    .from("messages")
    .select("role, compressed_content, original_content")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: true })
    .limit(20);

  // ── Input compression ────────────────────────────────────────────────────
  const compressionResult = compressionEnabled
    ? compressInput(message, compressionLevel)
    : {
        original: message,
        compressed: message,
        rawTokens: countTokens(message),
        compressedTokens: countTokens(message),
        basis: "inferred" as const,
      };

  // ── Persist user message ─────────────────────────────────────────────────
  const { data: userMsg } = await supabase
    .from("messages")
    .insert({
      conversation_id: convId,
      role: "user",
      original_content: compressionResult.original,
      compressed_content: compressionResult.compressed,
      raw_tokens: compressionResult.rawTokens,
      compressed_tokens: compressionResult.compressedTokens,
    })
    .select("id")
    .single();

  // ── Build LLM messages array ─────────────────────────────────────────────
  const systemPrompt = compressionEnabled
    ? getCompressionSystemPrompt(compressionLevel)
    : UNCOMPRESSED_SYSTEM_PROMPT;

  type LLMMessage = { role: "system" | "user" | "assistant"; content: string };

  const llmMessages: LLMMessage[] = [
    { role: "system", content: systemPrompt },
    ...(history ?? []).map((m) => ({
      role: m.role as "user" | "assistant",
      content:
        (compressionEnabled ? m.compressed_content : m.original_content) ??
        m.original_content ??
        "",
    })),
    { role: "user", content: compressionResult.compressed },
  ];

  // ── Call LLM (streaming) ──────────────────────────────────────────────────
  let llmResponse: Response;
  try {
    llmResponse = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LLM_API_KEY}`,
        "HTTP-Referer": "https://tokensaver.app",
        "X-Title": "TokenSaver",
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: llmMessages,
        stream: true,
        max_tokens: 2048,
      }),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "LLM API unreachable", detail: String(err) },
      { status: 502 }
    );
  }

  if (!llmResponse.ok) {
    const errText = await llmResponse.text();
    return NextResponse.json(
      { error: "LLM API error", detail: errText },
      { status: llmResponse.status }
    );
  }

  // ── Stream back + accumulate response for logging ─────────────────────────
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let assistantContent = "";
  let promptTokensUsed = 0;
  let completionTokensUsed = 0;

  const stream = new ReadableStream({
    async start(controller) {
      // Send conversation id first so client can store it
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ conversationId: convId, type: "meta" })}\n\n`
        )
      );

      const reader = llmResponse.body!.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") {
              controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
              continue;
            }

            try {
              const parsed = JSON.parse(data);

              // Accumulate usage from final chunk
              if (parsed.usage) {
                promptTokensUsed = parsed.usage.prompt_tokens ?? 0;
                completionTokensUsed = parsed.usage.completion_tokens ?? 0;
              }

              const delta = parsed.choices?.[0]?.delta?.content ?? "";
              if (delta) {
                assistantContent += delta;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ delta, type: "token" })}\n\n`
                  )
                );
              }
            } catch {
              // Malformed chunk — skip
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // ── Post-stream: log assistant message ─────────────────────────────
      const rawAssistantTokens = countTokens(assistantContent);
      // If provider reported usage, use it; otherwise use our estimate
      const actualCompletionTokens =
        completionTokensUsed > 0 ? completionTokensUsed : rawAssistantTokens;

      await supabase.from("messages").insert({
        conversation_id: convId!,
        role: "assistant",
        original_content: null,
        compressed_content: assistantContent,
        raw_tokens: rawAssistantTokens,
        compressed_tokens: actualCompletionTokens,
      });

      // ── Log savings ──────────────────────────────────────────────────────
      const inputSavings = computeSavings(
        compressionResult.rawTokens,
        compressionResult.compressedTokens
      );
      const totalSaved = inputSavings.saved;
      const costSaved = estimateCost(totalSaved, PRICE_PER_MILLION);

      await supabase.from("usage_logs").insert({
        user_id: user.id,
        conversation_id: convId,
        tokens_saved: totalSaved,
        cost_saved_usd: costSaved,
      });

      // ── Send final stats to client ───────────────────────────────────────
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: "stats",
            userMsgId: userMsg?.id,
            inputRawTokens: compressionResult.rawTokens,
            inputCompressedTokens: compressionResult.compressedTokens,
            inputTokensSaved: inputSavings.saved,
            inputPctSaved: inputSavings.pctSaved,
            outputTokens: actualCompletionTokens,
            totalTokensSaved: totalSaved,
            costSavedUsd: costSaved,
            basis: "inferred",
          })}\n\n`
        )
      );

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
