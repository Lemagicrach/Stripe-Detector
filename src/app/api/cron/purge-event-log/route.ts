// src/app/api/cron/purge-event-log/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server-clients";
import { verifyCronAuth } from "@/lib/cron-auth";

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const admin = getSupabaseAdminClient();
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error, count } = await admin
    .from("stripe_events_processed")
    .delete({ count: "exact" })
    .lt("processed_at", cutoff);

  if (error) {
    console.error("[CRON_PURGE_EVENT_LOG]", error);
    return NextResponse.json({ error: "purge_failed" }, { status: 500 });
  }

  return NextResponse.json({ purged: count ?? 0, cutoff });
}
