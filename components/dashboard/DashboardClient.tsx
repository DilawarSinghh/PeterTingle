"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface TimePoint {
  date: string;
  tokens_saved: number;
  cost_saved: number;
}

interface Props {
  initialData: {
    totalTokensSaved: number;
    totalCostSaved: number;
    messageCount: number;
    timeSeries: TimePoint[];
    basis: "inferred";
  };
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="card p-5">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export default function DashboardClient({ initialData }: Props) {
  const { totalTokensSaved, totalCostSaved, messageCount, timeSeries } = initialData;

  const avgSavedPerMsg =
    messageCount > 0 ? Math.round(totalTokensSaved / messageCount) : 0;

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Lifetime token savings.{" "}
            <span className="italic text-gray-400">All counts inferred — offline BPE estimates.</span>
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Tokens saved"
            value={totalTokensSaved.toLocaleString()}
            sub="inferred"
          />
          <StatCard
            label="Est. cost saved"
            value={`$${totalCostSaved.toFixed(4)}`}
            sub="inferred · list-price only"
          />
          <StatCard
            label="Messages sent"
            value={messageCount.toLocaleString()}
          />
          <StatCard
            label="Avg saved / msg"
            value={avgSavedPerMsg.toLocaleString()}
            sub="tokens"
          />
        </div>

        {/* Token savings chart */}
        {timeSeries.length > 0 ? (
          <div className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-gray-700">
              Tokens saved per day
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={timeSeries}>
                <defs>
                  <linearGradient id="tokenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c026d3" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#c026d3" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(d) => d.slice(5)} // MM-DD
                />
                <YAxis tick={{ fontSize: 11 }} width={50} />
                <Tooltip
                  formatter={(v: number) => [v.toLocaleString(), "tokens saved"]}
                  labelFormatter={(l) => `Date: ${l}`}
                />
                <Area
                  type="monotone"
                  dataKey="tokens_saved"
                  stroke="#c026d3"
                  strokeWidth={2}
                  fill="url(#tokenGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="card flex items-center justify-center p-10 text-sm text-gray-500">
            No data yet — send some messages to see savings here.
          </div>
        )}

        {/* Cost chart */}
        {timeSeries.length > 0 && (
          <div className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-gray-700">
              Est. cost saved per day ($) <span className="font-normal text-gray-400 text-xs">inferred</span>
            </h2>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={timeSeries}>
                <defs>
                  <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(d) => d.slice(5)}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  width={60}
                  tickFormatter={(v) => `$${v.toFixed(4)}`}
                />
                <Tooltip
                  formatter={(v: number) => [`$${v.toFixed(5)}`, "est. cost saved"]}
                  labelFormatter={(l) => `Date: ${l}`}
                />
                <Area
                  type="monotone"
                  dataKey="cost_saved"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#costGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        <p className="text-center text-xs text-gray-400">
          Savings are offline BPE estimates (inferred), not provider invoices.
          Verify with your actual billing dashboard.
        </p>
      </div>
    </div>
  );
}
