// src/app/api/webhooks/stripe-connect/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient, getStripeServerClient } from "@/lib/server-clients";
import { log } from "@/lib/logger";
import { audit } from "@/lib/audit";
import type Stripe from "stripe";

const ROUTE = "/api/webhooks/stripe-connect";

export async function POST(req: NextRequest) {
  // Two signing secrets are tried in order: live first, then test. The test
  // secret is optional and intended only for idempotency validation from
  // Stripe Test mode against the production endpoint. The first secret that
  // verifies wins; the route then tags the dedup row with a "_test" suffix
  // so live and test event streams stay separable in stripe_events_processed.
  const liveSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const testSecret = process.env.STRIPE_WEBHOOK_SECRET_TEST;
  if (!liveSecret && !testSecret) {
    log("error", "No webhook secret configured", { route: ROUTE, errorCode: "missing_webhook_secret" });
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  const stripe = getStripeServerClient();
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  const candidates: Array<{ secret: string; mode: "live" | "test" }> = [];
  if (liveSecret) candidates.push({ secret: liveSecret, mode: "live" });
  if (testSecret) candidates.push({ secret: testSecret, mode: "test" });

  let event: Stripe.Event | null = null;
  let matchedMode: "live" | "test" | null = null;
  let lastErr: unknown = null;
  for (const { secret, mode } of candidates) {
    try {
      event = stripe.webhooks.constructEvent(body, sig, secret);
      matchedMode = mode;
      break;
    } catch (err) {
      lastErr = err;
    }
  }

  if (!event || !matchedMode) {
    log("error", "Webhook signature verification failed", { route: ROUTE, error: lastErr });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (matchedMode === "test") {
    log("info", "webhook signed with test secret", { route: ROUTE, eventId: event.id, eventType: event.type });
  }

  const admin = getSupabaseAdminClient();
  const dedupSource = matchedMode === "test" ? "connect_test" : "connect";

  const { error: dedupError } = await admin
    .from("stripe_events_processed")
    .insert({ event_id: event.id, source: dedupSource });

  if (dedupError) {
    if ((dedupError as { code?: string }).code === "23505") {
      return NextResponse.json({ received: true, deduped: true });
    }
    log("error", "Dedup insert failed", { route: ROUTE, eventId: event.id, error: dedupError });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "account.application.deauthorized": {
        const account = event.account;
        if (account) {
          const { data: conn } = await admin
            .from("stripe_connections")
            .update({ status: "disconnected" })
            .eq("stripe_account_id", account)
            .select("id, user_id")
            .single();

          if (conn) {
            await audit({
              userId: (conn as { user_id: string }).user_id,
              action: "stripe.connect.disconnected",
              resource_type: "stripe_connection",
              resource_id: (conn as { id: string }).id,
              meta: { account_id: account, source: "stripe_webhook" },
            });
          }
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        // Only track recovered payments (previously failed, now succeeded)
        if (invoice.attempt_count && invoice.attempt_count > 1) {
          const { data: conn } = await admin
            .from("stripe_connections")
            .select("id, user_id")
            .eq("stripe_account_id", event.account ?? "")
            .limit(1)
            .single();

          if (conn) {
            const customerId =
              typeof invoice.customer === "string"
                ? invoice.customer
                : invoice.customer?.id ?? null;

            await admin.from("recovery_events").insert({
              user_id: conn.user_id,
              type: "failed_payment_recovered",
              amount: (invoice.amount_paid ?? 0) / 100,
              customer_id: customerId,
            });
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const { data: conn } = await admin
          .from("stripe_connections")
          .select("id, user_id")
          .eq("stripe_account_id", event.account ?? "")
          .limit(1)
          .single();

        if (conn) {
          await admin.from("usage_events").insert({
            user_id: conn.user_id,
            event_type: "subscription_churned",
            metadata: { connection_id: conn.id, subscription_id: sub.id },
          });
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    log("error", "Webhook handler failed", { route: ROUTE, eventId: event.id, eventType: event.type, error });
    return NextResponse.json({ received: true });
  }
}
