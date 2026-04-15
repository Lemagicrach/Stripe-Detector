import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server-clients";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  auditRequestUpdateSchema,
  canViewAuditDashboard,
} from "@/lib/audit-requests";
import { badRequest, handleApiError, unauthorized } from "@/lib/server-error";

type RouteContext = {
  params: Promise<{ requestId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return unauthorized();
    if (!canViewAuditDashboard(user.email)) {
      return unauthorized("Owner access only");
    }

    const { requestId } = await context.params;
    if (!requestId) {
      return badRequest("requestId is required");
    }

    const rawBody = await request.json().catch(() => null);
    const parsed = auditRequestUpdateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Invalid request");
    }

    const payload = parsed.data;
    const admin = getSupabaseAdminClient();
    const updates: Record<string, string | null> = {};

    if (payload.status !== undefined) {
      updates.status = payload.status;
    }
    if (payload.adminNotes !== undefined) {
      updates.admin_notes = payload.adminNotes || null;
    }
    if (payload.touchLastContactedAt) {
      updates.last_contacted_at = new Date().toISOString();
    }

    const { data, error } = await admin
      .from("audit_requests")
      .update(updates)
      .eq("id", requestId)
      .select(
        "id, requested_at, name, work_email, company, website, mrr_band, billing_model, biggest_leak, landing_variant, utm_source, utm_medium, utm_campaign, utm_term, utm_content, referrer, user_agent, status, admin_notes, last_contacted_at"
      )
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true, request: data });
  } catch (error) {
    return handleApiError(error, "AUDIT_REQUEST_UPDATE");
  }
}
