import Link from "next/link";

export const metadata = {
  title: "Contact — Corvidet",
  description: "Get in touch with the Corvidet team.",
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#0B0E11] text-[#E8ECF1]">
      <nav className="border-b border-[#1E2530] px-6 py-4">
        <Link href="/" className="flex items-center gap-2 text-[17px] font-bold tracking-tight text-[#E8ECF1] w-fit">
          <span className="h-2 w-2 rounded-full bg-[#E8442A]" />
          Corvidet
        </Link>
      </nav>

      <div className="mx-auto max-w-[560px] px-6 py-24 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Get in touch</h1>
        <p className="mt-3 text-[#8B95A5]">
          Questions, feedback, or a bug to report — we read every email.
        </p>

        <div className="mt-10 grid gap-4 text-left">
          <a
            href="mailto:support@corvidet.com"
            className="flex items-start gap-4 rounded-xl border border-[#1E2530] bg-[#12161B] px-6 py-5 transition-colors hover:border-[#2A3444]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E8442A]/10 text-lg">
              ✉️
            </div>
            <div>
              <p className="font-semibold text-[#E8ECF1]">General support</p>
              <p className="mt-0.5 text-sm text-[#8B95A5]">support@corvidet.com</p>
              <p className="mt-1 text-xs text-[#5A6575]">Bugs, feature requests, onboarding questions</p>
            </div>
          </a>

          <a
            href="mailto:privacy@corvidet.com"
            className="flex items-start gap-4 rounded-xl border border-[#1E2530] bg-[#12161B] px-6 py-5 transition-colors hover:border-[#2A3444]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1E2530] text-lg">
              🔒
            </div>
            <div>
              <p className="font-semibold text-[#E8ECF1]">Privacy &amp; data</p>
              <p className="mt-0.5 text-sm text-[#8B95A5]">privacy@corvidet.com</p>
              <p className="mt-1 text-xs text-[#5A6575]">Data deletion, GDPR requests, account removal</p>
            </div>
          </a>
        </div>

        <p className="mt-10 text-sm text-[#5A6575]">
          We typically respond within 24 hours on business days.
        </p>
      </div>

      <footer className="border-t border-[#1E2530] px-6 py-8 text-center text-xs text-[#5A6575]">
        © 2026 Corvidet ·{" "}
        <Link href="/" className="transition-colors hover:text-[#8B95A5]">Home</Link>
        {" · "}
        <Link href="/privacy" className="transition-colors hover:text-[#8B95A5]">Privacy</Link>
      </footer>
    </main>
  );
}
