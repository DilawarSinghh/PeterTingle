/**
 * POST /api/auth/nfc-login
 * Body: { nfc_tag_id: string }
 *
 * Looks up the card in nfc_credentials, then (via the service role)
 * mints a one-time magic-link token for the bound user. The client redeems
 * it with supabase.auth.verifyOtp({ type: "magiclink", token_hash }) which
 * establishes a normal session — existing email/password auth, middleware
 * and cookie handling are untouched.
 *
 * Security: service-role key never leaves the server; route is rate limited
 * (5 attempts / IP / minute); every attempt is logged to nfc_login_logs.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// ── In-memory rate limiter (per server instance) ───────────────────────────
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;
const attempts = new Map<string, { count: number; reset: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.reset) {
    attempts.set(ip, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

// Opportunistic cleanup so the map does not grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of attempts) if (now > entry.reset) attempts.delete(ip);
}, WINDOW_MS).unref?.();

function clientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  const ip = clientIP(request);

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Wait a minute and try again." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const nfcTagId = typeof body.nfc_tag_id === "string" ? body.nfc_tag_id.trim() : "";

  if (!nfcTagId || nfcTagId.length > 64) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const service = createServiceClient();

  // ── 1. Look up the card ──────────────────────────────────────────────────
  const { data: cred, error: lookupError } = await (service as any)
    .from("nfc_credentials")
    .select("user_id")
    .eq("nfc_tag_id", nfcTagId)
    .maybeSingle();

  if (lookupError) {
    console.error("[nfc-login] lookup failed:", lookupError.message);
    return NextResponse.json({ error: "Login failed. Try again." }, { status: 500 });
  }

  // Audit log (best-effort — never blocks login)
  await (service as any)
    .from("nfc_login_logs")
    .insert({ nfc_tag_id: nfcTagId, user_id: cred?.user_id ?? null, ip, success: !!cred })
    .then(() => undefined, (e: unknown) => console.error("[nfc-login] audit log failed:", e));

  if (!cred?.user_id) {
    // Generic error — do not reveal whether the tag exists.
    return NextResponse.json({ error: "Card not recognized" }, { status: 401 });
  }

  // ── 2. Resolve the user's email (service role) ───────────────────────────
  const { data: userData, error: userError } = await (service as any).auth.admin.getUserById(cred.user_id);
  if (userError || !userData?.user?.email) {
    console.error("[nfc-login] user lookup failed:", userError?.message ?? "no email");
    return NextResponse.json({ error: "Login failed. Try again." }, { status: 500 });
  }

  // ── 3. Mint a one-time magic-link token (NOT sent by email — admin API) ──
  const { data: linkData, error: linkError } = await (service as any).auth.admin.generateLink({
    type: "magiclink",
    email: userData.user.email,
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    console.error("[nfc-login] generateLink failed:", linkError?.message);
    return NextResponse.json({ error: "Login failed. Try again." }, { status: 500 });
  }

  // ── 4. Update last_used_at ──────────────────────────────────────────────
  await (service as any)
    .from("nfc_credentials")
    .update({ last_used_at: new Date().toISOString() })
    .eq("nfc_tag_id", nfcTagId)
    .then(() => undefined, (e: unknown) => console.error("[nfc-login] last_used_at update failed:", e));

  console.log(`[nfc-login] success user=${cred.user_id} ip=${ip}`);

  // Client redeems this with verifyOtp() to establish a real session.
  return NextResponse.json({
    token: linkData.properties.hashed_token,
    expiresAt: linkData.properties.expires_at ?? null,
  });
}
