"use client";
import Link from "next/link";
import { useState } from "react";

// â”€â”€ Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const tickerLeaks = [
  {
    icon: "ðŸ’³",
    type: "Failed payment â€” no retry",
    desc: "Card declined 3 days ago, no dunning email sent",
    amount: "âˆ’$149/mo",
    color: "red" as const,
  },
  {
    icon: "â³",
    type: "Trial expired â€” no conversion nudge",
    desc: "14-day trial ended, customer never contacted",
    amount: "âˆ’$79/mo",
    color: "yellow" as const,
  },
  {
    icon: "ðŸ’³",
    type: 'Subscription stuck in "past_due"',
    desc: "Active user, payment failed 12 days ago, still using product",
    amount: "âˆ’$299/mo",
    color: "red" as const,
  },
  {
    icon: "ðŸ“‰",
    type: "Cancellation wave detected",
    desc: "4 cancellations in 48 h from same pricing tier",
    amount: "âˆ’$596/mo",
    color: "yellow" as const,
  },
];

const stats = [
  {
    number: "9%",
    title: "Lost to failed payments",
    desc: "The average SaaS loses 9% of MRR monthly to involuntary churn from card failures that never get resolved.",
  },
  {
    number: "23%",
    title: "Trials that vanish",
    desc: "Nearly 1 in 4 trials expire without any follow-up. These are people who already showed intent.",
  },
  {
    number: "$0",
    title: "Recovered by default",
    desc: "Stripe's built-in retry logic is minimal. Without active recovery, failed payments stay failed.",
  },
];

const steps = [
  {
    num: "01",
    title: "Connect Stripe",
    desc: "OAuth with read-only permissions. We never touch your API keys or modify any data.",
    time: "30 seconds",
  },
  {
    num: "02",
    title: "We scan everything",
    desc: "Failed payments, stuck subscriptions, trial drop-offs, churn velocity, pricing anomalies â€” every signal that points to money leaving your account.",
    time: "2â€“4 minutes",
  },
  {
    num: "03",
    title: "Get your leak report",
    desc: "A clear breakdown of what's leaking, how much it's costing you, and exactly what to fix â€” ranked by dollar impact.",
    time: undefined,
  },
  {
    num: "04",
    title: "Monitor continuously",
    desc: "New leaks get flagged in real time. Alerts when churn spikes, payments fail in clusters, or a high-value customer goes quiet.",
    time: undefined,
  },
];

const leakTypes = [
  {
    icon: "ðŸ’³",
    title: "Failed payments without recovery",
    desc: "Declined cards with no retry schedule or dunning email. Revenue that just disappears.",
    stat: "Avg. recoverable: $380/mo per SaaS",
  },
  {
    icon: "â¸",
    title: "Subscriptions stuck in limbo",
    desc: 'Past-due, incomplete, or "active" subscriptions where the customer stopped paying weeks ago.',
    stat: "Found in 68% of scanned accounts",
  },
  {
    icon: "ðŸ“‰",
    title: "Silent churn patterns",
    desc: "Clusters of cancellations from the same plan, cohort, or time period that signal a deeper problem.",
    stat: "Detected 14 days before it hits MRR",
  },
  {
    icon: "ðŸ””",
    title: "Trial-to-paid drop-offs",
    desc: "Trials that expire without a conversion email, payment method prompt, or any engagement signal.",
    stat: "23% avg. trial abandonment rate",
  },
  {
    icon: "ðŸ·",
    title: "Pricing misconfigurations",
    desc: "Coupons that never expire, legacy plans with outdated pricing, customers grandfathered below cost.",
    stat: "Avg. $200/mo in underpriced subs",
  },
  {
    icon: "ðŸ¤–",
    title: "AI-powered diagnostics",
    desc: "Ask questions in plain English about any metric. Get answers with context, not just numbers.",
    stat: "Powered by real-time Stripe data",
  },
];

