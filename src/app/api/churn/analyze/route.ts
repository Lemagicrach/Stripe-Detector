import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/server-clients";
import { handleApiError, unauthorized } from "@/lib/server-error";

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return unauthorized();

    const admin = getSupabaseAdminClient();

    const { data: connection } = await admin
      .from("stripe_connections")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .single();

    if (!connection) {
      return NextResponse.json({ churnRate: 0, atRiskCount: 0, atRiskMrr: 0, history: [], atRiskCustomers: [] });
    }

    // Churn rate history from metrics snapshots
    const { data: snapshots } = await admin
      .from("metrics_snapshots")
      .select("snapshot_date, churn_rate, mrr")
      .eq("connection_id", connection.id)
      .order("snapshot_date", { ascending: false })
      .limit(30);

    const history = (snapshots ?? [])
      .reverse()
      .map((s) => ({
        date: new Date(s.snapshot_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        churnRate: parseFloat((s.churn_rate * 100).toFixed(2)),
      }));

    const currentChurnRate = snapshots?.[0]
      ? parseFloat((snapshots[0].churn_rate * 100).toFixed(2))
      : 0;

    // At-risk customers: pending cancellations + zombie subs
    const { data: atRiskLeaks } = await admin
      .from("revenue_leaks")
      .select("id, type, severity, revenue_impact, recovery_probability, title, description, created_at")
      .eq("connection_id", connection.id)
      .in("category", ["pending_cancel", "zombie_sub"])
      .eq("status", "open")
      .order("revenue_impact", { ascending: false })
      .limit(50);

    const atRiskCustomers = (atRiskLeaks ?? []).map((leak) => ({
      id: leak.id,
      type: leak.type as "pending_cancel" | "zombie_sub",
      severity: leak.severity as string,
      title: leak.title as string,
      description: leak.description as string,
      revenueAtRisk: (leak.revenue_impact as number) ?? 0,
      recoveryProbability: (leak.recovery_probability as number) ?? 0,
      detectedAt: leak.created_at as string,
    }));

    const atRiskMrr = atRiskCustomers.reduce((sum, c) => sum + c.revenueAtRisk, 0);

    return NextResponse.json({
      churnRate: currentChurnRate,
      atRiskCount: atRiskCustomers.length,
      atRiskMrr: Math.round(atRiskMrr * 100) / 100,
      history,
      atRiskCustomers,
    });
  } catch (error) {
    return handleApiError(error, "CHURN_ANALYZE");
  }
}
