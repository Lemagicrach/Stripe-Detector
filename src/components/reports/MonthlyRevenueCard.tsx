import Link from "next/link";
import { ArrowRight } from "lucide-react";
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

export function MonthlyRevenueCard({
  report,
  href = "/dashboard/reports",
}: {
  report: MonthlyRevenueHealthReport;
  href?: string;
}) {
  return (
    <Card className="border-blue-500/20 bg-gradient-to-br from-blue-950/30 via-gray-900 to-gray-950">
      <CardHeader className="flex flex-col gap-4 border-b border-gray-800/80 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardDescription>Latest monthly revenue health snapshot</CardDescription>
          <CardTitle className="mt-1 text-2xl text-white">{report.period}</CardTitle>
          <p className="mt-2 text-sm text-gray-400">
            {report.accountName ?? report.stripeAccountId}
          </p>
        </div>
        <Badge variant={getHealthBadgeVariant(report.healthStatus)} className="capitalize">
          {report.healthStatus}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
            <p className="text-xs uppercase tracking-wider text-gray-500">Revenue captured</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {formatReportCurrency(report.totalRevenue, report.currency)}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {formatDeltaPercent(report.revenueChangePercent)} vs previous stored month
            </p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
            <p className="text-xs uppercase tracking-wider text-gray-500">Failed exposure</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {formatReportCurrency(report.failedPaymentsAmount, report.currency)}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {report.failedPaymentsCount} unresolved invoice
              {report.failedPaymentsCount === 1 ? "" : "s"}
            </p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
            <p className="text-xs uppercase tracking-wider text-gray-500">Recovered revenue</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {formatReportCurrency(report.recoveredRevenue, report.currency)}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {formatReportPercent(report.churnRate)} churn across the period
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 text-sm text-gray-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {report.activeSubscriptions.toLocaleString()} active subscriptions and{" "}
            {report.canceledSubscriptions.toLocaleString()} cancellations in the stored month.
          </p>
          <Button variant="outline" asChild>
            <Link href={href}>
              Review reports
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
