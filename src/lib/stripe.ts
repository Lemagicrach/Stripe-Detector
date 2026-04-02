// Re-export for convenience â€” always use getStripeServerClient() for server-side
export { getStripeServerClient } from "./server-clients";

// â”€â”€ Canonical plan tiers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Single source of truth for all plan configuration.
// All enforcement, billing, and UI must reference PLAN_LIMITS.

export type PlanTier = "free" | "growth" | "business";

export const PLAN_LIMITS = {
  free: {
    label: "Starter",
    priceUsd: 0,
    aiQueriesPerMonth: 5,
    mrrCapUsd: 10_000,
    dataRetentionDays: 30,
    continuousMonitoring: false,
    customReports: false,
    prioritySupport: false,
    stripePriceId: null as string | null,
  },
  growth: {
    label: "Growth",
    priceUsd: 29,
    aiQueriesPerMonth: 50,
    mrrCapUsd: 100_000,
    dataRetentionDays: 365,
    continuousMonitoring: true,
    customReports: false,
    prioritySupport: false,
    stripePriceId: process.env.STRIPE_GROWTH_PRICE_ID ?? null,
  },
  business: {
    label: "Business",
    priceUsd: 99,
    aiQueriesPerMonth: 200,
    mrrCapUsd: 500_000,
    dataRetentionDays: 9999,
    continuousMonitoring: true,
    customReports: true,
    prioritySupport: true,
    stripePriceId: process.env.STRIPE_BUSINESS_PRICE_ID ?? null,
  },
} as const satisfies Record<PlanTier, {
  label: string;
  priceUsd: number;
  aiQueriesPerMonth: number;
  mrrCapUsd: number;
  dataRetentionDays: number;
  continuousMonitoring: boolean;
  customReports: boolean;
  prioritySupport: boolean;
  stripePriceId: string | null;
}>;

/** Map a Stripe price ID back to a plan tier (used in webhooks). */
export function planFromPriceId(priceId: string): PlanTier {
  if (priceId === process.env.STRIPE_GROWTH_PRICE_ID)   return "growth";
  if (priceId === process.env.STRIPE_BUSINESS_PRICE_ID) return "business";
  return "free";
}
