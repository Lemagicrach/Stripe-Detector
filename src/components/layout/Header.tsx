"use client";

import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, User } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { createBrowserClient } from "@supabase/ssr";

const PAGE_LABELS: Record<string, string> = {
  "/dashboard": "Revenue Pulse",
  "/dashboard/leaks": "Leak Scanner",
  "/dashboard/metrics": "Metrics",
  "/dashboard/churn": "Churn",
  "/dashboard/recovery": "Recovery",
  "/dashboard/copilot": "AI Copilot",
  "/dashboard/alerts": "Alerts",
  "/dashboard/benchmarks": "Benchmarks",
  "/dashboard/scenarios": "Scenarios",
  "/dashboard/billing": "Billing",
  "/dashboard/connect": "Connect Stripe",
  "/dashboard/settings": "Settings",
};

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const pageLabel = PAGE_LABELS[pathname] ?? "Dashboard";

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  ), []);

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
    } catch {
      // signOut failure is non-critical â€” clear local session and redirect anyway
    }
    router.push("/login");
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-800 bg-[#111827] px-6">
      <h2 className="text-sm font-semibold text-white">{pageLabel}</h2>

      <div className="flex items-center gap-2">
        <a
          href="/dashboard/alerts"
          className="relative rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          aria-label="Alerts"
        >
          <Bell className="h-5 w-5" />
        </a>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
            aria-label="User menu"
          >
            <User className="h-4 w-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-11 z-50 min-w-[160px] rounded-xl border border-gray-700 bg-gray-900 py-1 shadow-2xl">
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
