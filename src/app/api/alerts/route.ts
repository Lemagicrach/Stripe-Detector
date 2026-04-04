import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/server-clients";
import { buildRevenueAlerts } from "@/lib/alerts";
import { handleApiError, unauthorized } from "@/lib/server-error";

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return unauthorized();

    const admin = getSupabaseAdminClient();

    const [leaksResult, signalsResult] = await Promise.all([
      admin
        .from("revenue_leaks")
        .select("id, category, severity, title, description, fix_steps, status, detected_at")
        .eq("user_id", user.id)
        .in("status", ["open", "in_progress"])
        .order("detected_at", { ascending: false })
        .limit(50),
      admin
        .from("revenue_signals")
        .select("id, type, severity, title, description, data, read, created_at")
        .eq("user_id", user.id)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (leaksResult.error) throw leaksResult.error;
    if (signalsResult.error) throw signalsResult.error;

    const alerts = buildRevenueAlerts({
      leaks: leaksResult.data,
      signals: signalsResult.data,
    });

    if (alerts.length === 0) {
      return NextResponse.json({
        alerts: [],
        count: 0,
        message: "No actionable alerts found.",
      });
    }

    return NextResponse.json({ alerts, count: alerts.length });
  } catch (error) {
    return handleApiError(error, "ALERTS_GET");
  }
}
