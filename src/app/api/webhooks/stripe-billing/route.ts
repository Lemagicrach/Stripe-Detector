import { NextRequest, NextResponse } from "next/server";
import { getStripeServerClient, getSupabaseAdminClient } from "@/lib/server-clients";
import { planFromPriceId } from "@/lib/stripe";
import { log } from "@/lib/logger";
import type Stripe from "stripe";

const ROUTE = "/api/webhooks/stripe-billing";


export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_BILLING_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "Missing stripe-signature or webhook secret" }, { status: 400 });
  }

  const stripe = getStripeServerClient();
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    log("error", "Webhook signature verification failed", { route: ROUTE, error: err });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  const { error: dedupError } = await admin
    .from("stripe_events_processed")
    .insert({ event_id: event.id, source: "billing" });

  if (dedupError) {
    if ((dedupError as { code?: string }).code === "23505") {
      return NextResponse.json({ received: true, deduped: true });
    }
    log("error", "Dedup insert failed", { route: ROUTE, eventId: event.id, error: dedupError });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        const plan   = session.metadata?.plan;
        if (userId && plan) {
          await admin.from("user_profiles").update({ plan }).eq("id", userId);
          await admin.from("usage_events").insert({
            user_id: userId,
            event_type: "plan_upgraded",
            metadata: { plan, checkout_session_id: session.id },
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const priceId = sub.items.data[0]?.price?.id;
        if (!priceId) break;

        const plan = planFromPriceId(priceId);
        const { data: profile } = await admin
          .from("user_profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        const userId = (profile as { id: string } | null)?.id;
        if (userId) {
          await admin.from("user_profiles").update({ plan }).eq("id", userId);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

        const { data: profile } = await admin
          .from("user_profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        const userId = (profile as { id: string } | null)?.id;
        if (userId) {
          await admin.from("user_profiles").update({ plan: "free" }).eq("id", userId);
          await admin.from("usage_events").insert({
            user_id: userId,
            event_type: "plan_downgraded",
            metadata: { plan: "free", reason: "subscription_deleted" },
          });
        }
        break;
      }

      default:
        // Ignore other event types
        break;
    }
  } catch (err) {
    log("error", "Webhook handler failed", { route: ROUTE, eventId: event.id, eventType: event.type, error: err });
    // Return 200 so Stripe doesn't retry - log the failure instead
  }

  return NextResponse.json({ received: true });
}
