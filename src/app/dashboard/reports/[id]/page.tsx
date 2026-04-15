"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, FileDown, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatDeltaPercent,
  formatReportCurrency,
  formatReportPercent,
  getHealthBadgeVariant,
} from "@/lib/report-format";
import type { MonthlyRevenueHealthReport } from "@/types/reports";

export default function DashboardReportDetailPage() {
  const params = useParams<{ id: string }>();
  const reportId = typeof params.id === "string" ? params.id : "";
  const [report, setReport] = useState<MonthlyRevenueHealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!reportId) {
      setErrorMessage("Invalid report identifier.");
      setLoading(false);
      return;
    }

    fetch(`/api/reports/monthly-health/${encodeURIComponent(reportId)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          report?: MonthlyRevenueHealthReport;
          error?: string;
        };
        if (!response.ok || !payload.report) {
          throw new Error(payload.error ?? "Failed to load report");
        }
        setReport(payload.report);
      })
      .catch((error) =>
        setErrorMessage(error instanceof Error ? error.message : "Failed to load report")
      )
      .finally(() => setLoading(false));
  }, [reportId]);

  async function handleSendEmail() {
    setIsSending(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const response = await fetch("/api/notifications/send-monthly-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_id: reportId }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to send email");
      }
      setStatusMessage("Monthly report emailed.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to send email");
    } finally {
      setIsSending(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-44 rounded-lg bg-gray-800" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-28 rounded-xl bg-gray-800" />
          ))}
        </div>
        <div className="h-60 rounded-xl bg-gray-800" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild size="sm">
          <Link href="/dashboard/reports">
            <ArrowLeft />
            Back to reports
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Report unavailable</CardTitle>
            <CardDescription>{errorMessage ?? "The requested report could not be loaded."}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Button variant="ghost" asChild size="sm" className="-ml-2 mb-3">
            <Link href="/dashboard/reports">
              <ArrowLeft />
              Back to reports
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{report.period}</h1>
            <Badge variant={getHealthBadgeVariant(report.healthStatus)}>{report.healthStatus}</Badge>
          </div>
          <p className="mt-1 text-sm text-gray-400">
            {report.accountName ?? report.stripeAccountId} | Period {report.periodStart} to {report.periodEnd}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void handleSendEmail()} disabled={isSending}>
            <Mail />
            {isSending ? "Sending..." : "Email report"}
          </Button>
          <Button variant="outline" asChild>
            <a href={`/api/export/investor-dashboard?report_id=${encodeURIComponent(report.reportId)}`}>
              <FileDown />
              Export CSV
            </a>
          </Button>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      {statusMessage && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {statusMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total revenue</CardDescription>
            <CardTitle className="font-mono text-3xl">
              {formatReportCurrency(report.totalRevenue, report.currency)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500">
              {formatDeltaPercent(report.revenueChangePercent)} vs previous stored month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Failed payments</CardDescription>
            <CardTitle className="font-mono text-3xl">
              {formatReportCurrency(report.failedPaymentsAmount, report.currency)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500">
              {report.failedPaymentsCount} unresolved invoice{report.failedPaymentsCount === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Recovered revenue</CardDescription>
            <CardTitle className="font-mono text-3xl">
              {formatReportCurrency(report.recoveredRevenue, report.currency)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500">Recovered after at least one failed retry</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Churn rate</CardDescription>
            <CardTitle className="font-mono text-3xl">{formatReportPercent(report.churnRate)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500">
              {report.canceledSubscriptions.toLocaleString()} cancellations across the period
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Operational summary</CardTitle>
            <CardDescription>Monthly health metrics persisted for this account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4">
                <p className="text-xs uppercase tracking-wider text-gray-500">Currency</p>
                <p className="mt-2 text-lg font-semibold text-white uppercase">{report.currency}</p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4">
                <p className="text-xs uppercase tracking-wider text-gray-500">Active subscriptions</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {report.activeSubscriptions.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4">
                <p className="text-xs uppercase tracking-wider text-gray-500">Canceled subscriptions</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {report.canceledSubscriptions.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4">
                <p className="text-xs uppercase tracking-wider text-gray-500">Created</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {report.createdAt
                    ? new Date(report.createdAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "Unknown"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Health interpretation</CardTitle>
            <CardDescription>How Corvidet classified this month.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-300">
            <p>
              Health status combines churn pressure with unresolved failed-payment exposure.
            </p>
            <p>
              A month moves to risk when churn exceeds 8% or failed invoices exceed 10% of captured revenue.
            </p>
            <p>
              Moderate covers the middle band so you can intervene before leakage becomes structural.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