const vsRows: {
  feature: string;
  Corvidet: boolean | string;
  chartmogul: boolean | string;
  baremetrics: boolean | string;
}[] = [
  { feature: "Revenue leak detection",   Corvidet: true,      chartmogul: false,    baremetrics: false },
  { feature: "Leak $ impact scoring",    Corvidet: true,      chartmogul: false,    baremetrics: false },
  { feature: "Real-time churn alerts",   Corvidet: true,      chartmogul: false,    baremetrics: true  },
  { feature: "MRR / ARR / churn tracking", Corvidet: true,    chartmogul: true,     baremetrics: true  },
  { feature: "AI Q&A on metrics",        Corvidet: true,      chartmogul: false,    baremetrics: false },
  { feature: "Free tier",               Corvidet: "<$10K",   chartmogul: "<$10K",  baremetrics: "$108/mo" },
  { feature: "Setup time",              Corvidet: "5 min",   chartmogul: "10 min", baremetrics: "10 min" },
];

const plans = [
  {
    tag: "Free",
    name: "Starter",
    price: "$0",
    note: "/mo",
    subNote: "Under $10K MRR",
    features: ["Full leak scan", "MRR, churn, revenue tracking", "5 AI queries/month", "30-day data retention"],
    cta: "Start for free â†’",
    href: "/login",
    featured: false,
  },
  {
    tag: "Most popular",
    name: "Growth",
    price: "$29",
    note: "/mo",
    subNote: "Up to $100K MRR",
    features: ["Continuous leak monitoring", "Real-time churn alerts", "50 AI queries/month", "1-year data retention", "Email support"],
    cta: "Start 14-day trial â†’",
    href: "/login",
    featured: true,
  },
  {
    tag: "Scale",
    name: "Business",
    price: "$99",
    note: "/mo",
    subNote: "Up to $500K MRR",
    features: ["Everything in Growth", "200 AI queries/month", "Custom leak reports", "Unlimited retention", "Priority support"],
    cta: "Start 14-day trial",
    href: "/login",
    featured: false,
  },
];

const faqs = [
  {
    q: 'What exactly is a "revenue leak"?',
    a: "Any revenue you should be collecting but aren't â€” failed payments without retry, expired trials without follow-up, subscriptions stuck in broken states, or pricing errors that undercharge customers.",
  },
  {
    q: "How is this different from Stripe's dashboard?",
    a: "Stripe shows you what happened. Corvidet shows you what's going wrong â€” silently. We surface the patterns, anomalies, and broken flows that don't show up in a revenue chart.",
  },
  {
    q: "Is my Stripe data safe?",
    a: "We connect via OAuth with read-only access. We never see your API keys, never modify your data, and you can disconnect in one click at any time.",
  },
  {
    q: "I'm already using ChartMogul / Baremetrics",
    a: "Corvidet doesn't replace your analytics dashboard â€” it complements it. Those tools show metrics. We find the problems hiding inside those metrics. Many users run both.",
  },
  {
    q: "How fast does it work?",
    a: "Connect Stripe, and your first leak report is ready in under 5 minutes. Continuous monitoring starts immediately after.",
  },
  {
    q: "What if no leaks are found?",
    a: "Then you're running a tight ship and the scan cost you nothing. But in 90%+ of accounts we scan, we find recoverable revenue.",
  },
];

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function VsCell({ value }: { value: boolean | string }) {
  if (value === true)  return <td className="px-4 py-3.5 text-center text-sm font-semibold text-[#2ECC71]">âœ“</td>;
  if (value === false) return <td className="px-4 py-3.5 text-center text-sm text-[#5A6575]">âœ•</td>;
  return <td className="px-4 py-3.5 text-center text-sm text-[#8B95A5]">{value}</td>;
}

