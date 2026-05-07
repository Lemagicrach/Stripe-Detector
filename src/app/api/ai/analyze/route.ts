// src/app/api/ai/analyze/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/server-clients";
import { handleApiError, unauthorized, badRequest, rateLimited } from "@/lib/server-error";
import { checkRateLimit } from "@/lib/rate-limit";
import { computeAiCostCents } from "@/lib/ai-pricing";
import { log } from "@/lib/logger";
import { PLAN_LIMITS, type PlanTier } from "@/lib/stripe";

type StripeConnection = {
  id: string;
};

type MetricsSnapshot = {
  mrr: number;
  active_customers: number;
  churn_rate: number;
  nrr: number;
};

type RevenueLeak = {
  title: string;
  lost_revenue: number;
};

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return unauthorized();

    const { success, reset } = await checkRateLimit("ai", user.id);
    if (!success) return rateLimited(reset);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return badRequest("AI not configured");

    const admin = getSupabaseAdminClient();

    const { data: profileRaw } = await admin
      .from("user_profiles")
      .select("plan")
      .eq("id", user.id)
      .single();
    const plan = ((profileRaw as { plan?: string } | null)?.plan ?? "free") as PlanTier;
    const planConfig = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
    const limit = planConfig.aiQueriesPerMonth;
    const maxCostCents = planConfig.aiMaxCostCentsPerMonth;

    const { data: quotaResult, error: quotaError } = await admin.rpc(
      "increment_ai_usage_if_allowed",
      { p_user_id: user.id, p_plan_limit: limit, p_max_cost_cents: maxCostCents }
    );
    if (quotaError) {
      log("error", "Quota RPC failed", { route: "/api/ai/analyze", userId: user.id, error: quotaError });
      return badRequest("Quota check failed");
    }
    const quota = quotaResult as { allowed?: boolean; event_id?: string; reason?: string } | null;
    if (!quota?.allowed) {
      return NextResponse.json(
        {
          error: quota?.reason === "cost_limit" ? "Monthly AI cost limit reached" : "Monthly AI query limit reached",
          plan,
          limit,
          maxCostCents,
          reason: quota?.reason,
          upgradeUrl: "/dashboard/billing",
        },
        { status: 402 }
      );
    }
    const usageEventId = quota.event_id ?? null;

    const { data: connectionRaw } = await admin.from("stripe_connections").select("id")
      .eq("user_id", user.id).eq("status", "active").limit(1).single();
    const connection = connectionRaw as unknown as StripeConnection | null;

    if (!connection) return NextResponse.json({ analysis: "Connect your Stripe account to get AI-powered insights." });

    const [metricsRes, leaksRes] = await Promise.all([
      admin.from("metrics_snapshots").select("*").eq("connection_id", connection.id)
        .order("snapshot_date", { ascending: false }).limit(1),
      admin.from("revenue_leaks").select("category, severity, title, lost_revenue, recoverable_revenue")
        .eq("connection_id", connection.id).eq("status", "open").order("lost_revenue", { ascending: false }).limit(5),
    ]);

    const metrics = ((metricsRes.data as unknown as MetricsSnapshot[] | null)?.[0] ?? null);
    const leaks = (leaksRes.data as unknown as RevenueLeak[] | null) ?? [];

    const prompt = `You are a SaaS revenue analyst. Given these metrics and leaks, provide a 3-4 bullet analysis of what's working, what's broken, and the #1 action to take.

Metrics: ${metrics ? `MRR: $${metrics.mrr}, Customers: ${metrics.active_customers}, Churn: ${(metrics.churn_rate * 100).toFixed(2)}%, NRR: ${(metrics.nrr * 100).toFixed(1)}%` : "No metrics yet"}
Leaks: ${leaks.length > 0 ? leaks.map(l => `${l.title}: $${l.lost_revenue} lost`).join("; ") : "None detected"}

Be specific with numbers. Be direct.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-5-20250929", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
    });

    const data = await response.json();
    const text = data.content?.map((c: any) => c.text || "").join("") || "Analysis unavailable.";

    // Backfill cost_cents on the usage_events row this request created.
    const inputTokens = data.usage?.input_tokens ?? 0;
    const outputTokens = data.usage?.output_tokens ?? 0;
    if (usageEventId && (inputTokens > 0 || outputTokens > 0)) {
      const costCents = computeAiCostCents(inputTokens, outputTokens);
      try {
        await admin
          .from("usage_events")
          .update({
            metadata: {
              used: null,
              limit,
              input_tokens: inputTokens,
              output_tokens: outputTokens,
              cost_cents: costCents,
            },
          })
          .eq("id", usageEventId);
      } catch (updateErr) {
        log("warn", "Failed to backfill cost_cents", {
          route: "/api/ai/analyze",
          userId: user.id,
          usageEventId,
          error: updateErr,
        });
      }
    }

    return NextResponse.json({ analysis: text });
  } catch (error) {
    return handleApiError(error, "AI_ANALYZE");
  }
}
