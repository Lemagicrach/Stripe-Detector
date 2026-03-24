"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  AlertTriangle, TrendingUp, TrendingDown, Users, Zap, ArrowRight,
  CreditCard, Clock, XCircle, Ghost, ChevronDown, ChevronUp, Sparkles,
  CheckCircle2, ExternalLink,
} from "lucide-react";

// ── Hardcoded demo data ──────────────────────────────────────────────────────

const DEMO_MRR_HISTORY = [
  { date: "Feb 6",  mrr: 24100 },
  { date: "Feb 9",  mrr: 24650 },
  { date: "Feb 12", mrr: 25200 },
  { date: "Feb 15", mrr: 25800 },
  { date: "Feb 18", mrr: 26100 },
  { date: "Feb 21", mrr: 26500 },
  { date: "Feb 24", mrr: 26900 },
  { date: "Feb 27", mrr: 27200 },
  { date: "Mar 1",  mrr: 27650 },
  { date: "Mar 4",  mrr: 27100 }, // leak blip
  { date: "Mar 7",  mrr: 28500 },
];

const DEMO_LEAKS = [
  {
    id: "1",
    category: "failed_payment",
    severity: "critical",
    title: "12 Failed Payments Unrecovered",
    description:
      "12 customers attempted to pay but their charges declined. Without retry logic, these subscriptions will churn in the next billing cycle.",
    lost_revenue: 3240,
    recoverable_revenue: 3240,
    affected_customers: 12,
    recovery_probability: 0.70,
    fix_steps: [
      "Enable Stripe Smart Retries in your billing settings",
      "Send a personalised dunning email within 24 h of failure",
      "Add an in-app banner pointing to the billing portal for card update",
      "Set up a 3-email sequence (day 1, day 3, day 7) before cancelling",
    ],
  },
  {
    id: "2",
    category: "expiring_card",
    severity: "warning",
    title: "8 Cards Expiring This Month",
    description:
      "8 active customers have cards that expire within 30 days. Without proactive outreach, expect silent payment failures next month.",
    lost_revenue: 1840,
    recoverable_revenue: 1840,
    affected_customers: 8,
    recovery_probability: 0.85,
    fix_steps: [
      "Enable Stripe Automatic Card Updater (updates Visa/MC automatically)",
      "Send a 'Your card is expiring soon' email 2 weeks before expiry",
      "Add a dashboard prompt for customers with soon-to-expire cards",
    ],
  },
  {
    id: "3",
    category: "pending_cancel",
    severity: "warning",
    title: "5 Subscriptions Scheduled to Cancel",
    description:
      "5 customers activated cancel at period end. You have until their next renewal date to run a save campaign.",
    lost_revenue: 920,
    recoverable_revenue: 460,
    affected_customers: 5,
    recovery_probability: 0.25,
    fix_steps: [
      "Trigger an exit survey to learn why they're leaving",
      "Offer a one-time 20% discount valid for 48 h",
      "Show a feature highlight of capabilities they haven't tried yet",
      "Route high-value churners to a founder call",
    ],
  },
  {
    id: "4",
    category: "zombie_subscription",
    severity: "info",
    title: "3 Zombie Subscriptions Detected",
    description:
      "3 paying customers haven't logged in or used any feature in over 45 days. They are high churn risk.",
    lost_revenue: 240,
    recoverable_revenue: 180,
    affected_customers: 3,
    recovery_probability: 0.40,
    fix_steps: [
      "Send a re-engagement email with a 5-minute quick-win tutorial",
      "Trigger an in-app onboarding checklist on next login",
      "Consider a 'We miss you' coupon to restart habit formation",
    ],
  },
];

const TOTAL_LOST = DEMO_LEAKS.reduce((s, l) => s + l.lost_revenue, 0);
const TOTAL_RECOVERABLE = DEMO_LEAKS.reduce((s, l) => s + l.recoverable_revenue, 0);
const LEAK_SCORE = 62;
const DEMO_MRR = 28500;
const DEMO_CUSTOMERS = 94;
const DEMO_CHURN = 2.7;
const DEMO_NRR = 104.2;

// ── Sub-components ───────────────────────────────────────────────────────────

