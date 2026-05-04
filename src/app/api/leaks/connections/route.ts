import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/server-clients";
import { handleApiError, unauthorized } from "@/lib/server-error";
import { log } from "@/lib/logger";

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
      return NextResponse.json({ leaks: [], leakScore: 0, message: "No active Stripe connection" });
    }

    const { data: leaks, error } = await admin
      .from("revenue_leaks")
      .select("id, title, description, category, severity, lost_revenue, recoverable_revenue, affected_customers, fix_steps, status, created_at")
      .eq("connection_id", connection.id)
      .eq("status", "open")
      .order("lost_revenue", { ascending: false });

    if (error) {
      log("error", "Leaks connections query failed", { route: "/api/leaks/connections", userId: user.id, error });
      return NextResponse.json({ leaks: [], leakScore: 0 });
    }

    const totalLost = (leaks ?? []).reduce((s, l) => s + (l.lost_revenue ?? 0), 0);
    const { data: snap } = await admin
      .from("metrics_snapshots")
      .select("mrr")
      .eq("connection_id", connection.id)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .single();

    const mrr = snap?.mrr ?? 0;
    const leakScore = mrr > 0 ? Math.max(0, Math.round(100 - (totalLost / mrr) * 100)) : 0;

    return NextResponse.json({ leaks: leaks ?? [], leakScore });
  } catch (error) {
    return handleApiError(error, "LEAKS_CONNECTIONS");
  }
}
