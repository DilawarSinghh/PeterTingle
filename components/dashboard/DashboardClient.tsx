"use client";

import Link from "next/link";
import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TimePoint {
  date: string;
  tokens_saved: number;
  cost_saved: number;
}

interface CompressionBreakdown {
  level: string;
  count: number;
}

interface ModelBreakdown {
  model_id: string;
  count: number;
  tokens_saved: number;
}

interface RecentConversation {
  id: string;
  title: string | null;
  updated_at: string;
  tokens_saved: number;
}

interface Props {
  data: {
    totalTokensSaved: number;
    totalCostSaved: number;
    messageCount: number;
    timeSeries: TimePoint[];
    compressionBreakdown: CompressionBreakdown[];
    modelBreakdown: ModelBreakdown[];
    recentConversations: RecentConversation[];
  };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BRAND_COLORS = ["#c026d3", "#9333ea", "#7c3aed", "#6d28d9", "#5b21b6", "#4c1d95"];
const LEVEL_COLORS: Record<string, string> = {
  lite: "#a78bfa",
  full: "#c026d3",
  ultra: "#7c3aed",
  none: "#d1d5db",
};
const LEVEL_LABELS: Record<string, string> = {
  lite: "Lite",
  full: "Full",
  ultra: "Ultra",
  none: "Off",
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

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`card p-5 ${accent ? "border-brand-200 bg-brand-50" : ""}`}>
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? "text-brand-700" : "text-gray-900"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DashboardClient({ data }: Props) {
  const {
    totalTokensSaved,
    totalCostSaved,
    messageCount,
    timeSeries,
    compressionBreakdown,
    modelBreakdown,
    recentConversations,
  } = data;

  const avgPerMsg = messageCount > 0 ? Math.round(totalTokensSaved / messageCount) : 0;

  const pieData = compressionBreakdown.map((d) => ({
    name: LEVEL_LABELS[d.level] ?? d.level,
    value: d.count,
    color: LEVEL_COLORS[d.level] ?? "#d1d5db",
  }));

  // Shorten model IDs for display
  const modelChartData = modelBreakdown.slice(0, 8).map((m) => ({
    name: m.model_id.includes("/") ? m.model_id.split("/").pop()! : m.model_id,
    messages: m.count,
    tokens_saved: m.tokens_saved,
  }));

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-5xl space-y-8">

        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Lifetime token savings.{" "}
            <span className="italic text-gray-400">All counts are inferred — offline BPE estimates.</span>
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Tokens saved"
            value={fmt(totalTokensSaved)}
            sub="lifetime · inferred"
            accent
          />
          <StatCard
            label="Est. cost saved"
            value={`$${totalCostSaved.toFixed(4)}`}
            sub="inferred · list-price only"
          />
          <StatCard
            label="Messages sent"
            value={fmt(messageCount)}
          />
          <StatCard
            label="Avg saved / msg"
            value={fmt(avgPerMsg)}
            sub="tokens"
          />
        </div>

        {/* Tokens saved over time */}
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">
            Tokens saved — last 30 days
          </h2>
          {timeSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={timeSeries}>
                <defs>
                  <linearGradient id="tokenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c026d3" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#c026d3" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} width={50} />
                <Tooltip
                  formatter={(v: number) => [fmt(v), "tokens saved"]}
                  labelFormatter={(l) => `Date: ${l}`}
                />
                <Area type="monotone" dataKey="tokens_saved" stroke="#c026d3" strokeWidth={2} fill="url(#tokenGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-32 items-center justify-center text-sm text-gray-400">
              No data yet — send some messages to see savings here.
            </div>
          )}
        </div>

        {/* Compression breakdown + Model breakdown (side by side) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* Compression level pie */}
          <div className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-gray-700">Messages by compression level</h2>
            {pieData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={70} strokeWidth={0}>
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [fmt(v), "messages"]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 text-xs">
                  {pieData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                      <span className="text-gray-600">{d.name}</span>
                      <span className="font-semibold text-gray-900">{fmt(d.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center text-sm text-gray-400">No data yet</div>
            )}
          </div>

          {/* Model usage bar */}
          <div className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-gray-700">Messages by model</h2>
            {modelChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={modelChartData} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                  <Tooltip formatter={(v: number) => [fmt(v), "messages"]} />
                  <Bar dataKey="messages" radius={[0, 4, 4, 0]}>
                    {modelChartData.map((_, i) => (
                      <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-32 items-center justify-center text-sm text-gray-400">No data yet</div>
            )}
          </div>
        </div>

        {/* Model tokens saved bar */}
        {modelChartData.some((m) => m.tokens_saved > 0) && (
          <div className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-gray-700">Tokens saved by model</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={modelChartData} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                <Tooltip formatter={(v: number) => [fmt(v), "tokens saved"]} />
                <Bar dataKey="tokens_saved" radius={[0, 4, 4, 0]}>
                  {modelChartData.map((_, i) => (
                    <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recent conversations table */}
        <div className="card overflow-hidden">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-700">Recent conversations</h2>
          </div>
          {recentConversations.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {recentConversations.map((conv) => (
                <Link
                  key={conv.id}
                  href="/chat"
                  className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800">
                      {conv.title || "Untitled chat"}
                    </p>
                    <p className="text-xs text-gray-400">{relativeTime(conv.updated_at)}</p>
                  </div>
                  <div className="ml-4 shrink-0 text-right">
                    {conv.tokens_saved > 0 && (
                      <span className="savings-badge">
                        ⛏ {fmt(conv.tokens_saved)} saved
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              No conversations yet
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400">
          All savings are offline BPE estimates (inferred), not provider invoices.
        </p>
      </div>
    </div>
  );
}
