import Link from "next/link";

export const metadata = {
  title: "Privacy Policy - Corvidet",
  description: "How Corvidet collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#0B0E11] text-[#E8ECF1]">
      <nav className="border-b border-[#1E2530] px-6 py-4">
        <Link href="/" className="flex items-center gap-2 text-[17px] font-bold tracking-tight text-[#E8ECF1] w-fit">
          <span className="h-2 w-2 rounded-full bg-[#E8442A]" />
          Corvidet
        </Link>
      </nav>

      <div className="mx-auto max-w-[720px] px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-[#5A6575]">Last updated: March 2026</p>

        <div className="mt-10 space-y-10 text-[15px] leading-relaxed text-[#8B95A5]">

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#E8ECF1]">What we collect</h2>
            <p>When you connect your Stripe account, we retrieve subscription and payment data via Stripe's OAuth API with <strong className="text-[#E8ECF1]">read-only access</strong>. We collect your email address for authentication and to send you revenue reports you explicitly request. We do not collect payment card data or store your Stripe secret keys.</p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#E8ECF1]">How we use your data</h2>
            <ul className="ml-4 list-disc space-y-2">
              <li>To scan your Stripe account for revenue leaks and generate reports</li>
              <li>To calculate MRR, churn, and recovery metrics shown in your dashboard</li>
              <li>To power the AI copilot with context from your revenue data</li>
              <li>To send you revenue digest emails (you can opt out at any time)</li>
            </ul>
            <p className="mt-3">We do not sell your data. We do not share your data with third parties except as required to operate the service (Supabase for database, Vercel for hosting, Anthropic for AI processing).</p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#E8ECF1]">Data security</h2>
            <p>Stripe access tokens are encrypted at rest using AES-256-GCM before being stored in our database. All data is transmitted over HTTPS. We use Supabase Row Level Security to ensure your data is only accessible to you.</p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#E8ECF1]">Data retention</h2>
            <p>We retain your data for as long as your account is active. Free plan data is retained for 30 days of history. You can disconnect your Stripe account and delete all associated data at any time from your dashboard settings.</p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#E8ECF1]">Your rights</h2>
            <p>You can request a copy of your data, ask us to delete your account, or disconnect Stripe at any time. To exercise these rights, email us at <a href="mailto:privacy@corvidet.com" className="text-[#E8442A] hover:underline">privacy@corvidet.com</a>.</p>
          </section>

          <section id="delete-account">
            <h2 className="mb-3 text-lg font-semibold text-[#E8ECF1]">How to delete your account and all associated data</h2>
            <p>You can permanently delete your Corvidet account directly from the dashboard at any time. Under GDPR Article 17 (right to erasure), this is a self-service action — no support ticket required.</p>
            <ol className="mt-3 ml-4 list-decimal space-y-1.5">
              <li>Sign in to your account.</li>
              <li>Go to <Link href="/dashboard/settings" className="text-[#E8442A] hover:underline">dashboard settings</Link> and scroll to the <em>Danger zone</em> section.</li>
              <li>Click <strong className="text-[#E8ECF1]">Delete my account</strong>, type your email exactly to confirm, and submit.</li>
            </ol>
            <p className="mt-3">When you delete your account, we immediately:</p>
            <ul className="mt-2 ml-4 list-disc space-y-1.5">
              <li>Revoke our Stripe Connect authorization (you can verify this in your Stripe dashboard under <em>Connected apps</em>).</li>
              <li>Cancel any active Corvidet billing subscription.</li>
              <li>Delete your Supabase auth record, which cascades through every table containing your data: revenue metrics, leak detections, recovery events, monthly reports, usage events, and connection records.</li>
              <li>Send you a confirmation email at the address on file.</li>
            </ul>
            <p className="mt-3">We retain a single tamper-evident audit row containing a SHA-256 hash of your email (never the plaintext) and the deletion timestamp. This is required to demonstrate compliance during legal audits and contains no personally identifiable information.</p>
            <p className="mt-3">If something goes wrong, contact <a href="mailto:privacy@corvidet.com" className="text-[#E8442A] hover:underline">privacy@corvidet.com</a> and we will manually verify and complete the deletion within 30 days.</p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#E8ECF1]">Cookies</h2>
            <p>We use session cookies managed by Supabase Auth for authentication only. We do not use advertising or tracking cookies.</p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#E8ECF1]">Changes</h2>
            <p>We may update this policy from time to time. If we make material changes, we will notify you by email.</p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#E8ECF1]">Contact</h2>
            <p>Questions about this policy? Email <a href="mailto:privacy@corvidet.com" className="text-[#E8442A] hover:underline">privacy@corvidet.com</a>.</p>
          </section>
        </div>
      </div>

      <footer className="border-t border-[#1E2530] px-6 py-8 text-center text-xs text-[#5A6575]">
        © 2026 Corvidet ·{" "}
        <Link href="/" className="transition-colors hover:text-[#8B95A5]">Home</Link>
        {" · "}
        <Link href="/contact" className="transition-colors hover:text-[#8B95A5]">Contact</Link>
      </footer>
    </main>
  );
}
