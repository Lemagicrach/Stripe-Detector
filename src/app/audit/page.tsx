import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Search, ShieldCheck } from "lucide-react";
import { AuditRequestForm } from "@/components/marketing/AuditRequestForm";

export const metadata = {
  title: "Request Free Audit - Corvidet",
  description:
    "Request a free Stripe revenue leak audit for your B2B SaaS billing setup.",
};

const whatHappensNext = [
  "We review your request and the leak pattern you called out.",
  "If the fit is strong, we reply with the right audit angle and next step.",
  "The goal is to surface the highest-value billing leak before you spend on broad acquisition.",
];

const bestFitSignals = [
  "Stripe Billing powers your subscription revenue.",
  "Your team is between $10k and $100k MRR or heading there fast.",
  "You need clarity on failed renewals, past-due accounts, or weak dunning.",
];

export default function AuditPage() {
  return (
    <main className="relative min-h-screen overflow-x-clip bg-[#0B0E11] text-[#E8ECF1]">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="orb orb-a" />
        <div className="orb orb-b" />
      </div>

      <div className="mx-auto max-w-6xl px-6 pb-24 pt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-[#1E2530] px-4 py-2 text-sm font-medium text-[#8B95A5] transition-colors hover:border-[#2A3444] hover:text-[#E8ECF1]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to landing page
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-[#1E2530] px-4 py-2 text-sm font-medium text-[#8B95A5] transition-colors hover:border-[#2A3444] hover:text-[#E8ECF1]"
          >
            Sign in
          </Link>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[28px] border border-[#1E2530] bg-[#12161B]/90 p-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#E8442A]/25 bg-[#E8442A]/10 px-3.5 py-1.5 text-xs font-semibold text-[#E8442A]">
              <span className="badge-pulse h-1.5 w-1.5 rounded-full bg-[#E8442A]" />
              Free audit request
            </span>

            <h1 className="mt-6 text-[clamp(30px,4vw,46px)] font-bold leading-[1.05] tracking-[-0.04em] text-white">
              Tell us where Stripe revenue is slipping.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-[#8B95A5]">
              This request form is designed for B2B SaaS operators who suspect billing
              leakage but need a clearer explanation of what to inspect and fix first.
            </p>

            <div className="mt-8 rounded-[24px] border border-[#1E2530] bg-[#0E1217] p-5">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-10 w-10 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-300" />
                <div>
                  <h2 className="text-lg font-semibold text-white">Best-fit request profile</h2>
                  <p className="text-sm text-[#5A6575]">Lean team, real subscription volume, billing pain already visible</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {bestFitSignals.map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl border border-[#1E2530] px-4 py-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                    <p className="text-sm leading-relaxed text-[#C3CBD6]">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-[24px] border border-[#1E2530] bg-[#0E1217] p-5">
              <div className="flex items-center gap-3">
                <Search className="h-9 w-9 text-[#E8442A]" />
                <div>
                  <h2 className="text-lg font-semibold text-white">What happens next</h2>
                  <p className="text-sm text-[#5A6575]">A short, concrete path instead of a vague sales loop</p>
                </div>
              </div>
              <ol className="mt-5 space-y-3">
                {whatHappensNext.map((item, index) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-[#C3CBD6]">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E8442A]/15 text-xs font-semibold text-[#E8442A]">
                      {index + 1}
                    </span>
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section className="rounded-[28px] border border-[#1E2530] bg-[#12161B]/95 p-7 shadow-[0_30px_100px_rgba(0,0,0,0.35)]">
            <div className="border-b border-[#1E2530] pb-5">
              <p className="text-xs uppercase tracking-[0.16em] text-[#5A6575]">Audit intake</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Request your free revenue leak audit</h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#8B95A5]">
                Use your work email and describe the billing issue clearly. That gives us enough
                signal to respond with a useful audit direction instead of a generic pitch.
              </p>
            </div>

            <div className="mt-6">
              <Suspense
                fallback={
                  <div className="rounded-2xl border border-[#1E2530] bg-[#0E1217] px-4 py-3 text-sm text-[#8B95A5]">
                    Loading audit form...
                  </div>
                }
              >
                <AuditRequestForm />
              </Suspense>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
