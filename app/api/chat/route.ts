/**
 * POST /api/chat
 *
 * Flow:
 * 1. Auth-guard
 * 2. Parse body — includes modelId
 * 3. Look up model row → provider + base_url
 * 4. Resolve API key: platform quota check → BYOK fallback
 * 5. Input compression (local estimate for "original" baseline only)
 * 6. Build provider-specific request (OpenAI-compat, Anthropic, NVIDIA NIM)
 * 7. Stream response via SSE
 * 8. Use provider-reported usage.tokens for actuals (NOT local estimate)
 * 9. Persist messages + usage_logs, auto-title conversation
 *
 * Token accuracy:
 *  - tokens_actual (raw_tokens, compressed_tokens) = provider usage object
 *  - tokens_original (what we would have sent without compression) = local tiktoken estimate
 *  - Savings = tokens_original_input - tokens_actual_input (actual provider cost reduction)
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
import { getModelCost } from "@/lib/model-cost-overrides";
import type { CompressionLevel } from "@/types/database";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTitle(text: string, maxLen = 40): string {
  return text
    .replace(/[#*`_~\[\]()>!]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

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

async function isPlatformQuotaExhausted(
  serviceClient: ReturnType<typeof createServiceClient>,
  provider: string
): Promise<boolean> {
  const { data } = await (serviceClient as any)
    .from("platform_usage")
    .select("tokens_used, monthly_quota")
    .eq("provider", provider)
    .single();
  if (!data) return false;
  return data.tokens_used >= data.monthly_quota;
}

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

/** OpenAI-compatible (OpenAI, Groq, OpenRouter, NVIDIA NIM) */
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