// â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <main className="relative min-h-screen overflow-x-clip bg-[#0B0E11] text-[#E8ECF1]">
      {/* Background orbs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="orb orb-a" />
        <div className="orb orb-b" />
      </div>

      {/* â”€â”€ NAV â”€â”€ */}
      <nav className="sticky top-0 z-50 border-b border-[#1E2530] bg-[#0B0E11]/85 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <img
              src="/Modern Logo with Geometric Crow and Teal Accents.png"
              alt="Corvidet"
              width={36}
              height={36}
              className="rounded-lg object-contain"
            />
            <span className="text-[17px] font-bold tracking-tight text-[#E8ECF1]">Corvidet</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden items-center gap-8 sm:flex">
            <a href="#how"     className="text-sm font-medium text-[#8B95A5] transition-colors hover:text-[#E8ECF1]">How it works</a>
            <a href="#leaks"   className="text-sm font-medium text-[#8B95A5] transition-colors hover:text-[#E8ECF1]">What we find</a>
            <a href="#pricing" className="text-sm font-medium text-[#8B95A5] transition-colors hover:text-[#E8ECF1]">Pricing</a>
            <a href="#faq"     className="text-sm font-medium text-[#8B95A5] transition-colors hover:text-[#E8ECF1]">FAQ</a>
          </div>

          <div className="flex items-center gap-3">
            {/* Desktop CTAs */}
            <Link
              href="/login"
              className="hidden rounded-lg border border-[#1E2530] px-4 py-2 text-sm font-medium text-[#8B95A5] transition-colors hover:border-[#2A3444] hover:text-[#E8ECF1] sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="hidden rounded-lg bg-[#E8442A] px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-110 hover:-translate-y-px sm:inline-flex"
            >
              Get started free
            </Link>

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#1E2530] text-[#8B95A5] sm:hidden"
              aria-label="Toggle menu"
            >
              {mobileOpen ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="border-t border-[#1E2530] px-6 pb-5 pt-4 sm:hidden">
            <div className="flex flex-col gap-1">
              {[
                { href: "#how",     label: "How it works" },
                { href: "#leaks",   label: "What we find" },
                { href: "#pricing", label: "Pricing" },
                { href: "#faq",     label: "FAQ" },
              ].map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#8B95A5] transition-colors hover:bg-[#12161B] hover:text-[#E8ECF1]"
                >
                  {label}
                </a>
              ))}
              <div className="mt-3 flex flex-col gap-2 border-t border-[#1E2530] pt-3">
                <Link href="/login" onClick={() => setMobileOpen(false)} className="rounded-lg border border-[#1E2530] px-4 py-2.5 text-center text-sm font-medium text-[#8B95A5]">
                  Sign in
                </Link>
                <Link href="/login" onClick={() => setMobileOpen(false)} className="rounded-lg bg-[#E8442A] px-4 py-2.5 text-center text-sm font-semibold text-white">
                  Get started free
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* â”€â”€ HERO â”€â”€ */}
      <section className="relative mx-auto max-w-[860px] px-6 pb-16 pt-24 text-center">
        {/* Radial glow */}
        <div aria-hidden className="hero-glow" />

        <div className="fade-up relative">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#E8442A]/25 bg-[#E8442A]/10 px-3.5 py-1.5 text-xs font-semibold text-[#E8442A]">
            <span className="badge-pulse h-1.5 w-1.5 rounded-full bg-[#E8442A]" />
            Revenue leak scanner for Stripe SaaS
          </span>
        </div>

        <h1 className="fade-up delay-1 mt-4 text-[clamp(36px,5.5vw,58px)] font-bold leading-[1.1] tracking-[-0.03em]">
          Your Stripe account is{" "}
          <span
            className="bg-gradient-to-br from-[#E8442A] to-[#FF6B4A] bg-clip-text text-transparent"
          >
            leaking revenue.
          </span>
          <br />Corvidet finds it.
        </h1>

        <p className="fade-up delay-2 mx-auto mt-5 max-w-[560px] text-[17px] leading-relaxed text-[#8B95A5]">
          Failed payments nobody follows up on. Subscriptions stuck in limbo. Churn patterns you don&apos;t see until it&apos;s too late.
          Connect your Stripe and get a leak report in under 5 minutes.
        </p>

        <div className="fade-up delay-2 mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 rounded-lg bg-[#E8442A] px-5 py-3 text-[15px] font-semibold text-white transition-all hover:brightness-110 hover:-translate-y-px"
          >
            Run live demo scan â†’
          </Link>
          <a
            href="#how"
            className="inline-flex items-center gap-2 rounded-lg border border-[#1E2530] px-5 py-3 text-[15px] font-medium text-[#8B95A5] transition-all hover:border-[#2A3444] hover:text-[#E8ECF1]"
          >
            See what we detect
          </a>
        </div>

        <p className="fade-up delay-3 mt-5 text-xs text-[#5A6575]">
          Read-only access Â· Free under $10K MRR Â· Disconnect anytime
        </p>
      </section>

      {/* â”€â”€ LEAK TICKER â”€â”€ */}
      <section className="mx-auto max-w-[700px] px-6 pb-20">
        <p className="mb-4 text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-[#5A6575]">
          Example leaks we detect in Stripe accounts
        </p>
        <div className="space-y-2">
          {tickerLeaks.map((leak, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl border border-[#1E2530] bg-[#12161B] px-5 py-4 transition-colors hover:border-[#2A3444]"
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base ${
                  leak.color === "red" ? "bg-[#E8442A]/10" : "bg-[#F0B832]/10"
                }`}>
                  {leak.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-[#E8ECF1]">{leak.type}</p>
                  <p className="text-xs text-[#5A6575]">{leak.desc}</p>
                </div>
              </div>
              <span className={`shrink-0 font-mono text-sm font-semibold ${
                leak.color === "red" ? "text-[#E8442A]" : "text-[#F0B832]"
              }`}>
                {leak.amount}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* â”€â”€ PROBLEM STATS â”€â”€ */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="mb-12 text-center">
          <h2 className="text-[clamp(26px,3.5vw,38px)] font-bold tracking-[-0.02em]">The leaks nobody talks about</h2>
          <p className="mt-3 text-[#8B95A5]">Stripe shows you revenue. It doesn&apos;t show you what you&apos;re silently losing every month.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {stats.map((s, i) => (
            <div
              key={s.title}
              className={`fade-up delay-${i + 1} rounded-xl border border-[#1E2530] bg-[#12161B] p-7 transition-all hover:border-[#2A3444] hover:bg-[#181D24]`}
            >
              <p className="font-mono text-4xl font-bold text-[#E8442A]">{s.number}</p>
              <h3 className="mt-3 text-base font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#8B95A5]">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* â”€â”€ HOW IT WORKS â”€â”€ */}
      <section id="how" className="mx-auto max-w-[780px] px-6 py-20">
        <div className="mb-12 text-center">
          <h2 className="text-[clamp(26px,3.5vw,38px)] font-bold tracking-[-0.02em]">
            From connected to leak report in 5 minutes
          </h2>
          <p className="mt-3 text-[#8B95A5]">No code. No spreadsheets. No 45-minute onboarding calls.</p>
        </div>
        <div className="divide-y divide-[#1E2530]">
          {steps.map((step) => (
            <div key={step.num} className="grid grid-cols-[56px_1fr] gap-5 py-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#1E2530] bg-[#12161B] font-mono text-base font-semibold text-[#5A6575]">
                {step.num}
              </div>
              <div>
                <h3 className="text-[16px] font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[#8B95A5]">{step.desc}</p>
                {step.time && (
                  <span className="mt-2.5 inline-block rounded-full bg-[#2ECC71]/10 px-3 py-1 text-xs font-medium text-[#2ECC71]">
                    {step.time}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* â”€â”€ WHAT WE FIND â”€â”€ */}
      <section id="leaks" className="mx-auto max-w-5xl px-6 py-20">
        <div className="mb-12 text-center">
          <h2 className="text-[clamp(26px,3.5vw,38px)] font-bold tracking-[-0.02em]">
            What Corvidet catches that Stripe doesn&apos;t show you
          </h2>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {leakTypes.map((leak, i) => (
            <div
              key={leak.title}
              className={`fade-up delay-${(i % 3) + 1} rounded-xl border border-[#1E2530] bg-[#12161B] p-6 transition-all hover:border-[#2A3444]`}
            >
              <span className="text-[22px]">{leak.icon}</span>
              <h3 className="mt-3.5 text-[15px] font-semibold">{leak.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#8B95A5]">{leak.desc}</p>
              <p className="mt-4 border-t border-[#1E2530] pt-4 font-mono text-xs text-[#F0B832]">{leak.stat}</p>
            </div>
          ))}
        </div>
      </section>

      {/* â”€â”€ COMPARISON TABLE â”€â”€ */}
      <section className="mx-auto max-w-[700px] px-6 py-20">
        <div className="mb-12 text-center">
          <h2 className="text-[clamp(26px,3.5vw,38px)] font-bold tracking-[-0.02em]">Corvidet vs. the alternatives</h2>
          <p className="mt-3 text-[#8B95A5]">Others show you dashboards. We show you what&apos;s broken.</p>
        </div>
        <div className="overflow-hidden rounded-xl border border-[#1E2530]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#1E2530]">
                <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.06em] text-[#5A6575]">
                  <span className="sr-only">Feature</span>
                </th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-[0.06em] text-[#E8442A]">Corvidet</th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-[0.06em] text-[#5A6575]">ChartMogul</th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-[0.06em] text-[#5A6575]">Baremetrics</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2530] bg-[#12161B]">
              {vsRows.map((row) => (
                <tr key={row.feature} className="hover:bg-[#181D24]">
                  <td className="px-4 py-3.5 text-sm font-medium text-[#E8ECF1]">{row.feature}</td>
                  <VsCell value={row.Corvidet} />
                  <VsCell value={row.chartmogul} />
                  <VsCell value={row.baremetrics} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* â”€â”€ PRICING â”€â”€ */}
      <section id="pricing" className="mx-auto max-w-5xl px-6 py-20">
        <div className="mb-12 text-center">
          <h2 className="text-[clamp(26px,3.5vw,38px)] font-bold tracking-[-0.02em]">One scan could pay for a year</h2>
          <p className="mt-3 text-[#8B95A5]">Free for early-stage. Priced to save you multiples of what you pay.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {plans.map((plan, i) => (
            <div
              key={plan.name}
              className={`fade-up delay-${(i % 3) + 1} flex flex-col rounded-xl border p-7 transition-all ${
                plan.featured
                  ? "border-[#E8442A] shadow-[0_0_40px_rgba(232,68,42,0.12)]"
                  : "border-[#1E2530] bg-[#12161B]"
              }`}
            >
              <p className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${plan.featured ? "text-[#E8442A]" : "text-[#5A6575]"}`}>
                {plan.tag}
              </p>
              <h3 className="mt-3 text-lg font-bold">{plan.name}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="font-mono text-4xl font-bold">{plan.price}</span>
                <span className="text-sm text-[#8B95A5]">{plan.note}</span>
              </div>
              <p className="mt-0.5 text-xs text-[#5A6575]">{plan.subNote}</p>
              <ul className="mt-5 flex-grow space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-[#8B95A5]">
                    <span className="mt-0.5 shrink-0 font-semibold text-[#2ECC71]">âœ“</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`mt-6 w-full rounded-lg py-2.5 text-center text-sm font-semibold transition-all ${
                  plan.featured
                    ? "bg-[#E8442A] text-white hover:brightness-110"
                    : "border border-[#1E2530] text-[#8B95A5] hover:border-[#2A3444] hover:text-[#E8ECF1]"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* â”€â”€ FAQ â”€â”€ */}
      <section id="faq" className="mx-auto max-w-[640px] px-6 py-20">
        <div className="mb-12 text-center">
          <h2 className="text-[clamp(26px,3.5vw,38px)] font-bold tracking-[-0.02em]">Questions</h2>
        </div>
        <div className="divide-y divide-[#1E2530]">
          {faqs.map((item) => (
            <details key={item.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[15px] font-semibold">
                {item.q}
                <span className="ml-4 shrink-0 text-xl text-[#5A6575] transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-[#8B95A5]">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* â”€â”€ BOTTOM CTA â”€â”€ */}
      <section className="mx-auto max-w-[640px] px-6 pb-28 pt-4 text-center">
        <div className="rounded-2xl border border-[#E8442A]/20 bg-[#E8442A]/5 px-8 py-12">
          <h2 className="text-[clamp(24px,3vw,34px)] font-bold leading-tight tracking-[-0.02em]">
            Find out what Stripe isn&apos;t telling you
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[#8B95A5]">
            Connect in 30 seconds. Get your leak report in 5 minutes. Free under $10K MRR.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-lg bg-[#E8442A] px-6 py-3 font-semibold text-white transition-all hover:brightness-110 hover:-translate-y-px"
            >
              Run live demo scan â†’
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center rounded-lg border border-[#1E2530] px-6 py-3 font-medium text-[#8B95A5] transition-all hover:border-[#2A3444] hover:text-[#E8ECF1]"
            >
              Sign in
            </Link>
          </div>
          <p className="mt-5 text-xs text-[#5A6575]">
            No credit card required Â· Read-only access Â· Cancel anytime
          </p>
        </div>
      </section>

      {/* â”€â”€ FOOTER â”€â”€ */}
      <footer className="border-t border-[#1E2530] px-6 py-8 text-center text-xs text-[#5A6575]">
        Â© 2026 Corvidet Â·{" "}
        <a href="/privacy" className="transition-colors hover:text-[#8B95A5]">Privacy</a>
        {" Â· "}
        <a href="/contact" className="transition-colors hover:text-[#8B95A5]">Contact</a>
      </footer>
    </main>
  );
}
