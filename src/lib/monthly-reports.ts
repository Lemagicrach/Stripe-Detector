import Stripe from "stripe";
import { sendEmail } from "@/lib/email";
import { MonthlyHealthReport } from "@/emails/MonthlyHealthReport";
import { buildUnsubscribeUrl } from "@/lib/email-token";
import { withStripeConnect } from "@/lib/stripe-connect";
import {
  formatDeltaPercent,
  formatReportCurrency,
  formatReportPercent,
} from "@/lib/report-format";
import { getSupabaseAdminClient } from "@/lib/server-clients";
import { log } from "@/lib/logger";
import type {
  ActiveStripeConnection,
  GenerateMonthlyRevenueHealthInput,
  MonthlyHealthStatus,
  MonthlyRevenueHealthReport,
} from "@/types/reports";

type ReportRow = {
  id: string;
  connection_id: string;
  user_id: string;
  stripe_account_id: string;
  account_name: string | null;
  period_start: string;
  period_end: string;
  period_label: string;
  currency: string;
  total_revenue: number | string | null;
  failed_payments_count: number | string | null;
  failed_payments_amount: number | string | null;
  recovered_revenue: number | string | null;
  active_subscriptions: number | string | null;
  canceled_subscriptions: number | string | null;
  churn_rate: number | string | null;
  revenue_change_percent: number | string | null;
  health_status: MonthlyHealthStatus;
  report_payload: Record<string, unknown> | null;
  created_at: string | null;
};

type ConnectionRow = {
  id: string;
  user_id: string;
  stripe_account_id: string;
  account_name: string | null;
  encrypted_access_token: string;
};

type InvoiceSummary = {
  currency: string;
  totalRevenue: number;
  failedPaymentsCount: number;
  failedPaymentsAmount: number;
  recoveredRevenue: number;
  invoiceCount: number;
};

type SubscriptionSummary = {
  activeSubscriptions: number;
  canceledSubscriptions: number;
  subscriptionCount: number;
};

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ACTIVE_AT_END_STATUSES = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "paused",
]);
const PUBLIC_REPORT_SELECT =
  "id, connection_id, user_id, stripe_account_id, account_name, period_start, period_end, period_label, currency, total_revenue, failed_payments_count, failed_payments_amount, recovered_revenue, active_subscriptions, canceled_subscriptions, churn_rate, revenue_change_percent, health_status, report_payload, created_at";

