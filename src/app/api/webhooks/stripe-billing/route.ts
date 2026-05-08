import { NextRequest, NextResponse } from "next/server";
import { getStripeServerClient, getSupabaseAdminClient } from "@/lib/server-clients";
import { planFromPriceId, PLAN_LIMITS, type PlanTier } from "@/lib/stripe";
import { sendViaResend } from "@/lib/resend";
import { log } from "@/lib/logger";
import { audit } from "@/lib/audit";
import { notifyUserOnSlack, buildTrialEndingSoon } from "@/lib/slack";
import type Stripe from "stripe";

function buildTrialEndingEmail(trialEndsAt: Date, billingUrl: string): string {
  const formatted = trialEndsAt.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  return `<!DOCTYPE html>
<html>
  <body style="font-family:Arial,sans-serif;background:#f8fafc;color:#0f172a;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;">
      <h1 style="margin:0 0 16px;font-size:22px;">Your Corvidet Growth trial ends in 3 days</h1>
      <p style="margin:0 0 12px;line-height:1.6;">Your trial ends on <strong>${formatted}</strong>. To keep your Growth features, add a payment method before then:</p>
      <p style="margin:20px 0;text-align:center;">
        <a href="${billingUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Add payment method</a>
      </p>
      <p style="margin:0 0 12px;line-height:1.6;color:#64748b;font-size:14px;">If you don't add a card, your account will revert to the free plan automatically — no charge, no surprises.</p>
      <p style="margin:24px 0 0;color:#64748b;font-size:13px;">— Corvidet</p>
    </div>
  </body>
</html>`;
}

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
          .select("id, plan")
          .eq("stripe_customer_id", customerId)
          .single();

        const profileRow = profile as { id: string; plan: string } | null;
        const userId = profileRow?.id;
        if (userId) {
          const previousPlan = profileRow.plan;
          // Mirror Stripe's trial_end onto the profile so the dashboard banner
          // can render without round-tripping to Stripe. Cleared once the
          // trial transitions to active billing (sub.trial_end becomes null).
          const trialEndsAt = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;
          await admin.from("user_profiles").update({ plan, trial_ends_at: trialEndsAt }).eq("id", userId);

          // Audit only on actual plan changes (Stripe fires subscription.updated
          // for many no-op reasons: invoice.created, billing_cycle_anchor, etc.)
          if (plan !== previousPlan) {
            await audit({
              userId,
              action: plan === "free" ? "subscription.downgraded" : "subscription.upgraded",
              resource_type: "subscription",
              resource_id: sub.id,
              meta: { from: previousPlan, to: plan, source: "stripe_webhook" },
            });
          }
        }
        break;
      }

      case "customer.subscription.trial_will_end": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        if (!sub.trial_end) break;

        const { data: profile } = await admin
          .from("user_profiles")
          .select("id, email, plan")
          .eq("stripe_customer_id", customerId)
          .single();

        const profileRow = profile as { id?: string; email?: string; plan?: string } | null;
        if (!profileRow?.email) break;

        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://corvidet.com";
        const billingUrl = `${appUrl}/dashboard/billing`;
        const trialEndsAt = new Date(sub.trial_end * 1000);
        try {
          await sendViaResend({
            to: profileRow.email,
            subject: "Your Corvidet Growth trial ends in 3 days",
            html: buildTrialEndingEmail(trialEndsAt, billingUrl),
          });
        } catch (emailErr) {
          log("warn", "Trial ending email failed", { route: ROUTE, userId: profileRow.id, error: emailErr });
        }

        // Slack notification (Business plan only — though trials are typically
        // for Growth, this hooks correctly when a Business user is in trial).
        const userPlan = (profileRow.plan ?? "free") as PlanTier;
        if (profileRow.id && PLAN_LIMITS[userPlan].slackAlerts) {
          const daysLeft = Math.max(1, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
          await notifyUserOnSlack(
            profileRow.id,
            buildTrialEndingSoon({ daysLeft, billingUrl })
          );
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
          // If the sub was canceled while still in trial, the user never
          // converted; record that in the audit metadata for funnel analysis.
          const wasTrialing = sub.status === "trialing" || sub.trial_end !== null;
          const reason = wasTrialing ? "trial_expired_no_payment" : "subscription_deleted";
          await admin.from("user_profiles")
            .update({ plan: "free", trial_ends_at: null })
            .eq("id", userId);
          await admin.from("usage_events").insert({
            user_id: userId,
            event_type: "plan_downgraded",
            metadata: { plan: "free", reason },
          });
          await audit({
            userId,
            action: "subscription.downgraded",
            resource_type: "subscription",
            resource_id: sub.id,
            meta: { to: "free", reason, source: "stripe_webhook" },
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
