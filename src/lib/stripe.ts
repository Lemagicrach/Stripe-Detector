// Re-export for convenience - always use getStripeServerClient() for server-side
export { getStripeServerClient } from "./server-clients";

// â"€â"€ Canonical plan tiers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
// Single source of truth for all plan configuration.
// All enforcement, billing, and UI must reference PLAN_LIMITS.

export type PlanTier = "free" | "growth" | "business";

// `aiMaxCostCentsPerMonth` is a hard ceiling on AI spend per user per month
// in cents. It backstops the per-query count limit: even with "small" queries,
// a free user spamming long contexts could blow our Anthropic budget. Caps
// are calibrated as roughly (aiQueriesPerMonth × ~5 cents/query × 2x slack)
// based on observed avg context size; tune as Anthropic's pricing or our
// usage patterns shift.
export const PLAN_LIMITS = {
  free: {
    label: "Starter",
    priceUsd: 0,
    aiQueriesPerMonth: 5,
    aiMaxCostCentsPerMonth: 50,    // $0.50 — covers 5 queries × ~5 cents + slack
    mrrCapUsd: 10_000,
    dataRetentionDays: 30,
    continuousMonitoring: false,
    customReports: false,
    prioritySupport: false,
    slackAlerts: false,
    stripePriceId: null as string | null,
  },
  growth: {
    label: "Growth",
    priceUsd: 29,
    aiQueriesPerMonth: 50,
    aiMaxCostCentsPerMonth: 500,   // $5.00 — covers 50 queries × ~5 cents + slack
    mrrCapUsd: 100_000,
    dataRetentionDays: 365,
    continuousMonitoring: true,
    customReports: false,
    prioritySupport: false,
    slackAlerts: false,
    stripePriceId: process.env.STRIPE_GROWTH_PRICE_ID ?? null,
  },
  business: {
    label: "Business",
    priceUsd: 99,
    aiQueriesPerMonth: 200,
    aiMaxCostCentsPerMonth: 2000,  // $20.00 — covers 200 queries × ~5 cents + slack
    mrrCapUsd: 500_000,
    dataRetentionDays: 9999,
    continuousMonitoring: true,
    customReports: true,
    prioritySupport: true,
    slackAlerts: true,             // Business-only: real-time leak alerts to Slack
    stripePriceId: process.env.STRIPE_BUSINESS_PRICE_ID ?? null,
  },
} as const satisfies Record<PlanTier, {
  label: string;
  priceUsd: number;
  aiQueriesPerMonth: number;
  aiMaxCostCentsPerMonth: number;
  mrrCapUsd: number;
  dataRetentionDays: number;
  continuousMonitoring: boolean;
  customReports: boolean;
  prioritySupport: boolean;
  slackAlerts: boolean;
  stripePriceId: string | null;
}>;

/** Map a Stripe price ID back to a plan tier (used in webhooks). */
export function planFromPriceId(priceId: string): PlanTier {
  if (priceId === process.env.STRIPE_GROWTH_PRICE_ID)   return "growth";
  if (priceId === process.env.STRIPE_BUSINESS_PRICE_ID) return "business";
  return "free";
}
