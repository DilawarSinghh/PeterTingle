/**
 * GET /api/usage
 * Returns aggregate and time-series token savings for the authenticated user.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") ?? "30", 10);

  const since = new Date();
  since.setDate(since.getDate() - days);

  // ── Aggregate totals ────────────────────────────────────────────────────
  const { data: totals } = await supabase
    .from("usage_logs")
    .select("tokens_saved, cost_saved_usd")
    .eq("user_id", user.id)
    .gte("created_at", since.toISOString());

  const totalTokensSaved = (totals ?? []).reduce(
    (sum, r) => sum + (r.tokens_saved ?? 0),
    0
  );
  const totalCostSaved = (totals ?? []).reduce(
    (sum, r) => sum + Number(r.cost_saved_usd ?? 0),
    0
  );

  // ── Message count ────────────────────────────────────────────────────────
  const { count: messageCount } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq(
      "conversation_id",
      supabase
        .from("conversations")
        .select("id")
        .eq("user_id", user.id)
    );

  // ── Daily time-series ────────────────────────────────────────────────────
  // Build a day-by-day breakdown from usage_logs
  const { data: logs } = await supabase
    .from("usage_logs")
    .select("tokens_saved, cost_saved_usd, created_at")
    .eq("user_id", user.id)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true });

  // Bucket by date
  const dailyMap: Record<string, { tokens_saved: number; cost_saved: number }> =
    {};

  for (const log of logs ?? []) {
    const day = log.created_at.slice(0, 10); // YYYY-MM-DD
    if (!dailyMap[day]) dailyMap[day] = { tokens_saved: 0, cost_saved: 0 };
    dailyMap[day].tokens_saved += log.tokens_saved ?? 0;
    dailyMap[day].cost_saved += Number(log.cost_saved_usd ?? 0);
  }

  const timeSeries = Object.entries(dailyMap).map(([date, vals]) => ({
    date,
    tokens_saved: vals.tokens_saved,
    cost_saved: parseFloat(vals.cost_saved.toFixed(6)),
  }));

  // ── Lifetime totals (all time) ───────────────────────────────────────────
  const { data: lifetime } = await supabase
    .from("usage_logs")
    .select("tokens_saved, cost_saved_usd")
    .eq("user_id", user.id);

  const lifetimeTokens = (lifetime ?? []).reduce(
    (s, r) => s + (r.tokens_saved ?? 0),
    0
  );
  const lifetimeCost = (lifetime ?? []).reduce(
    (s, r) => s + Number(r.cost_saved_usd ?? 0),
    0
  );

  return NextResponse.json({
    period: { days, since: since.toISOString() },
    totals: {
      tokensSaved: totalTokensSaved,
      costSavedUsd: parseFloat(totalCostSaved.toFixed(6)),
      messageCount: messageCount ?? 0,
      basis: "inferred",
    },
    lifetime: {
      tokensSaved: lifetimeTokens,
      costSavedUsd: parseFloat(lifetimeCost.toFixed(6)),
      basis: "inferred",
    },
    timeSeries,
  });
}
