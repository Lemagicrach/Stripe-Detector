"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { PLAN_LIMITS, type PlanTier } from "@/lib/stripe";
import { CheckCircle2, Zap, ArrowRight, ExternalLink, AlertTriangle } from "lucide-react";

type UsageData = {
  plan: PlanTier;
  aiQueriesUsed: number;
  aiQueriesLimit: number;
};

const PLAN_FEATURES: Record<PlanTier, string[]> = {
  free: [
    "Full leak scan (on demand)",
    "MRR, churn, revenue tracking",
    "5 AI queries / month",
    "30-day data retention",
  ],
  growth: [
    "Continuous leak monitoring",
    "Real-time churn alerts",
    "50 AI queries / month",
    "1-year data retention",
    "Email support",
  ],
  business: [
    "Everything in Growth",
    "200 AI queries / month",
    "Custom leak reports",
    "Unlimited data retention",
    "Priority support",
  ],
};

export default function BillingPage() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<PlanTier | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function loadUsage() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from("user_profiles")
          .select("plan")
          .eq("id", user.id)
          .single();

        const plan = ((profile as { plan?: string } | null)?.plan ?? "free") as PlanTier;
        const limit = PLAN_LIMITS[plan]?.aiQueriesPerMonth ?? PLAN_LIMITS.free.aiQueriesPerMonth;

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { count } = await supabase
          .from("usage_events")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("event_type", "ai_query")
          .gte("created_at", startOfMonth.toISOString());

        setUsage({ plan, aiQueriesUsed: count ?? 0, aiQueriesLimit: limit });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load billing data");
      } finally {
        setLoading(false);
      }
    }
    void loadUsage();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startCheckout(plan: PlanTier) {
    setCheckoutLoading(plan);
    setError(null);
    try {
      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Failed to create checkout");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setCheckoutLoading(null);
    }
  }

  async function openPortal() {
    setPortalLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/create-portal", { method: "POST" });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Failed to open billing portal");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Portal failed");
      setPortalLoading(false);
    }
  }

  const currentPlan = usage?.plan ?? "free";
  const limits = PLAN_LIMITS[currentPlan];
  const usagePercent = usage
    ? Math.min(100, Math.round((usage.aiQueriesUsed / usage.aiQueriesLimit) * 100))
    : 0;
  const nearLimit = usagePercent >= 80;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Billing</h1>
        <p className="mt-1 text-sm text-gray-400">Manage your plan and view usage</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-40 animate-pulse rounded-xl bg-gray-800/60" />
      ) : (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Current plan</p>
              <div className="mt-2 flex items-center gap-3">
                <span className="text-2xl font-bold text-white">{limits.label}</span>
                {currentPlan !== "free" && (
                  <span className="rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs font-medium text-blue-300">
                    ${limits.priceUsd}/mo
                  </span>
                )}
                {currentPlan === "free" && (
                  <span className="rounded-full bg-gray-700 px-2.5 py-0.5 text-xs font-medium text-gray-300">Free</span>
                )}
              </div>
              <ul className="mt-3 space-y-1.5">
                {PLAN_FEATURES[currentPlan].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            {currentPlan !== "free" && (
              <button
                type="button"
                onClick={openPortal}
                disabled={portalLoading}
                className="flex items-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 hover:border-gray-600 hover:text-white disabled:opacity-60 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                {portalLoading ? "Loading..." : "Manage subscription"}
              </button>
            )}
          </div>

          <div className="mt-6 border-t border-gray-800 pt-5">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-gray-300">AI queries this month</span>
              <span className={`font-mono font-semibold ${nearLimit ? "text-amber-400" : "text-gray-300"}`}>
                {usage?.aiQueriesUsed ?? 0} / {usage?.aiQueriesLimit ?? limits.aiQueriesPerMonth}
              </span>
            </div>
            <style>{`.billing-progress-fill { width: ${usagePercent}%; }`}</style>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
              <div
                className={`billing-progress-fill h-full rounded-full transition-all ${
                  usagePercent >= 100 ? "bg-red-500" : nearLimit ? "bg-amber-500" : "bg-blue-500"
                }`}
              />
            </div>
            {nearLimit && usagePercent < 100 && (
              <p className="mt-2 text-xs text-amber-400">
                Approaching your monthly AI query limit. Upgrade to avoid interruptions.
              </p>
            )}
            {usagePercent >= 100 && (
              <p className="mt-2 text-xs text-red-400">
                Monthly AI query limit reached. Upgrade to continue using the AI copilot.
              </p>
            )}
          </div>
        </div>
      )}

      {currentPlan !== "business" && (
        <div>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">Upgrade your plan</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {(["growth", "business"] as const)
              .filter((p) => {
                const tier: Record<PlanTier, number> = { free: 0, growth: 1, business: 2 };
                return tier[p] > tier[currentPlan];
              })
              .map((plan) => {
                const pl = PLAN_LIMITS[plan];
                return (
                  <div
                    key={plan}
                    className={`flex flex-col rounded-xl border p-6 ${
                      plan === "growth" ? "border-blue-500/30 bg-blue-500/5" : "border-gray-800 bg-gray-900"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{pl.label}</p>
                        <div className="mt-1 flex items-baseline gap-1">
                          <span className="font-mono text-3xl font-bold text-white">${pl.priceUsd}</span>
                          <span className="text-sm text-gray-400">/mo</span>
                        </div>
                      </div>
                      {plan === "growth" && (
                        <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-medium text-blue-300">Popular</span>
                      )}
                    </div>
                    <ul className="mt-4 flex-grow space-y-2">
                      {PLAN_FEATURES[plan].map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => startCheckout(plan)}
                      disabled={checkoutLoading !== null}
                      className={`mt-5 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all disabled:opacity-60 ${
                        plan === "growth"
                          ? "bg-blue-500 text-white hover:bg-blue-600"
                          : "border border-gray-700 text-gray-300 hover:border-gray-600 hover:text-white"
                      }`}
                    >
                      {checkoutLoading === plan ? (
                        <><Zap className="h-4 w-4 animate-pulse" /> Redirecting...</>
                      ) : (
                        <>Upgrade to {pl.label} <ArrowRight className="h-4 w-4" /></>
                      )}
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 text-sm text-gray-400">
        <p>
          <span className="font-semibold text-gray-300">MRR cap for your plan: </span>
          ${limits.mrrCapUsd.toLocaleString()} — accounts tracking more MRR than their plan cap will be prompted to upgrade.
        </p>
      </div>
    </div>
  );
}
