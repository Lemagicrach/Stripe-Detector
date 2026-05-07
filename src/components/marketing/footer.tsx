// src/components/marketing/footer.tsx
//
// Shared marketing footer used across landing, terms, privacy, contact, and
// audit pages. Centralizes the legal links so adding a new policy page (e.g.
// DPA) only touches this file.

import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="border-t border-[#1E2530] px-6 py-8 text-center text-xs text-[#5A6575]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 md:flex-row">
        <p>Copyright 2026 Corvidet</p>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link href="/audit" className="transition-colors hover:text-[#8B95A5]">
            Request audit
          </Link>
          <Link href="/terms" className="transition-colors hover:text-[#8B95A5]">
            Terms
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
  );
}
