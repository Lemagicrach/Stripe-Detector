// src/app/api/leaks/run-scan/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/server-clients";
import { syncStripeMetrics } from "@/lib/stripe-metrics";
import { detectRevenueLeaks, calculateLeakScore } from "@/lib/revenue-leaks";
import { handleApiError, unauthorized, badRequest } from "@/lib/server-error";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const { allowed } = checkRateLimit({ key: "run-scan", limit: 3, windowMs: 60_000 });
    if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return unauthorized();

    const admin = getSupabaseAdminClient();
    const { data: connection } = await admin
      .from("stripe_connections")
      .select("id, stripe_account_id, encrypted_access_token")
      .eq("user_id", user.id).eq("status", "active").limit(1).single();

    if (!connection) return badRequest("No active Stripe connection. Connect Stripe first.");

    // 1. Sync fresh metrics
    const metrics = await syncStripeMetrics(connection.stripe_account_id, connection.encrypted_access_token);

    // 2. Run leak detection
    const leaks = await detectRevenueLeaks({
      connectionId: connection.id, userId: user.id,
      encryptedAccessToken: connection.encrypted_access_token, metrics,
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
