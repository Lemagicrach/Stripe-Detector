import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  ChartNoAxesColumnIncreasing,
  CreditCard,
  Mail,
  Radar,
  Search,
  ShieldCheck,
  TrendingDown,
  Users,
} from "lucide-react";

const proofPoints = [
  {
    value: "15 min",
    label: "to identify the first leak pattern",
    detail: "Manual audit workflow designed for Stripe-native B2B SaaS teams.",
  },
  {
    value: "$10k-$100k",
    label: "best-fit MRR band",
    detail: "Enough subscription volume to have leakage, small enough to move fast.",
  },
  {
    value: "3",
    label: "high-signal leak categories",
    detail: "Failed renewals, broken subscription states, and silent churn triggers.",
  },
];

const auditFindings = [
  {
    icon: CreditCard,
    title: "Failed renewals nobody recovered",
    description:
      "Invoices that failed, never got a real retry path, and quietly turned into involuntary churn.",
  },
  {
    icon: AlertTriangle,
    title: "Broken subscription states",
    description:
      "Past-due, unpaid, or incomplete subscriptions still tied to active product access or live customer accounts.",
  },
  {
    icon: TrendingDown,
    title: "Silent churn precursors",
    description:
      "Cancellation clusters, expiring cards, and downgrade behavior that usually shows up before MRR drops.",
  },
  {
    icon: Radar,
    title: "Billing flow gaps",
    description:
      "Missing dunning, weak save sequences, and billing ops issues that a dashboard never calls out directly.",
  },
];

const fitChecks = [
  "B2B SaaS with recurring subscription revenue in Stripe Billing",
  "Founder, operator, or finance owner without dedicated RevOps coverage",
  "Roughly $10k-$100k MRR and enough volume for leakage to matter",
  "Need a concrete audit and fix list, not another generic analytics chart",
];

const processSteps = [
  {
    step: "01",
    title: "Request the audit",
    detail:
      "Tell us who you are, what you sell, and where you think revenue is slipping.",
  },
  {
    step: "02",
    title: "We review your Stripe leakage pattern",
    detail:
      "We focus on failed payments, broken subscription states, and the highest-signal retention gaps.",
  },
  {
    step: "03",
    title: "You get a prioritized action plan",
    detail:
      "Not a vanity report. A list of what is likely leaking, what to fix first, and what that means for MRR.",
  },
];

const faqs = [
  {
    question: "Who is this audit for?",
    answer:
      "Stripe-native B2B SaaS teams with subscription revenue and no appetite for another broad analytics tool evaluation.",
  },
  {
    question: "Is this a free consultation or a product demo?",
    answer:
      "It is a free revenue leak audit request. If there is a real fit, the audit naturally leads into Corvidet.",
  },
  {
    question: "What if I am earlier than $10k MRR?",
    answer:
      "You can still use the product, but campaign-wise the strongest fit is the band where leakage has real dollar weight and fixes are still fast to ship.",
  },
  {
    question: "Why not just send people to the live demo?",
    answer:
      "Cold traffic converts better on a specific operational promise than on a general product tour. The demo stays available as secondary proof.",
  },
];

type SearchParamValue = string | string[] | undefined;

function buildQueryParams(params: Record<string, SearchParamValue>) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      if (value) query.append(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item) query.append(key, item);
      }
    }
  }

  return query;
}

