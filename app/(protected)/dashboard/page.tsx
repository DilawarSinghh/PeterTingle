import { createClient } from "@/lib/supabase/server";
import DashboardClient from "@/components/dashboard/DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fallback: fetch directly via supabase
  const { data: lifetimeLogs } = await supabase
    .from("usage_logs")
    .select("tokens_saved, cost_saved_usd, created_at")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: true });

  // Fetch conversation IDs for this user, then count messages
  const { data: userConvs } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_id", user!.id);

  const convIds = (userConvs ?? []).map((c: { id: string }) => c.id);

  const { count: messageCount } = convIds.length
    ? await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .in("conversation_id", convIds)
    : { count: 0 };

  const logs = lifetimeLogs ?? [];
  const totalTokensSaved = logs.reduce((s, r) => s + (r.tokens_saved ?? 0), 0);
  const totalCostSaved = logs.reduce(
    (s, r) => s + Number(r.cost_saved_usd ?? 0),
    0
  );

  // Build daily buckets
  const dailyMap: Record<string, { tokens_saved: number; cost_saved: number }> = {};
  for (const log of logs) {
    const day = log.created_at.slice(0, 10);
    if (!dailyMap[day]) dailyMap[day] = { tokens_saved: 0, cost_saved: 0 };
    dailyMap[day].tokens_saved += log.tokens_saved ?? 0;
    dailyMap[day].cost_saved += Number(log.cost_saved_usd ?? 0);
  }

  const timeSeries = Object.entries(dailyMap).map(([date, vals]) => ({
    date,
    tokens_saved: vals.tokens_saved,
    cost_saved: parseFloat(vals.cost_saved.toFixed(6)),
  }));

  return (
    <DashboardClient
      initialData={{
        totalTokensSaved,
        totalCostSaved: parseFloat(totalCostSaved.toFixed(6)),
        messageCount: messageCount ?? 0,
        timeSeries,
        basis: "inferred" as const,
      }}
    />
  );
}
