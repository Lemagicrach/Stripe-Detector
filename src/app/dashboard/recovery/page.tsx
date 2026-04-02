"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import { TrendingUp, CheckCircle, Clock, DollarSign } from "lucide-react";
import Link from "next/link";

type RecoveryEvent = {
  id: string;
  category: string;
  amount: number;
  customer_email: string | null;
  recovered_at: string;
  metadata: Record<string, unknown> | null;
};

type ByType = {
  category: string;
  count: number;
  total: number;
};

type TimelineData = {
  events: RecoveryEvent[];
  totalRecovered: number;
};

type ByTypeData = {
  byType: ByType[];
  totalRecovered: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  failed_payment: "Failed Payment",
  expiring_card:  "Expiring Card",
  pending_cancel: "Saved Cancel",
  zombie_sub:     "Zombie Sub",
  other:          "Other",
};

const BAR_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444"];
const BAR_BG_CLASSES = ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-violet-500", "bg-red-500"];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm shadow-xl">
      <p className="text-gray-400">{CATEGORY_LABELS[label ?? ""] ?? label}</p>
      <p className="font-mono font-semibold text-emerald-300">${payload[0].value.toLocaleString()}</p>
    </div>
  );
};

export default function RecoveryPage() {
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [byType, setByType] = useState<ByTypeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/recoveries/timeline", { cache: "no-store" }).then(r => r.json()),
      fetch("/api/recoveries/by-type",  { cache: "no-store" }).then(r => r.json()),
    ])
      .then(([t, b]) => { setTimeline(t); setByType(b); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-56 rounded-lg bg-gray-800" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[0, 1, 2].map(i => <div key={i} className="h-28 rounded-xl bg-gray-800" />)}
        </div>
        <div className="h-56 rounded-xl bg-gray-800" />
        <div className="h-64 rounded-xl bg-gray-800" />
      </div>
    );
  }

  const totalRecovered = timeline?.totalRecovered ?? 0;
  const events = timeline?.events ?? [];
  const byTypeRows = byType?.byType ?? [];
  const topCategory = byTypeRows[0];
  const noData = events.length === 0 && byTypeRows.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Revenue Recovery</h1>
        <p className="mt-1 text-sm text-gray-400">Track revenue saved from failed payments, cancellations, and more</p>
      </div>

      {noData ? (
        <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/50 py-16 text-center">
          <TrendingUp className="mx-auto h-10 w-10 text-gray-600" />
          <p className="mt-3 text-sm text-gray-400">No recoveries recorded yet.</p>
          <p className="mt-1 text-xs text-gray-500">
            <Link href="/dashboard/leaks" className="text-blue-400 underline">Run a leak scan</Link> â€” recoveries are tracked automatically when leaks are resolved.
          </p>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-900/30 bg-emerald-500/5 p-5">
              <div className="flex items-start justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">Total Recovered</p>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                  <DollarSign className="h-4 w-4 text-emerald-400" />
                </div>
              </div>
              <p className="mt-3 font-mono text-3xl font-bold text-emerald-300">${totalRecovered.toLocaleString()}</p>
              <p className="mt-1 text-xs text-emerald-400/60">all time</p>
            </div>

            <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
              <div className="flex items-start justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Recovery Events</p>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                  <CheckCircle className="h-4 w-4 text-blue-400" />
                </div>
              </div>
              <p className="mt-3 font-mono text-3xl font-bold text-white">{events.length}</p>
              <p className="mt-1 text-xs text-gray-500">successful recoveries</p>
            </div>

            <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
              <div className="flex items-start justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Top Category</p>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                  <TrendingUp className="h-4 w-4 text-blue-400" />
                </div>
              </div>
              <p className="mt-3 text-xl font-bold text-white">
                {topCategory ? (CATEGORY_LABELS[topCategory.category] ?? topCategory.category) : "â€”"}
              </p>
              {topCategory && (
                <p className="mt-1 text-xs text-gray-500">${topCategory.total.toLocaleString()} Â· {topCategory.count} event{topCategory.count !== 1 ? "s" : ""}</p>
              )}
            </div>
          </div>

          {/* Recovery by category bar chart */}
          {byTypeRows.length > 0 && (
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
              <div className="mb-6">
                <p className="text-sm font-semibold text-white">Recovery by Category</p>
                <p className="mt-0.5 text-xs text-gray-400">Total $ recovered per leak type</p>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byTypeRows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                  <XAxis
                    dataKey="category"
                    tick={{ fill: "#6B7280", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => CATEGORY_LABELS[v] ?? v}
                  />
                  <YAxis
                    tick={{ fill: "#6B7280", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                    {byTypeRows.map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Legend */}
              <div className="mt-4 flex flex-wrap gap-4">
                {byTypeRows.map((row, i) => (
                  <div key={row.category} className="flex items-center gap-1.5">
                    <span className={`h-2.5 w-2.5 rounded-full ${BAR_BG_CLASSES[i % BAR_BG_CLASSES.length]}`} />
                    <span className="text-xs text-gray-400">{CATEGORY_LABELS[row.category] ?? row.category}</span>
                    <span className="font-mono text-xs text-white">${row.total.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline table */}
          {events.length > 0 && (
            <div className="rounded-xl border border-gray-800 bg-gray-900">
              <div className="border-b border-gray-800 px-5 py-4">
                <p className="text-sm font-semibold text-white">Recovery Timeline</p>
                <p className="mt-0.5 text-xs text-gray-400">Most recent {events.length} recovery event{events.length !== 1 ? "s" : ""}</p>
              </div>
              <div className="divide-y divide-gray-800">
                {events.map(ev => (
                  <div key={ev.id} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                      <CheckCircle className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">
                        {CATEGORY_LABELS[ev.category] ?? ev.category}
                      </p>
                      {ev.customer_email && (
                        <p className="truncate text-xs text-gray-500">{ev.customer_email}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-sm font-semibold text-emerald-300">
                        +${(ev.amount ?? 0).toLocaleString()}
                      </p>
                      <div className="mt-0.5 flex items-center justify-end gap-1 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        {new Date(ev.recovered_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
