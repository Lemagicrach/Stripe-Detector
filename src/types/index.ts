// â"€â"€ Revenue Leak Types â"€â"€
export type LeakSeverity = "critical" | "warning" | "info";
export type LeakCategory =
  | "failed_payment"
  | "expired_card"
  | "subscription_gap"
  | "downgrade_without_intervention"
  | "trial_expired_no_convert"
  | "duplicate_subscription"
  | "pricing_mismatch"
  | "zombie_subscription";

export interface RevenueLeak {
  id: string;
  category: LeakCategory;
  severity: LeakSeverity;
  title: string;
  description: string;
  lostRevenue: number;
  recoverableRevenue: number;
  affectedCustomers: string[];
  fixSteps: string[];
  detectedAt: string;
  status: "open" | "in_progress" | "resolved" | "dismissed";
}

// â"€â"€ Metrics Types â"€â"€
export interface SaaSMetrics {
  mrr: number;
  arr: number;
  activeCustomers: number;
  churnRate: number;
  nrr: number;
  arpu: number;
  ltv: number;
  mrrGrowthRate: number;
  newMrr: number;
  expansionMrr: number;
  churnedMrr: number;
  contractionMrr: number;
}

// â"€â"€ Churn Types â"€â"€
export interface ChurnPrediction {
  customerId: string;
  customerEmail: string;
  riskScore: number; // 0-100
  riskLevel: "low" | "medium" | "high" | "critical";
  signals: string[];
  recommendedAction: string;
  predictedChurnDate: string;
  currentMrr: number;
}

// â"€â"€ Recovery Types â"€â"€
export interface RecoveryEvent {
  id: string;
  type: "payment_retry" | "card_update" | "reactivation" | "manual_recovery";
  amount: number;
  customerId: string;
  recoveredAt: string;
  leakId?: string;
}

// â"€â"€ User / Connection Types â"€â"€
export type PlanTier = "free" | "growth" | "business"; // synced with PLAN_LIMITS in lib/stripe.ts

export interface UserProfile {
  id: string;
  email: string;
  plan: PlanTier;
  stripeCustomerId?: string;
  createdAt: string;
}

export interface StripeConnection {
  id: string;
  userId: string;
  stripeAccountId: string;
  accountName?: string;
  lastSyncAt?: string;
  status: "active" | "disconnected" | "error";
}
