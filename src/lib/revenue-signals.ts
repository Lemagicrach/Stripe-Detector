type SignalSeverity = "info" | "warning" | "critical";

interface MetricsSnapshotForSignals {
  snapshot_date: string;
  mrr: number | null;
  churn_rate: number | null;
  nrr: number | null;
  active_customers: number | null;
}

interface LeakForSignals {
  category: string;
  severity: SignalSeverity;
  title: string;
  description: string;
  lostRevenue: number;
  recoverableRevenue: number;
}

export interface RevenueSignalCandidate {
  type: string;
  severity: SignalSeverity;
  title: string;
  description: string;
  data: Record<string, unknown>;
}

export const GENERATED_SYNC_SIGNAL_TYPES = [
  "mrr_drop",
  "churn_spike",
  "failed_payment_spike",
] as const;

export function buildRevenueSignals(params: {
  metricsHistory?: MetricsSnapshotForSignals[] | null;
  leaks?: LeakForSignals[] | null;
}): RevenueSignalCandidate[] {
  const metricsHistory = params.metricsHistory ?? [];
  const leaks = params.leaks ?? [];
  const signals: RevenueSignalCandidate[] = [];

  const latest = metricsHistory[0];
  const previous = metricsHistory[1];

  if (latest && previous) {
    const latestMrr = sanitizeMoney(latest.mrr);
    const previousMrr = sanitizeMoney(previous.mrr);
    const mrrDrop = previousMrr - latestMrr;
    const mrrDropPct = previousMrr > 0 ? mrrDrop / previousMrr : 0;

    if (mrrDrop > 0 && (mrrDropPct >= 0.03 || mrrDrop >= 100)) {
      signals.push({
        type: "mrr_drop",
        severity: mrrDropPct >= 0.15 || mrrDrop >= 500 ? "critical" : "warning",
        title: `MRR dropped by ${formatCurrency(mrrDrop)}`,
        description: `MRR moved from ${formatCurrency(previousMrr)} to ${formatCurrency(latestMrr)} since the previous snapshot.`,
        data: {
          previous_mrr: roundCurrency(previousMrr),
          current_mrr: roundCurrency(latestMrr),
          change_amount: roundCurrency(mrrDrop),
          change_pct: roundPercent(mrrDropPct * 100),
          recoverable_revenue: roundCurrency(mrrDrop),
          previous_snapshot_date: previous.snapshot_date,
          current_snapshot_date: latest.snapshot_date,
        },
      });
    }

    const latestChurn = sanitizeRate(latest.churn_rate);
    const previousChurn = sanitizeRate(previous.churn_rate);
    const churnIncrease = latestChurn - previousChurn;

    if (churnIncrease >= 0.01 || latestChurn >= 0.05) {
      signals.push({
        type: "churn_spike",
        severity: churnIncrease >= 0.03 || latestChurn >= 0.08 ? "critical" : "warning",
        title: `Churn increased to ${formatPercent(latestChurn)}`,
        description: `Churn moved from ${formatPercent(previousChurn)} to ${formatPercent(latestChurn)} since the previous snapshot.`,
        data: {
          previous_churn_rate: roundPercent(previousChurn * 100),
          current_churn_rate: roundPercent(latestChurn * 100),
          change_pct_points: roundPercent(churnIncrease * 100),
          current_nrr: sanitizeRate(latest.nrr),
          active_customers: latest.active_customers ?? 0,
          previous_snapshot_date: previous.snapshot_date,
          current_snapshot_date: latest.snapshot_date,
        },
      });
    }
  }

  const failedPaymentLeak = leaks.find((leak) => leak.category === "failed_payment" && leak.lostRevenue > 0);
  if (failedPaymentLeak) {
    signals.push({
      type: "failed_payment_spike",
      severity: failedPaymentLeak.severity,
      title: failedPaymentLeak.title,
      description: failedPaymentLeak.description,
      data: {
        revenue_impact: roundCurrency(failedPaymentLeak.lostRevenue),
        recoverable_revenue: roundCurrency(failedPaymentLeak.recoverableRevenue),
        related_leak_category: failedPaymentLeak.category,
      },
    });
  }

  return signals;
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

function sanitizeRate(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}
