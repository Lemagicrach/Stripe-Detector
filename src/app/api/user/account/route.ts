// src/app/api/user/account/route.ts
//
// GDPR-compliant account deletion. Orchestrates an 8-step flow:
//
//   1. Auth check
//   2. Email confirmation match (request body must contain user.email)
//   3. Stripe Connect deauthorize for every connection
//   4. Cancel any active billing subscription
//   5. Insert tamper-evident audit row (sha256 email — never plaintext)
//   6. Hard-delete the auth.users row (cascades through public schema FKs)
//   7. Send confirmation email via Resend (fire-and-forget)
//   8. Return { deleted: true }
//
// Failure at steps 3-4 is logged but non-fatal — better to delete a record
// even if Stripe rejects deauthorize (e.g., already deauthorized) than to
// leave the user stuck. Failure at step 5 or 6 returns 500 so the user can
// retry.

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import Stripe from "stripe";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/server-clients";
import { sendViaResend } from "@/lib/resend";
import { handleApiError, unauthorized, badRequest } from "@/lib/server-error";
import { log } from "@/lib/logger";
import { audit } from "@/lib/audit";

const ROUTE = "/api/user/account";
const STRIPE_API_VERSION = "2026-02-25.clover" as const;

function buildConfirmationEmail(): string {
  return `<!DOCTYPE html>
<html>
  <body style="font-family:Arial,sans-serif;background:#f8fafc;color:#0f172a;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;">
      <h1 style="margin:0 0 16px;font-size:22px;">Your Corvidet account has been deleted</h1>
      <p style="margin:0 0 12px;line-height:1.6;">Your account and all associated revenue data have been permanently removed from our systems.</p>
      <p style="margin:0 0 12px;line-height:1.6;">Your Stripe Connect authorization has been revoked, and any active billing subscription has been canceled.</p>
      <p style="margin:0 0 12px;line-height:1.6;">If this was a mistake, contact <a href="mailto:support@corvidet.com" style="color:#2563eb;">support@corvidet.com</a>. Note that we cannot restore deleted data.</p>
      <p style="margin:24px 0 0;color:#64748b;font-size:13px;">— Corvidet</p>
    </div>
  </body>
</html>`;
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return unauthorized();

    const userEmail = user.email;
    if (!userEmail) {
      return badRequest("Account has no email — contact support to delete");
    }

    const body = await req.json().catch(() => ({})) as { confirmEmail?: string; reason?: string };
    if (body.confirmEmail !== userEmail) {
      return badRequest("Email confirmation does not match account email");
    }

    const admin = getSupabaseAdminClient();

    // Step 3: Deauthorize every Stripe Connect link
    const stripeClientId = process.env.STRIPE_CLIENT_ID;
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (stripeClientId && stripeSecretKey) {
      const platformStripe = new Stripe(stripeSecretKey, { apiVersion: STRIPE_API_VERSION });
      const { data: connections } = await admin
        .from("stripe_connections")
        .select("id, stripe_account_id")
        .eq("user_id", user.id);

      for (const conn of connections ?? []) {
        try {
          await platformStripe.oauth.deauthorize({
            client_id: stripeClientId,
            stripe_user_id: conn.stripe_account_id,
          });
        } catch (err) {
          // Common case: already deauthorized on Stripe's side. Don't block.
          log("warn", "Stripe deauthorize failed (continuing)", {
            route: ROUTE,
            userId: user.id,
            connectionId: conn.id,
            error: err,
          });
        }
      }
    }

    // Step 4: Cancel any active billing subscription
    if (stripeSecretKey) {
      const { data: profile } = await admin
        .from("user_profiles")
        .select("stripe_customer_id")
        .eq("id", user.id)
        .single();

      const customerId = (profile as { stripe_customer_id?: string } | null)?.stripe_customer_id;
      if (customerId) {
        const billingStripe = new Stripe(stripeSecretKey, { apiVersion: STRIPE_API_VERSION });
        try {
          const subs = await billingStripe.subscriptions.list({
            customer: customerId,
            status: "active",
            limit: 100,
          });
          for (const sub of subs.data) {
            await billingStripe.subscriptions.cancel(sub.id);
          }
        } catch (err) {
          log("warn", "Cancel billing subscriptions failed (continuing)", {
            route: ROUTE,
            userId: user.id,
            customerId,
            error: err,
          });
        }
      }
    }

    // Step 5: Audit row (sha256 email, never plaintext)
    const emailHash = createHash("sha256").update(userEmail.toLowerCase()).digest("hex");
    const { error: auditError } = await admin.from("account_deletions").insert({
      user_id: user.id,
      email_hash: emailHash,
      reason: body.reason ?? null,
    });
    if (auditError) {
      log("error", "Failed to insert account_deletions audit row", {
        route: ROUTE,
        userId: user.id,
        error: auditError,
      });
      return handleApiError(auditError, "ACCOUNT_DELETE_AUDIT");
    }

    // Audit log entry (cascades when user is deleted at step 6, but worth it
    // for the brief window where support may need to verify the request).
    await audit({
      userId: user.id,
      action: "account.deleted",
      resource_type: "user",
      resource_id: user.id,
      request: req,
      meta: { reason: body.reason ?? null, email_hash: emailHash },
    });

    // Step 6: Hard-delete the auth.users row (cascades through public schema)
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      log("error", "auth.admin.deleteUser failed", {
        route: ROUTE,
        userId: user.id,
        error: deleteError,
      });
      return handleApiError(deleteError, "ACCOUNT_DELETE");
    }

    log("info", "Account deleted", { route: ROUTE, userId: user.id });

    // Step 7: Confirmation email (fire-and-forget)
    sendViaResend({
      to: userEmail,
      subject: "Your Corvidet account has been deleted",
      html: buildConfirmationEmail(),
    }).catch((err) => {
      log("warn", "Deletion confirmation email failed", {
        route: ROUTE,
        userId: user.id,
        error: err,
      });
    });

    return NextResponse.json({ deleted: true });
  } catch (err) {
    return handleApiError(err, "ACCOUNT_DELETE");
  }
}
