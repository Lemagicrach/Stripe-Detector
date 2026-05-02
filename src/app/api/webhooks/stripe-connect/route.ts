// src/app/api/webhooks/stripe-connect/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient, getStripeServerClient } from "@/lib/server-clients";
import type Stripe from "stripe";

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[STRIPE_CONNECT_WEBHOOK] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  const stripe = getStripeServerClient();
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  const { error: dedupError } = await admin
    .from("stripe_events_processed")
    .insert({ event_id: event.id, source: "connect" });

  if (dedupError) {
    if ((dedupError as { code?: string }).code === "23505") {
      return NextResponse.json({ received: true, deduped: true });
    }
    console.error("[STRIPE_CONNECT_WEBHOOK] dedup insert failed", dedupError);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "account.application.deauthorized": {
        const account = event.account;
        if (account) {
          await admin
            .from("stripe_connections")
            .update({ status: "disconnected" })
            .eq("stripe_account_id", account);
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
    console.error("Webhook processing error:", error);
    return NextResponse.json({ received: true });
  }
}
