import { NextResponse } from "next/server";
import {
  generateMonthlyRevenueHealthReport,
  getPreviousMonthRange,
  sendMonthlyReportEmail,
  toIsoDate,
} from "@/lib/monthly-reports";
import { verifyCronAuth } from "@/lib/cron-auth";
import { getSupabaseAdminClient } from "@/lib/server-clients";
import { handleApiError } from "@/lib/server-error";
import { log } from "@/lib/logger";
import { pingHealthcheck } from "@/lib/healthcheck";

const ROUTE = "/api/cron/run-monthly-health";

export const maxDuration = 300;

async function runMonthlyHealth(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const HC = process.env.HC_MONTHLY_HEALTH_URL;
  await pingHealthcheck(HC, "start");

  try {
    const admin = getSupabaseAdminClient();
    const { start, end } = getPreviousMonthRange();
    const startDate = toIsoDate(start);
    const endDate = toIsoDate(end);

    const { data: connections, error } = await admin
      .from("stripe_connections")
      .select("id, user_id")
      .eq("status", "active")
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const results: Array<{
      connection_id: string;
      user_id: string;
      ok: boolean;
      report_id?: string;
      email_sent?: boolean;
      error?: string;
    }> = [];

    for (const connection of connections ?? []) {
      try {
        const report = await generateMonthlyRevenueHealthReport({
          userId: connection.user_id,
          connectionId: connection.id,
          startDate,
          endDate,
        });

        let emailSent = false;
        try {
          await sendMonthlyReportEmail({
            userId: connection.user_id,
            reportId: report.reportId,
          });
          emailSent = true;
        } catch (emailError) {
          log("error", "Monthly health email failed", { route: ROUTE, connectionId: connection.id, userId: connection.user_id, error: emailError });
        }

        results.push({
          connection_id: connection.id,
          user_id: connection.user_id,
          ok: true,
          report_id: report.reportId,
          email_sent: emailSent,
        });
      } catch (connectionError) {
        results.push({
          connection_id: connection.id,
          user_id: connection.user_id,
          ok: false,
          error:
            connectionError instanceof Error ? connectionError.message : "Unknown connection error",
        });
      }
    }

    await pingHealthcheck(HC);
    return NextResponse.json({
      ok: true,
      period_start: startDate,
      period_end: endDate,
      processed: results.length,
      failed: results.filter((result) => !result.ok).length,
      results,
    });
  } catch (error) {
    await pingHealthcheck(HC, "fail");
    return handleApiError(error, "MONTHLY_HEALTH_CRON");
  }
}

export async function GET(request: Request) {
  return runMonthlyHealth(request);
}

export async function POST(request: Request) {
  return runMonthlyHealth(request);
}
