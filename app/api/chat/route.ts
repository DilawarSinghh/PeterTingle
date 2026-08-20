/**
 * POST /api/chat
 *
 * Flow:
 * 1. Auth-guard
 * 2. Parse body — includes modelId
 * 3. Look up model row → provider + base_url
 * 4. Resolve API key: platform quota check → BYOK fallback
 * 5. Input compression
 * 6. Build provider-specific request (OpenAI-compat or Anthropic adapter)
 * 7. Stream response back via SSE
 * 8. Persist messages + usage_logs
 * 9. Auto-generate conversation title from first user message
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  compressInput,
  getCompressionSystemPrompt,
  UNCOMPRESSED_SYSTEM_PROMPT,
  countTokens,
  computeSavings,
  estimateCost,
} from "@/lib/compression";
import type { CompressionLevel } from "@/types/database";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strip markdown and truncate for auto-title */
function makeTitle(text: string, maxLen = 40): string {
  return text
    .replace(/[#*`_~\[\]()>!]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

/** Decrypt a user API key stored with pgp_sym_encrypt */
async function decryptUserKey(
  serviceClient: ReturnType<typeof createServiceClient>,
  userId: string,
  provider: string
): Promise<string | null> {
  const secret = process.env.KEY_ENCRYPTION_SECRET;
  if (!secret) return null;

  const { data, error } = await (serviceClient as any).rpc("decrypt_user_api_key", {
    p_user_id: userId,
    p_provider: provider,
    p_secret: secret,
  });

  if (error || !data) return null;
  return data as string;
}

/** Check whether platform quota for a provider is exhausted */
async function isPlatformQuotaExhausted(
  serviceClient: ReturnType<typeof createServiceClient>,
  provider: string
): Promise<boolean> {
  const { data } = await (serviceClient as any)
    .from("platform_usage")
    .select("tokens_used, monthly_quota")
    .eq("provider", provider)
    .single();

  if (!data) return false; // no row → no limit configured
  return data.tokens_used >= data.monthly_quota;
}

/** Increment platform token usage after a successful call */
async function incrementPlatformUsage(
  serviceClient: ReturnType<typeof createServiceClient>,
  provider: string,
  tokensUsed: number
) {
  await (serviceClient as any).rpc("increment_platform_usage", {
    p_provider: provider,
    p_tokens: tokensUsed,
  });
}

// ── Provider adapters ─────────────────────────────────────────────────────────

type LLMMessage = { role: "system" | "user" | "assistant"; content: string };

interface AdapterResponse {
  stream: ReadableStream<Uint8Array>;
  isStreaming: boolean;
}

/** OpenAI-compatible adapter (OpenAI, Groq, OpenRouter) */
async function callOpenAICompat(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: LLMMessage[]
): Promise<Response> {
  return fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://tokensaver.app",
      "X-Title": "TokenSaver",
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      max_tokens: 2048,
      stream_options: { include_usage: true },
    }),
  });
}

/** Anthropic adapter — converts OpenAI message format to Anthropic's /v1/messages */
async function callAnthropic(
  apiKey: string,
  model: string,
  messages: LLMMessage[]
): Promise<Response> {
  // Extract system message
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const anthropicMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "messages-2023-12-15",
    },
    body: JSON.stringify({
      model,
      system,
      messages: anthropicMessages,
      stream: true,
      max_tokens: 2048,
    }),
  });
}

// ── SSE parsers ────────────────────────────────────────────────────────────────

/** Parse OpenAI-compatible SSE stream, yielding text deltas and usage */
async function* parseOpenAIStream(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<{ delta?: string; usage?: { prompt_tokens: number; completion_tokens: number } }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") return;
        try {
          const parsed = JSON.parse(data);
          if (parsed.usage) yield { usage: parsed.usage };
          const delta = parsed.choices?.[0]?.delta?.content ?? "";
          if (delta) yield { delta };
        } catch { /* skip malformed */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** Parse Anthropic SSE stream */
async function* parseAnthropicStream(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<{ delta?: string; usage?: { prompt_tokens: number; completion_tokens: number } }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.type === "content_block_delta") {
              yield { delta: parsed.delta?.text ?? "" };
            }
            if (parsed.type === "message_start" && parsed.message?.usage) {
              inputTokens = parsed.message.usage.input_tokens ?? 0;
            }
            if (parsed.type === "message_delta" && parsed.usage) {
              outputTokens = parsed.usage.output_tokens ?? 0;
            }
            if (parsed.type === "message_stop") {
              yield { usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens } };
            }
          } catch { /* skip */ }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ── Platform API key resolver ─────────────────────────────────────────────────