/** Anthropic /v1/messages — different shape */
async function callAnthropic(
  apiKey: string,
  model: string,
  messages: LLMMessage[]
): Promise<Response> {
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

// ── SSE parsers — each yields real provider usage ─────────────────────────────

interface StreamChunk {
  delta?: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

async function* parseOpenAIStream(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamChunk> {
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
          // Provider-reported real usage (comes in final chunk with include_usage)
          if (parsed.usage) {
            yield {
              usage: {
                prompt_tokens: parsed.usage.prompt_tokens ?? 0,
                completion_tokens: parsed.usage.completion_tokens ?? 0,
              },
            };
          }
          const delta = parsed.choices?.[0]?.delta?.content ?? "";
          if (delta) yield { delta };
        } catch { /* skip malformed */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function* parseAnthropicStream(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamChunk> {
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
        if (!line.startsWith("data: ")) continue;
        try {
          const parsed = JSON.parse(line.slice(6));
          if (parsed.type === "content_block_delta") {
            yield { delta: parsed.delta?.text ?? "" };
          }
          // Real token counts from Anthropic
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
  } finally {
    reader.releaseLock();
  }
}

// ── Platform API key map ──────────────────────────────────────────────────────

/** Placeholder values like "<your-openai-api-key>" must be treated as unset. */
function validKey(key: string | undefined): string | undefined {
  if (!key) return undefined;
  const trimmed = key.trim();
  if (!trimmed || trimmed.startsWith("<") || trimmed.length < 10) return undefined;
  return trimmed;
}

const PLATFORM_KEYS: Record<string, string | undefined> = {
  openai:     validKey(process.env.OPENAI_API_KEY),
  anthropic:  validKey(process.env.ANTHROPIC_API_KEY),
  groq:       validKey(process.env.GROQ_API_KEY),
  nvidia:     validKey(process.env.NVIDIA_NIM_API_KEY),
  openrouter: validKey(process.env.LLM_API_KEY),
};

const PROVIDER_BASE_URLS: Record<string, string> = {
  openai:     "https://api.openai.com/v1",
  groq:       "https://api.groq.com/openai/v1",
  nvidia:     "https://integrate.api.nvidia.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
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

  // ── Resolve model ──────────────────────────────────────────────────────────
  const effectiveModelId = modelId ?? process.env.LLM_MODEL ?? "gpt-4o-mini";

  const { data: modelRow } = await supabase
    .from("models")
    .select("*")
    .eq("id", effectiveModelId)
    .single();

  if (!modelRow) {
    return NextResponse.json(
      { error: `Unknown model: ${effectiveModelId}. Pick a model from the selector.` },
      { status: 400 }
    );
  }
  if (!modelRow.is_active) {
    return NextResponse.json(
      { error: `Model ${effectiveModelId} is no longer available. Pick another model.` },
      { status: 400 }
    );
  }

  const provider = modelRow.provider ?? "openrouter";
  const baseUrl =
    modelRow?.base_url ??
    PROVIDER_BASE_URLS[provider] ??
    (process.env.LLM_API_BASE_URL ?? "https://openrouter.ai/api/v1");

  // Cost: prefer DB row, fall back to override map, then env var
  const costOverride = getModelCost(effectiveModelId);
  const pricePerMillion =
    (modelRow?.input_cost_per_1k ?? costOverride?.input_cost_per_1k ?? null) != null
      ? (modelRow?.input_cost_per_1k ?? costOverride!.input_cost_per_1k) * 1000
      : parseFloat(process.env.LLM_PRICE_PER_MILLION_TOKENS ?? "1.0");
  const costKnown =
    (modelRow?.input_cost_per_1k ?? costOverride?.input_cost_per_1k) != null;

  // ── Resolve API key ────────────────────────────────────────────────────────
  let apiKey: string | null = null;
  let keySource: "platform" | "user" = "platform";

  const quotaExhausted = await isPlatformQuotaExhausted(serviceClient, provider);

  if (!quotaExhausted) {
    apiKey = PLATFORM_KEYS[provider] ?? null;
    keySource = "platform";
  }

  if (!apiKey || quotaExhausted) {
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
      {
        error: `No API key configured for ${provider}. Add one in Settings → API keys, or pick a model from a configured provider.`,
        code: "NO_KEY",
      },
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

  // Auto-title check
  const { count: existingMsgCount } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", convId);
  const shouldAutoTitle = isNewConversation || (existingMsgCount ?? 0) === 0;

  // ── Fetch history ──────────────────────────────────────────────────────────
  const { data: history } = await supabase
    .from("messages")
    .select("role, compressed_content, original_content")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: true })
    .limit(20);

  // ── Compression ───────────────────────────────────────────────────────────
  // tokens_original = local estimate (hypothetical "without compression" baseline)
  const originalTokenCount = countTokens(message); // always a local estimate — labeled as such

  const compressionResult = compressionEnabled
    ? compressInput(message, compressionLevel)
    : {
        original: message,
        compressed: message,
        rawTokens: originalTokenCount,
        compressedTokens: originalTokenCount,
        basis: "inferred" as const,
      };

  // ── Persist user message (placeholder — actual token counts updated after stream) ──
  const { data: userMsg } = await supabase
    .from("messages")
    .insert({
      conversation_id: convId,
      role: "user",
      original_content: compressionResult.original,
      compressed_content: compressionResult.compressed,
      // raw_tokens = original (local estimate, the "would have been" baseline)
      raw_tokens: compressionResult.rawTokens,
      // compressed_tokens will be updated to actual after provider reports usage
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
    providerResponse =
      provider === "anthropic"
        ? await callAnthropic(apiKey, effectiveModelId, llmMessages)
        : await callOpenAICompat(baseUrl, apiKey, effectiveModelId, llmMessages);
  } catch (err) {
    return NextResponse.json(
      { error: "Provider API unreachable", detail: String(err) },
      { status: 502 }
    );
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
  // These will be set from provider's real usage object
  let actualPromptTokens = 0;
  let actualCompletionTokens = 0;
  let usageReceivedFromProvider = false;
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
            // Real provider-reported token counts — use these, not local estimates
            actualPromptTokens = chunk.usage.prompt_tokens;
            actualCompletionTokens = chunk.usage.completion_tokens;
            usageReceivedFromProvider = true;
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

      // ── Post-stream: use real token counts where available ───────────────
      // Fallback to local estimate only if provider didn't report usage
      const finalPromptTokens = usageReceivedFromProvider
        ? actualPromptTokens
        : compressionResult.compressedTokens; // local estimate fallback

      const finalCompletionTokens = usageReceivedFromProvider
        ? actualCompletionTokens
        : countTokens(assistantContent); // local estimate fallback

      const totalTokensThisRequest = finalPromptTokens + finalCompletionTokens;

      // Savings: original (local estimate) vs actual sent (real provider count)
      // This is the true cost reduction from compression
      const inputSavings = computeSavings(
        compressionResult.rawTokens, // local estimate of original (hypothetical)
        finalPromptTokens            // real tokens actually sent to provider
      );

      const costSaved = costKnown
        ? estimateCost(inputSavings.saved, pricePerMillion)
        : 0;

      // Persist assistant message with real token counts
      await supabase.from("messages").insert({
        conversation_id: convId!,
        role: "assistant",
        original_content: null,
        compressed_content: assistantContent,
        raw_tokens: finalCompletionTokens,   // real provider output tokens
        compressed_tokens: finalCompletionTokens,
        tokens_saved: inputSavings.saved,
        compression_level: compressionEnabled ? compressionLevel : "none",
        model_id: effectiveModelId,
        key_source: keySource,
      });

      // Update user message's compressed_tokens with real provider prompt tokens
      if (userMsg?.id && usageReceivedFromProvider) {
        await supabase
          .from("messages")
          .update({ compressed_tokens: finalPromptTokens })
          .eq("id", userMsg.id);
      }

      // Log savings
      await supabase.from("usage_logs").insert({
        user_id: user.id,
        conversation_id: convId,
        tokens_saved: inputSavings.saved,
        cost_saved_usd: costSaved,
      });

      // Increment platform usage with real token count
      if (keySource === "platform") {
        await incrementPlatformUsage(serviceClient, provider, totalTokensThisRequest);
      }

      // Auto-title on first message
      if (shouldAutoTitle && message.trim()) {
        await supabase
          .from("conversations")
          .update({ title: makeTitle(message) })
          .eq("id", convId!)
          .is("title", null);
      }

      // Final stats SSE event
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: "stats",
            userMsgId: userMsg?.id,
            // Original (hypothetical) — local estimate
            inputOriginalTokens: compressionResult.rawTokens,
            // Actual sent — real provider usage (or fallback estimate)
            inputActualTokens: finalPromptTokens,
            inputTokensSaved: inputSavings.saved,
            inputPctSaved: inputSavings.pctSaved,
            // Output — real provider usage (or fallback estimate)
            outputActualTokens: finalCompletionTokens,
            totalTokensSaved: inputSavings.saved,
            costSavedUsd: costSaved,
            costKnown,
            keySource,
            usageFromProvider: usageReceivedFromProvider,
            basis: usageReceivedFromProvider ? "provider" : "inferred",
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
