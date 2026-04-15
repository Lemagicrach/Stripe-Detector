import { NextRequest, NextResponse } from "next/server";
import { getMonthlyReportById } from "@/lib/monthly-reports";
import {
  formatDeltaPercent,
  formatReportCurrency,
  formatReportPercent,
  sanitizeCsvCell,
} from "@/lib/report-format";
import { badRequest, handleApiError, unauthorized } from "@/lib/server-error";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return unauthorized();

    const reportId = request.nextUrl.searchParams.get("report_id");
    if (!reportId) {
      return badRequest("report_id is required");
    }

    const report = await getMonthlyReportById(user.id, reportId);
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const rows: Array<[string, string, string | number]> = [
      ["section", "metric", "value"],
      ["summary", "period_label", report.period],
      ["summary", "period_start", report.periodStart],
      ["summary", "period_end", report.periodEnd],
      ["summary", "created_at", report.createdAt ?? ""],
      ["summary", "account_name", report.accountName ?? "Unnamed Stripe account"],
      ["summary", "stripe_account_id", report.stripeAccountId],
      ["summary", "currency", report.currency],
      ["summary", "total_revenue", report.totalRevenue],
      ["summary", "failed_payments_count", report.failedPaymentsCount],
      ["summary", "failed_payments_amount", report.failedPaymentsAmount],
      ["summary", "recovered_revenue", report.recoveredRevenue],
      ["summary", "active_subscriptions", report.activeSubscriptions],
      ["summary", "canceled_subscriptions", report.canceledSubscriptions],
      ["summary", "churn_rate_ratio", report.churnRate],
      ["summary", "revenue_change_percent", report.revenueChangePercent],
      ["summary", "health_status", report.healthStatus],
      ["display", "total_revenue", formatReportCurrency(report.totalRevenue, report.currency)],
      [
        "display",
        "failed_payments_amount",
        formatReportCurrency(report.failedPaymentsAmount, report.currency),
      ],
      [
        "display",
        "recovered_revenue",
        formatReportCurrency(report.recoveredRevenue, report.currency),
      ],
      ["display", "churn_rate", formatReportPercent(report.churnRate)],
      ["display", "revenue_change", formatDeltaPercent(report.revenueChangePercent)],
    ];

    for (const [key, value] of Object.entries(report.reportPayload)) {
      rows.push([
        "payload",
        key,
        typeof value === "string" || typeof value === "number" ? value : JSON.stringify(value),
      ]);
    }

    const csv = rows.map((row) => row.map(sanitizeCsvCell).join(",")).join("\n");
    const filename = `investor-dashboard-${report.periodStart}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleApiError(error, "MONTHLY_REPORT_EXPORT");
  }
}
