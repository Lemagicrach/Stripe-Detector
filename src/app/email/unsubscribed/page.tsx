import Link from "next/link";

export const metadata = {
  title: "Unsubscribed - Corvidet",
  description: "You've been unsubscribed from Corvidet email notifications.",
};

export default async function UnsubscribedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; reason?: string }>;
}) {
  const params = await searchParams;
  const success = params.status === "success";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0B0E11] p-6 text-[#E8ECF1]">
      <div className="w-full max-w-md rounded-2xl border border-[#1E2530] bg-[#0F1419] p-8 text-center">
        {success ? (
          <>
            <h1 className="mb-3 text-2xl font-bold">You&apos;re unsubscribed</h1>
            <p className="text-sm leading-relaxed text-[#8B95A5]">
              We won&apos;t send you marketing or alert emails anymore. You&apos;ll still receive transactional notices required by your account (deletion confirmation, trial-ending notice, billing).
            </p>
            <p className="mt-4 text-sm leading-relaxed text-[#8B95A5]">
              Changed your mind? Sign in and re-enable notifications from your settings page.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link
                href="/dashboard/settings"
                className="rounded-lg bg-[#E8442A] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
              >
                Re-enable notifications
              </Link>
              <Link
                href="/"
                className="rounded-lg border border-[#1E2530] px-4 py-2 text-sm font-medium text-[#E8ECF1] transition-colors hover:bg-[#1E2530]"
              >
                Back to home
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="mb-3 text-2xl font-bold">Couldn&apos;t unsubscribe</h1>
            <p className="text-sm leading-relaxed text-[#8B95A5]">
              The unsubscribe link is invalid or expired{params.reason ? ` (${params.reason})` : ""}.
              Try the most recent email, or contact{" "}
              <a href="mailto:support@corvidet.com" className="text-[#E8442A] underline">support@corvidet.com</a>.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block rounded-lg border border-[#1E2530] px-4 py-2 text-sm font-medium text-[#E8ECF1] transition-colors hover:bg-[#1E2530]"
            >
              Back to home
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
