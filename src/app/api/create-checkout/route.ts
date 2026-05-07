import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getStripeServerClient, getSupabaseAdminClient } from "@/lib/server-clients";
import { handleApiError, unauthorized, badRequest } from "@/lib/server-error";
import { PLAN_LIMITS, type PlanTier } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return unauthorized();

    const body = await req.json() as { plan?: string };
    const plan = body.plan as PlanTier | undefined;
    if (!plan || plan === "free" || !(plan in PLAN_LIMITS)) {
      return badRequest("plan must be 'growth' or 'business'");
    }

    const priceId = PLAN_LIMITS[plan].stripePriceId;
    if (!priceId) {
      return NextResponse.json(
        { error: `Stripe price ID for plan "${plan}" is not configured. Set STRIPE_${plan.toUpperCase()}_PRICE_ID.` },
        { status: 503 }
      );
    }

    const stripe = getStripeServerClient();
    const admin = getSupabaseAdminClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    // Find or create Stripe customer + load current plan
    const { data: profile } = await admin
      .from("user_profiles")
      .select("stripe_customer_id, plan")
      .eq("id", user.id)
      .single();

    const profileData = profile as { stripe_customer_id?: string; plan?: PlanTier } | null;
    let customerId = profileData?.stripe_customer_id;
    const currentPlan = profileData?.plan ?? "free";

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await admin
        .from("user_profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    // Offer a 14-day trial only on the first-ever upgrade from free → growth.
    // No payment method collected upfront (lower friction); if the user does
    // not add a card by trial end, the subscription auto-cancels and the
    // customer.subscription.deleted webhook reverts the plan to free.
    const isFirstGrowthUpgrade = plan === "growth" && currentPlan === "free";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard/billing?checkout=success`,
      cancel_url:  `${appUrl}/dashboard/billing?checkout=cancelled`,
      metadata: { supabase_user_id: user.id, plan },
      allow_promotion_codes: true,
      ...(isFirstGrowthUpgrade
        ? {
            payment_method_collection: "if_required" as const,
            subscription_data: {
              metadata: { supabase_user_id: user.id, plan },
              trial_period_days: 14,
              trial_settings: {
                end_behavior: { missing_payment_method: "cancel" as const },
              },
            },
          }
        : {
            subscription_data: { metadata: { supabase_user_id: user.id, plan } },
          }),
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return handleApiError(error, "CREATE_CHECKOUT");
  }
}
