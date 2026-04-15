import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendViaResend } from "@/lib/resend";
import { checkRateLimit } from "@/lib/rate-limit";
import { badRequest, handleApiError, rateLimited } from "@/lib/server-error";

const requestSchema = z.object({
  name: z.string().trim().min(2).max(80),
  workEmail: z.string().trim().email().max(160),
  company: z.string().trim().min(2).max(120),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  mrrBand: z.enum([
    "under_10k",
    "10k_to_25k",
    "25k_to_50k",
    "50k_to_100k",
    "100k_plus",
  ]),
  billingModel: z.enum([
    "b2b_saas_subscription",
    "subscription_plus_usage",
    "annual_contracts_in_stripe",
    "not_sure",
  ]),
  biggestLeak: z.string().trim().min(20).max(1000),
  utmSource: z.string().trim().max(80).optional().or(z.literal("")),
  utmMedium: z.string().trim().max(80).optional().or(z.literal("")),
  utmCampaign: z.string().trim().max(120).optional().or(z.literal("")),
  utmTerm: z.string().trim().max(120).optional().or(z.literal("")),
  utmContent: z.string().trim().max(120).optional().or(z.literal("")),
  landingVariant: z.string().trim().max(80).optional().or(z.literal("")),
  referrer: z.string().trim().max(500).optional().or(z.literal("")),
});

function getClientKey(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  return (forwardedFor?.split(",")[0] ?? realIp ?? "unknown").trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildInternalRequestHtml(payload: z.infer<typeof requestSchema>) {
  const rows = [
    ["Name", payload.name],
    ["Work email", payload.workEmail],
    ["Company", payload.company],
    ["Website", payload.website || "Not provided"],
    ["MRR band", formatLabel(payload.mrrBand)],
    ["Billing model", formatLabel(payload.billingModel)],
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

function buildConfirmationHtml(payload: z.infer<typeof requestSchema>) {
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
    const clientKey = getClientKey(request);
    const { allowed } = checkRateLimit({
      key: `audit-request:${clientKey}`,
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!allowed) return rateLimited();

    const rawBody = await request.json().catch(() => null);
    const parsed = requestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return badRequest("Please complete all required fields with valid information.");
    }

    const payload = parsed.data;
    const inbox = process.env.AUDIT_INBOX_EMAIL || "support@corvidet.com";

    await Promise.all([
      sendViaResend({
        to: inbox,
        subject: `Audit request: ${payload.company} (${formatLabel(payload.mrrBand)})`,
        html: buildInternalRequestHtml(payload),
      }),
      sendViaResend({
        to: payload.workEmail,
        subject: "We received your Corvidet audit request",
        html: buildConfirmationHtml(payload),
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "AUDIT_REQUEST");
  }
}
