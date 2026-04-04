import { buildRevenueAlerts } from "@/lib/alerts";

type InsightSeverity = "info" | "warning" | "critical";
type InsightStatus = "open" | "in_progress" | "resolved" | "dismissed" | "acknowledged";

interface MetricsSnapshotRow {
  snapshot_date: string;
  mrr: number | null;
  active_customers: number | null;
  churn_rate: number | null;
  nrr: number | null;
  new_mrr: number | null;
  churned_mrr: number | null;
}

interface RevenueLeakInsightRow {
  id: string;
  category: string;
  severity: InsightSeverity;
  title: string;
  description: string | null;
  recoverable_revenue: number | null;
  fix_steps: unknown;
  status: Exclude<InsightStatus, "acknowledged">;
  detected_at: string;
}

interface RevenueSignalInsightRow {
  id: string;
  type: string;
  severity: InsightSeverity;
  title: string;
  description: string | null;
  data: unknown;
  read: boolean;
  created_at: string;
}

export interface RevenueInsightRisk {
  id: string;
  source: "revenue_leak" | "revenue_signal";
  type: string;
  severity: InsightSeverity;
  title: string;
  description: string;
  created_at: string;
  status: InsightStatus;
  estimated_recoverable_revenue: number | null;
}

export interface RevenueInsightsPayload {
  estimated_recoverable_revenue: number;
  top_risks: RevenueInsightRisk[];
  trend_summary: string;
  recommended_actions: string[];
}

export function buildRevenueInsights(params: {
  hasActiveConnection: boolean;
  metricsSnapshots?: MetricsSnapshotRow[] | null;
  leaks?: RevenueLeakInsightRow[] | null;
  signals?: RevenueSignalInsightRow[] | null;
}): RevenueInsightsPayload {
  const metricsSnapshots = params.metricsSnapshots ?? [];
  const leaks = params.leaks ?? [];
  const signals = params.signals ?? [];

  const alerts = buildRevenueAlerts({
    leaks: leaks.map((leak) => ({
      id: leak.id,
      category: leak.category,
      severity: leak.severity,
      title: leak.title,
      description: leak.description,
      fix_steps: leak.fix_steps,
      status: leak.status,
      detected_at: leak.detected_at,
    })),
    signals: signals.map((signal) => ({
      id: signal.id,
      type: signal.type,
      severity: signal.severity,
      title: signal.title,
      description: signal.description,
      data: signal.data,
      read: signal.read,
      created_at: signal.created_at,
    })),
  });

  const alertById = new Map(alerts.map((alert) => [alert.id, alert]));
  const estimatedRecoverableRevenue = roundCurrency(
    leaks.reduce((sum, leak) => sum + sanitizeMoney(leak.recoverable_revenue), 0)
  );

  const topRisks = [
    ...leaks.map((leak) => {
      const alert = alertById.get(leak.id);
      return {
        id: leak.id,
        source: "revenue_leak" as const,
        type: leak.category,
        severity: leak.severity,
        title: leak.title,
        description: alert?.description ?? fallbackDescription(leak.description),
        created_at: leak.detected_at,
        status: leak.status,
        estimated_recoverable_revenue: sanitizeNullableMoney(leak.recoverable_revenue),
        recommended_action: alert?.recommended_action ?? "Review this leak and assign a remediation step.",
      };
    }),
    ...signals.map((signal) => {
      const alert = alertById.get(signal.id);
      return {
        id: signal.id,
        source: "revenue_signal" as const,
        type: signal.type,
        severity: signal.severity,
        title: signal.title,
        description: alert?.description ?? fallbackDescription(signal.description),
        created_at: signal.created_at,
        status: alert?.status ?? "open",
        estimated_recoverable_revenue: extractSignalRevenueImpact(signal.data),
        recommended_action: alert?.recommended_action ?? "Review this signal and decide whether it needs follow-up.",
      };
    }),
  ]
    .sort(compareRisks)
    .slice(0, 5);

  const recommendedActions = uniqueStrings(topRisks.map((risk) => risk.recommended_action)).slice(0, 3);

  return {
    estimated_recoverable_revenue: estimatedRecoverableRevenue,
    top_risks: topRisks.map((risk) => ({
      id: risk.id,
      source: risk.source,
      type: risk.type,
      severity: risk.severity,
      title: risk.title,
      description: risk.description,
      created_at: risk.created_at,
      status: risk.status,
      estimated_recoverable_revenue: risk.estimated_recoverable_revenue,
    })),
    trend_summary: buildTrendSummary({
      hasActiveConnection: params.hasActiveConnection,
      metricsSnapshots,
      openLeakCount: leaks.length,
      unreadSignalCount: signals.length,
      estimatedRecoverableRevenue,
    }),
    recommended_actions: recommendedActions,
  };
}

