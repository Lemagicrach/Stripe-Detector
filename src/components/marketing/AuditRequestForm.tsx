"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

type FormState = {
  name: string;
  workEmail: string;
  company: string;
  website: string;
  mrrBand: string;
  billingModel: string;
  biggestLeak: string;
};

const INITIAL_FORM: FormState = {
  name: "",
  workEmail: "",
  company: "",
  website: "",
  mrrBand: "",
  billingModel: "",
  biggestLeak: "",
};

export function AuditRequestForm() {
  const searchParams = useSearchParams();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [referrer, setReferrer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setReferrer(document.referrer || "");
  }, []);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/audit-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          utmSource: searchParams.get("utm_source") ?? "",
          utmMedium: searchParams.get("utm_medium") ?? "",
          utmCampaign: searchParams.get("utm_campaign") ?? "",
          utmTerm: searchParams.get("utm_term") ?? "",
          utmContent: searchParams.get("utm_content") ?? "",
          landingVariant: searchParams.get("landing_variant") ?? "stripe-b2b-saas-audit",
          referrer,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to request audit");
      }

      setSubmitted(true);
      setForm(INITIAL_FORM);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to request audit");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-[28px] border border-emerald-500/20 bg-emerald-500/8 p-6">
        <div className="flex items-start gap-4">
          <CheckCircle2 className="mt-0.5 h-8 w-8 text-emerald-300" />
          <div>
            <h3 className="text-xl font-semibold text-white">Audit request received</h3>
            <p className="mt-3 text-sm leading-relaxed text-emerald-100/85">
              We have your request. The next step is a short review of your Stripe setup,
              revenue band, and the leak pattern you called out so we can respond with
              the right audit angle.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-[#E8ECF1]">Name</span>
          <input
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            required
            maxLength={80}
            className="h-11 w-full rounded-xl border border-[#1E2530] bg-[#0E1217] px-4 text-sm text-white outline-none transition-colors placeholder:text-[#5A6575] focus:border-[#E8442A]"
            placeholder="Jane Founder"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-[#E8ECF1]">Work email</span>
          <input
            type="email"
            value={form.workEmail}
            onChange={(event) => updateField("workEmail", event.target.value)}
            required
            maxLength={160}
            className="h-11 w-full rounded-xl border border-[#1E2530] bg-[#0E1217] px-4 text-sm text-white outline-none transition-colors placeholder:text-[#5A6575] focus:border-[#E8442A]"
            placeholder="jane@company.com"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-[#E8ECF1]">Company</span>
          <input
            value={form.company}
            onChange={(event) => updateField("company", event.target.value)}
            required
            maxLength={120}
            className="h-11 w-full rounded-xl border border-[#1E2530] bg-[#0E1217] px-4 text-sm text-white outline-none transition-colors placeholder:text-[#5A6575] focus:border-[#E8442A]"
            placeholder="Acme Analytics"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-[#E8ECF1]">Website</span>
          <input
            value={form.website}
            onChange={(event) => updateField("website", event.target.value)}
            maxLength={200}
            className="h-11 w-full rounded-xl border border-[#1E2530] bg-[#0E1217] px-4 text-sm text-white outline-none transition-colors placeholder:text-[#5A6575] focus:border-[#E8442A]"
            placeholder="https://company.com"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-[#E8ECF1]">Current MRR band</span>
          <select
            value={form.mrrBand}
            onChange={(event) => updateField("mrrBand", event.target.value)}
            required
            className="h-11 w-full rounded-xl border border-[#1E2530] bg-[#0E1217] px-4 text-sm text-white outline-none transition-colors focus:border-[#E8442A]"
          >
            <option value="">Select a band</option>
            <option value="under_10k">Under $10k MRR</option>
            <option value="10k_to_25k">$10k-$25k MRR</option>
            <option value="25k_to_50k">$25k-$50k MRR</option>
            <option value="50k_to_100k">$50k-$100k MRR</option>
            <option value="100k_plus">$100k+ MRR</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-[#E8ECF1]">Billing model</span>
          <select
            value={form.billingModel}
            onChange={(event) => updateField("billingModel", event.target.value)}
            required
            className="h-11 w-full rounded-xl border border-[#1E2530] bg-[#0E1217] px-4 text-sm text-white outline-none transition-colors focus:border-[#E8442A]"
          >
            <option value="">Select a model</option>
            <option value="b2b_saas_subscription">B2B SaaS subscriptions</option>
            <option value="subscription_plus_usage">Subscription plus usage</option>
            <option value="annual_contracts_in_stripe">Annual contracts in Stripe</option>
            <option value="not_sure">Not sure yet</option>
          </select>
        </label>
      </div>

      <label className="space-y-2">
        <span className="text-sm font-medium text-[#E8ECF1]">Where do you think revenue is leaking?</span>
        <textarea
          value={form.biggestLeak}
          onChange={(event) => updateField("biggestLeak", event.target.value)}
          required
          maxLength={1000}
          rows={5}
          className="w-full rounded-2xl border border-[#1E2530] bg-[#0E1217] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-[#5A6575] focus:border-[#E8442A]"
          placeholder="Failed renewals are climbing, some accounts stay active while invoices are past due, and we do not trust our billing follow-up."
        />
      </label>

      {errorMessage && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#E8442A] px-5 text-sm font-semibold text-white transition-all hover:-translate-y-px hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending request
          </>
        ) : (
          <>
            Request free audit
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </form>
  );
}
