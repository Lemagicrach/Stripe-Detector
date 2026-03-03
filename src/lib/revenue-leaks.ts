// src/lib/revenue-leaks.ts
import { getFailedInvoices, getExpiringCards } from "./stripe-metrics";

interface DetectionContext {
  connectionId: string; userId: string; encryptedAccessToken: string;
  metrics: {
    mrr: number; activeCustomers: number; churnRate: number;
    subscriptionDetails: Array<{
      id: string; customerId: string; customerEmail: string; status: string;
      mrr: number; planName: string; currentPeriodEnd: number;
      cancelAtPeriodEnd: boolean; created: number;
    }>;
  };
}

interface LeakResult {
  category: string; severity: "critical" | "warning" | "info";
  title: string; description: string;
  lostRevenue: number; recoverableRevenue: number;
  affectedCustomers: string[]; fixSteps: string[]; status: string;
}

export async function detectRevenueLeaks(ctx: DetectionContext): Promise<LeakResult[]> {
  const leaks: LeakResult[] = [];
  const [fp, ec, pc, zs] = await Promise.all([
    detectFailedPayments(ctx), detectExpiringCards(ctx),
    detectPendingCancelations(ctx), detectZombieSubscriptions(ctx),
  ]);
  leaks.push(...fp, ...ec, ...pc, ...zs);
  leaks.sort((a, b) => b.recoverableRevenue - a.recoverableRevenue);
  return leaks;
}

async function detectFailedPayments(ctx: DetectionContext): Promise<LeakResult[]> {
  try {
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
    const failed = await getFailedInvoices(ctx.encryptedAccessToken, thirtyDaysAgo);
    if (failed.length === 0) return [];

    const totalLost = failed.reduce((sum, inv) => sum + (inv.amount_due || 0) / 100, 0);
    const affected = [...new Set(failed.map(inv => {
      const c = inv.customer as any;
      return c?.email || c?.id || "unknown";
    }))];

    return [{
      category: "failed_payment",
      severity: totalLost > 200 ? "critical" : "warning",
      title: `${failed.length} Failed Payment${failed.length > 1 ? "s" : ""}`,
      description: `${failed.length} invoices failed to charge, totaling $${totalLost.toFixed(0)}/mo in at-risk revenue.`,
      lostRevenue: totalLost, recoverableRevenue: totalLost * 0.7,
      affectedCustomers: affected,
      fixSteps: [
        "Enable Stripe Smart Retries if not already active",
        "Send payment update email to each affected customer",
        "Set up a 3-email dunning sequence (day 1, 3, 7)",
        "Offer temporary payment link for manual retry",
      ],
      status: "open",
    }];
  } catch (err) { console.error("Failed payment detection error:", err); return []; }
}

async function detectExpiringCards(ctx: DetectionContext): Promise<LeakResult[]> {
  try {
    const expiring = await getExpiringCards(ctx.encryptedAccessToken);
    if (expiring.length === 0) return [];

    const atRiskIds = new Set(expiring.map(c => c.customerId));
    const atRiskSubs = ctx.metrics.subscriptionDetails.filter(s => atRiskIds.has(s.customerId));
    const mrrAtRisk = atRiskSubs.reduce((sum, s) => sum + s.mrr, 0);

    return [{
      category: "expired_card",
      severity: mrrAtRisk > 300 ? "critical" : "warning",
      title: `${expiring.length} Cards Expiring Soon`,
      description: `${expiring.length} customers have cards expiring, putting $${mrrAtRisk.toFixed(0)}/mo at risk.`,
      lostRevenue: mrrAtRisk, recoverableRevenue: mrrAtRisk * 0.85,
      affectedCustomers: expiring.map(c => c.email),
      fixSteps: [
        "Send card update reminder emails",
        "Enable Stripe card account updater",
        "Add in-app banner prompting card update",
        "Set up proactive email 14 days before expiration",
      ],
      status: "open",
    }];
  } catch (err) { console.error("Expiring card detection error:", err); return []; }
}

async function detectPendingCancelations(ctx: DetectionContext): Promise<LeakResult[]> {
  const pending = ctx.metrics.subscriptionDetails.filter(s => s.cancelAtPeriodEnd && s.status === "active");
  if (pending.length === 0) return [];

  const mrrAtRisk = pending.reduce((sum, s) => sum + s.mrr, 0);
  return [{
    category: "downgrade_without_intervention",
    severity: mrrAtRisk > 500 ? "critical" : "warning",
    title: `${pending.length} Pending Cancelation${pending.length > 1 ? "s" : ""}`,
    description: `${pending.length} subscriptions set to cancel, worth $${mrrAtRisk.toFixed(0)}/mo. Still time to save them.`,
    lostRevenue: mrrAtRisk, recoverableRevenue: mrrAtRisk * 0.25,
    affectedCustomers: pending.map(s => s.customerEmail),
    fixSteps: [
      "Send personalized win-back email within 24 hours",
      "Offer discount or pause option instead of cancel",
      "Ask for feedback (sometimes a quick fix saves them)",
      "Trigger in-app modal offering alternatives",
    ],
    status: "open",
  }];
}

async function detectZombieSubscriptions(ctx: DetectionContext): Promise<LeakResult[]> {
  const zombies = ctx.metrics.subscriptionDetails.filter(s => s.status === "active" && s.mrr === 0);
  if (zombies.length === 0) return [];

  return [{
    category: "zombie_subscription",
    severity: "info",
    title: `${zombies.length} Zero-Revenue Subscription${zombies.length > 1 ? "s" : ""}`,
    description: `${zombies.length} subscriptions active but generating $0. May be free plans, 100% coupons, or stuck in limbo.`,
    lostRevenue: 0, recoverableRevenue: 0,
    affectedCustomers: zombies.map(s => s.customerEmail),
    fixSteps: [
      "Review each to determine if intentional or accidental",
      "Check for expired 100% discount coupons",
      "Convert to proper free tier with limited features",
      "Clean up test subscriptions from development",
    ],
    status: "open",
  }];
}

export function calculateLeakScore(
  leaks: Array<{ severity: string; lostRevenue: number }>, mrr: number
): number {
  if (mrr <= 0 || leaks.length === 0) return 0;
  const totalLost = leaks.reduce((sum, l) => sum + l.lostRevenue, 0);
  const leakPct = totalLost / mrr;
  const severityScore =
    leaks.filter(l => l.severity === "critical").length * 30 +
    leaks.filter(l => l.severity === "warning").length * 15 +
    leaks.filter(l => l.severity === "info").length * 5;
  return Math.min(Math.round(Math.min(leakPct * 200, 60) + Math.min(severityScore, 40)), 100);
}
