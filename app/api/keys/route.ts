/**
 * GET    /api/keys           — list which providers the user has keys for (no raw keys)
 * POST   /api/keys           — save (encrypt + store) an API key for a provider
 * DELETE /api/keys?provider= — remove a key
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { Provider } from "@/types/database";

const VALID_PROVIDERS: Provider[] = ["openai", "anthropic", "groq", "openrouter", "nvidia"];

export async function GET() {
  const supabase = await createClient();
  const serviceClient = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await (serviceClient as any).rpc("get_user_key_providers", {
    p_user_id: user.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keys: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const serviceClient = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const secret = process.env.KEY_ENCRYPTION_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Server not configured for BYOK (KEY_ENCRYPTION_SECRET missing)" },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const { provider, apiKey } = body as { provider?: string; apiKey?: string };

  if (!provider || !VALID_PROVIDERS.includes(provider as Provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }
  if (!apiKey?.trim()) {
    return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
  }

  const { error } = await (serviceClient as any).rpc("encrypt_and_store_api_key", {
    p_user_id: user.id,
    p_provider: provider,
    p_raw_key: apiKey.trim(),
    p_secret: secret,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const serviceClient = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider");

  if (!provider || !VALID_PROVIDERS.includes(provider as Provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const { error } = await (serviceClient as any)
    .from("user_api_keys")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", provider);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
