import { createClient } from "@/lib/supabase/server";
import DashboardClient from "@/components/dashboard/DashboardClient";

const PRECISION = 6;

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const uid = user!.id;

  // ── Fetch conversation IDs (once, reused) ─────────────────────────────────
  const { data: convs } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_id", uid);
  const convIds = (convs ?? []).map((c) => c.id);

  // ── Aggregates from usage_logs (one row per user message) ─────────────────
  // tokens_saved = input-compression savings (real measure of value)
  const { data: logs } = await supabase
    .from("usage_logs")
    .select("tokens_saved, cost_saved_usd, created_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: true });

  const totalTokensSaved = (logs ?? []).reduce((s, r) => s + (r.tokens_saved ?? 0), 0);
  const totalCostSaved = (logs ?? []).reduce((s, r) => s + Number(r.cost_saved_usd ?? 0), 0);

  // ── Count user messages (compressed) — count of rows in usage_logs ────────
  const compressedCount = logs?.length ?? 0;

  // ── Count only user messages (all, including uncompressed) ────────────────
  let totalUserMsgCount = 0;
  if (convIds.length) {
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", convIds)
      .eq("role", "user");
    totalUserMsgCount = count ?? 0;
  }

  // ── Compression breakdown (user messages only) ────────────────────────────
  let compressionRaw: Array<{ compression_level: string | null }> = [];
  if (convIds.length) {
    const { data } = await supabase
      .from("messages")
      .select("compression_level")
      .in("conversation_id", convIds)
      .eq("role", "user")
      .not("compression_level", "is", null);
    compressionRaw = data ?? [];
  }
  const levelCounts: Record<string, number> = {};
  for (const m of compressionRaw) {
    const lvl = m.compression_level ?? "none";
    levelCounts[lvl] = (levelCounts[lvl] ?? 0) + 1;
  }
  const compressionBreakdown = Object.entries(levelCounts).map(([level, count]) => ({ level, count }));

  // ── Model breakdown (assistant messages only) ─────────────────────────────
  let modelRaw: Array<{ model_id: string | null; tokens_saved: number | null }> = [];
  if (convIds.length) {
    const { data } = await supabase
      .from("messages")
      .select("model_id, tokens_saved")
      .in("conversation_id", convIds)
      .eq("role", "assistant")
      .not("model_id", "is", null);
    modelRaw = data ?? [];
  }
  const modelMap: Record<string, { count: number; tokens_saved: number }> = {};
  for (const m of modelRaw) {
    const mid = m.model_id ?? "unknown";
    if (!modelMap[mid]) modelMap[mid] = { count: 0, tokens_saved: 0 };
    modelMap[mid].count += 1;
    modelMap[mid].tokens_saved += m.tokens_saved ?? 0;
  }
  const modelBreakdown = Object.entries(modelMap)
    .map(([model_id, v]) => ({ model_id, ...v }))
    .sort((a, b) => b.count - a.count);

  // ── Time series (from usage_logs — last 30 days) ─────────────────────────
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentLogs = (logs ?? []).filter((l) => new Date(l.created_at) >= thirtyDaysAgo);

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
    cost_saved: parseFloat(v.cost_saved.toFixed(PRECISION)),
  }));

  // ── Recent conversations (avoid N+1 — batch query usage_logs) ────────────
  const { data: recentConvs } = await supabase
    .from("conversations")
    .select("id, title, updated_at")
    .eq("user_id", uid)
    .order("updated_at", { ascending: false })
    .limit(10);

  // Batch load all usage_logs for these conversations
  const recentIds = (recentConvs ?? []).map((c) => c.id);
  let convLogsMap: Record<string, number> = {};
  if (recentIds.length > 0) {
    const { data: batchLogs } = await supabase
      .from("usage_logs")
      .select("conversation_id, tokens_saved")
      .in("conversation_id", recentIds);
    for (const log of batchLogs ?? []) {
      convLogsMap[log.conversation_id] = (convLogsMap[log.conversation_id] ?? 0) + (log.tokens_saved ?? 0);
    }
  }

  const recentConversations = (recentConvs ?? []).map((conv) => ({
    ...conv,
    tokens_saved: convLogsMap[conv.id] ?? 0,
  }));

  // ── Output savings-focused metrics ────────────────────────────────────────
  const avgSavedPerUserMsg = compressedCount > 0
    ? Math.round(totalTokensSaved / compressedCount)
    : 0;

  return (
    <DashboardClient
      data={{
        totalTokensSaved,
        totalCostSaved: parseFloat(totalCostSaved.toFixed(PRECISION)),
        userMessageCount: totalUserMsgCount,
        compressedMessageCount: compressedCount,
        avgSavedPerUserMsg,
        timeSeries,
        compressionBreakdown,
        modelBreakdown,
        recentConversations,
      }}
    />
  );
}
