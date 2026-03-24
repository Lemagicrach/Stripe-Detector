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
      return NextResponse.json({ byType: [], totalRecovered: 0 });
    }

    const { data: events } = await admin
      .from("recovery_events")
      .select("category, amount")
      .eq("connection_id", connection.id);

    // Aggregate by category
    const byTypeMap = new Map<string, { count: number; total: number }>();
    for (const ev of events ?? []) {
      const cat = (ev.category as string) ?? "other";
      const existing = byTypeMap.get(cat) ?? { count: 0, total: 0 };
      byTypeMap.set(cat, {
        count: existing.count + 1,
        total: existing.total + ((ev.amount as number) ?? 0),
      });
    }

    const byType = Array.from(byTypeMap.entries())
      .map(([category, { count, total }]) => ({
        category,
        count,
        total: Math.round(total * 100) / 100,
      }))
      .sort((a, b) => b.total - a.total);

    const totalRecovered = byType.reduce((sum, t) => sum + t.total, 0);

    return NextResponse.json({ byType, totalRecovered: Math.round(totalRecovered * 100) / 100 });
  } catch (error) {
    return handleApiError(error, "RECOVERIES_BY_TYPE");
  }
}
