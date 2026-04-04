import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/server-clients";
import { buildRevenueInsights } from "@/lib/insights";
import { handleApiError, unauthorized } from "@/lib/server-error";

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return unauthorized();

    const admin = getSupabaseAdminClient();

    const connectionResult = await admin
      .from("stripe_connections")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);

    if (connectionResult.error) throw connectionResult.error;

    const activeConnection = connectionResult.data?.[0] ?? null;

    const [metricsResult, leaksResult, signalsResult] = await Promise.all([
      activeConnection
        ? admin
            .from("metrics_snapshots")
            .select("snapshot_date, mrr, active_customers, churn_rate, nrr, new_mrr, churned_mrr")
            .eq("connection_id", activeConnection.id)
            .order("snapshot_date", { ascending: false })
            .limit(2)
        : Promise.resolve({ data: [], error: null }),
      admin
        .from("revenue_leaks")
        .select("id, category, severity, title, description, recoverable_revenue, fix_steps, status, detected_at")
        .eq("user_id", user.id)
        .in("status", ["open", "in_progress"])
        .order("recoverable_revenue", { ascending: false })
        .limit(20),
      admin
        .from("revenue_signals")
        .select("id, type, severity, title, description, data, read, created_at")
        .eq("user_id", user.id)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (metricsResult.error) throw metricsResult.error;
    if (leaksResult.error) throw leaksResult.error;
    if (signalsResult.error) throw signalsResult.error;

    const insights = buildRevenueInsights({
      hasActiveConnection: Boolean(activeConnection),
      metricsSnapshots: metricsResult.data,
      leaks: leaksResult.data,
      signals: signalsResult.data,
    });

    return NextResponse.json({ ok: true, insights });
  } catch (error) {
    return handleApiError(error, "INSIGHTS_GET");
  }
}
