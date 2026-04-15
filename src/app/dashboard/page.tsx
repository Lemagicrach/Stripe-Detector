"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, TrendingUp, Sparkles, ArrowRight, RefreshCw, Zap, FileText } from "lucide-react";
import { MonthlyRevenueCard } from "@/components/reports/MonthlyRevenueCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { MonthlyRevenueHealthReport } from "@/types/reports";

type Leak = {
  id: string;
  title: string;
  severity: string;
  lost_revenue: number;
  recoverable_revenue: number;
};

type PulseData = {
  leakScore: number;
  mrr: number;
  totalLost: number;
  totalRecoverable: number;
  topLeaks: Leak[];
  hasConnection: boolean;
  latestMonthlyReport: MonthlyRevenueHealthReport | null;
};

type ReportsPreview = {
  reports?: MonthlyRevenueHealthReport[];
};

function HealthRing({ score }: { score: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const filled = circumference * (score / 100);
  const color = score >= 70 ? "#10B981" : score >= 40 ? "#F59E0B" : "#EF4444";
  const label = score >= 70 ? "Healthy" : score >= 40 ? "At Risk" : "Critical";
  const labelColor = score >= 70 ? "text-emerald-400" : score >= 40 ? "text-amber-400" : "text-red-400";
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-36 w-36">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#1E293B" strokeWidth="10" />
          <circle
            cx="60" cy="60" r={radius} fill="none"
            stroke={color} strokeWidth="10"
            strokeDasharray={`${filled} ${circumference}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-3xl font-bold text-white">{score}</span>
          <span className="text-xs text-gray-400">/ 100</span>
        </div>
      </div>
      <span className={`text-sm font-semibold ${labelColor}`}>{label}</span>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}

const SEVERITY_VARIANT: Record<string, "destructive" | "warning" | "info"> = {
  critical: "destructive",
  warning: "warning",
  info: "info",
};

export default function DashboardHome() {
  const [data, setData] = useState<PulseData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const latestReportPromise = fetch("/api/reports/monthly-health?limit=1", {
          cache: "no-store",
        })
          .then(async (response) => {
            if (!response.ok) return null;
            const payload = (await response.json()) as ReportsPreview;
            return payload.reports?.[0] ?? null;
          })
          .catch(() => null);

        const [metricsRes, leaksRes, latestMonthlyReport] = await Promise.all([
          fetch("/api/metrics", { cache: "no-store" }),
          fetch("/api/leaks/connections", { cache: "no-store" }),
          latestReportPromise,
        ]);
        const metrics = await metricsRes.json();
        const leaks = await leaksRes.json();
        const topLeaks: Leak[] = (leaks.leaks || []).slice(0, 4);
        const totalLost = topLeaks.reduce((s: number, l: Leak) => s + (l.lost_revenue || 0), 0);
        const totalRecoverable = topLeaks.reduce((s: number, l: Leak) => s + (l.recoverable_revenue || 0), 0);
        setData({
          leakScore: leaks.leakScore ?? (metrics.current ? 80 : 0),
          mrr: metrics.current?.mrr ?? 0,
          totalLost,
          totalRecoverable,
          topLeaks,
          hasConnection: !!metrics.current,
          latestMonthlyReport,
        });
      } catch {
        setData({
          leakScore: 0,
          mrr: 0,
          totalLost: 0,
          totalRecoverable: 0,
          topLeaks: [],
          hasConnection: false,
          latestMonthlyReport: null,
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <DashboardSkeleton />;

  if (!data?.hasConnection) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 py-24 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-500/10">
          <Zap className="h-10 w-10 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Connect Stripe to unlock your Revenue Pulse</h1>
          <p className="mt-2 max-w-sm text-gray-400">
            Corvidet needs read-only access to your Stripe account to detect leaks and track MRR.
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/dashboard/connect">
            Connect Stripe <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    );
  }

  const criticalLeaks = data.topLeaks.filter((l) => l.severity === "critical");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Revenue Pulse</h1>
          <p className="mt-1 text-sm text-gray-400">What is draining your MRR right now</p>
        </div>
        <Button variant="outline" asChild size="sm">
          <Link href="/dashboard/leaks">
            <RefreshCw className="h-3.5 w-3.5" /> Run fresh scan
          </Link>
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card className="flex items-center justify-center p-6">
          <HealthRing score={data.leakScore} />
        </Card>

        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">MRR</p>
          <p className="mt-3 font-mono text-3xl font-bold text-white">${data.mrr.toLocaleString()}</p>
          <p className="mt-1 text-xs text-gray-500">Monthly recurring revenue</p>
        </Card>

        <Card className="border-red-900/30 bg-red-500/5 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-red-400">Leaking / mo</p>
          <p className="mt-3 font-mono text-3xl font-bold text-red-300">${data.totalLost.toLocaleString()}</p>
          <p className="mt-1 text-xs text-red-400/60">
            {data.topLeaks.length} active leak{data.topLeaks.length !== 1 ? "s" : ""}
          </p>
        </Card>

        <Card className="border-emerald-900/30 bg-emerald-500/5 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">Recoverable</p>
          <p className="mt-3 font-mono text-3xl font-bold text-emerald-300">${data.totalRecoverable.toLocaleString()}</p>
          <p className="mt-1 text-xs text-emerald-400/60">With quick action today</p>
        </Card>
      </div>

      {data.latestMonthlyReport ? (
        <MonthlyRevenueCard
          report={data.latestMonthlyReport}
          href={`/dashboard/reports/${data.latestMonthlyReport.reportId}`}
        />
      ) : (
        <Card className="border-dashed border-gray-700 bg-gray-900/60">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Monthly revenue health</CardTitle>
              <p className="mt-1 text-sm text-gray-400">
                No stored month-end snapshot yet. Generate one to benchmark churn and payment risk.
              </p>
            </div>
            <Button variant="outline" asChild size="sm">
              <Link href="/dashboard/reports">
                Open reports
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
        </Card>
      )}

      {/* Critical leaks alert */}
      {criticalLeaks.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {criticalLeaks.length} critical issue{criticalLeaks.length > 1 ? "s" : ""} - act today
          </AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-2">
              {criticalLeaks.map((leak) => (
                <div key={leak.id} className="flex items-center justify-between rounded-lg bg-gray-900/60 px-4 py-3">
                  <span className="text-sm text-gray-200">{leak.title}</span>
                  <span className="font-mono text-sm font-semibold text-red-300">
                    -{`$${leak.lost_revenue.toLocaleString()}`}/mo
                  </span>
                </div>
              ))}
            </div>
            <Link
              href="/dashboard/leaks"
              className="mt-3 flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              View fix steps <ArrowRight className="h-3 w-3" />
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Leaks table */}
      <Card>
        <CardHeader className="border-b border-gray-800 px-5 py-4 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Active Revenue Leaks</CardTitle>
          <Link href="/dashboard/leaks" className="text-xs text-blue-400 hover:text-blue-300">
            See all
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {data.topLeaks.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400">
              No leaks on record.{" "}
              <Link href="/dashboard/leaks" className="text-blue-400 underline">
                Run a scan
              </Link>{" "}
              to analyse your Stripe account.
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {data.topLeaks.map((leak) => (
                <div key={leak.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={SEVERITY_VARIANT[leak.severity] ?? "info"}>
                        {leak.severity}
                      </Badge>
                      <span className="truncate text-sm font-medium text-gray-100">{leak.title}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-6 text-sm">
                    <div className="text-right">
                      <p className="font-mono font-semibold text-red-300">-${leak.lost_revenue.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">lost/mo</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-semibold text-emerald-300">+${leak.recoverable_revenue.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">recoverable</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { href: "/dashboard/leaks", iconName: "alert", title: "Scan for leaks", sub: "Run full analysis" },
          { href: "/dashboard/metrics", iconName: "trending", title: "View metrics", sub: "MRR, churn, NRR" },
          { href: "/dashboard/reports", iconName: "report", title: "Monthly reports", sub: "Store month-end health" },
          { href: "/dashboard/copilot", iconName: "sparkles", title: "Ask AI Copilot", sub: "Revenue insights" },
        ].map(({ href, iconName, title, sub }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4 hover:border-blue-500/30 hover:bg-gray-800/60 transition-all"
          >
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                iconName === "alert"
                  ? "bg-red-500/10"
                  : iconName === "trending"
                  ? "bg-blue-500/10"
                  : iconName === "report"
                  ? "bg-emerald-500/10"
                  : "bg-purple-500/10"
              }`}
            >
              {iconName === "alert" && <AlertTriangle className="h-5 w-5 text-red-400" />}
              {iconName === "trending" && <TrendingUp className="h-5 w-5 text-blue-400" />}
              {iconName === "report" && <FileText className="h-5 w-5 text-emerald-400" />}
              {iconName === "sparkles" && <Sparkles className="h-5 w-5 text-purple-400" />}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">{title}</p>
              <p className="text-xs text-gray-400">{sub}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-600 group-hover:text-blue-400 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}
