import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server-clients";
import { syncStripeMetrics } from "@/lib/stripe-metrics";
import { detectRevenueLeaks, calculateLeakScore } from "@/lib/revenue-leaks";
import { handleApiError } from "@/lib/server-error";
import { verifyCronAuth } from "@/lib/cron-auth";

export const maxDuration = 300;

export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    const admin = getSupabaseAdminClient();

    const { data: connections } = await admin
      .from("stripe_connections")
      .select("id, user_id, stripe_account_id, encrypted_access_token")
      .eq("status", "active");

    if (!connections?.length) {
      return NextResponse.json({ success: true, processed: 0 });
    }

    let processed = 0;
    let errors = 0;

    for (const conn of connections) {
      try {
        const metrics = await syncStripeMetrics(
          conn.stripe_account_id,
          conn.encrypted_access_token
        );

        const leaks = await detectRevenueLeaks({
          connectionId: conn.id,
          userId: conn.user_id,
          encryptedAccessToken: conn.encrypted_access_token,
          metrics,
        });

        // Replace open leaks for this connection with fresh scan results
        await admin
          .from("revenue_leaks")
          .delete()
          .eq("connection_id", conn.id)
          .eq("status", "open");

        if (leaks.length > 0) {
          const leakRows = leaks.map((leak) => ({
            connection_id: conn.id,
            user_id: conn.user_id,
            category: leak.category,
            severity: leak.severity,
            title: leak.title,
            description: leak.description,
            lost_revenue: leak.lostRevenue,
            recoverable_revenue: leak.recoverableRevenue,
            affected_customers: leak.affectedCustomers,
            fix_steps: leak.fixSteps,
            status: "open",
          }));
          await admin.from("revenue_leaks").insert(leakRows);
        }

        const leakScore = calculateLeakScore(leaks, metrics.mrr);
        await admin.from("usage_events").insert({
          user_id: conn.user_id,
          event_type: "cron_leak_scan",
          metadata: {
            connection_id: conn.id,
            leaks_found: leaks.length,
            leak_score: leakScore,
          },
        });

        processed++;
      } catch (err) {
        errors++;
        console.error(`[CRON_DETECT_LEAKS] Failed for connection ${conn.id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      errors,
      total: connections.length,
    });
  } catch (error) {
    return handleApiError(error, "CRON_DETECT_LEAKS");
  }
}
