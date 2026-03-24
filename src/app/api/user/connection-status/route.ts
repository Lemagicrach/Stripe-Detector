// src/app/api/user/connection-status/route.ts
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
    const { data: connections } = await admin.from("stripe_connections")
      .select("id, stripe_account_id, account_name, status, last_sync_at, created_at")
      .eq("user_id", user.id).order("created_at", { ascending: false });
    return NextResponse.json({ connections: connections || [] });
  } catch (error) { return handleApiError(error, "CONNECTION_STATUS"); }
}
