/**
 * POST /api/keys/test — test a user-provided API key against the real provider
 * Body: { provider: string, apiKey: string }
 * Returns: { valid: boolean, error?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { Provider } from "@/types/database";

const VALID_PROVIDERS: Provider[] = ["openai", "anthropic", "groq", "openrouter", "nvidia"];

async function testOpenAICompat(baseUrl: string, apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return { valid: true };
    const text = await res.text().catch(() => "");
    return { valid: false, error: `Status ${res.status}: ${text.slice(0, 120)}` };
  } catch (e) {
    return { valid: false, error: String(e) };
  }
}

async function testAnthropic(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    // Anthropic doesn't have a /models endpoint; fire a minimal 1-token message
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) return { valid: true };
    const data = await res.json().catch(() => ({}));
    return { valid: false, error: data?.error?.message ?? `Status ${res.status}` };
  } catch (e) {
    return { valid: false, error: String(e) };
  }
}

const PROVIDER_BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  groq: "https://api.groq.com/openai/v1",
  openrouter: "https://openrouter.ai/api/v1",
  nvidia: "https://integrate.api.nvidia.com/v1",
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const serviceClient = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { provider, apiKey } = body as { provider?: string; apiKey?: string };

  if (!provider || !VALID_PROVIDERS.includes(provider as Provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }
  if (!apiKey?.trim()) {
    return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
  }

  let result: { valid: boolean; error?: string };

  if (provider === "anthropic") {
    result = await testAnthropic(apiKey.trim());
  } else {
    const baseUrl = PROVIDER_BASE_URLS[provider] ?? "";
    result = await testOpenAICompat(baseUrl, apiKey.trim());
  }

  // If valid, mark as verified in DB (key must already be saved)
  if (result.valid) {
    await (serviceClient as any).rpc("mark_key_verified", {
      p_user_id: user.id,
      p_provider: provider,
    });
  }

  return NextResponse.json(result);
}
