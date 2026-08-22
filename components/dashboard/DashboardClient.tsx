"use client";

import Link from "next/link";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

interface TimePoint { date: string; tokens_saved: number; cost_saved: number; }
interface CompressionBreakdown { level: string; count: number; }
interface ModelBreakdown { model_id: string; count: number; tokens_saved: number; }
interface RecentConversation { id: string; title: string | null; updated_at: string; tokens_saved: number; }

interface Props {
  data: {
    totalTokensSaved: number;
    totalCostSaved: number;
    userMessageCount: number;
    compressedMessageCount: number;
    avgSavedPerUserMsg: number;
    timeSeries: TimePoint[];
    compressionBreakdown: CompressionBreakdown[];
    modelBreakdown: ModelBreakdown[];
    recentConversations: RecentConversation[];
  };
}

const ACCENT        = "#22c55e";
const ACCENT_DIM    = "#14532d";
const SURFACE       = "#111a14";
const SURFACE_3     = "#1e2b1f";
const TEXT_SEC      = "#6b8f72";

const CHART_COLORS  = ["#22c55e", "#16a34a", "#15803d", "#166534", "#14532d", "#4ade80", "#86efac", "#bbf7d0"];

const LEVEL_COLORS: Record<string, string> = { lite: "#4ade80", full: "#22c55e", ultra: "#16a34a", none: SURFACE_3 };
const LEVEL_LABELS: Record<string, string> = { lite: "Lite", full: "Full", ultra: "Ultra", none: "Off" };

const TOOLTIP_STYLE = {
  backgroundColor: SURFACE, border: `1px solid ${SURFACE_3}`,
  borderRadius: 8, color: "#e8f5e9", fontSize: 11,
};

function fmt(n: number) { return n.toLocaleString(); }

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`card p-5 ${accent ? "border-accent-muted bg-accent-dim" : ""}`}>
      <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? "text-accent" : "text-text-primary"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-text-muted">{sub}</p>}
    </div>
  );
}

function EmptyChart({ text }: { text?: string }) {
  return (
    <div className="flex h-32 items-center justify-center text-sm text-text-muted">
      {text ?? "No data yet — send messages to see stats."}
    </div>
  );
}

export default function DashboardClient({ data }: Props) {
  const {
    totalTokensSaved, totalCostSaved, userMessageCount, compressedMessageCount,
    avgSavedPerUserMsg, timeSeries, compressionBreakdown, modelBreakdown, recentConversations,
  } = data;

  const hasSavings = totalTokensSaved > 0;
  const hasBreakdowns = compressionBreakdown.length > 0 || modelBreakdown.length > 0;

  const pieData = compressionBreakdown.map((d) => ({
    name: LEVEL_LABELS[d.level] ?? d.level,
    value: d.count,
    color: LEVEL_COLORS[d.level] ?? SURFACE_3,
  }));

  const modelChartData = modelBreakdown.slice(0, 8).map((m) => ({
    name: m.model_id.includes("/") ? m.model_id.split("/").pop()! : m.model_id,
    messages: m.count,
    tokens_saved: m.tokens_saved,
  }));

  return (
    <div className="h-full overflow-y-auto px-6 py-6 bg-background">
      <div className="mx-auto max-w-5xl space-y-6">

        {/* Title — savings-focused narrative */}
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {hasSavings
              ? `You have saved ${fmt(totalTokensSaved)} tokens across ${fmt(userMessageCount)} messages.`
              : "Send your first message to start tracking savings."}
            <span className="ml-1 italic text-text-muted">Token counts are BPE estimates.</span>
          </p>
        </div>

        {/* Summary cards — savings-first */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Tokens saved" value={fmt(totalTokensSaved)} sub="lifetime · from input compression" accent />
          <StatCard label="Est. cost saved" value={`$${totalCostSaved.toFixed(4)}`} sub="list-price estimate" />
          <StatCard label="Messages compressed" value={fmt(compressedMessageCount)} sub={`of ${fmt(userMessageCount)} total`} />
          <StatCard label="Avg saved / msg" value={fmt(avgSavedPerUserMsg)} sub="tokens per compressed message" />
        </div>

        {/* Time series */}
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Tokens saved — last 30 days</h2>
          {timeSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={timeSeries}>
                <defs>
                  <linearGradient id="tokenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ACCENT} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={SURFACE_3} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: TEXT_SEC }} tickFormatter={(d) => d.slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: TEXT_SEC }} width={50} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [fmt(v), "tokens saved"]} labelFormatter={(l) => `Date: ${l}`} />
                <Area type="monotone" dataKey="tokens_saved" stroke={ACCENT} strokeWidth={2} fill="url(#tokenGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyChart text="Send messages with compression to start seeing savings over time." />}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-text-primary">Messages by compression level</h2>
            {pieData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={70} strokeWidth={0}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [fmt(v), "messages"]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 text-xs">
                  {pieData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                      <span className="text-text-secondary">{d.name}</span>
                      <span className="font-semibold text-text-primary">{fmt(d.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <EmptyChart />}
          </div>

          <div className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-text-primary">Messages by model</h2>
            {modelChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={modelChartData} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={SURFACE_3} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: TEXT_SEC }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: TEXT_SEC }} width={90} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [fmt(v), "messages"]} />
                  <Bar dataKey="messages" radius={[0, 4, 4, 0]}>
                    {modelChartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </div>

        {/* Tokens saved per model */}
        {modelChartData.some((m) => m.tokens_saved > 0) && (
          <div className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-text-primary">Tokens saved by model</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={modelChartData} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={SURFACE_3} />
                <XAxis type="number" tick={{ fontSize: 10, fill: TEXT_SEC }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: TEXT_SEC }} width={90} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [fmt(v), "tokens saved"]} />
                <Bar dataKey="tokens_saved" radius={[0, 4, 4, 0]}>
                  {modelChartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recent conversations */}
        <div className="card overflow-hidden">
          <div className="border-b border-surface-3 flex items-center justify-between px-5 py-4">
            <h2 className="text-sm font-semibold text-text-primary">Recent conversations</h2>
            <Link href="/chat" className="text-xs text-accent hover:underline">Open chat →</Link>
          </div>
          {recentConversations.length > 0 ? (
            <div className="divide-y divide-surface-3">
              {recentConversations.map((conv) => (
                <Link key={conv.id} href="/chat" className="flex items-center justify-between px-5 py-3 hover:bg-surface-2 transition-colors">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{conv.title || "Untitled chat"}</p>
                    <p className="text-xs text-text-muted">{relativeTime(conv.updated_at)}</p>
                  </div>
                  <div className="ml-4 shrink-0 text-right">
                    {conv.tokens_saved > 0 && (
                      <span className="savings-badge">⛏ {fmt(conv.tokens_saved)} saved</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="px-5 py-8 text-center text-sm text-text-muted">
              <p className="mb-2">No conversations yet</p>
              <Link href="/chat" className="text-accent hover:underline">Start chatting</Link>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-text-muted">
          Token savings are estimated using BPE encoding. Actual provider costs may vary.
        </p>
      </div>
    </div>
  );
}