function toNumber(value: number | string | null | undefined): number {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundRatio(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function parseIsoDate(value: string) {
  const match = ISO_DATE_RE.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const normalized = new Date(Date.UTC(year, month - 1, day));

  if (
    normalized.getUTCFullYear() !== year ||
    normalized.getUTCMonth() !== month - 1 ||
    normalized.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function assertIsoDate(value: string, label: string) {
  if (!parseIsoDate(value)) {
    throw new Error(`${label} must use YYYY-MM-DD format`);
  }
}

function toUtcDate(dateString: string, endOfDay = false): Date {
  const parts = parseIsoDate(dateString);
  if (!parts) {
    throw new Error(`Invalid date: ${dateString}`);
  }

  return new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0
    )
  );
}

export function formatPeriodLabel(start: Date): string {
  return start.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getPreviousMonthRange(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  return {
    start: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
  };
}

function getReportUrl(reportId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://corvidet.com";
  return `${baseUrl.replace(/\/$/, "")}/dashboard/reports/${reportId}`;
}

function mapReportRow(row: ReportRow): MonthlyRevenueHealthReport {
  return {
    reportId: row.id,
    connectionId: row.connection_id,
    userId: row.user_id,
    stripeAccountId: row.stripe_account_id,
    accountName: row.account_name,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    period: row.period_label,
    currency: row.currency,
    totalRevenue: toNumber(row.total_revenue),
    failedPaymentsCount: Math.round(toNumber(row.failed_payments_count)),
    failedPaymentsAmount: toNumber(row.failed_payments_amount),
    recoveredRevenue: toNumber(row.recovered_revenue),
    activeSubscriptions: Math.round(toNumber(row.active_subscriptions)),
    canceledSubscriptions: Math.round(toNumber(row.canceled_subscriptions)),
    churnRate: toNumber(row.churn_rate),
    revenueChangePercent: toNumber(row.revenue_change_percent),
    healthStatus: row.health_status,
    reportPayload: row.report_payload ?? {},
    createdAt: row.created_at,
  };
}

export async function trackUsageEvent(
  userId: string,
  eventType: string,
  metadata: Record<string, unknown> = {}
) {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("usage_events").insert({
    user_id: userId,
    event_type: eventType,
    metadata,
  });

  if (error) {
    log("error", "Failed to track monthly report event", { eventType, error });
  }
}

async function getActiveConnection(userId: string, connectionId?: string): Promise<ConnectionRow> {
  const admin = getSupabaseAdminClient();
  let query = admin
    .from("stripe_connections")
    .select("id, user_id, stripe_account_id, account_name, encrypted_access_token")
    .eq("user_id", userId)
    .eq("status", "active");

  if (connectionId) {
    query = query.eq("id", connectionId);
  } else {
    query = query.order("created_at", { ascending: true }).limit(1);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(`Failed to load Stripe connection: ${error.message}`);
  }
  if (!data) {
    throw new Error("No active Stripe connection found for this user");
  }

  return data as ConnectionRow;
}

async function listActiveConnectionRows(userId: string): Promise<ConnectionRow[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("stripe_connections")
    .select("id, user_id, stripe_account_id, account_name, encrypted_access_token")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load Stripe connections: ${error.message}`);
  }

  return (data ?? []) as ConnectionRow[];
}

async function listInvoicesForRange(stripe: Stripe, startUnix: number, endUnix: number) {
  const invoices: Stripe.Invoice[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const batch = await stripe.invoices.list({
      limit: 100,
      created: { gte: startUnix, lte: endUnix },
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    invoices.push(...batch.data);
    hasMore = batch.has_more;
    startingAfter = batch.data.at(-1)?.id;
  }

  return invoices;
}

async function listSubscriptions(stripe: Stripe) {
  const subscriptions: Stripe.Subscription[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const batch = await stripe.subscriptions.list({
      limit: 100,
      status: "all",
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    subscriptions.push(...batch.data);
    hasMore = batch.has_more;
    startingAfter = batch.data.at(-1)?.id;
  }

  return subscriptions;
}

function summarizeInvoices(invoices: Stripe.Invoice[]): InvoiceSummary {
  let totalRevenue = 0;
  let failedPaymentsCount = 0;
  let failedPaymentsAmount = 0;
  let recoveredRevenue = 0;
  const currencies = new Set<string>();

  for (const invoice of invoices) {
    const amountPaid = toNumber(invoice.amount_paid) / 100;
    const amountDue = toNumber(invoice.amount_due || invoice.total) / 100;

    if (invoice.currency) {
      currencies.add(invoice.currency.toLowerCase());
    }

    if (invoice.status === "paid") {
      totalRevenue += amountPaid;
      if ((invoice.attempt_count ?? 0) > 1) {
        recoveredRevenue += amountPaid;
      }
    }

    const attempted = invoice.attempted === true;
    const unresolvedFailure =
      invoice.status === "open" || invoice.status === "uncollectible";

    if (attempted && unresolvedFailure) {
      failedPaymentsCount += 1;
      failedPaymentsAmount += amountDue;
    }
  }

  const currency =
    currencies.size === 1 ? Array.from(currencies)[0] : currencies.size > 1 ? "mixed" : "usd";

  return {
    currency,
    totalRevenue: roundCurrency(totalRevenue),
    failedPaymentsCount,
    failedPaymentsAmount: roundCurrency(failedPaymentsAmount),
    recoveredRevenue: roundCurrency(recoveredRevenue),
    invoiceCount: invoices.length,
  };
}

function summarizeSubscriptions(
  subscriptions: Stripe.Subscription[],
  startUnix: number,
  endUnix: number
): SubscriptionSummary {
  let activeSubscriptions = 0;
  let canceledSubscriptions = 0;

  for (const subscription of subscriptions) {
    if (subscription.created > endUnix) {
      continue;
    }

    const canceledAt = subscription.canceled_at ?? null;

    if (canceledAt && canceledAt >= startUnix && canceledAt <= endUnix) {
      canceledSubscriptions += 1;
    }

    const wasActiveAtPeriodEnd =
      (!canceledAt || canceledAt > endUnix) &&
      ACTIVE_AT_END_STATUSES.has(subscription.status);

    if (wasActiveAtPeriodEnd) {
      activeSubscriptions += 1;
    }
  }

  return {
    activeSubscriptions,
    canceledSubscriptions,
    subscriptionCount: subscriptions.length,
  };
}

function determineHealthStatus(params: {
  churnRate: number;
  totalRevenue: number;
  failedPaymentsAmount: number;
  failedPaymentsCount: number;
}): MonthlyHealthStatus {
  const { churnRate, totalRevenue, failedPaymentsAmount, failedPaymentsCount } = params;
  const failedRevenueRatio = totalRevenue > 0 ? failedPaymentsAmount / totalRevenue : 0;

  if (churnRate >= 0.08 || failedRevenueRatio >= 0.1) {
    return "risk";
  }

  if (churnRate >= 0.04 || failedRevenueRatio >= 0.04 || failedPaymentsCount >= 3) {
    return "moderate";
  }

  return "healthy";
}

async function getPreviousRevenue(connectionId: string, periodStart: string): Promise<number> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("monthly_reports")
    .select("total_revenue")
    .eq("connection_id", connectionId)
    .lt("period_end", periodStart)
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    log("error", "Failed to load previous monthly report", { error });
    return 0;
  }

  return toNumber((data as { total_revenue?: number | string } | null)?.total_revenue);
}

export async function listActiveConnections(userId: string): Promise<ActiveStripeConnection[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("stripe_connections")
    .select("id, stripe_account_id, account_name")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load connections: ${error.message}`);
  }

  return ((data ?? []) as Array<{ id: string; stripe_account_id: string; account_name: string | null }>).map(
    (connection) => ({
      id: connection.id,
      stripeAccountId: connection.stripe_account_id,
      accountName: connection.account_name,
    })
  );
}

export async function listMonthlyReports(
  userId: string,
  connectionId?: string,
  limit?: number
): Promise<MonthlyRevenueHealthReport[]> {
  const admin = getSupabaseAdminClient();
  let query = admin
    .from("monthly_reports")
    .select(PUBLIC_REPORT_SELECT)
    .eq("user_id", userId)
    .order("period_start", { ascending: false })
    .order("created_at", { ascending: false });

  if (connectionId) {
    query = query.eq("connection_id", connectionId);
  }

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load monthly reports: ${error.message}`);
  }

  return ((data ?? []) as ReportRow[]).map(mapReportRow);
}

export async function getMonthlyReportById(
  userId: string,
  reportId: string
): Promise<MonthlyRevenueHealthReport | null> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("monthly_reports")
    .select(PUBLIC_REPORT_SELECT)
    .eq("id", reportId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load report: ${error.message}`);
  }

  return data ? mapReportRow(data as ReportRow) : null;
}