function PreviewRow({
  amount,
  title,
  detail,
  tone,
}: {
  amount: string;
  title: string;
  detail: string;
  tone: "red" | "amber" | "blue";
}) {
  const toneStyles =
    tone === "red"
      ? "border-red-500/20 bg-red-500/8 text-red-200"
      : tone === "amber"
      ? "border-amber-500/20 bg-amber-500/8 text-amber-100"
      : "border-blue-500/20 bg-blue-500/8 text-blue-100";

  return (
    <div className={`rounded-2xl border p-4 ${toneStyles}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-white/55">Potential leak</p>
          <p className="mt-2 text-base font-semibold text-white">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-white/70">{detail}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-sm text-white">
          {amount}
        </span>
      </div>
    </div>
  );
}

export default async function LandingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, SearchParamValue>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const baseParams = buildQueryParams(resolvedSearchParams);
  const auditParams = new URLSearchParams(baseParams);
  if (!auditParams.has("landing_variant")) {
    auditParams.set("landing_variant", "stripe-b2b-saas-audit");
  }
  const auditQuery = auditParams.toString();
  const demoQuery = baseParams.toString();
  const auditHref = auditQuery ? `/audit?${auditQuery}` : "/audit";
  const demoHref = demoQuery ? `/demo?${demoQuery}` : "/demo";

  return (
    <main className="relative min-h-screen overflow-x-clip bg-[#0B0E11] text-[#E8ECF1]">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="orb orb-a" />
        <div className="orb orb-b" />
        <div className="orb orb-c" />
      </div>

      <nav className="sticky top-0 z-50 border-b border-[#1E2530]/50 bg-[#0B0E11]/60 backdrop-blur-2xl transition-all">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/Modern Logo with Geometric Crow and Teal Accents.png"
              alt="Corvidet"
              width={38}
              height={38}
              className="rounded-xl"
            />
            <div>
              <p className="text-[17px] font-bold tracking-tight text-[#E8ECF1]">Corvidet</p>
              <p className="text-xs text-[#5A6575]">Stripe revenue leak audits</p>
            </div>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            <a href="#fit" className="text-sm font-medium text-[#8B95A5] transition-colors hover:text-[#E8ECF1]">
              Best Fit
            </a>
            <a href="#audit" className="text-sm font-medium text-[#8B95A5] transition-colors hover:text-[#E8ECF1]">
              Audit Scope
            </a>
            <a href="#process" className="text-sm font-medium text-[#8B95A5] transition-colors hover:text-[#E8ECF1]">
              Process
            </a>
            <a href="#faq" className="text-sm font-medium text-[#8B95A5] transition-colors hover:text-[#E8ECF1]">
              FAQ
            </a>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden rounded-lg border border-[#1E2530] px-4 py-2 text-sm font-medium text-[#8B95A5] transition-colors hover:border-[#2A3444] hover:text-[#E8ECF1] sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href={auditHref}
              className="hidden rounded-lg bg-[#E8442A] px-4 py-2 text-sm font-semibold text-white transition-all hover:-translate-y-px hover:brightness-110 sm:inline-flex"
            >
              Request free audit
            </Link>
            <details className="relative md:hidden">
              <summary
                className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-[#1E2530] text-[#8B95A5] [&::-webkit-details-marker]:hidden"
                aria-label="Toggle menu"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12h18M3 6h18M3 18h18" />
                </svg>
              </summary>

              <div className="absolute right-0 top-[calc(100%+12px)] z-50 min-w-[240px] rounded-2xl border border-[#1E2530] bg-[#0B0E11] p-2 shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
                {[
                  { href: "#fit", label: "Best Fit" },
                  { href: "#audit", label: "Audit Scope" },
                  { href: "#process", label: "Process" },
                  { href: "#faq", label: "FAQ" },
                ].map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[#8B95A5] transition-colors hover:bg-[#12161B] hover:text-[#E8ECF1]"
                  >
                    {item.label}
                  </a>
                ))}
                <div className="mt-2 grid gap-2 border-t border-[#1E2530] pt-3">
                  <Link
                    href={auditHref}
                    className="rounded-lg bg-[#E8442A] px-4 py-2.5 text-center text-sm font-semibold text-white"
                  >
                    Request free audit
                  </Link>
                  <Link
                    href="/login"
                    className="rounded-lg border border-[#1E2530] px-4 py-2.5 text-center text-sm font-medium text-[#8B95A5]"
                  >
                    Sign in
                  </Link>
                </div>
              </div>
            </details>
          </div>
        </div>
      </nav>

      <section className="relative mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <div className="fade-up relative">
          <div aria-hidden className="hero-glow" />
          <span className="inline-flex items-center gap-2 rounded-full border border-[#E8442A]/25 bg-[#E8442A]/10 px-3.5 py-1.5 text-xs font-semibold text-[#E8442A]">
            <span className="badge-pulse h-1.5 w-1.5 rounded-full bg-[#E8442A]" />
            Free Stripe revenue leak audit for B2B SaaS
          </span>

          <h1 className="mt-6 text-[clamp(42px,7vw,72px)] font-bold leading-[1.02] tracking-[-0.04em] text-white">
            Find the MRR your
            <span className="text-gradient">
              {" "}Stripe Billing setup is quietly losing.
            </span>
          </h1>

          <p className="mt-6 max-w-[620px] text-[18px] leading-relaxed text-[#8B95A5]">
            Corvidet is best for Stripe-native B2B SaaS founders and operators between
            <span className="text-white font-medium">{" "}$10k and $100k MRR</span> who need a concrete leak audit, not another generic analytics dashboard.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href={auditHref}
              className="group inline-flex items-center gap-2 rounded-xl bg-[#E8442A] px-6 py-3.5 text-[15px] font-semibold text-white transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-[#E8442A]/30 hover:brightness-110"
            >
              Request free audit
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href={demoHref}
              className="inline-flex items-center gap-2 rounded-xl border border-[#1E2530]/80 bg-white/5 backdrop-blur-md px-6 py-3.5 text-[15px] font-medium text-[#E8ECF1] transition-all hover:-translate-y-1 hover:bg-white/10 hover:border-white/20"
            >
              View live demo
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-3 text-sm text-[#5A6575]">
            <span className="rounded-full border border-[#1E2530] bg-[#12161B] px-3 py-1.5">
              Read-only Stripe access
            </span>
            <span className="rounded-full border border-[#1E2530] bg-[#12161B] px-3 py-1.5">
              Prioritized action plan
            </span>
            <span className="rounded-full border border-[#1E2530] bg-[#12161B] px-3 py-1.5">
              Ideal for lean SaaS teams
            </span>
          </div>
        </div>

        <div className="fade-up delay-1 rounded-[28px] glass-card p-6 shadow-[0_30px_100px_rgba(0,0,0,0.35)] relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <div className="flex items-center justify-between gap-4 border-b border-[#1E2530] pb-5">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[#5A6575]">Audit preview</p>
              <h2 className="mt-2 text-xl font-semibold text-white">What a strong-fit account usually surfaces</h2>
            </div>
            <ShieldCheck className="h-10 w-10 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-300" />
          </div>

          <div className="mt-5 space-y-4">
            <PreviewRow
              amount="$2.8k/mo"
              title="Failed renewals with no real recovery path"
              detail="Retry logic exists, but billing follow-up and save messaging are weak or missing."
              tone="red"
            />
            <PreviewRow
              amount="$1.1k/mo"
              title="Past-due subscriptions still tied to live access"
              detail="Billing status and product entitlement are out of sync, so churn hides in operations."
              tone="amber"
            />
            <PreviewRow
              amount="14 days"
              title="Silent churn pattern before the dashboard shows it"
              detail="Expiring cards, cancellations, and downgrade behavior cluster before headline MRR moves."
              tone="blue"
            />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {proofPoints.map((point) => (
              <div key={point.label} className="rounded-2xl border border-[#1E2530] bg-[#0E1217] p-4">
                <p className="font-mono text-2xl font-bold text-white">{point.value}</p>
                <p className="mt-2 text-sm font-medium text-[#E8ECF1]">{point.label}</p>
                <p className="mt-2 text-xs leading-relaxed text-[#5A6575]">{point.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="fit" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#E8442A]">Best fit</p>
          <h2 className="mt-4 text-[clamp(28px,4vw,42px)] font-bold tracking-[-0.03em] text-white">
            Campaign to the operator who already feels the billing pain.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[#8B95A5]">
            This is not for every Stripe account. It is for the SaaS team that knows
            revenue is slipping somewhere in billing, but does not yet have a clear,
            prioritized explanation for where.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
          <div className="rounded-[26px] border border-[#1E2530] bg-[#12161B] p-7">
            <div className="flex items-center gap-3">
              <Users className="h-10 w-10 rounded-2xl border border-[#1E2530] bg-[#0E1217] p-2 text-[#E8442A]" />
              <div>
                <h3 className="text-lg font-semibold text-white">Who should request the audit</h3>
                <p className="text-sm text-[#5A6575]">Founder, COO, finance lead, or growth operator</p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {fitChecks.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-[#1E2530] bg-[#0E1217] px-4 py-3">
                  <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                  <p className="text-sm leading-relaxed text-[#C3CBD6]">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {auditFindings.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-[24px] glass-card group p-6 relative overflow-hidden">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#1E2530] bg-[#0E1217] transition-all duration-300 group-hover:scale-110 group-hover:border-[#E8442A]/30 group-hover:bg-[#E8442A]/10">
                    <Icon className="h-5 w-5 text-[#E8442A]" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-white transition-colors group-hover:text-[#E8442A]">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#8B95A5]">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="audit" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#E8442A]">Audit scope</p>
          <h2 className="mt-4 text-[clamp(28px,4vw,42px)] font-bold tracking-[-0.03em] text-white">
            One clear operational promise beats a broad product pitch.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[#8B95A5]">
            The campaign offer is simple: request a Stripe revenue leak audit and get a
            high-signal read on billing leakage, subscription breakage, and the first fixes
            worth shipping.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] glass-card group p-6">
            <Search className="h-9 w-9 text-[#E8442A] transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-110" />
            <h3 className="mt-5 text-lg font-semibold text-white">What we inspect</h3>
            <p className="mt-3 text-sm leading-relaxed text-[#8B95A5]">
              Failed invoices, dunning gaps, broken subscription states, card expiry patterns,
              and early churn signals tied to billing operations.
            </p>
          </div>
          <div className="rounded-[24px] glass-card group p-6">
            <Mail className="h-9 w-9 text-[#E8442A] transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-110" />
            <h3 className="mt-5 text-lg font-semibold text-white">What you receive</h3>
            <p className="mt-3 text-sm leading-relaxed text-[#8B95A5]">
              A concise action plan with the highest-value leak category, why it matters,
              and the first workflow or messaging fix to test.
            </p>
          </div>
          <div className="rounded-[24px] glass-card group p-6">
            <ChartNoAxesColumnIncreasing className="h-9 w-9 text-[#E8442A] transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-110" />
            <h3 className="mt-5 text-lg font-semibold text-white">What this is not</h3>
            <p className="mt-3 text-sm leading-relaxed text-[#8B95A5]">
              Not another generic BI dashboard, not a month-long consulting engagement,
              and not a random AI summary without operational context.
            </p>
          </div>
        </div>
      </section>

      <section id="process" className="mx-auto max-w-5xl px-6 py-20">
        <div className="mb-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#E8442A]">Process</p>
          <h2 className="mt-4 text-[clamp(28px,4vw,42px)] font-bold tracking-[-0.03em] text-white">
            A campaign flow your ICP can say yes to quickly.
          </h2>
        </div>

        <div className="divide-y divide-[#1E2530]/50 rounded-[28px] glass-card px-6">
          {processSteps.map((step) => (
            <div key={step.step} className="grid gap-5 py-7 md:grid-cols-[72px_1fr] md:items-start group">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#1E2530] bg-[#0E1217] font-mono text-lg font-semibold text-[#E8442A] transition-all duration-300 group-hover:border-[#E8442A]/30 group-hover:bg-[#E8442A]/10 group-hover:shadow-[0_0_15px_rgba(232,68,42,0.2)]">
                {step.step}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#8B95A5]">{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-4xl px-6 py-20">
        <div className="mb-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#E8442A]">FAQ</p>
          <h2 className="mt-4 text-[clamp(28px,4vw,42px)] font-bold tracking-[-0.03em] text-white">
            Questions your campaign traffic will ask
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((item) => (
            <details key={item.question} className="group rounded-2xl border border-[#1E2530] bg-[#12161B] px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[15px] font-semibold text-white">
                {item.question}
                <span className="text-xl text-[#5A6575] transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-[#8B95A5]">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-28 pt-6 text-center">
        <div className="rounded-[30px] border border-[#E8442A]/20 bg-[#E8442A]/6 px-8 py-12 shadow-[0_24px_80px_rgba(232,68,42,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#E8442A]">Primary CTA</p>
          <h2 className="mt-4 text-[clamp(28px,4vw,42px)] font-bold tracking-[-0.03em] text-white">
            Request the free leak audit before spending on broad marketing.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[#8B95A5]">
            If the offer converts with the right Stripe-native SaaS operator, then scale traffic.
            If it does not, fix positioning before buying reach.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href={auditHref}
              className="inline-flex items-center gap-2 rounded-xl bg-[#E8442A] px-6 py-3 font-semibold text-white transition-all hover:-translate-y-px hover:brightness-110"
            >
              Request free audit
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={demoHref}
              className="inline-flex items-center gap-2 rounded-xl border border-[#1E2530] px-6 py-3 font-medium text-[#8B95A5] transition-all hover:border-[#2A3444] hover:text-[#E8ECF1]"
            >
              View live demo
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#1E2530] px-6 py-8 text-center text-xs text-[#5A6575]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 md:flex-row">
          <p>Copyright 2026 Corvidet</p>
          <div className="flex items-center gap-4">
            <Link href="/audit" className="transition-colors hover:text-[#8B95A5]">
              Request audit
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-[#8B95A5]">
              Privacy
            </Link>
            <Link href="/contact" className="transition-colors hover:text-[#8B95A5]">
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
