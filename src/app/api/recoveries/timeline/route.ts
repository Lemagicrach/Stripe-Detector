// src/app/api/recoveries/timeline/route.ts
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
    const { data: connection } = await admin.from("stripe_connections").select("id")
      .eq("user_id", user.id).eq("status", "active").limit(1).single();
    if (!connection) return NextResponse.json({ events: [], totalRecovered: 0 });
    const { data: events } = await admin.from("recovery_events")
      .select("id, category, amount, customer_email, recovered_at, metadata")
      .eq("connection_id", connection.id).order("recovered_at", { ascending: false }).limit(50);
    const totalRecovered = (events || []).reduce((sum, e) => sum + (e.amount || 0), 0);
    return NextResponse.json({ events: events || [], totalRecovered: Math.round(totalRecovered * 100) / 100 });
  } catch (error) { return handleApiError(error, "RECOVERIES_TIMELINE"); }
}