const PLATFORM_KEYS: Record<string, string | undefined> = {
  openai: process.env.OPENAI_API_KEY,
  anthropic: process.env.ANTHROPIC_API_KEY,
  groq: process.env.GROQ_API_KEY,
  openrouter: process.env.LLM_API_KEY, // legacy env var
};

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const serviceClient = createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    message: string;
    conversationId?: string;
    compressionEnabled?: boolean;
    compressionLevel?: CompressionLevel;
    modelId?: string;
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
    modelId,
  } = body;

  if (!message?.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  // ── Resolve model ─────────────────────────────────────────────────────────
  const effectiveModelId = modelId ?? process.env.LLM_MODEL ?? "gpt-4o-mini";

  const { data: modelRow } = await supabase
    .from("models")
    .select("*")
    .eq("id", effectiveModelId)
    .single();

  // Fallback to env vars if model not found in DB
  const provider = modelRow?.provider ?? "openrouter";
  const baseUrl = modelRow?.base_url ?? (process.env.LLM_API_BASE_URL ?? "https://openrouter.ai/api/v1");
  const pricePerMillion = modelRow?.input_cost_per_1k != null
    ? modelRow.input_cost_per_1k * 1000
    : parseFloat(process.env.LLM_PRICE_PER_MILLION_TOKENS ?? "1.0");

  // ── Resolve API key (quota check → BYOK fallback) ─────────────────────────
  let apiKey: string | null = null;
  let keySource: "platform" | "user" = "platform";

  const quotaExhausted = await isPlatformQuotaExhausted(serviceClient, provider);

  if (!quotaExhausted) {
    apiKey = PLATFORM_KEYS[provider] ?? null;
    keySource = "platform";
  }

  if (!apiKey || quotaExhausted) {
    // Try user's own key
    const userKey = await decryptUserKey(serviceClient, user.id, provider);
    if (userKey) {
      apiKey = userKey;
      keySource = "user";
    } else if (quotaExhausted) {
      return NextResponse.json(
        {
          error: `Platform quota reached for ${provider}. Add your own API key in Settings to continue.`,
          code: "QUOTA_EXCEEDED",
        },
        { status: 402 }
      );
    }
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: `No API key configured for provider: ${provider}` },
      { status: 502 }
    );
  }

  // ── Ensure conversation ────────────────────────────────────────────────────
  let convId = conversationId;
  let isNewConversation = false;

  if (!convId) {
    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title: null, default_model_id: effectiveModelId })
      .select("id")
      .single();

    if (convErr || !conv) {
      return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
    }
    convId = conv.id;
    isNewConversation = true;
  }

  // ── Check if this is the first message (for auto-title) ───────────────────
  const { count: existingMsgCount } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", convId);

  const shouldAutoTitle = isNewConversation || (existingMsgCount ?? 0) === 0;

  // ── Fetch conversation history ─────────────────────────────────────────────
  const { data: history } = await supabase
    .from("messages")
    .select("role, compressed_content, original_content")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: true })
    .limit(20);

  // ── Input compression ──────────────────────────────────────────────────────
  const compressionResult = compressionEnabled
    ? compressInput(message, compressionLevel)
    : {
        original: message,
        compressed: message,
        rawTokens: countTokens(message),
        compressedTokens: countTokens(message),
        basis: "inferred" as const,
      };

  // ── Persist user message ───────────────────────────────────────────────────
  const { data: userMsg } = await supabase
    .from("messages")
    .insert({
      conversation_id: convId,
      role: "user",
      original_content: compressionResult.original,
      compressed_content: compressionResult.compressed,
      raw_tokens: compressionResult.rawTokens,
      compressed_tokens: compressionResult.compressedTokens,
      tokens_saved: Math.max(0, compressionResult.rawTokens - compressionResult.compressedTokens),
      compression_level: compressionEnabled ? compressionLevel : "none",
      model_id: effectiveModelId,
      key_source: keySource,
    })
    .select("id")
    .single();

  // ── Build LLM messages ─────────────────────────────────────────────────────
  const systemPrompt = compressionEnabled
    ? getCompressionSystemPrompt(compressionLevel)
    : UNCOMPRESSED_SYSTEM_PROMPT;

  const llmMessages: LLMMessage[] = [
    { role: "system", content: systemPrompt },
    ...(history ?? []).map((m) => ({
      role: m.role as "user" | "assistant",
      content:
        (compressionEnabled ? m.compressed_content : m.original_content) ??
        m.original_content ?? "",
    })),
    { role: "user", content: compressionResult.compressed },
  ];

  // ── Call provider ──────────────────────────────────────────────────────────
  let providerResponse: Response;
  try {
    if (provider === "anthropic") {
      providerResponse = await callAnthropic(apiKey, effectiveModelId, llmMessages);
    } else {
      providerResponse = await callOpenAICompat(baseUrl, apiKey, effectiveModelId, llmMessages);
    }
  } catch (err) {
    return NextResponse.json({ error: "Provider API unreachable", detail: String(err) }, { status: 502 });
  }

  if (!providerResponse.ok) {
    const errText = await providerResponse.text();
    return NextResponse.json(
      { error: "Provider API error", detail: errText },
      { status: providerResponse.status }
    );
  }

  // ── Stream + collect ───────────────────────────────────────────────────────
  const encoder = new TextEncoder();
  let assistantContent = "";
  let promptTokensUsed = 0;
  let completionTokensUsed = 0;
  const responseBody = providerResponse.body!;

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ conversationId: convId, type: "meta" })}\n\n`
        )
      );

      const parser =
        provider === "anthropic"
          ? parseAnthropicStream(responseBody)
          : parseOpenAIStream(responseBody);

      try {
        for await (const chunk of parser) {
          if (chunk.usage) {
            promptTokensUsed = chunk.usage.prompt_tokens;
            completionTokensUsed = chunk.usage.completion_tokens;
          }
          if (chunk.delta) {
            assistantContent += chunk.delta;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ delta: chunk.delta, type: "token" })}\n\n`
              )
            );
          }
        }
      } catch {
        // stream read error — close gracefully
      }

      // ── Post-stream DB writes ───────────────────────────────────────────
      const rawAssistantTokens = countTokens(assistantContent);
      const actualCompletionTokens = completionTokensUsed > 0 ? completionTokensUsed : rawAssistantTokens;
      const totalTokensThisRequest = (promptTokensUsed > 0 ? promptTokensUsed : compressionResult.compressedTokens) + actualCompletionTokens;

      await supabase.from("messages").insert({
        conversation_id: convId!,
        role: "assistant",
        original_content: null,
        compressed_content: assistantContent,
        raw_tokens: rawAssistantTokens,
        compressed_tokens: actualCompletionTokens,
        tokens_saved: 0,
        compression_level: compressionEnabled ? compressionLevel : "none",
        model_id: effectiveModelId,
        key_source: keySource,
      });

      // Savings
      const inputSavings = computeSavings(compressionResult.rawTokens, compressionResult.compressedTokens);
      const totalSaved = inputSavings.saved;
      const costSaved = estimateCost(totalSaved, pricePerMillion);

      await supabase.from("usage_logs").insert({
        user_id: user.id,
        conversation_id: convId,
        tokens_saved: totalSaved,
        cost_saved_usd: costSaved,
      });

      // Increment platform usage
      if (keySource === "platform") {
        await incrementPlatformUsage(serviceClient, provider, totalTokensThisRequest);
      }

      // Auto-generate title on first message
      if (shouldAutoTitle && message.trim()) {
        const autoTitle = makeTitle(message);
        await supabase
          .from("conversations")
          .update({ title: autoTitle })
          .eq("id", convId!)
          .is("title", null);
      }

      // Final stats event
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
            keySource,
            basis: "inferred",
          })}\n\n`
        )
      );

      controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
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
