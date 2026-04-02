"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp, TrendingDown, Users, Activity } from "lucide-react";

type Snapshot = {
  snapshot_date: string;
  mrr: number;
  active_customers: number;
  churn_rate: number;
  nrr: number;
  arpu: number;
};

type MetricsResponse = {
  current: Snapshot | null;
  history: Snapshot[];
  changes: { mrrChange: number; churnChange: number };
};

function StatCard({
  label, value, change, changeLabel, icon, accentClass,
}: {
  label: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  accentClass: string;
}) {
  const up = (change ?? 0) >= 0;
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-gray-400">{label}</p>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accentClass}`}>
          {icon}
        </div>
      </div>
      <p className="mt-3 font-mono text-3xl font-bold text-white">{value}</p>
      {change !== undefined && (
        <p className={`mt-2 flex items-center gap-1 text-xs ${up ? "text-emerald-400" : "text-red-400"}`}>
          {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {Math.abs(change).toFixed(1)}{changeLabel} vs prev period
        </p>
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm shadow-xl">
      <p className="text-gray-400">{label}</p>
      <p className="font-mono font-semibold text-white">${payload[0].value.toLocaleString()}</p>
    </div>
  );
};

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/metrics", { cache: "no-store" })
      .then(r => r.json())
      .then(setMetrics)
      .catch(() => setMetrics(null))
      .finally(() => setLoading(false));
  }, []);

  const cur = metrics?.current;
  const chartData = (metrics?.history ?? []).map(s => ({
    date: new Date(s.snapshot_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    mrr: s.mrr,
    customers: s.active_customers,
  }));

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 rounded-lg bg-gray-800" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          {[0,1,2,3].map(i => <div key={i} className="h-28 rounded-xl bg-gray-800" />)}
        </div>
        <div className="h-72 rounded-xl bg-gray-800" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Revenue Metrics</h1>
        <p className="mt-1 text-sm text-gray-400">MRR trends and subscription health</p>
      </div>

      {!cur ? (
        <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/50 py-16 text-center">
          <Activity className="mx-auto h-10 w-10 text-gray-600" />
          <p className="mt-3 text-sm text-gray-400">No metrics yet.</p>
          <p className="mt-1 text-xs text-gray-500">Connect Stripe and run a scan to populate your metrics.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="MRR" value={`$${cur.mrr.toLocaleString()}`}
              change={metrics?.changes.mrrChange} changeLabel="%"
              icon={<TrendingUp className="h-4 w-4 text-blue-400" />} accentClass="bg-blue-500/10"
            />
            <StatCard
              label="ARR" value={`$${(cur.mrr * 12).toLocaleString()}`}
              icon={<TrendingUp className="h-4 w-4 text-blue-400" />} accentClass="bg-blue-500/10"
            />
            <StatCard
              label="Active Customers" value={cur.active_customers.toLocaleString()}
              icon={<Users className="h-4 w-4 text-emerald-400" />} accentClass="bg-emerald-500/10"
            />
            <StatCard
              label="Churn Rate" value={`${(cur.churn_rate * 100).toFixed(2)}%`}
              change={metrics?.changes.churnChange} changeLabel="pp"
              icon={<TrendingDown className="h-4 w-4 text-red-400" />} accentClass="bg-red-500/10"
            />
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">MRR Trend</p>
                <p className="text-xs text-gray-400">Last {chartData.length} snapshots</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-xs text-gray-400">MRR</span>
              </div>
            </div>
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis dataKey="date" tick={{ fill: "#6B7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#6B7280", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="mrr" stroke="#3B82F6" strokeWidth={2} fill="url(#mrrGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-64 items-center justify-center text-sm text-gray-500">
                Not enough data yet â€” run more scans to build trend history.
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">NRR</p>
              <p className="mt-2 font-mono text-2xl font-bold text-white">{(cur.nrr * 100).toFixed(1)}%</p>
              <p className="mt-1 text-xs text-gray-500">Net revenue retention â€” above 100% means expansion</p>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">ARPU</p>
              <p className="mt-2 font-mono text-2xl font-bold text-white">${cur.arpu.toFixed(0)}</p>
              <p className="mt-1 text-xs text-gray-500">Average revenue per active customer</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
