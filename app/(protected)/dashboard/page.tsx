import { createClient } from "@/lib/supabase/server";
import DashboardClient from "@/components/dashboard/DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // ── Fetch all data in parallel ────────────────────────────────────────────
  const [logsRes, convsRes, recentConvsRes] = await Promise.all([
    supabase
      .from("usage_logs")
      .select("tokens_saved, cost_saved_usd, created_at")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("conversations")
      .select("id")
      .eq("user_id", user!.id),
    supabase
      .from("conversations")
      .select("id, title, updated_at, created_at")
      .eq("user_id", user!.id)
      .order("updated_at", { ascending: false })
      .limit(10),
  ]);

  const convIds = (convsRes.data ?? []).map((c: { id: string }) => c.id);

  // Message count + compression breakdown + model breakdown (parallel)
  const [msgCountRes, compressionRes, modelRes] = await Promise.all([
    convIds.length
      ? supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .in("conversation_id", convIds)
      : Promise.resolve({ count: 0 }),

    convIds.length
      ? supabase
          .from("messages")
          .select("compression_level")
          .in("conversation_id", convIds)
          .not("compression_level", "is", null)
      : Promise.resolve({ data: [] }),

    convIds.length
      ? supabase
          .from("messages")
          .select("model_id, tokens_saved")
          .in("conversation_id", convIds)
          .eq("role", "assistant")
          .not("model_id", "is", null)
      : Promise.resolve({ data: [] }),
  ]);

  // Recent conversations with per-conversation token savings
  const recentConvData = await Promise.all(
    (recentConvsRes.data ?? []).map(async (conv) => {
      const { data: convLogs } = await supabase
        .from("usage_logs")
        .select("tokens_saved")
        .eq("conversation_id", conv.id);
      const tokensSaved = (convLogs ?? []).reduce(
        (s: number, r: { tokens_saved: number | null }) => s + (r.tokens_saved ?? 0), 0
      );
      return { ...conv, tokens_saved: tokensSaved };
    })
  );

  const logs = logsRes.data ?? [];

  // ── Summary stats ────────────────────────────────────────────────────────
  const totalTokensSaved = logs.reduce((s, r) => s + (r.tokens_saved ?? 0), 0);
  const totalCostSaved = logs.reduce((s, r) => s + Number(r.cost_saved_usd ?? 0), 0);
  const messageCount = (msgCountRes as { count: number | null }).count ?? 0;

  // ── Time series (last 30 days) ─────────────────────────────────────────
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentLogs = logs.filter(
    (l) => new Date(l.created_at) >= thirtyDaysAgo
  );

  const dailyMap: Record<string, { tokens_saved: number; cost_saved: number }> = {};
  for (const log of recentLogs) {
    const day = log.created_at.slice(0, 10);
    if (!dailyMap[day]) dailyMap[day] = { tokens_saved: 0, cost_saved: 0 };
    dailyMap[day].tokens_saved += log.tokens_saved ?? 0;
    dailyMap[day].cost_saved += Number(log.cost_saved_usd ?? 0);
  }
  const timeSeries = Object.entries(dailyMap).map(([date, v]) => ({
    date,
    tokens_saved: v.tokens_saved,
    cost_saved: parseFloat(v.cost_saved.toFixed(6)),
  }));

  // ── Compression level breakdown ─────────────────────────────────────────
  const levelCounts: Record<string, number> = {};
  for (const m of (compressionRes.data ?? []) as Array<{ compression_level: string | null }>) {
    const lvl = m.compression_level ?? "none";
    levelCounts[lvl] = (levelCounts[lvl] ?? 0) + 1;
  }
  const compressionBreakdown = Object.entries(levelCounts).map(([level, count]) => ({
    level,
    count,
  }));

  // ── Model breakdown ──────────────────────────────────────────────────────
  const modelMap: Record<string, { count: number; tokens_saved: number }> = {};
  for (const m of (modelRes.data ?? []) as Array<{ model_id: string | null; tokens_saved: number | null }>) {
    const mid = m.model_id ?? "unknown";
    if (!modelMap[mid]) modelMap[mid] = { count: 0, tokens_saved: 0 };
    modelMap[mid].count += 1;
    modelMap[mid].tokens_saved += m.tokens_saved ?? 0;
  }
  const modelBreakdown = Object.entries(modelMap)
    .map(([model_id, v]) => ({ model_id, ...v }))
    .sort((a, b) => b.count - a.count);

  return (
    <DashboardClient
      data={{
        totalTokensSaved,
        totalCostSaved: parseFloat(totalCostSaved.toFixed(6)),
        messageCount,
        timeSeries,
        compressionBreakdown,
        modelBreakdown,
        recentConversations: recentConvData,
      }}
    />
  );
}