function buildTrendSummary(params: {
  hasActiveConnection: boolean;
  metricsSnapshots: MetricsSnapshotRow[];
  openLeakCount: number;
  unreadSignalCount: number;
  estimatedRecoverableRevenue: number;
}): string {
  const { hasActiveConnection, metricsSnapshots, openLeakCount, unreadSignalCount, estimatedRecoverableRevenue } = params;
  const latest = metricsSnapshots[0];
  const previous = metricsSnapshots[1];

  if (!latest) {
    if (openLeakCount > 0 || unreadSignalCount > 0) {
      return `Detected ${openLeakCount} open revenue leak${openLeakCount === 1 ? "" : "s"} and ${unreadSignalCount} unread signal${unreadSignalCount === 1 ? "" : "s"}, but there is not enough metrics history yet to summarize revenue trends.`;
    }

    return hasActiveConnection
      ? "No metrics snapshots or detected revenue risks are available yet."
      : "No active Stripe connection or persisted revenue data is available yet.";
  }

  const latestMrr = sanitizeMoney(latest.mrr);
  const latestChurnRate = sanitizeRate(latest.churn_rate);
  const activeCustomers = latest.active_customers ?? 0;

  if (!previous) {
    return `Latest snapshot shows ${formatCurrency(latestMrr)} in MRR across ${activeCustomers} active customer${activeCustomers === 1 ? "" : "s"} with ${formatPercent(latestChurnRate)} churn. Current open leaks represent about ${formatCurrency(estimatedRecoverableRevenue)} in recoverable revenue.`;
  }

  const previousMrr = sanitizeMoney(previous.mrr);
  const previousChurnRate = sanitizeRate(previous.churn_rate);
  const mrrDelta = latestMrr - previousMrr;
  const mrrDeltaPct = previousMrr > 0 ? (mrrDelta / previousMrr) * 100 : 0;
  const churnDeltaPctPoints = (latestChurnRate - previousChurnRate) * 100;

  const mrrClause =
    Math.abs(mrrDelta) < 0.01
      ? `MRR held steady at ${formatCurrency(latestMrr)}`
      : `MRR ${mrrDelta > 0 ? "increased" : "decreased"} by ${formatCurrency(Math.abs(mrrDelta))} (${Math.abs(mrrDeltaPct).toFixed(1)}%) to ${formatCurrency(latestMrr)}`;

  const churnClause =
    Math.abs(churnDeltaPctPoints) < 0.1
      ? `churn was flat at ${formatPercent(latestChurnRate)}`
      : `churn ${churnDeltaPctPoints > 0 ? "rose" : "fell"} to ${formatPercent(latestChurnRate)} (${Math.abs(churnDeltaPctPoints).toFixed(1)} pts)`;

  return `${mrrClause} since the previous snapshot, ${churnClause}. ${openLeakCount} open leak${openLeakCount === 1 ? "" : "s"} currently account for about ${formatCurrency(estimatedRecoverableRevenue)} in recoverable revenue, with ${unreadSignalCount} unread signal${unreadSignalCount === 1 ? "" : "s"} reinforcing current risk.`;
}

function compareRisks(
  left: RevenueInsightRisk & { recommended_action: string },
  right: RevenueInsightRisk & { recommended_action: string }
): number {
  const severityDelta = severityRank(right.severity) - severityRank(left.severity);
  if (severityDelta !== 0) return severityDelta;

  const revenueDelta =
    sanitizeMoney(right.estimated_recoverable_revenue) - sanitizeMoney(left.estimated_recoverable_revenue);
  if (revenueDelta !== 0) return revenueDelta;

  return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
}

function severityRank(severity: InsightSeverity): number {
  switch (severity) {
    case "critical":
      return 3;
    case "warning":
      return 2;
    case "info":
    default:
      return 1;
  }
}

function extractSignalRevenueImpact(data: unknown): number | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;

  const record = data as Record<string, unknown>;
  const candidateKeys = [
    "recoverable_revenue",
    "recoverableRevenue",
    "revenue_impact",
    "revenueImpact",
    "mrr_at_risk",
    "mrrAtRisk",
    "amount",
  ];

  for (const key of candidateKeys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return roundCurrency(value);
    }
  }

  return null;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (!value) continue;
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function sanitizeMoney(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function sanitizeNullableMoney(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? roundCurrency(value) : null;
}

function sanitizeRate(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function fallbackDescription(value: string | null | undefined): string {
  return typeof value === "string" && value.trim() ? value.trim() : "No additional context available.";
}
