// src/app/api/integrations/slack/disconnect/route.ts
//
// Soft-disconnect: marks the integration as revoked without deleting the
// row, so future audits can see "user X had Slack connected to workspace Y
// from t1 to t2". The encrypted webhook URL stays in DB; it's idle but
// inert until the user reconnects (which UPSERTs).
//
// Stripping the URL from Slack's side requires the user to remove the
// custom integration from their workspace; we link to that flow in the UI.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/server-clients";
import { handleApiError, unauthorized } from "@/lib/server-error";
import { audit } from "@/lib/audit";

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return unauthorized();

    const admin = getSupabaseAdminClient();
    const { data: rows } = await admin
      .from("slack_integrations")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("status", "active")
      .select("id");

    const revoked = (rows ?? []) as Array<{ id: string }>;
    for (const row of revoked) {
      await audit({
        userId: user.id,
        action: "slack.integration.disconnected",
        resource_type: "slack_integration",
        resource_id: row.id,
        request: req,
      });
    }

    return NextResponse.json({ disconnected: revoked.length });
  } catch (err) {
    return handleApiError(err, "INTEGRATIONS_SLACK_DISCONNECT");
  }
}
