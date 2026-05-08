// src/lib/audit.ts
//
// Fail-silent helper for writing tamper-evident audit_logs entries. An audit
// insert failure must never break the parent operation (you don't want a
// dropped audit row to fail the user's actual request), so all errors here
// are logged and swallowed.
//
// Usage:
//
//   await audit({
//     userId: user.id,
//     action: "leak.dismissed",
//     resource_type: "revenue_leak",
//     resource_id: leakId,
//     request: req,                    // optional, captures IP + UA
//     meta: { reason: "duplicate" },   // optional
//   });
//
// Recommended action naming: dot-namespaced verbs in past-tense:
//   "stripe.connect.connected", "stripe.connect.disconnected",
//   "subscription.upgraded", "subscription.downgraded", "account.deleted",
//   "leak.dismissed", "ai.query"

import { getSupabaseAdminClient } from "@/lib/server-clients";
import { log } from "@/lib/logger";

type AuditParams = {
  userId: string | null;
  action: string;
  resource_type?: string | null;
  resource_id?: string | null;
  meta?: Record<string, unknown>;
  request?: Request | null;
};

function extractClientInfo(req?: Request | null): { ip: string | null; userAgent: string | null } {
  if (!req) return { ip: null, userAgent: null };
  const fwd = req.headers.get("x-forwarded-for");
  const real = req.headers.get("x-real-ip");
  const ip = (fwd?.split(",")[0] ?? real ?? null)?.trim() || null;
  const userAgent = req.headers.get("user-agent")?.trim() || null;
  return { ip, userAgent };
}

export async function audit(params: AuditParams): Promise<void> {
  const { ip, userAgent } = extractClientInfo(params.request);
  try {
    const admin = getSupabaseAdminClient();
    await admin.from("audit_logs").insert({
      user_id: params.userId,
      action: params.action,
      resource_type: params.resource_type ?? null,
      resource_id: params.resource_id ?? null,
      ip,
      user_agent: userAgent,
      metadata: params.meta ?? {},
    });
  } catch (err) {
    log("warn", "Audit insert failed", {
      action: params.action,
      userId: params.userId ?? undefined,
      error: err,
    });
  }
}
