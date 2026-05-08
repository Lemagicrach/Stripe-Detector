// src/app/api/email/unsubscribe/route.ts
//
// Token-protected one-click unsubscribe. Sets user_profiles.email_notifications_enabled
// to false and redirects to a confirmation page. Stateless: token is HMAC
// over the user_id, so we don't need to store or rotate per-mail tokens.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server-clients";
import { verifyUnsubscribeToken } from "@/lib/email-token";
import { log } from "@/lib/logger";

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function redirectTo(status: "success" | "error", reason?: string) {
  const url = new URL("/email/unsubscribed", getAppUrl());
  url.searchParams.set("status", status);
  if (reason) url.searchParams.set("reason", reason);
  return NextResponse.redirect(url.toString());
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("u");
  const token = url.searchParams.get("t");

  if (!userId || !token) return redirectTo("error", "missing_params");
  if (!verifyUnsubscribeToken(userId, token)) return redirectTo("error", "invalid_token");

  try {
    const admin = getSupabaseAdminClient();
    const { error } = await admin
      .from("user_profiles")
      .update({ email_notifications_enabled: false })
      .eq("id", userId);
    if (error) {
      log("error", "Unsubscribe update failed", { userId, error });
      return redirectTo("error", "update_failed");
    }
  } catch (err) {
    log("error", "Unsubscribe handler crashed", { userId, error: err });
    return redirectTo("error", "exception");
  }

  return redirectTo("success");
}

// Resend also forwards a one-click POST (RFC 8058) when enabled. Mirror GET.
export const POST = GET;
