import { NextResponse } from "next/server";
import { getMonthlyReportById, trackMonthlyReportViewed } from "@/lib/monthly-reports";
import { handleApiError, unauthorized } from "@/lib/server-error";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ reportId: string }> }
) {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return unauthorized();

    const { reportId } = await context.params;
    const report = await getMonthlyReportById(user.id, reportId);
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    await trackMonthlyReportViewed(user.id, reportId);

    return NextResponse.json({ report });
  } catch (error) {
    return handleApiError(error, "MONTHLY_REPORT_DETAIL");
  }
}
