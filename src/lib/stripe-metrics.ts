// src/lib/stripe-metrics.ts
//
// Pure Stripe API helpers. Each function takes an authenticated `Stripe`
// instance (typically obtained via `withStripeConnect(connectionId, ...)` so
// the caller transparently gets token refresh on expiry).

import Stripe from "stripe";

interface SyncResult {
  mrr: number; arr: number; activeCustomers: number;
  churnRate: number; nrr: number; arpu: number;
  newMrr: number; expansionMrr: number; churnedMrr: number; contractionMrr: number;
  subscriptionDetails: SubscriptionDetail[];
}

interface SubscriptionDetail {
  id: string; customerId: string; customerEmail: string; status: string;
  mrr: number; planName: string; currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean; created: number;
}

export async function syncStripeMetrics(stripe: Stripe): Promise<SyncResult> {
  // Fetch all subscriptions
  const subscriptions: Stripe.Subscription[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const batch = await stripe.subscriptions.list({
      limit: 100, status: "all", expand: ["data.customer"],
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    subscriptions.push(...batch.data);
    hasMore = batch.has_more;
    if (batch.data.length > 0) startingAfter = batch.data[batch.data.length - 1].id;
  }

  const now = Date.now() / 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60;

  const active = subscriptions.filter(s => s.status === "active" || s.status === "trialing");
  const canceledRecently = subscriptions.filter(
    s => s.status === "canceled" && s.canceled_at && s.canceled_at > thirtyDaysAgo
  );

  let totalMrr = 0;
  const details: SubscriptionDetail[] = [];

  for (const sub of active) {
    const subMrr = calculateSubscriptionMrr(sub);
    totalMrr += subMrr;
    const customer = sub.customer as Stripe.Customer;
    details.push({
      id: sub.id, customerId: customer.id,
      customerEmail: customer.email || "unknown", status: sub.status,
      mrr: subMrr,
      planName: sub.items.data[0]?.price?.nickname || sub.items.data[0]?.price?.id || "unknown",
      currentPeriodEnd: (sub as any).current_period_end ?? sub.created,
      cancelAtPeriodEnd: Boolean((sub as any).cancel_at_period_end), created: sub.created,
    });
  }

  let churnedMrr = 0;
  for (const sub of canceledRecently) churnedMrr += calculateSubscriptionMrr(sub);

  const newSubs = active.filter(s => s.created > thirtyDaysAgo);
  let newMrr = 0;
  for (const sub of newSubs) newMrr += calculateSubscriptionMrr(sub);

  const uniqueCustomers = new Set(active.map(s => (s.customer as Stripe.Customer).id));
  const activeCustomers = uniqueCustomers.size;

  const arpu = activeCustomers > 0 ? totalMrr / activeCustomers : 0;
  const previousMrr = totalMrr + churnedMrr - newMrr;
  const churnRate = previousMrr > 0 ? churnedMrr / previousMrr : 0;
  const nrr = previousMrr > 0 ? (totalMrr - newMrr) / previousMrr : 1;

  return {
    mrr: Math.round(totalMrr * 100) / 100,
    arr: Math.round(totalMrr * 12 * 100) / 100,
    activeCustomers, churnRate: Math.round(churnRate * 10000) / 10000,
    nrr: Math.round(nrr * 10000) / 10000,
    arpu: Math.round(arpu * 100) / 100,
    newMrr: Math.round(newMrr * 100) / 100,
    expansionMrr: 0, churnedMrr: Math.round(churnedMrr * 100) / 100,
    contractionMrr: 0, subscriptionDetails: details,
  };
}

function calculateSubscriptionMrr(sub: Stripe.Subscription): number {
  let mrr = 0;
  for (const item of sub.items.data) {
    const price = item.price;
    const quantity = item.quantity || 1;
    const amount = (price.unit_amount || 0) * quantity;
    switch (price.recurring?.interval) {
      case "month": mrr += amount / 100; break;
      case "year": mrr += amount / 100 / 12; break;
      case "week": mrr += (amount / 100) * (52 / 12); break;
      case "day": mrr += (amount / 100) * (365 / 12); break;
    }
  }
  return mrr;
}

export async function getFailedInvoices(stripe: Stripe, since: number): Promise<Stripe.Invoice[]> {
  const invoices: Stripe.Invoice[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;
  while (hasMore) {
    const batch = await stripe.invoices.list({
      limit: 100, status: "open", created: { gte: since }, expand: ["data.customer"],
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    invoices.push(
      ...batch.data.filter(
        (inv) => Boolean((inv as any).attempted) && (inv as any).status !== "paid"
      )
    );
    hasMore = batch.has_more;
    if (batch.data.length > 0) startingAfter = batch.data[batch.data.length - 1].id;
  }
  return invoices;
}

export async function getExpiringCards(stripe: Stripe) {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const results: Array<{ customerId: string; email: string; expMonth: number; expYear: number; last4: string }> = [];

  let hasMore = true;
  let startingAfter: string | undefined;
  while (hasMore) {
    const batch = await stripe.customers.list({
      limit: 100, expand: ["data.default_source"],
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    for (const customer of batch.data) {
      if (customer.default_source && typeof customer.default_source !== "string") {
        const source = customer.default_source as Stripe.Card;
        if (source.object === "card") {
          const expiresSoon = source.exp_year < currentYear ||
            (source.exp_year === currentYear && source.exp_month <= currentMonth + 1);
          if (expiresSoon) {
            results.push({
              customerId: customer.id, email: customer.email || "unknown",
              expMonth: source.exp_month, expYear: source.exp_year, last4: source.last4,
            });
          }
        }
      }
    }
    hasMore = batch.has_more;
    if (batch.data.length > 0) startingAfter = batch.data[batch.data.length - 1].id;
  }
  return results;
}