export async function generateMonthlyRevenueHealthReport(
  input: GenerateMonthlyRevenueHealthInput
): Promise<MonthlyRevenueHealthReport> {
  assertIsoDate(input.startDate, "startDate");
  assertIsoDate(input.endDate, "endDate");

  const start = toUtcDate(input.startDate);
  const end = toUtcDate(input.endDate, true);
  if (start > end) {
    throw new Error("startDate must be before or equal to endDate");
  }

  const connection = await getActiveConnection(input.userId, input.connectionId);
  const startUnix = Math.floor(start.getTime() / 1000);
  const endUnix = Math.floor(end.getTime() / 1000);
  const periodLabel = formatPeriodLabel(start);

  const [stripeData, previousRevenue] = await Promise.all([
    withStripeConnect(connection.id, async (stripe) => {
      return Promise.all([
        listInvoicesForRange(stripe, startUnix, endUnix),
        listSubscriptions(stripe),
      ]);
    }),
    getPreviousRevenue(connection.id, input.startDate),
  ]);
  const [invoices, subscriptions] = stripeData;

  const invoiceSummary = summarizeInvoices(invoices);
  const subscriptionSummary = summarizeSubscriptions(subscriptions, startUnix, endUnix);
  const denominator =
    subscriptionSummary.activeSubscriptions + subscriptionSummary.canceledSubscriptions;
  const churnRate =
    denominator > 0 ? roundRatio(subscriptionSummary.canceledSubscriptions / denominator) : 0;
  const revenueChangePercent =
    previousRevenue > 0
      ? roundRatio(((invoiceSummary.totalRevenue - previousRevenue) / previousRevenue) * 100)
      : 0;
  const healthStatus = determineHealthStatus({
    churnRate,
    totalRevenue: invoiceSummary.totalRevenue,
    failedPaymentsAmount: invoiceSummary.failedPaymentsAmount,
    failedPaymentsCount: invoiceSummary.failedPaymentsCount,
  });

  const reportPayload = {
    generatedAt: new Date().toISOString(),
    invoiceCount: invoiceSummary.invoiceCount,
    subscriptionCount: subscriptionSummary.subscriptionCount,
    previousRevenue,
    connectionId: connection.id,
    stripeAccountId: connection.stripe_account_id,
  };

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("monthly_reports")
    .upsert(
      {
        connection_id: connection.id,
        user_id: input.userId,
        stripe_account_id: connection.stripe_account_id,
        account_name: connection.account_name,
        period_start: input.startDate,
        period_end: input.endDate,
        period_label: periodLabel,
        currency: invoiceSummary.currency,
        total_revenue: invoiceSummary.totalRevenue,
        failed_payments_count: invoiceSummary.failedPaymentsCount,
        failed_payments_amount: invoiceSummary.failedPaymentsAmount,
        recovered_revenue: invoiceSummary.recoveredRevenue,
        active_subscriptions: subscriptionSummary.activeSubscriptions,
        canceled_subscriptions: subscriptionSummary.canceledSubscriptions,
        churn_rate: churnRate,
        revenue_change_percent: revenueChangePercent,
        health_status: healthStatus,
        report_payload: reportPayload,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "connection_id,period_start,period_end",
      }
    )
    .select(PUBLIC_REPORT_SELECT)
    .single();

  if (error || !data) {
    throw new Error(`Failed to store monthly report: ${error?.message ?? "unknown error"}`);
  }

  const report = mapReportRow(data as ReportRow);

  await trackUsageEvent(input.userId, "monthly_report_generated", {
    report_id: report.reportId,
    connection_id: report.connectionId,
    period_start: report.periodStart,
    period_end: report.periodEnd,
  });

  return report;
}

