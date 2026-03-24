"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { PLAN_LIMITS, type PlanTier } from "@/lib/stripe";
import { CheckCircle2, Zap, ArrowRight, ExternalLink, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

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

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  useEffect(() => {
    async function loadUsage() {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from("user_profiles")
          .select("plan")
          .eq("id", user.id)
          .single();

        const plan = (
          (profile as { plan?: string } | null)?.plan ?? "free"
        ) as PlanTier;
        const limit =
          PLAN_LIMITS[plan]?.aiQueriesPerMonth ?? PLAN_LIMITS.free.aiQueriesPerMonth;

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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
        signal: controller.signal,
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Failed to create checkout");
      window.location.href = data.url;
    } catch (e) {
      const msg =
        e instanceof Error && e.name === "AbortError"
          ? "Request timed out. Please try again."
          : e instanceof Error
          ? e.message
          : "Checkout failed";
      setError(msg);
      setCheckoutLoading(null);
    } finally {
      clearTimeout(timeout);
    }
  }

  async function openPortal() {
    setPortalLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/create-portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
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
  const atLimit = usagePercent >= 100;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Billing</h1>
        <p className="mt-1 text-sm text-gray-400">Manage your plan and view usage</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Current plan</p>
                <div className="mt-2 flex items-center gap-3">
                  <CardTitle className="text-2xl">{limits.label}</CardTitle>
                  {currentPlan !== "free" ? (
                    <Badge variant="info">${limits.priceUsd}/mo</Badge>
                  ) : (
                    <Badge variant="secondary">Free</Badge>
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={openPortal}
                  disabled={portalLoading}
                  size="sm"
                >
                  <ExternalLink className="h-4 w-4" />
                  {portalLoading ? "Loading..." : "Manage subscription"}
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="border-t border-gray-800 pt-5">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-gray-300">AI queries this month</span>
              <span className={`font-mono font-semibold ${nearLimit ? "text-amber-400" : "text-gray-300"}`}>
                {usage?.aiQueriesUsed ?? 0} / {usage?.aiQueriesLimit ?? limits.aiQueriesPerMonth}
              </span>
            </div>
            <Progress
              value={usagePercent}
              className={atLimit ? "[&>div]:bg-red-500" : nearLimit ? "[&>div]:bg-amber-500" : ""}
            />

            {atLimit && (
              <Alert variant="destructive" className="mt-3">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Monthly AI query limit reached. Upgrade to continue using the AI copilot.
                </AlertDescription>
              </Alert>
            )}
            {nearLimit && !atLimit && (
              <Alert variant="warning" className="mt-3">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Approaching your monthly AI query limit. Upgrade to avoid interruptions.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {currentPlan !== "business" && (
        <div>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Upgrade your plan
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {(["growth", "business"] as const)
              .filter((p) => {
                const tier: Record<PlanTier, number> = { free: 0, growth: 1, business: 2 };
                return tier[p] > tier[currentPlan];
              })
              .map((plan) => {
                const pl = PLAN_LIMITS[plan];
                return (
                  <Card
                    key={plan}
                    className={`flex flex-col ${
                      plan === "growth" ? "border-blue-500/30 bg-blue-500/5" : ""
                    }`}
                  >
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                            {pl.label}
                          </p>
                          <div className="mt-1 flex items-baseline gap-1">
                            <span className="font-mono text-3xl font-bold text-white">
                              ${pl.priceUsd}
                            </span>
                            <span className="text-sm text-gray-400">/mo</span>
                          </div>
                        </div>
                        {plan === "growth" && (
                          <Badge variant="info">Popular</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="flex-grow space-y-0 pb-4 pt-0">
                      <ul className="space-y-2">
                        {PLAN_FEATURES[plan].map((f) => (
                          <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                    <CardContent className="pt-0">
                      <Button
                        type="button"
                        variant={plan === "growth" ? "default" : "outline"}
                        className="w-full"
                        onClick={() => startCheckout(plan)}
                        disabled={checkoutLoading !== null}
                      >
                        {checkoutLoading === plan ? (
                          <>
                            <Zap className="h-4 w-4 animate-pulse" /> Redirecting...
                          </>
                        ) : (
                          <>
                            Upgrade to {pl.label} <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </div>
      )}

      <Card className="bg-gray-900/50">
        <CardContent className="p-5 text-sm text-gray-400">
          <p>
            <span className="font-semibold text-gray-300">MRR cap for your plan: </span>
            ${limits.mrrCapUsd.toLocaleString()} â€” accounts tracking more MRR than their plan cap will be
            prompted to upgrade.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
