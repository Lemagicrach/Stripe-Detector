// src/app/api/cron/sync-all/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server-clients";
import { syncStripeMetrics } from "@/lib/stripe-metrics";
import { verifyCronAuth } from "@/lib/cron-auth";
import { log } from "@/lib/logger";
import { pingHealthcheck } from "@/lib/healthcheck";
import { withStripeConnect } from "@/lib/stripe-connect";

const ROUTE = "/api/cron/sync-all";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const HC = process.env.HC_SYNC_ALL_URL;
  await pingHealthcheck(HC, "start");

  try {
    const admin = getSupabaseAdminClient();
    const { data: connections } = await admin
      .from("stripe_connections")
      .select("id, user_id, stripe_account_id, encrypted_access_token, account_name")
      .eq("status", "active");

    if (!connections?.length) {
      await pingHealthcheck(HC);
      return NextResponse.json({ success: true, synced: 0 });
    }

    let synced = 0, errors = 0;
    const today = new Date().toISOString().split("T")[0];

    for (const conn of connections) {
      try {
        const metrics = await withStripeConnect(conn.id, (stripe) => syncStripeMetrics(stripe));

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
        log("error", "Sync failed", { route: ROUTE, stripeAccountId: conn.stripe_account_id, connectionId: conn.id, error: err });
        const errMsg = err instanceof Error ? err.message : "";
        if (errMsg.includes("Invalid API Key") || errMsg.includes("deauthorized")) {
          await admin.from("stripe_connections").update({ status: "error" }).eq("id", conn.id);
        }
      }
    }

    await pingHealthcheck(HC);
    return NextResponse.json({ success: true, synced, errors, total: connections.length });
  } catch (err) {
    await pingHealthcheck(HC, "fail");
    throw err;
  }
}
