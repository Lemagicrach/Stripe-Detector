type AlertSeverity = "info" | "warning" | "critical";

type AlertStatus = "open" | "in_progress" | "resolved" | "dismissed" | "acknowledged";

interface RevenueLeakAlertRow {
  id: string;
  category: string;
  severity: AlertSeverity;
  title: string;
  description: string | null;
  fix_steps: unknown;
  status: Exclude<AlertStatus, "acknowledged">;
  detected_at: string;
}

interface RevenueSignalAlertRow {
  id: string;
  type: string;
  severity: AlertSeverity;
  title: string;
  description: string | null;
  data: unknown;
  read: boolean;
  created_at: string;
}

export interface RevenueAlert {
  id: string;
  type: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  created_at: string;
  status: AlertStatus;
  recommended_action: string;
}

const LEAK_ACTION_FALLBACKS: Record<string, string> = {
  failed_payment: "Review failed invoices and launch a dunning sequence for impacted customers.",
  expired_card: "Prompt affected customers to update their payment method before the next billing cycle.",
  downgrade_without_intervention: "Reach out to canceling customers with a save offer or feedback request.",
  pending_cancel: "Reach out to canceling customers with a save offer or feedback request.",
  zombie_subscription: "Audit zero-revenue subscriptions and convert or clean up any unintended accounts.",
  zombie_sub: "Audit zero-revenue subscriptions and convert or clean up any unintended accounts.",
};

const SIGNAL_ACTION_FALLBACKS: Record<string, string> = {
  churn_spike: "Inspect recent churn drivers and trigger retention outreach for at-risk accounts.",
  failed_payment_spike: "Review recent failed charges and tighten dunning follow-up.",
  mrr_drop: "Compare the latest MRR changes against churn, downgrades, and failed payments.",
  expansion_slowdown: "Review upgrade opportunities and recent plan changes across active accounts.",
};

export function buildRevenueAlerts(params: {
  leaks?: RevenueLeakAlertRow[] | null;
  signals?: RevenueSignalAlertRow[] | null;
}): RevenueAlert[] {
  const leakAlerts = (params.leaks ?? []).map(mapRevenueLeakToAlert);
  const signalAlerts = (params.signals ?? []).map(mapRevenueSignalToAlert);

  return [...leakAlerts, ...signalAlerts].sort(
    (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  );
}

function mapRevenueLeakToAlert(leak: RevenueLeakAlertRow): RevenueAlert {
  return {
    id: leak.id,
    type: leak.category,
    severity: leak.severity,
    title: leak.title,
    description: cleanText(leak.description, "Revenue leak detected."),
    created_at: leak.detected_at,
    status: leak.status,
    recommended_action:
      extractRecommendedAction(leak.fix_steps) ??
      LEAK_ACTION_FALLBACKS[leak.category] ??
      "Review this leak and assign the next remediation step.",
  };
}

function mapRevenueSignalToAlert(signal: RevenueSignalAlertRow): RevenueAlert {
  return {
    id: signal.id,
    type: signal.type,
    severity: signal.severity,
    title: signal.title,
    description: cleanText(signal.description, "Revenue signal detected."),
    created_at: signal.created_at,
    status: signal.read ? "acknowledged" : "open",
    recommended_action:
      extractSignalRecommendedAction(signal.data) ??
      SIGNAL_ACTION_FALLBACKS[signal.type] ??
      "Review this signal and decide whether it needs follow-up.",
  };
}

function extractSignalRecommendedAction(data: unknown): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;

  const record = data as Record<string, unknown>;
  const directCandidate = firstNonEmptyString([
    record.recommended_action,
    record.recommendedAction,
    record.action,
    record.next_step,
    record.nextStep,
  ]);

  if (directCandidate) return directCandidate;
  return extractRecommendedAction(record.fix_steps ?? record.fixSteps ?? record.actions);
}

function extractRecommendedAction(value: unknown): string | null {
  if (!Array.isArray(value)) return null;

  for (const item of value) {
    if (typeof item === "string" && item.trim()) return item.trim();

    if (item && typeof item === "object" && !Array.isArray(item)) {
      const record = item as Record<string, unknown>;
      const candidate = firstNonEmptyString([
        record.action,
        record.title,
        record.label,
        record.step,
        record.description,
      ]);

      if (candidate) return candidate;
    }
  }

  return null;
}

function firstNonEmptyString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return null;
}

function cleanText(value: string | null | undefined, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
