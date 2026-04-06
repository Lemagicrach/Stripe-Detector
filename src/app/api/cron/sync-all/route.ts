// src/app/api/cron/sync-all/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server-clients";
import { syncStripeMetrics } from "@/lib/stripe-metrics";
import { verifyCronAuth } from "@/lib/cron-auth";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const admin = getSupabaseAdminClient();
  const { data: connections } = await admin
    .from("stripe_connections")
    .select("id, user_id, stripe_account_id, encrypted_access_token, account_name")
    .eq("status", "active");

  if (!connections?.length) return NextResponse.json({ success: true, synced: 0 });

  let synced = 0, errors = 0;
  const today = new Date().toISOString().split("T")[0];

  for (const conn of connections) {
    try {
      const metrics = await syncStripeMetrics(conn.stripe_account_id, conn.encrypted_access_token);

      await admin.from("metrics_snapshots").upsert({
        connection_id: conn.id, user_id: conn.user_id,
        mrr: metrics.mrr, arr: metrics.arr,
        active_customers: metrics.activeCustomers, churn_rate: metrics.churnRate,
        nrr: metrics.nrr, arpu: metrics.arpu,
        new_mrr: metrics.newMrr, expansion_mrr: metrics.expansionMrr,
        churned_mrr: metrics.churnedMrr, contraction_mrr: metrics.contractionMrr,
        snapshot_date: today,
      }, { onConflict: "connection_id,snapshot_date" });

      await admin.from("stripe_connections").update({ last_sync_at: new Date().toISOString() }).eq("id", conn.id);
      synced++;
    } catch (err) {
      errors++;
      console.error(`Sync failed for ${conn.stripe_account_id}:`, err);
      const errMsg = err instanceof Error ? err.message : "";
      if (errMsg.includes("Invalid API Key") || errMsg.includes("deauthorized")) {
        await admin.from("stripe_connections").update({ status: "error" }).eq("id", conn.id);
      }
    }
  }

  return NextResponse.json({ success: true, synced, errors, total: connections.length });
}
