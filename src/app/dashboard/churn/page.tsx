"use client";

import { useEffect, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { AlertTriangle, TrendingDown, Users, DollarSign, Link as LinkIcon } from "lucide-react";
import Link from "next/link";

type AtRiskCustomer = {
  id: string;
  type: "pending_cancel" | "zombie_sub";
  severity: string;
  title: string;
  description: string;
  revenueAtRisk: number;
  recoveryProbability: number;
  detectedAt: string;
};

type ChurnData = {
  churnRate: number;
  atRiskCount: number;
  atRiskMrr: number;
  history: { date: string; churnRate: number }[];
  atRiskCustomers: AtRiskCustomer[];
};

const TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending_cancel: { label: "Pending Cancel", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  zombie_sub:     { label: "Zombie Sub",     color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-red-400",
  warning:  "text-amber-400",
  info:     "text-blue-400",
};

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm shadow-xl">
      <p className="text-gray-400">{label}</p>
      <p className="font-mono font-semibold text-red-300">{payload[0].value}%</p>
    </div>
  );
};

export default function ChurnPage() {
  const [data, setData] = useState<ChurnData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/churn/analyze", { cache: "no-store" })
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-56 rounded-lg bg-gray-800" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[0, 1, 2].map(i => <div key={i} className="h-28 rounded-xl bg-gray-800" />)}
        </div>
        <div className="h-64 rounded-xl bg-gray-800" />
        <div className="h-48 rounded-xl bg-gray-800" />
      </div>
    );
  }

  const noConnection = !data || (data.churnRate === 0 && data.atRiskCount === 0 && data.history.length === 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Churn Predictions</h1>
        <p className="mt-1 text-sm text-gray-400">Identify customers at risk and intervene before they leave</p>
      </div>

      {noConnection ? (
        <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/50 py-16 text-center">
          <TrendingDown className="mx-auto h-10 w-10 text-gray-600" />
          <p className="mt-3 text-sm text-gray-400">No churn data yet.</p>
          <p className="mt-1 text-xs text-gray-500">
            <Link href="/dashboard/connect" className="text-blue-400 underline">Connect Stripe</Link> and run a leak scan to detect at-risk customers.
          </p>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
              <div className="flex items-start justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Current Churn Rate</p>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
                  <TrendingDown className="h-4 w-4 text-red-400" />
                </div>
              </div>
              <p className="mt-3 font-mono text-3xl font-bold text-white">{data.churnRate}%</p>
              <p className="mt-1 text-xs text-gray-500">monthly customer churn</p>
            </div>

            <div className="rounded-xl border border-amber-900/30 bg-amber-500/5 p-5">
              <div className="flex items-start justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-amber-400">At-Risk Customers</p>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                  <Users className="h-4 w-4 text-amber-400" />
                </div>
              </div>
              <p className="mt-3 font-mono text-3xl font-bold text-white">{data.atRiskCount}</p>
              <p className="mt-1 text-xs text-amber-400/60">pending cancels + zombie subs</p>
            </div>

            <div className="rounded-xl border border-red-900/30 bg-red-500/5 p-5">
              <div className="flex items-start justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-red-400">MRR at Risk</p>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
                  <DollarSign className="h-4 w-4 text-red-400" />
                </div>
              </div>
              <p className="mt-3 font-mono text-3xl font-bold text-red-300">${data.atRiskMrr.toLocaleString()}</p>
              <p className="mt-1 text-xs text-red-400/60">revenue at risk this month</p>
            </div>
          </div>

          {/* Churn rate trend chart */}
          {data.history.length > 1 && (
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Churn Rate Trend</p>
                  <p className="text-xs text-gray-400">Last {data.history.length} snapshots</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  <span className="text-xs text-gray-400">Churn %</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={data.history} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="churnGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis dataKey="date" tick={{ fill: "#6B7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#6B7280", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="churnRate" stroke="#EF4444" strokeWidth={2} fill="url(#churnGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* At-risk customer list */}
          {data.atRiskCustomers.length > 0 && (
            <div className="rounded-xl border border-gray-800 bg-gray-900">
              <div className="border-b border-gray-800 px-5 py-4">
                <p className="text-sm font-semibold text-white">At-Risk Customers</p>
                <p className="mt-0.5 text-xs text-gray-400">
                  {data.atRiskCustomers.length} customer{data.atRiskCustomers.length !== 1 ? "s" : ""} need intervention
                </p>
              </div>
              <div className="divide-y divide-gray-800">
                {data.atRiskCustomers.map(c => {
                  const typeStyle = TYPE_LABELS[c.type] ?? TYPE_LABELS.pending_cancel;
                  const sevColor = SEVERITY_COLORS[c.severity] ?? "text-gray-400";
                  return (
                    <div key={c.id} className="flex items-start gap-4 px-5 py-4">
                      <div className="mt-0.5 shrink-0">
                        <AlertTriangle className={`h-4 w-4 ${sevColor}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${typeStyle.bg} ${typeStyle.color}`}>
                            {typeStyle.label}
                          </span>
                          <span className="text-xs text-gray-500">
                            Detected {new Date(c.detectedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-medium text-white">{c.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-gray-400">{c.description}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono text-sm font-semibold text-red-300">${c.revenueAtRisk.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">at risk</p>
                        <p className="mt-1 text-xs text-emerald-400">{Math.round(c.recoveryProbability * 100)}% save rate</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-gray-800 px-5 py-3">
                <Link
                  href="/dashboard/leaks"
                  className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <LinkIcon className="h-3 w-3" />
                  View full leak scanner for fix steps
                </Link>
              </div>
            </div>
          )}

          {data.atRiskCustomers.length === 0 && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 py-10 text-center">
              <p className="font-semibold text-emerald-300">No at-risk customers detected</p>
              <p className="mt-1 text-sm text-gray-400">Run a leak scan to check for pending cancellations and zombie subscriptions.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
