import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/server-clients";
import { syncStripeMetrics } from "@/lib/stripe-metrics";
import { detectRevenueLeaks } from "@/lib/revenue-leaks";
import { buildRevenueSignals, GENERATED_SYNC_SIGNAL_TYPES } from "@/lib/revenue-signals";
import { handleApiError, unauthorized, badRequest, rateLimited } from "@/lib/server-error";
import { checkRateLimit } from "@/lib/rate-limit";

async function runSync() {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return unauthorized();

    const { allowed } = checkRateLimit({ key: `sync-stripe-session:${user.id}`, limit: 5, windowMs: 60_000 });
    if (!allowed) return rateLimited();

    const admin = getSupabaseAdminClient();
    const { data: connection, error: connectionError } = await admin
      .from("stripe_connections")
      .select("id, stripe_account_id, account_name, encrypted_access_token")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (connectionError) {
      if (connectionError.code === "PGRST116") {
        return badRequest("No active Stripe connection found");
      }

      throw connectionError;
    }

    const syncedAt = new Date().toISOString();
    const snapshotDate = syncedAt.split("T")[0];
    const metrics = await syncStripeMetrics(connection.stripe_account_id, connection.encrypted_access_token);

    const { error: metricsError } = await admin.from("metrics_snapshots").upsert(
      {
        connection_id: connection.id,
        user_id: user.id,
        mrr: metrics.mrr,
        arr: metrics.arr,
        active_customers: metrics.activeCustomers,
        churn_rate: metrics.churnRate,
        nrr: metrics.nrr,
        arpu: metrics.arpu,
        new_mrr: metrics.newMrr,
        expansion_mrr: metrics.expansionMrr,
        churned_mrr: metrics.churnedMrr,
        contraction_mrr: metrics.contractionMrr,
        snapshot_date: snapshotDate,
      },
      { onConflict: "connection_id,snapshot_date" }
    );

    if (metricsError) throw metricsError;

    const { data: metricsHistory, error: historyError } = await admin
      .from("metrics_snapshots")
      .select("snapshot_date, mrr, churn_rate, nrr, active_customers")
      .eq("connection_id", connection.id)
      .order("snapshot_date", { ascending: false })
      .limit(2);

    if (historyError) throw historyError;

    const detectedLeaks = await detectRevenueLeaks({
      connectionId: connection.id,
      userId: user.id,
      encryptedAccessToken: connection.encrypted_access_token,
      metrics,
    });

    const { error: deleteLeaksError } = await admin
      .from("revenue_leaks")
      .delete()
      .eq("connection_id", connection.id)
      .eq("user_id", user.id)
      .eq("status", "open");

    if (deleteLeaksError) throw deleteLeaksError;

    if (detectedLeaks.length > 0) {
      const { error: insertLeaksError } = await admin.from("revenue_leaks").insert(
        detectedLeaks.map((leak) => ({
          connection_id: connection.id,
          user_id: user.id,
          category: leak.category,
          severity: leak.severity,
          title: leak.title,
          description: leak.description,
          lost_revenue: leak.lostRevenue,
          recoverable_revenue: leak.recoverableRevenue,
          affected_customers: leak.affectedCustomers,
          fix_steps: leak.fixSteps,
          status: "open",
        }))
      );

      if (insertLeaksError) throw insertLeaksError;
    }

    const detectedSignals = buildRevenueSignals({
      metricsHistory: metricsHistory ?? [],
      leaks: detectedLeaks,
    });

    const { error: deleteSignalsError } = await admin
      .from("revenue_signals")
      .delete()
      .eq("user_id", user.id)
      .eq("read", false)
      .in("type", [...GENERATED_SYNC_SIGNAL_TYPES]);

    if (deleteSignalsError) throw deleteSignalsError;

    if (detectedSignals.length > 0) {
      const { error: insertSignalsError } = await admin.from("revenue_signals").insert(
        detectedSignals.map((signal) => ({
          user_id: user.id,
          type: signal.type,
          severity: signal.severity,
          title: signal.title,
          description: signal.description,
          data: signal.data,
          read: false,
        }))
      );

      if (insertSignalsError) throw insertSignalsError;
    }

    const { error: updateConnectionError } = await admin
      .from("stripe_connections")
      .update({ last_sync_at: syncedAt })
      .eq("id", connection.id)
      .eq("user_id", user.id);

    if (updateConnectionError) throw updateConnectionError;

    const totalRecoverableRevenue = Math.round(
      detectedLeaks.reduce((sum, leak) => sum + leak.recoverableRevenue, 0) * 100
    ) / 100;

    const { error: usageError } = await admin.from("usage_events").insert({
      user_id: user.id,
      event_type: "stripe_sync",
      metadata: {
        connection_id: connection.id,
        metrics_updated: 1,
        leaks_detected: detectedLeaks.length,
        signals_detected: detectedSignals.length,
      },
    });

    if (usageError) {
      console.warn('[SYNC_STRIPE_SESSION] usage event "stripe_sync" failed:', usageError.message);
    }

    const summary = [
      `Synced ${connection.account_name || "your Stripe account"}.`,
      `Updated today's metrics snapshot.`,
      `Detected ${detectedLeaks.length} revenue leak${detectedLeaks.length === 1 ? "" : "s"}.`,
      `Generated ${detectedSignals.length} revenue signal${detectedSignals.length === 1 ? "" : "s"}.`,
      totalRecoverableRevenue > 0
        ? `${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(totalRecoverableRevenue)} is currently estimated as recoverable revenue.`
        : "No recoverable revenue is currently estimated from detected leaks.",
    ].join(" ");

    return NextResponse.json({
      ok: true,
      synced: true,
      metrics_updated: 1,
      leaks_detected: detectedLeaks.length,
      signals_detected: detectedSignals.length,
      summary,
      timestamp: syncedAt,
    });
  } catch (error) {
    return handleApiError(error, "SYNC_STRIPE_SESSION");
  }
}

export async function GET() {
  return runSync();
}

export async function POST() {
  return runSync();
}