const SEVERITY_ICON: Record<string, React.ReactNode> = {
  critical: <XCircle className="h-4 w-4 text-red-400" />,
  warning:  <Clock className="h-4 w-4 text-amber-400" />,
  info:     <Ghost className="h-4 w-4 text-blue-400" />,
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/30",
  warning:  "text-amber-400 bg-amber-500/10 border-amber-500/30",
  info:     "text-blue-400 bg-blue-500/10 border-blue-500/30",
};

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  failed_payment:       <CreditCard className="h-5 w-5 text-red-400" />,
  expiring_card:        <Clock className="h-5 w-5 text-amber-400" />,
  pending_cancel:       <XCircle className="h-5 w-5 text-amber-400" />,
  zombie_subscription:  <Ghost className="h-5 w-5 text-blue-400" />,
};

function HealthRing({ score }: { score: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const filled = circumference * (score / 100);
  const color = score >= 70 ? "#10B981" : score >= 40 ? "#F59E0B" : "#EF4444";
  const label = score >= 70 ? "Healthy" : score >= 40 ? "At Risk" : "Critical";
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-36 w-36">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#1E293B" strokeWidth="10" />
          <circle
            cx="60" cy="60" r={radius} fill="none"
            stroke={color} strokeWidth="10"
            strokeDasharray={`${filled} ${circumference}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-3xl font-bold text-white">{score}</span>
          <span className="text-xs text-gray-400">/ 100</span>
        </div>
      </div>
      <span className="text-sm font-semibold" style={{ color }}>{label}</span>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm shadow-xl">
      <p className="text-gray-400">{label}</p>
      <p className="font-mono font-semibold text-white">${payload[0].value.toLocaleString()}</p>
    </div>
  );
};

function LeakCard({ leak }: { leak: typeof DEMO_LEAKS[number] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-xl border bg-gray-900 overflow-hidden transition-all ${
      leak.severity === "critical" ? "border-red-500/30" :
      leak.severity === "warning"  ? "border-amber-500/20" :
                                     "border-gray-800"
    }`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start gap-4 p-5 text-left hover:bg-gray-800/40 transition-colors"
      >
        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          leak.severity === "critical" ? "bg-red-500/10" :
          leak.severity === "warning"  ? "bg-amber-500/10" :
                                         "bg-blue-500/10"
        }`}>
          {CATEGORY_ICON[leak.category]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${SEVERITY_BADGE[leak.severity]}`}>
              {SEVERITY_ICON[leak.severity]} {leak.severity}
            </span>
            <span className="text-sm font-semibold text-gray-100">{leak.title}</span>
          </div>
          <p className="mt-1.5 text-xs text-gray-400 line-clamp-2">{leak.description}</p>
          <div className="mt-3 flex flex-wrap gap-4 text-xs">
            <span className="font-mono font-semibold text-red-300">-${leak.lost_revenue.toLocaleString()}/mo</span>
            <span className="font-mono font-semibold text-emerald-300">+${leak.recoverable_revenue.toLocaleString()} recoverable</span>
            <span className="text-gray-500">{leak.affected_customers} customer{leak.affected_customers !== 1 ? "s" : ""}</span>
            <span className="text-gray-500">{Math.round(leak.recovery_probability * 100)}% recovery rate</span>
          </div>
        </div>
        <div className="shrink-0 text-gray-500">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-gray-800 px-5 pb-5 pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Fix steps</p>
          <ol className="space-y-2">
            {leak.fix_steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-400">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-[#0B1120] text-white">
      {/* Top banner */}
      <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900/80 px-4 py-3 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-white">Corvidet</span>
          <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-400">
            Demo — sample data
          </span>
        </div>
        <Link
          href="/login"
          className="flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 transition-colors"
        >
          Connect your Stripe <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Revenue Pulse</h1>
            <p className="mt-1 text-sm text-gray-400">Live scan · acme-saas.stripe.com · Mar 7, 2026</p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Scan complete — 4 leaks found
          </div>
        </div>

        {/* Score + stat cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center justify-center rounded-xl border border-gray-800 bg-gray-900 p-6">
            <HealthRing score={LEAK_SCORE} />
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">MRR</p>
            <p className="mt-3 font-mono text-3xl font-bold text-white">${DEMO_MRR.toLocaleString()}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-emerald-400">
              <TrendingUp className="h-3 w-3" /> +18.2% vs last 30 days
            </p>
          </div>
          <div className="rounded-xl border border-red-900/30 bg-red-500/5 p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-red-400">Leaking / mo</p>
            <p className="mt-3 font-mono text-3xl font-bold text-red-300">${TOTAL_LOST.toLocaleString()}</p>
            <p className="mt-1 text-xs text-red-400/60">4 active leaks detected</p>
          </div>
          <div className="rounded-xl border border-emerald-900/30 bg-emerald-500/5 p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">Recoverable</p>
            <p className="mt-3 font-mono text-3xl font-bold text-emerald-300">${TOTAL_RECOVERABLE.toLocaleString()}</p>
            <p className="mt-1 text-xs text-emerald-400/60">With quick action today</p>
          </div>
        </div>

        {/* Critical alert */}
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <span className="text-sm font-semibold text-red-300">1 critical issue — act today or lose $3,240 this month</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-gray-900/60 px-4 py-3">
            <span className="text-sm text-gray-200">12 Failed Payments Unrecovered</span>
            <span className="font-mono text-sm font-semibold text-red-300">-$3,240/mo</span>
          </div>
        </div>

        {/* MRR chart */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">MRR Trend</p>
              <p className="text-xs text-gray-400">Last 30 days — revenue dip detected Mar 4</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              <span className="text-xs text-gray-400">MRR</span>
              <span className="h-2 w-2 ml-2 rounded-full bg-red-500" />
              <span className="text-xs text-gray-400">Leak event</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={DEMO_MRR_HISTORY} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="demoMrrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis dataKey="date" tick={{ fill: "#6B7280", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: "#6B7280", fontSize: 11 }}
                axisLine={false} tickLine={false}
                tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                domain={[22000, 30000]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone" dataKey="mrr"
                stroke="#3B82F6" strokeWidth={2}
                fill="url(#demoMrrGrad)" dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Secondary metrics */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-400" />
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Active customers</p>
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-white">{DEMO_CUSTOMERS}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-400" />
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Churn rate</p>
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-white">{DEMO_CHURN}%</p>
            <p className="mt-1 text-xs text-gray-500">Industry avg: 3.5% — you&apos;re below average</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-400" />
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">NRR</p>
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-white">{DEMO_NRR}%</p>
            <p className="mt-1 text-xs text-gray-500">Above 100% = net expansion</p>
          </div>
        </div>

        {/* Leak cards */}
        <div>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Revenue leaks — click to expand fix steps
          </h2>
          <div className="space-y-3">
            {DEMO_LEAKS.map(leak => (
              <LeakCard key={leak.id} leak={leak} />
            ))}
          </div>
        </div>

        {/* AI copilot demo */}
        <div className="rounded-xl border border-purple-500/20 bg-gray-900 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
            <Sparkles className="h-4 w-4 text-purple-400" />
            <span className="text-sm font-semibold text-white">AI Revenue Copilot</span>
            <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-xs text-purple-400">demo preview</span>
          </div>
          <div className="space-y-4 p-5">
            <div className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-700 text-xs font-bold text-gray-300">
                You
              </div>
              <div className="rounded-2xl rounded-tl-none bg-gray-800 px-4 py-3 text-sm text-gray-100">
                Why did MRR dip on March 4?
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-600 text-xs">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </div>
              <div className="rounded-2xl rounded-tl-none border border-purple-500/20 bg-purple-500/5 px-4 py-3 text-sm text-gray-100 leading-relaxed">
                The March 4 dip (-$550) is consistent with the{" "}
                <span className="text-red-300 font-medium">12 failed payments</span> detected in your current scan.
                Five of those failures occurred on Mar 3–4 when your payment processor reported elevated decline rates
                for international cards. Enabling{" "}
                <span className="text-blue-300 font-medium">Stripe Smart Retries</span> would have recovered an
                estimated $1,840 automatically. I&apos;d prioritise fixing this before your next billing cycle (Mar 14).
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-600/10 to-purple-600/10 p-8 text-center">
          <h2 className="text-2xl font-bold text-white">Ready to scan your real Stripe data?</h2>
          <p className="mx-auto mt-3 max-w-md text-gray-400">
            Connect in 30 seconds. Read-only OAuth — we never touch your money.
            First insights in under 2 minutes.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="flex items-center gap-2 rounded-xl bg-blue-500 px-6 py-3 font-semibold text-white hover:bg-blue-600 transition-colors"
            >
              <Zap className="h-4 w-4" />
              Connect my Stripe now
            </Link>
            <a
              href="https://stripe.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-300 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Powered by Stripe Connect
            </a>
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-4 text-xs text-gray-500">
            <span>No credit card required</span>
            <span>·</span>
            <span>Read-only access</span>
            <span>·</span>
            <span>Cancel anytime</span>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-600 pb-4">
          This is a marketing demo with sample data. Real scans use your actual Stripe account.
        </p>
      </div>
    </div>
  );
}
