// src/app/api/webhooks/stripe-connect/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient, getStripeServerClient } from "@/lib/server-clients";
import type Stripe from "stripe";

export async function POST(req: NextRequest) {
  const stripe = getStripeServerClient();
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET || "");
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  try {
    switch (event.type) {
      case "account.application.deauthorized": {
        const account = event.account;
        if (account) {
          await admin.from("stripe_connections").update({ status: "disconnected" }).eq("stripe_account_id", account);
        }
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.attempt_count && invoice.attempt_count > 1) {
          const { data: conn } = await admin.from("stripe_connections")
            .select("id").eq("stripe_account_id", event.account || "").limit(1).single();
          if (conn) {
            const customer = invoice.customer as string;
            const customerData = await stripe.customers.retrieve(customer);
            const email = (customerData as Stripe.Customer).email || "unknown";
            await admin.from("recovery_events").insert({
              connection_id: conn.id, user_id: null,
              category: "failed_payment_recovered", amount: (invoice.amount_paid || 0) / 100,
              customer_email: email,
              metadata: { invoice_id: invoice.id, attempts: invoice.attempt_count },
            });
          }
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const { data: conn } = await admin.from("stripe_connections")
          .select("id").eq("stripe_account_id", event.account || "").limit(1).single();
        if (conn) {
          await admin.from("usage_events").insert({
            user_id: null, event_type: "subscription_churned",
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
