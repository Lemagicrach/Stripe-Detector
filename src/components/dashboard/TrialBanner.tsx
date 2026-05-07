"use client";

import Link from "next/link";

type Props = {
  trialEndsAt: string;
};

export function TrialBanner({ trialEndsAt }: Props) {
  const endsAt = new Date(trialEndsAt);
  const now = Date.now();
  const msLeft = endsAt.getTime() - now;
  if (msLeft <= 0) return null;

  const daysLeft = Math.max(1, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
  const label = daysLeft === 1 ? "1 day" : `${daysLeft} days`;

  return (
    <div className="border-b border-blue-900/40 bg-blue-950/40 px-6 py-2.5">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 text-sm sm:flex-row sm:items-center">
        <p className="text-blue-200">
          <span className="font-semibold">{label} left</span> in your Growth trial.{" "}
          <span className="text-blue-300/70">Add a payment method to keep your features after the trial ends.</span>
        </p>
        <Link
          href="/dashboard/billing"
          className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500"
        >
          Add payment method
        </Link>
      </div>
    </div>
  );
}
