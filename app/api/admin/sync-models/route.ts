/**
 * POST /api/admin/sync-models
 *
 * Fetches live model lists from Groq and NVIDIA NIM, upserts into the models
 * table, and marks disappeared models inactive.
 *
 * Access control:
 *  - Vercel Cron calls this with the CRON_SECRET in the Authorization header
 *  - Admin users (email in ADMIN_EMAILS env var) can also trigger it manually
 *
 * Called daily by Vercel Cron (see vercel.json).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncProviderModels } from "@/lib/models-sync";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function isCronRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

async function isAdminUser(request: NextRequest): Promise<boolean> {
  if (ADMIN_EMAILS.length === 0) return false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return false;
    return ADMIN_EMAILS.includes(user.email.toLowerCase());
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  // Allow Vercel Cron or admin users
  const fromCron = isCronRequest(request);
  const fromAdmin = !fromCron && await isAdminUser(request);

  if (!fromCron && !fromAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const results = await syncProviderModels();
    const summary = results.map((r) => ({
      provider: r.provider,
      fetched: r.fetched,
      upserted: r.upserted,
      deactivated: r.deactivated,
      ...(r.error ? { error: r.error } : {}),
    }));

    console.log("[sync-models] Sync complete:", JSON.stringify(summary));
    return NextResponse.json({ ok: true, results: summary });
  } catch (err) {
    console.error("[sync-models] Sync failed:", err);
    return NextResponse.json(
      { error: "Sync failed", detail: String(err) },
      { status: 500 }
    );
  }
}

// Allow GET for Vercel Cron (some cron configs use GET)
export async function GET(request: NextRequest) {
  return POST(request);
}