export async function generateMonthlyRevenueHealthReports(
  input: GenerateMonthlyRevenueHealthInput
): Promise<MonthlyRevenueHealthReport[]> {
  if (input.connectionId) {
    return [await generateMonthlyRevenueHealthReport(input)];
  }

  const connections = await listActiveConnectionRows(input.userId);
  if (connections.length === 0) {
    throw new Error("No active Stripe connections found for this user");
  }

  const reports: MonthlyRevenueHealthReport[] = [];
  for (const connection of connections) {
    reports.push(
      await generateMonthlyRevenueHealthReport({
        ...input,
        connectionId: connection.id,
      })
    );
  }

  return reports;
}

export async function trackMonthlyReportViewed(userId: string, reportId: string) {
  await trackUsageEvent(userId, "monthly_report_viewed", {
    report_id: reportId,
  });
}

export async function sendMonthlyReportEmail(params: {
  userId: string;
  reportId: string;
}): Promise<{ email: string; reportUrl: string }> {
  const admin = getSupabaseAdminClient();
  const report = await getMonthlyReportById(params.userId, params.reportId);
  if (!report) {
    throw new Error("Monthly report not found");
  }

  const { data: profile, error } = await admin
    .from("user_profiles")
    .select("email")
    .eq("id", params.userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load user email: ${error.message}`);
  }
  if (!profile?.email) {
    throw new Error("No email address found for this user");
  }

  const reportUrl = getReportUrl(report.reportId);
  await sendEmail({
    to: profile.email,
    userId: params.userId,
    subject: `Your ${report.period} revenue health report`,
    react: MonthlyHealthReport({
      accountName: report.accountName,
      period: report.period,
      totalRevenue: report.totalRevenue,
      failedPaymentsCount: report.failedPaymentsCount,
      failedPaymentsAmount: report.failedPaymentsAmount,
      recoveredRevenue: report.recoveredRevenue,
      activeSubscriptions: report.activeSubscriptions,
      canceledSubscriptions: report.canceledSubscriptions,
      churnRate: report.churnRate,
      revenueChangePercent: report.revenueChangePercent,
      healthStatus: report.healthStatus,
      reportUrl,
      unsubscribeUrl: buildUnsubscribeUrl(params.userId),
    }),
  });

  await trackUsageEvent(params.userId, "monthly_report_email_sent", {
    report_id: report.reportId,
    connection_id: report.connectionId,
    period_start: report.periodStart,
  });

  return { email: profile.email, reportUrl };
}
