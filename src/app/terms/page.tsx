import Link from "next/link";
import { MarketingFooter } from "@/components/marketing/footer";

export const metadata = {
  title: "Terms of Service - Corvidet",
  description: "The agreement governing your use of Corvidet.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#0B0E11] text-[#E8ECF1]">
      <nav className="border-b border-[#1E2530] px-6 py-4">
        <Link href="/" className="flex items-center gap-2 text-[17px] font-bold tracking-tight text-[#E8ECF1] w-fit">
          <span className="h-2 w-2 rounded-full bg-[#E8442A]" />
          Corvidet
        </Link>
      </nav>

      <div className="mx-auto max-w-[720px] px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
        <p className="mt-2 text-sm text-[#5A6575]">Last updated: May 2026</p>

        <div className="mt-10 space-y-10 text-[15px] leading-relaxed text-[#8B95A5]">

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#E8ECF1]">1. Agreement</h2>
            <p>These Terms of Service (&ldquo;Terms&rdquo;) form a binding agreement between you (&ldquo;you&rdquo;, &ldquo;Customer&rdquo;) and Corvidet (&ldquo;we&rdquo;, &ldquo;us&rdquo;) governing your access to and use of the Corvidet service, including the corvidet.com website, dashboard, APIs, and any related software (collectively, the &ldquo;Service&rdquo;). By creating an account or using the Service, you agree to these Terms and to our <Link href="/privacy" className="text-[#E8442A] hover:underline">Privacy Policy</Link>. If you do not agree, you must not use the Service.</p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#E8ECF1]">2. The Service</h2>
            <p>Corvidet provides revenue-leak detection, MRR tracking, and recovery analytics for SaaS businesses that use Stripe as their payment processor. The Service connects to your Stripe account via OAuth to read subscription, invoice, and customer data, and surfaces leaks (failed payments, expiring cards, pending cancellations, zombie subscriptions) along with recovery suggestions and an AI-powered copilot. We may add, modify, or remove features at any time.</p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#E8ECF1]">3. Account &amp; eligibility</h2>
            <p>You must be at least 18 years old and authorized to bind the entity (if any) on whose behalf you use the Service. You are responsible for keeping your login credentials confidential and for all activity under your account. If you suspect unauthorized access, contact <a href="mailto:support@corvidet.com" className="text-[#E8442A] hover:underline">support@corvidet.com</a> immediately.</p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#E8ECF1]">4. Plans, billing, and refunds</h2>
            <p>Paid plans (Growth, Business) are billed monthly in advance via Stripe. Subscription fees are non-refundable except where required by law. Trial periods, where offered, automatically convert to a paid subscription unless canceled before the trial ends. We may change pricing with 30 days&rsquo; notice; if you do not accept the change, you may cancel before the new price takes effect.</p>
            <p className="mt-3">Taxes (VAT, sales tax) are your responsibility unless explicitly itemized on your invoice. You may cancel at any time from your dashboard; cancellation takes effect at the end of the current billing period.</p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#E8ECF1]">5. Acceptable use</h2>
            <p>You agree not to:</p>
            <ul className="mt-3 ml-4 list-disc space-y-2">
              <li>Use the Service to process Stripe data you do not own or are not explicitly authorized to access.</li>
              <li>Reverse-engineer, decompile, or attempt to extract source code from the Service, except as expressly permitted by law.</li>
              <li>Resell, sublicense, or rebrand the Service without a written agreement with us.</li>
              <li>Submit malicious code, attempt to disrupt the Service, or circumvent rate limits, quotas, or security controls.</li>
              <li>Use the Service to violate any applicable law, regulation, or third-party right (including Stripe&rsquo;s terms).</li>
            </ul>
            <p className="mt-3">We may suspend or terminate accounts that violate this section without prior notice.</p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#E8ECF1]">6. Intellectual property</h2>
            <p>We retain all rights to the Service, including its software, design, branding, and documentation. You retain all rights to the data you connect to the Service (your Stripe data, your customer information). You grant us a limited license to process your data solely as needed to operate, secure, and improve the Service in accordance with our <Link href="/privacy" className="text-[#E8442A] hover:underline">Privacy Policy</Link>.</p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#E8ECF1]">7. Your data and Stripe</h2>
            <p>The Service uses Stripe Connect OAuth with read-only intent to access subscription and payment metadata. Your Stripe access tokens are encrypted at rest using AES-256-GCM. We never store your Stripe API secret keys or your customers&rsquo; raw card data. You can revoke our access at any time from your Stripe dashboard or by deleting your Corvidet account.</p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#E8ECF1]">8. Service availability</h2>
            <p>We strive to keep the Service available 24/7 but do not guarantee any specific uptime. We may perform maintenance, updates, or downgrade availability for security reasons without prior notice. The Service depends on third parties (Supabase, Vercel, Stripe, Anthropic) whose outages may temporarily affect us.</p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#E8ECF1]">9. Termination</h2>
            <p>You may terminate your account at any time from <Link href="/dashboard/settings" className="text-[#E8442A] hover:underline">dashboard settings</Link>. We may terminate or suspend your account for material breach of these Terms, non-payment, or if we are required by law. Upon termination, your data is deleted in accordance with our <Link href="/privacy#delete-account" className="text-[#E8442A] hover:underline">deletion procedure</Link>; we retain only the audit trail required for compliance demonstration.</p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#E8ECF1]">10. Disclaimer of warranties</h2>
            <p>THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. We do not warrant that leak detection, recovery suggestions, or AI-generated insights are accurate or complete. You are solely responsible for the financial decisions you make based on the Service&rsquo;s output.</p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#E8ECF1]">11. Limitation of liability</h2>
            <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, CORVIDET&rsquo;S AGGREGATE LIABILITY ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICE IS LIMITED TO THE GREATER OF (A) THE FEES YOU PAID US IN THE TWELVE MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM, OR (B) ONE HUNDRED US DOLLARS (USD 100). WE ARE NOT LIABLE FOR INDIRECT, CONSEQUENTIAL, INCIDENTAL, OR PUNITIVE DAMAGES, INCLUDING LOST REVENUE, LOST CUSTOMERS, OR DATA LOSS, EVEN IF ADVISED OF THE POSSIBILITY.</p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#E8ECF1]">12. Indemnification</h2>
            <p>You agree to defend, indemnify, and hold us harmless from any third-party claim arising out of (a) your use of the Service in violation of these Terms, (b) your data or Stripe account, or (c) your violation of any law or third-party right.</p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#E8ECF1]">13. Changes to these Terms</h2>
            <p>We may update these Terms from time to time. Material changes will be communicated by email at least 14 days before they take effect. Continued use of the Service after the effective date constitutes acceptance of the new Terms.</p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#E8ECF1]">14. Governing law and disputes</h2>
            <p>These Terms are governed by the laws of France, without regard to conflict-of-law rules. Any dispute arising out of or related to these Terms or the Service will be resolved by the competent courts of Paris, France, except that either party may seek injunctive relief in any court of competent jurisdiction. If any provision is held unenforceable, the remaining provisions remain in full force.</p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#E8ECF1]">15. Contact</h2>
            <p>Questions about these Terms? Email <a href="mailto:support@corvidet.com" className="text-[#E8442A] hover:underline">support@corvidet.com</a> or visit our <Link href="/contact" className="text-[#E8442A] hover:underline">contact page</Link>.</p>
          </section>
        </div>
      </div>

      <MarketingFooter />
    </main>
  );
}
