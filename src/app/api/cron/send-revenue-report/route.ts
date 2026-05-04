import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server-clients";
import { sendViaResend } from "@/lib/resend";
import { handleApiError } from "@/lib/server-error";
import { verifyCronAuth } from "@/lib/cron-auth";
import { log } from "@/lib/logger";
import { pingHealthcheck } from "@/lib/healthcheck";

const ROUTE = "/api/cron/send-revenue-report";

export const maxDuration = 120;

function buildReportHtml(params: {
  accountName: string;
  mrr: number;
  arr: number;
  churnRate: number;
  activeCustomers: number;
  openLeaks: number;
  recoverableRevenue: number;
  appUrl: string;
}): string {
  const { accountName, mrr, arr, churnRate, activeCustomers, openLeaks, recoverableRevenue, appUrl } = params;
  const churnPct = (churnRate * 100).toFixed(2);

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Your Weekly Revenue Report</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1f2937;background:#f9fafb;">
  <div style="background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e7eb;">
    <h1 style="font-size:20px;margin:0 0 4px;">Weekly Revenue Report</h1>
    <p style="color:#6b7280;margin:0 0 24px;font-size:14px;">${accountName}</p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr>
        <td style="padding:12px;background:#f3f4f6;border-radius:6px;text-align:center;width:50%;">
          <div style="font-size:24px;font-weight:700;color:#111827;">$${mrr.toLocaleString()}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:4px;">Monthly Recurring Revenue</div>
        </td>
        <td style="width:8px;"></td>
        <td style="padding:12px;background:#f3f4f6;border-radius:6px;text-align:center;width:50%;">
          <div style="font-size:24px;font-weight:700;color:#111827;">$${arr.toLocaleString()}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:4px;">Annual Recurring Revenue</div>
        </td>
      </tr>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">
          <span style="color:#6b7280;font-size:14px;">Active Customers</span>
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;">
          ${activeCustomers.toLocaleString()}
        </td>
      </tr>
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">
          <span style="color:#6b7280;font-size:14px;">Monthly Churn Rate</span>
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;color:${parseFloat(churnPct) > 5 ? "#ef4444" : "#111827"};">
          ${churnPct}%
        </td>
      </tr>
      <tr>
        <td style="padding:8px 0;">
          <span style="color:#6b7280;font-size:14px;">Open Revenue Leaks</span>
        </td>
        <td style="padding:8px 0;text-align:right;font-weight:600;color:${openLeaks > 0 ? "#f59e0b" : "#10b981"};">
          ${openLeaks}
        </td>
      </tr>
    </table>

    ${openLeaks > 0 ? `
    <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:16px;margin-bottom:24px;">
      <strong style="color:#92400e;">⚠ $${recoverableRevenue.toLocaleString()} recoverable revenue detected</strong>
      <p style="margin:8px 0 0;font-size:14px;color:#78350f;">
        You have ${openLeaks} open revenue leak${openLeaks > 1 ? "s" : ""}.
        Review and take action to recover this revenue.
      </p>
    </div>` : `
    <div style="background:#d1fae5;border:1px solid #6ee7b7;border-radius:6px;padding:16px;margin-bottom:24px;">
      <strong style="color:#065f46;">✓ No open revenue leaks — great work!</strong>
    </div>`}

    <a href="${appUrl}/dashboard" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;font-size:14px;">
      View Full Dashboard →
    </a>

    <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">
      You're receiving this because you have an active Corvidet account.
      Weekly reports are sent every Monday.
    </p>
  </div>
</body>
</html>`;
}

export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const HC = process.env.HC_SEND_REPORT_URL;
  await pingHealthcheck(HC, "start");

  try {
    const admin = getSupabaseAdminClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://corvidet.com";

    // Get all active users with at least one active connection
    const { data: connections } = await admin
      .from("stripe_connections")
      .select("id, user_id, account_name")
      .eq("status", "active");

    if (!connections?.length) {
      await pingHealthcheck(HC);
      return NextResponse.json({ success: true, sent: 0 });
    }

    // Deduplicate by user_id (use first connection per user)
    const perUser = new Map<string, { connectionId: string; accountName: string }>();
    for (const conn of connections) {
      if (!perUser.has(conn.user_id)) {
        perUser.set(conn.user_id, {
          connectionId: conn.id,
          accountName: conn.account_name ?? "Your Stripe Account",
        });
      }
    }

    let sent = 0;
    let errors = 0;

    for (const [userId, { connectionId, accountName }] of perUser) {
      try {
        // Get user email
        const { data: profile } = await admin
          .from("user_profiles")
          .select("email")
          .eq("id", userId)
          .single();

        if (!profile?.email) continue;

        // Get latest metrics snapshot
        const { data: snapshot } = await admin
          .from("metrics_snapshots")
          .select("mrr, arr, churn_rate, active_customers")
          .eq("connection_id", connectionId)
          .order("snapshot_date", { ascending: false })
          .limit(1)
          .single();

        // Get open leaks summary
        const { data: leaks } = await admin
          .from("revenue_leaks")
          .select("recoverable_revenue")
          .eq("connection_id", connectionId)
          .eq("status", "open");

        const openLeaks = leaks?.length ?? 0;
        const recoverableRevenue = Math.round(
          (leaks ?? []).reduce((sum, l) => sum + (l.recoverable_revenue ?? 0), 0)
        );

        const html = buildReportHtml({
          accountName,
          mrr: Math.round(snapshot?.mrr ?? 0),
          arr: Math.round(snapshot?.arr ?? 0),
          churnRate: snapshot?.churn_rate ?? 0,
          activeCustomers: snapshot?.active_customers ?? 0,
          openLeaks,
          recoverableRevenue,
          appUrl,
        });

        await sendViaResend({
          to: profile.email,
          subject: `Your weekly revenue report — MRR $${Math.round(snapshot?.mrr ?? 0).toLocaleString()}`,
          html,
        });

        sent++;
      } catch (err) {
        errors++;
        log("error", "Revenue report send failed", { route: ROUTE, userId, error: err });
      }
    }

    await pingHealthcheck(HC);
    return NextResponse.json({ success: true, sent, errors, total: perUser.size });
  } catch (error) {
    await pingHealthcheck(HC, "fail");
    return handleApiError(error, "CRON_REPORT");
  }
}
