import { NextRequest, NextResponse } from "next/server";
import { sendViaResend } from "@/lib/resend";
import { checkRateLimit, clientIdentifier } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import { badRequest, handleApiError, rateLimited } from "@/lib/server-error";
import { getSupabaseAdminClient } from "@/lib/server-clients";
import {
  auditRequestSchema,
  formatAuditLabel,
  getAuditThankYouHref,
  type AuditRequestPayload,
} from "@/lib/audit-requests";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildInternalRequestHtml(payload: AuditRequestPayload) {
  const rows = [
    ["Name", payload.name],
    ["Work email", payload.workEmail],
    ["Company", payload.company],
    ["Website", payload.website || "Not provided"],
    ["MRR band", formatAuditLabel(payload.mrrBand)],
    ["Billing model", formatAuditLabel(payload.billingModel)],
    ["Landing variant", payload.landingVariant || "stripe-b2b-saas-audit"],
    ["UTM source", payload.utmSource || "-"],
    ["UTM medium", payload.utmMedium || "-"],
    ["UTM campaign", payload.utmCampaign || "-"],
    ["UTM term", payload.utmTerm || "-"],
    ["UTM content", payload.utmContent || "-"],
    ["Referrer", payload.referrer || "-"],
  ];

  return `<!DOCTYPE html>
<html>
  <body style="font-family:Arial,sans-serif;background:#f8fafc;color:#0f172a;padding:24px;">
    <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Corvidet Audit Request</p>
      <h1 style="margin:0 0 18px;font-size:26px;">New Stripe revenue leak audit request</h1>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        ${rows
          .map(
            ([label, value]) => `<tr>
          <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;width:180px;font-size:13px;color:#64748b;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-size:14px;font-weight:600;">${escapeHtml(value)}</td>
        </tr>`
          )
          .join("")}
      </table>
      <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;background:#f8fafc;">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Reported leak</p>
        <p style="margin:0;font-size:15px;line-height:1.7;color:#334155;">${escapeHtml(payload.biggestLeak)}</p>
      </div>
    </div>
  </body>
</html>`;
}

function buildConfirmationHtml(payload: AuditRequestPayload) {
  return `<!DOCTYPE html>
<html>
  <body style="font-family:Arial,sans-serif;background:#f8fafc;color:#0f172a;padding:24px;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Corvidet</p>
      <h1 style="margin:0 0 14px;font-size:24px;">Audit request received</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">
        Thanks ${escapeHtml(payload.name)}. We received your request for a Stripe revenue leak audit for ${escapeHtml(payload.company)}.
      </p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">
        We will use the billing issue you shared to decide whether there is a strong-fit audit angle and what the next step should be.
      </p>
      <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;background:#f8fafc;">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Your note</p>
        <p style="margin:0;font-size:15px;line-height:1.7;color:#334155;">${escapeHtml(payload.biggestLeak)}</p>
      </div>
      <p style="margin:18px 0 0;font-size:13px;color:#64748b;">
        If you need to add context, just reply to this email with more detail about your Stripe billing setup.
      </p>
    </div>
  </body>
</html>`;
}

export async function POST(request: NextRequest) {
  try {
    const { success, reset } = await checkRateLimit("formPublic", clientIdentifier(request));
    if (!success) return rateLimited(reset);

    const rawBody = await request.json().catch(() => null);
    const parsed = auditRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return badRequest("Please complete all required fields with valid information.");
    }

    const payload = parsed.data;
    const inbox = process.env.AUDIT_INBOX_EMAIL || "support@corvidet.com";
    const supabaseAdmin = getSupabaseAdminClient();
    const userAgent = request.headers.get("user-agent")?.trim() || null;

    const { data: insertedRequest, error: insertError } = await supabaseAdmin
      .from("audit_requests")
      .insert({
        name: payload.name,
        work_email: payload.workEmail,
        company: payload.company,
        website: payload.website || null,
        mrr_band: payload.mrrBand,
        billing_model: payload.billingModel,
        biggest_leak: payload.biggestLeak,
        landing_variant: payload.landingVariant || "stripe-b2b-saas-audit",
        utm_source: payload.utmSource || null,
        utm_medium: payload.utmMedium || null,
        utm_campaign: payload.utmCampaign || null,
        utm_term: payload.utmTerm || null,
        utm_content: payload.utmContent || null,
        referrer: payload.referrer || null,
        user_agent: userAgent,
      })
      .select("id")
      .single();

    if (insertError) {
      throw insertError;
    }

    const emailResults = await Promise.allSettled([
      sendViaResend({
        to: inbox,
        subject: `Audit request: ${payload.company} (${formatAuditLabel(payload.mrrBand)})`,
        html: buildInternalRequestHtml(payload),
      }),
      sendViaResend({
        to: payload.workEmail,
        subject: "We received your Corvidet audit request",
        html: buildConfirmationHtml(payload),
      }),
    ]);

    const emailDeliveryOk = emailResults.every((result) => result.status === "fulfilled");
    if (!emailDeliveryOk) {
      log("error", "Audit request email failed", { route: "/api/audit-request", emailResults });
    }

    return NextResponse.json({
      ok: true,
      requestId: insertedRequest.id,
      redirectTo: getAuditThankYouHref(payload),
      emailDeliveryOk,
    });
  } catch (error) {
    return handleApiError(error, "AUDIT_REQUEST");
  }
}
