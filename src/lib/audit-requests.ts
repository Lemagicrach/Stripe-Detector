import { z } from "zod";

export const AUDIT_MRR_BANDS = [
  "under_10k",
  "10k_to_25k",
  "25k_to_50k",
  "50k_to_100k",
  "100k_plus",
] as const;

export const AUDIT_BILLING_MODELS = [
  "b2b_saas_subscription",
  "subscription_plus_usage",
  "annual_contracts_in_stripe",
  "not_sure",
] as const;

export const AUDIT_STATUSES = [
  "requested",
  "qualified",
  "contacted",
  "booked",
  "connected",
  "won",
  "lost",
] as const;

export const auditRequestSchema = z.object({
  name: z.string().trim().min(2).max(80),
  workEmail: z.string().trim().email().max(160),
  company: z.string().trim().min(2).max(120),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  mrrBand: z.enum(AUDIT_MRR_BANDS),
  billingModel: z.enum(AUDIT_BILLING_MODELS),
  biggestLeak: z.string().trim().min(20).max(1000),
  utmSource: z.string().trim().max(80).optional().or(z.literal("")),
  utmMedium: z.string().trim().max(80).optional().or(z.literal("")),
  utmCampaign: z.string().trim().max(120).optional().or(z.literal("")),
  utmTerm: z.string().trim().max(120).optional().or(z.literal("")),
  utmContent: z.string().trim().max(120).optional().or(z.literal("")),
  landingVariant: z.string().trim().max(80).optional().or(z.literal("")),
  referrer: z.string().trim().max(500).optional().or(z.literal("")),
});

export type AuditRequestPayload = z.infer<typeof auditRequestSchema>;
export type AuditRequestStatus = (typeof AUDIT_STATUSES)[number];

export type AuditRequestRow = {
  id: string;
  requested_at: string;
  name: string;
  work_email: string;
  company: string;
  website: string | null;
  mrr_band: AuditRequestPayload["mrrBand"];
  billing_model: AuditRequestPayload["billingModel"];
  biggest_leak: string;
  landing_variant: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  referrer: string | null;
  user_agent: string | null;
  status: AuditRequestStatus;
  admin_notes: string | null;
  last_contacted_at: string | null;
};

export const AUDIT_ACTIVE_PIPELINE_STATUSES = [
  "requested",
  "qualified",
  "contacted",
  "booked",
  "connected",
] as const satisfies readonly AuditRequestStatus[];

export const AUDIT_MRR_BAND_LABELS: Record<AuditRequestPayload["mrrBand"], string> = {
  under_10k: "Under $10k MRR",
  "10k_to_25k": "$10k-$25k MRR",
  "25k_to_50k": "$25k-$50k MRR",
  "50k_to_100k": "$50k-$100k MRR",
  "100k_plus": "$100k+ MRR",
};

export const AUDIT_BILLING_MODEL_LABELS: Record<AuditRequestPayload["billingModel"], string> = {
  b2b_saas_subscription: "B2B SaaS subscriptions",
  subscription_plus_usage: "Subscription plus usage",
  annual_contracts_in_stripe: "Annual contracts in Stripe",
  not_sure: "Not sure yet",
};

export const AUDIT_STATUS_LABELS: Record<AuditRequestStatus, string> = {
  requested: "Requested",
  qualified: "Qualified",
  contacted: "Contacted",
  booked: "Booked",
  connected: "Connected",
  won: "Won",
  lost: "Lost",
};

export const auditRequestUpdateSchema = z
  .object({
    status: z.enum(AUDIT_STATUSES).optional(),
    adminNotes: z.string().trim().max(2000).optional(),
    touchLastContactedAt: z.boolean().optional(),
  })
  .refine(
    (value) => value.status !== undefined || value.adminNotes !== undefined || value.touchLastContactedAt,
    {
      message: "At least one update field is required.",
    }
  );

export function formatAuditLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getAuditThankYouHref(payload: Pick<AuditRequestPayload, "company" | "mrrBand">) {
  const params = new URLSearchParams();
  params.set("company", payload.company);
  params.set("mrr_band", payload.mrrBand);
  return `/audit/thanks?${params.toString()}`;
}

export function getAuditAdminEmails() {
  return (process.env.AUDIT_ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function canViewAuditDashboard(email?: string | null) {
  if (!email) return false;
  return getAuditAdminEmails().includes(email.trim().toLowerCase());
}

export function getAuditCalendarUrl() {
  return process.env.AUDIT_CALENDAR_URL || process.env.NEXT_PUBLIC_AUDIT_CALENDAR_URL || "";
}

export function getIsoDateDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function getSingleQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export function isAuditRequestActive(status: AuditRequestStatus) {
  return (AUDIT_ACTIVE_PIPELINE_STATUSES as readonly AuditRequestStatus[]).includes(status);
}
