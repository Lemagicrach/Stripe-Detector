import { NextRequest, NextResponse } from "next/server";
import {
  formatPeriodLabel,
  generateMonthlyRevenueHealthReports,
  getPreviousMonthRange,
  listActiveConnections,
  listMonthlyReports,
  toIsoDate,
} from "@/lib/monthly-reports";
import { badRequest, handleApiError, unauthorized } from "@/lib/server-error";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type GenerateBody = {
  connection_id?: string;
  start_date?: string;
  end_date?: string;
};

function parseLimit(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("limit must be a positive integer");
  }

  return Math.min(parsed, 24);
}

function resolveRequestedPeriod(body: GenerateBody) {
  const hasStart = Boolean(body.start_date);
  const hasEnd = Boolean(body.end_date);

  if (hasStart !== hasEnd) {
    throw new Error("start_date and end_date must be provided together");
  }

  if (body.start_date && body.end_date) {
    return {
      startDate: body.start_date,
      endDate: body.end_date,
    };
  }

  const { start, end } = getPreviousMonthRange();
  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return unauthorized();

    const connectionId = request.nextUrl.searchParams.get("connection_id") ?? undefined;
    let limit: number | undefined;
    try {
      limit = parseLimit(request.nextUrl.searchParams.get("limit"));
    } catch (error) {
      return badRequest(error instanceof Error ? error.message : "Invalid limit");
    }

    const [reports, connections] = await Promise.all([
      listMonthlyReports(user.id, connectionId, limit),
      listActiveConnections(user.id),
    ]);

    const { start, end } = getPreviousMonthRange();

    return NextResponse.json({
      reports,
      connections,
      recommendedPeriod: {
        startDate: toIsoDate(start),
        endDate: toIsoDate(end),
        label: formatPeriodLabel(start),
      },
    });
  } catch (error) {
    return handleApiError(error, "MONTHLY_REPORTS_LIST");
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return unauthorized();

    const body = (await request.json().catch(() => ({}))) as GenerateBody;

    let period;
    try {
      period = resolveRequestedPeriod(body);
    } catch (error) {
      return badRequest(error instanceof Error ? error.message : "Invalid request body");
    }

    const reports = await generateMonthlyRevenueHealthReports({
      userId: user.id,
      connectionId: body.connection_id,
      startDate: period.startDate,
      endDate: period.endDate,
    });

    return NextResponse.json({
      reports,
      generatedCount: reports.length,
      period,
    });
  } catch (error) {
    return handleApiError(error, "MONTHLY_REPORTS_GENERATE");
  }
}
