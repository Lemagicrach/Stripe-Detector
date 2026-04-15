import { NextRequest, NextResponse } from "next/server";
import { sendMonthlyReportEmail } from "@/lib/monthly-reports";
import { badRequest, handleApiError, unauthorized } from "@/lib/server-error";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return unauthorized();

    const body = (await request.json().catch(() => ({}))) as { report_id?: string };
    if (!body.report_id) {
      return badRequest("report_id is required");
    }

    const result = await sendMonthlyReportEmail({
      userId: user.id,
      reportId: body.report_id,
    });

    return NextResponse.json({ ok: true, email: result.email, reportUrl: result.reportUrl });
  } catch (error) {
    return handleApiError(error, "MONTHLY_REPORT_EMAIL");
  }
}
