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
import { sendViaResend } from "@/lib/resend";
import { log } from "@/lib/logger";
import { pingHealthcheck } from "@/lib/healthcheck";
import { PLAN_LIMITS, type PlanTier } from "@/lib/stripe";

const ROUTE = "/api/cron/check-ai-budget";
const WARN_AT_PERCENT = 80;

function buildBudgetWarningEmail(
  plan: PlanTier,
  spentCents: number,
  capCents: number,
  percent: number,
  billingUrl: string
): string {
  const spentDollars = (spentCents / 100).toFixed(2);
  const capDollars = (capCents / 100).toFixed(2);
  return `<!DOCTYPE html>
<html>
  <body style="font-family:Arial,sans-serif;background:#f8fafc;color:#0f172a;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;">
      <h1 style="margin:0 0 16px;font-size:22px;">You're at ${percent}% of this month's AI budget</h1>
      <p style="margin:0 0 12px;line-height:1.6;">Your <strong>${plan}</strong> plan includes up to <strong>$${capDollars}</strong> of AI usage per calendar month. You've used <strong>$${spentDollars}</strong> so far.</p>
      <p style="margin:0 0 12px;line-height:1.6;">If you hit 100%, AI features (copilot and analyze) will return an error until your usage resets at the start of next month. Upgrade to keep going without interruption:</p>
      <p style="margin:20px 0;text-align:center;">
        <a href="${billingUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Upgrade plan</a>
      </p>
      <p style="margin:0;line-height:1.6;color:#64748b;font-size:14px;">No action required — your existing usage is unaffected. This is a courtesy heads-up so you don't get cut off mid-month.</p>
      <p style="margin:24px 0 0;color:#64748b;font-size:13px;">— Corvidet</p>
    </div>
  </body>
</html>`;
}

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
          await sendViaResend({
            to: profile.email,
            subject: `You're at ${percent}% of this month's AI budget`,
            html: buildBudgetWarningEmail(profile.plan, spent, cap, percent, `${appUrl}/dashboard/billing`),
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
