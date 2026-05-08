// src/lib/email.ts
//
// Central email-sending wrapper. Renders a React Email component to HTML,
// applies opt-out gating for marketing messages, and delegates to Resend.
// Use this instead of calling sendViaResend directly so opt-out and template
// rendering are consistent across the codebase.

import * as React from "react";
import { render } from "@react-email/render";
import { sendViaResend } from "@/lib/resend";
import { getSupabaseAdminClient } from "@/lib/server-clients";
import { log } from "@/lib/logger";

type SendEmailParams = {
  to: string;
  subject: string;
  react: React.ReactElement;
  /** When true, bypasses the email_notifications_enabled opt-out check.
   *  Use for: account deletion confirmation, trial-ending notice, budget
   *  warning, security alerts. Marketing/digest emails should leave this
   *  off so the user's opt-out is respected. */
  transactional?: boolean;
  /** When provided AND transactional=false, we check the user's opt-out
   *  flag before sending. Required for non-transactional emails. */
  userId?: string;
};

export async function sendEmail(params: SendEmailParams): Promise<{ sent: boolean; reason?: string }> {
  // Marketing emails: respect opt-out
  if (!params.transactional) {
    if (!params.userId) {
      log("warn", "Non-transactional email without userId, skipping", { to: params.to, subject: params.subject });
      return { sent: false, reason: "missing_user_id" };
    }
    const admin = getSupabaseAdminClient();
    const { data: profile } = await admin
      .from("user_profiles")
      .select("email_notifications_enabled")
      .eq("id", params.userId)
      .single();
    const enabled = (profile as { email_notifications_enabled?: boolean } | null)?.email_notifications_enabled;
    if (enabled === false) {
      return { sent: false, reason: "opted_out" };
    }
  }

  const html = await render(params.react);

  await sendViaResend({
    to: params.to,
    subject: params.subject,
    html,
  });

  return { sent: true };
}
