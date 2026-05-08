// src/app/api/cron/check-ai-budget/route.ts
//
// Daily sweep over all active users to flag those approaching their plan's
// AI cost ceiling. Sends a one-shot warning email at the 80% threshold and
// records a usage_events row so we can avoid re-spamming the user every
// day for the rest of the month.
//
// We rely on the per-call cost_cents already persisted in usage_events.metadata
// by /api/ai/copilot and /api/ai/analyze (Task 2.3). Hard cap enforcement
// happens at request time in increment_ai_usage_if_allowed; this cron is
// purely defensive UX (give the user a chance to upgrade before getting
// 402'd in the middle of the month).

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server-clients";
import { verifyCronAuth } from "@/lib/cron-auth";
import { sendEmail } from "@/lib/email";
import { BudgetWarning } from "@/emails/BudgetWarning";
import { log } from "@/lib/logger";
import { pingHealthcheck } from "@/lib/healthcheck";
import { PLAN_LIMITS, type PlanTier } from "@/lib/stripe";

const ROUTE = "/api/cron/check-ai-budget";
const WARN_AT_PERCENT = 80;

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const HC = process.env.HC_AI_BUDGET_URL;
  await pingHealthcheck(HC, "start");

  try {
    const admin = getSupabaseAdminClient();
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const { data: profiles, error: profilesError } = await admin
      .from("user_profiles")
      .select("id, email, plan");

    if (profilesError) throw profilesError;

    let warned = 0;
    let alreadyWarned = 0;
    let underThreshold = 0;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://corvidet.com";

    for (const row of profiles ?? []) {
      const profile = row as { id: string; email: string | null; plan: PlanTier };
      const planConfig = PLAN_LIMITS[profile.plan] ?? PLAN_LIMITS.free;
      const cap = planConfig.aiMaxCostCentsPerMonth;
      if (cap <= 0) continue;

      // Has the user already received a warning this month? If yes, skip.
      const { count: warningCount } = await admin
        .from("usage_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .eq("event_type", "ai_budget_warning")
        .gte("created_at", monthStart.toISOString());

      if ((warningCount ?? 0) > 0) {
        alreadyWarned++;
        continue;
      }

      // Sum cost_cents across this month's ai_query rows.
      const { data: events } = await admin
        .from("usage_events")
        .select("metadata")
        .eq("user_id", profile.id)
        .eq("event_type", "ai_query")
        .gte("created_at", monthStart.toISOString());

      let spent = 0;
      for (const e of (events ?? []) as Array<{ metadata: { cost_cents?: number } | null }>) {
        const c = e.metadata?.cost_cents;
        if (typeof c === "number" && c > 0) spent += c;
      }

      const percent = Math.floor((spent / cap) * 100);
      if (percent < WARN_AT_PERCENT) {
        underThreshold++;
        continue;
      }

      // Record warning first (idempotency guard for next run) then send email.
      await admin.from("usage_events").insert({
        user_id: profile.id,
        event_type: "ai_budget_warning",
        metadata: { plan: profile.plan, spent_cents: spent, cap_cents: cap, percent },
      });

      if (profile.email) {
        try {
          await sendEmail({
            to: profile.email,
            subject: `You're at ${percent}% of this month's AI budget`,
            react: BudgetWarning({
              plan: profile.plan,
              spentCents: spent,
              capCents: cap,
              percent,
              billingUrl: `${appUrl}/dashboard/billing`,
            }),
            transactional: true,
          });
        } catch (emailErr) {
          log("warn", "Budget warning email failed", { route: ROUTE, userId: profile.id, error: emailErr });
        }
      }
      warned++;
    }

    await pingHealthcheck(HC);
    return NextResponse.json({ warned, alreadyWarned, underThreshold, total: profiles?.length ?? 0 });
  } catch (err) {
    await pingHealthcheck(HC, "fail");
    log("error", "Check AI budget failed", { route: ROUTE, error: err });
    return NextResponse.json({ error: "check_ai_budget_failed" }, { status: 500 });
  }
}
