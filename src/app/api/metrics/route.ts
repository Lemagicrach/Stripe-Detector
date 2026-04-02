// src/app/api/metrics/route.ts
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
      .from("stripe_connections").select("id")
      .eq("user_id", user.id).eq("status", "active").limit(1).single();

    if (!connection) return NextResponse.json({ data: null, message: "No Stripe connection" });

    const [latestRes, historyRes] = await Promise.all([
      admin.from("metrics_snapshots").select("*")
        .eq("connection_id", connection.id).order("snapshot_date", { ascending: false }).limit(1),
      admin.from("metrics_snapshots")
        .select("snapshot_date, mrr, active_customers, churn_rate, nrr, arpu")
        .eq("connection_id", connection.id).order("snapshot_date", { ascending: true }).limit(90),
    ]);

    const latest = latestRes.data?.[0] || null;
    const history = historyRes.data || [];

    let mrrChange = 0, churnChange = 0;
    if (history.length >= 2) {
      const prev = history[history.length - 2];
      const curr = history[history.length - 1];
      if (prev.mrr > 0) mrrChange = ((curr.mrr - prev.mrr) / prev.mrr) * 100;
      churnChange = (curr.churn_rate - prev.churn_rate) * 100;
    }

    return NextResponse.json({ current: latest, history, changes: { mrrChange, churnChange } });
  } catch (error) {
    return handleApiError(error, "METRICS_GET");
  }
}
