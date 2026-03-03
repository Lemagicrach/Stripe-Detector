// src/app/api/stripe/sync/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/server-clients";
import { syncStripeMetrics } from "@/lib/stripe-metrics";
import { handleApiError, unauthorized, badRequest } from "@/lib/server-error";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const { allowed } = checkRateLimit({ key: "stripe-sync", limit: 5, windowMs: 60_000 });
    if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return unauthorized();

    const admin = getSupabaseAdminClient();
    const { data: connection } = await admin
      .from("stripe_connections")
      .select("id, stripe_account_id, encrypted_access_token")
      .eq("user_id", user.id).eq("status", "active").limit(1).single();

    if (!connection) return badRequest("No active Stripe connection found");

    const metrics = await syncStripeMetrics(connection.stripe_account_id, connection.encrypted_access_token);
    const today = new Date().toISOString().split("T")[0];

    await admin.from("metrics_snapshots").upsert({
      connection_id: connection.id, user_id: user.id,
      mrr: metrics.mrr, arr: metrics.arr,
      active_customers: metrics.activeCustomers, churn_rate: metrics.churnRate,
      nrr: metrics.nrr, arpu: metrics.arpu,
      new_mrr: metrics.newMrr, expansion_mrr: metrics.expansionMrr,
      churned_mrr: metrics.churnedMrr, contraction_mrr: metrics.contractionMrr,
      snapshot_date: today,
    }, { onConflict: "connection_id,snapshot_date" });

    await admin.from("stripe_connections").update({ last_sync_at: new Date().toISOString() }).eq("id", connection.id);

    return NextResponse.json({
      success: true, syncedAt: new Date().toISOString(),
      metrics: {
        mrr: metrics.mrr, arr: metrics.arr,
        activeCustomers: metrics.activeCustomers, churnRate: metrics.churnRate,
        nrr: metrics.nrr, arpu: metrics.arpu,
        newMrr: metrics.newMrr, churnedMrr: metrics.churnedMrr,
      },
    });
  } catch (error) {
    return handleApiError(error, "STRIPE_SYNC");
  }
}
