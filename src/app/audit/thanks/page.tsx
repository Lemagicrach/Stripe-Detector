import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Mail, Search } from "lucide-react";
import {
  AUDIT_MRR_BAND_LABELS,
  getAuditCalendarUrl,
  getSingleQueryValue,
  type AuditRequestPayload,
} from "@/lib/audit-requests";

export const metadata = {
  title: "Audit Request Received - Corvidet",
  description: "Next steps after requesting a Corvidet Stripe revenue leak audit.",
};

const nextSteps = [
  "We review the leak pattern, billing model, and revenue band you submitted.",
  "If the fit is strong, we reply with the right audit angle and what to inspect first.",
  "You can speed things up by booking a short review call or replying with more context.",
];

function getMrrBandLabel(value: string) {
  const key = value as AuditRequestPayload["mrrBand"];
  return AUDIT_MRR_BAND_LABELS[key] ?? "Your selected MRR band";
}

export default async function AuditThanksPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const company = getSingleQueryValue(resolvedSearchParams.company).trim();
  const mrrBand = getSingleQueryValue(resolvedSearchParams.mrr_band).trim();
  const calendarUrl = getAuditCalendarUrl();
  const inboxEmail = process.env.AUDIT_INBOX_EMAIL || "support@corvidet.com";

  return (
    <main className="relative min-h-screen overflow-x-clip bg-[#0B0E11] text-[#E8ECF1]">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="orb orb-a" />
        <div className="orb orb-b" />
      </div>

      <div className="mx-auto max-w-5xl px-6 pb-24 pt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-[#1E2530] px-4 py-2 text-sm font-medium text-[#8B95A5] transition-colors hover:border-[#2A3444] hover:text-[#E8ECF1]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to landing page
          </Link>
          <Link
            href="/demo"
            className="rounded-xl border border-[#1E2530] px-4 py-2 text-sm font-medium text-[#8B95A5] transition-colors hover:border-[#2A3444] hover:text-[#E8ECF1]"
          >
            View demo
          </Link>
        </div>

        <section className="mt-10 rounded-[30px] border border-emerald-500/20 bg-[#12161B]/95 p-8 shadow-[0_30px_100px_rgba(0,0,0,0.35)]">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                Audit request received
              </span>
              <h1 className="mt-6 text-[clamp(32px,4vw,48px)] font-bold leading-[1.05] tracking-[-0.04em] text-white">
                {company ? `We have ${company} in the queue.` : "We have your audit request."}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#8B95A5]">
                The next step is a short review of your billing setup and the leak pattern you flagged.
                We use that to decide the strongest audit angle instead of sending a generic sales reply.
              </p>
            </div>

            <div className="min-w-[240px] rounded-[24px] border border-[#1E2530] bg-[#0E1217] p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-[#5A6575]">Request profile</p>
              <div className="mt-4 space-y-3 text-sm text-[#C3CBD6]">
                <div>
                  <p className="text-xs text-[#5A6575]">Company</p>
                  <p className="mt-1 font-medium text-white">{company || "Submitted"}</p>
                </div>
                <div>
                  <p className="text-xs text-[#5A6575]">MRR band</p>
                  <p className="mt-1 font-medium text-white">{mrrBand ? getMrrBandLabel(mrrBand) : "Captured"}</p>
                </div>
                <div>
                  <p className="text-xs text-[#5A6575]">Response target</p>
                  <p className="mt-1 font-medium text-white">Within 1 business day</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[24px] border border-[#1E2530] bg-[#0E1217] p-6">
              <div className="flex items-center gap-3">
                <Search className="h-9 w-9 text-[#E8442A]" />
                <div>
                  <h2 className="text-lg font-semibold text-white">What happens next</h2>
                  <p className="text-sm text-[#5A6575]">A short, specific path instead of a broad nurture sequence</p>
                </div>
              </div>

              <ol className="mt-5 space-y-3">
                {nextSteps.map((item, index) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-[#C3CBD6]">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E8442A]/15 text-xs font-semibold text-[#E8442A]">
                      {index + 1}
                    </span>
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-[24px] border border-[#1E2530] bg-[#0E1217] p-6">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-9 w-9 text-emerald-300" />
                <div>
                  <h2 className="text-lg font-semibold text-white">Move faster</h2>
                  <p className="text-sm text-[#5A6575]">Optional if you want to accelerate the audit loop</p>
                </div>
              </div>

              <div className="mt-5 space-y-3 text-sm text-[#C3CBD6]">
                <p>
                  If you want a faster back-and-forth, book a short review call or email more context about
                  your Stripe setup, billing workflow, and where renewals are breaking.
                </p>
              </div>

              <div className="mt-6 grid gap-3">
                {calendarUrl ? (
                  <a
                    href={calendarUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E8442A] px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-px hover:brightness-110"
                  >
                    Book audit review
                    <ArrowRight className="h-4 w-4" />
                  </a>
                ) : null}
                <a
                  href={`mailto:${inboxEmail}?subject=Corvidet audit request follow-up`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#1E2530] px-5 py-3 text-sm font-medium text-[#8B95A5] transition-colors hover:border-[#2A3444] hover:text-[#E8ECF1]"
                >
                  <Mail className="h-4 w-4" />
                  Email more context
                </a>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#1E2530] px-5 py-3 text-sm font-medium text-[#8B95A5] transition-colors hover:border-[#2A3444] hover:text-[#E8ECF1]"
                >
                  Sign in and connect Stripe
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
