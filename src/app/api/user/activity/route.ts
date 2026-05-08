// src/app/api/user/activity/route.ts
//
// Returns the authenticated user's own audit_logs entries, most recent
// first. RLS on audit_logs already restricts SELECT to auth.uid() = user_id,
// so we can use the regular server client (not admin) — defense in depth.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { handleApiError, unauthorized } from "@/lib/server-error";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(req: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return unauthorized();

    const url = new URL(req.url);
    const limitParam = parseInt(url.searchParams.get("limit") ?? "", 10);
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;

    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, action, resource_type, resource_id, ip, user_agent, metadata, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({ entries: data ?? [] });
  } catch (err) {
    return handleApiError(err, "USER_ACTIVITY");
  }
}
