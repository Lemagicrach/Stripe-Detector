// src/app/api/leaks/run-scan/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/server-clients";
import { syncStripeMetrics } from "@/lib/stripe-metrics";
import { detectRevenueLeaks, calculateLeakScore } from "@/lib/revenue-leaks";
import { handleApiError, unauthorized, badRequest, rateLimited } from "@/lib/server-error";
import { checkRateLimit } from "@/lib/rate-limit";
import { withStripeConnect } from "@/lib/stripe-connect";

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return unauthorized();

    const { success, reset } = await checkRateLimit("scan", user.id);
    if (!success) return rateLimited(reset);

    const admin = getSupabaseAdminClient();
    const { data: connection } = await admin
      .from("stripe_connections")
      .select("id, stripe_account_id, encrypted_access_token")
      .eq("user_id", user.id).eq("status", "active").limit(1).single();

    if (!connection) return badRequest("No active Stripe connection. Connect Stripe first.");

    // 1+2. Sync metrics and run leak detection under a single Stripe Connect
    //      session (transparent token refresh on expiry).
    const { metrics, leaks } = await withStripeConnect(connection.id, async (stripe) => {
      const m = await syncStripeMetrics(stripe);
      const l = await detectRevenueLeaks({
        connectionId: connection.id, userId: user.id, stripe, metrics: m,
      });
      return { metrics: m, leaks: l };
    });

    // 3. Store leaks
    if (leaks.length > 0) {
      await admin.from("revenue_leaks").delete().eq("connection_id", connection.id).eq("status", "open");
      const leakRows = leaks.map(leak => ({
        connection_id: connection.id, user_id: user.id,
        category: leak.category, severity: leak.severity,
        title: leak.title, description: leak.description,
        lost_revenue: leak.lostRevenue, recoverable_revenue: leak.recoverableRevenue,
        affected_customers: leak.affectedCustomers, fix_steps: leak.fixSteps, status: "open",
      }));
      await admin.from("revenue_leaks").insert(leakRows);
    }

    const leakScore = calculateLeakScore(leaks, metrics.mrr);
    const totalLost = leaks.reduce((sum, l) => sum + l.lostRevenue, 0);
    const totalRecoverable = leaks.reduce((sum, l) => sum + l.recoverableRevenue, 0);

    await admin.from("usage_events").insert({
      user_id: user.id, event_type: "leak_scan",
      metadata: { leaks_found: leaks.length, leak_score: leakScore },
    });

    return NextResponse.json({
      leakScore, totalLeaks: leaks.length,
      totalLostRevenue: Math.round(totalLost * 100) / 100,
      totalRecoverableRevenue: Math.round(totalRecoverable * 100) / 100,
      leaks: leaks.map((l, i) => ({ ...l, id: `scan-${Date.now()}-${i}`, detectedAt: new Date().toISOString() })),
      metrics: { mrr: metrics.mrr, activeCustomers: metrics.activeCustomers, churnRate: metrics.churnRate },
      scannedAt: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error, "LEAK_SCAN");
  }
}
