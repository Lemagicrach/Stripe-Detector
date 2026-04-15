"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, FileDown, Mail, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatDeltaPercent,
  formatReportCurrency,
  formatReportPercent,
  getHealthBadgeVariant,
} from "@/lib/report-format";
import type { ActiveStripeConnection, MonthlyRevenueHealthReport } from "@/types/reports";

type ReportsResponse = {
  reports: MonthlyRevenueHealthReport[];
  connections: ActiveStripeConnection[];
  recommendedPeriod: {
    startDate: string;
    endDate: string;
    label: string;
  };
};

function ReportSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-52 rounded-lg bg-gray-800" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-28 rounded-xl bg-gray-800" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-gray-800" />
    </div>
  );
}

export default function DashboardReportsPage() {
  const [data, setData] = useState<ReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [sendingReportId, setSendingReportId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function loadReports(connectionId?: string) {
    const query = connectionId ? `?connection_id=${encodeURIComponent(connectionId)}` : "";
    const response = await fetch(`/api/reports/monthly-health${query}`, { cache: "no-store" });
    const payload = (await response.json()) as ReportsResponse & { error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to load reports");
    }
    setData(payload);
  }

  useEffect(() => {
    loadReports()
      .catch((error) => setErrorMessage(error instanceof Error ? error.message : "Failed to load reports"))
      .finally(() => setLoading(false));
  }, []);

  async function handleGenerate() {
    setIsGenerating(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const response = await fetch("/api/reports/monthly-health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connection_id: selectedConnectionId || undefined,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        generatedCount?: number;
        period?: { startDate: string; endDate: string };
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to generate report");
      }

      if (payload.generatedCount) {
        setStatusMessage(
          payload.generatedCount === 1
            ? "Monthly report generated."
            : `${payload.generatedCount} monthly reports generated across active connections.`
        );
      }

      await loadReports(selectedConnectionId || undefined);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to generate report");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSend(reportId: string) {
    setSendingReportId(reportId);
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
      setSendingReportId(null);
    }
  }

  async function handleConnectionChange(connectionId: string) {
    setSelectedConnectionId(connectionId);
    setLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await loadReports(connectionId || undefined);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <ReportSkeleton />;
  }

  const reports = data?.reports ?? [];
  const latest = reports[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Monthly Revenue Health</h1>
          <p className="mt-1 text-sm text-gray-400">
            Store a month-end revenue snapshot, review churn pressure, and email the report on demand.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={selectedConnectionId}
            onChange={(event) => void handleConnectionChange(event.target.value)}
            className="h-10 rounded-md border border-gray-700 bg-gray-900 px-3 text-sm text-gray-200 outline-none"
          >
            <option value="">All active connections</option>
            {(data?.connections ?? []).map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.accountName ?? connection.stripeAccountId}
              </option>
            ))}
          </select>
          <Button onClick={handleGenerate} disabled={isGenerating}>
            <RefreshCw className={isGenerating ? "animate-spin" : ""} />
            {isGenerating
              ? "Generating..."
              : `Generate ${data?.recommendedPeriod.label ?? "previous month"} report`}
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

      {latest ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Latest revenue captured</CardDescription>
              <CardTitle className="font-mono text-3xl">
                {formatReportCurrency(latest.totalRevenue, latest.currency)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-400">
                {latest.period} for {latest.accountName ?? "your active Stripe account"}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Revenue delta {formatDeltaPercent(latest.revenueChangePercent)} vs previous stored month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Failed payment exposure</CardDescription>
              <CardTitle className="font-mono text-3xl">
                {formatReportCurrency(latest.failedPaymentsAmount, latest.currency)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-400">
                {latest.failedPaymentsCount} unresolved invoice
                {latest.failedPaymentsCount === 1 ? "" : "s"}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {formatReportCurrency(latest.recoveredRevenue, latest.currency)} recovered after retries
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Account health</CardDescription>
              <div className="flex items-center gap-3">
                <CardTitle className="text-3xl capitalize">{latest.healthStatus}</CardTitle>
                <Badge variant={getHealthBadgeVariant(latest.healthStatus)}>
                  {formatReportPercent(latest.churnRate)} churn
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-400">
                {latest.activeSubscriptions.toLocaleString()} active subscriptions at month end
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {latest.canceledSubscriptions.toLocaleString()} canceled within the period
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="border-dashed border-gray-700 bg-gray-900/60">
          <CardHeader>
            <CardTitle>No monthly reports yet</CardTitle>
            <CardDescription>
              Generate the first report to create a month-end benchmark for connected Stripe accounts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? "Generating..." : "Generate previous month report"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-gray-800">
          <div>
            <CardTitle>Report history</CardTitle>
            <CardDescription>Stored month-end reports for your connected Stripe accounts.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {reports.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-gray-400">
              Nothing stored yet. Generate the recommended period to seed your history.
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {reports.map((report) => (
                <div
                  key={report.reportId}
                  className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-white">{report.period}</p>
                      <Badge variant={getHealthBadgeVariant(report.healthStatus)}>
                        {report.healthStatus}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-gray-400">
                      {report.accountName ?? report.stripeAccountId}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Revenue {formatReportCurrency(report.totalRevenue, report.currency)} | Failed payments{" "}
                      {formatReportCurrency(report.failedPaymentsAmount, report.currency)} | Recovered{" "}
                      {formatReportCurrency(report.recoveredRevenue, report.currency)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/reports/${report.reportId}`}>
                        View report <ArrowRight />
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleSend(report.reportId)}
                      disabled={sendingReportId === report.reportId}
                    >
                      <Mail />
                      {sendingReportId === report.reportId ? "Sending..." : "Email"}
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <a
                        href={`/api/export/investor-dashboard?report_id=${encodeURIComponent(
                          report.reportId
                        )}`}
                      >
                        <FileDown />
                        Export CSV
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
