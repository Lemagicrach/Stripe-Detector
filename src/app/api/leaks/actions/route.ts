// src/app/api/leaks/actions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/server-clients";
import { handleApiError, unauthorized, badRequest } from "@/lib/server-error";

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return unauthorized();
    const admin = getSupabaseAdminClient();
    const { data: leaks } = await admin.from("revenue_leaks")
      .select("id, category, severity, title, lost_revenue, recoverable_revenue, status, fix_steps, detected_at")
      .eq("user_id", user.id).order("detected_at", { ascending: false }).limit(50);
    return NextResponse.json({ leaks: leaks || [] });
  } catch (error) { return handleApiError(error, "LEAKS_LIST"); }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return unauthorized();
    const body = await req.json();
    const { leakId, status } = body;
    if (!leakId || !status) return badRequest("leakId and status required");
    if (!["open", "in_progress", "resolved", "dismissed"].includes(status)) return badRequest("Invalid status");
    const admin = getSupabaseAdminClient();
    const update: Record<string, any> = { status };
    if (status === "resolved") update.resolved_at = new Date().toISOString();
    await admin.from("revenue_leaks").update(update).eq("id", leakId).eq("user_id", user.id);
    return NextResponse.json({ success: true });
  } catch (error) { return handleApiError(error, "LEAKS_UPDATE"); }
}
