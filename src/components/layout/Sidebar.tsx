"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search, BarChart3, AlertTriangle, TrendingUp,
  Settings, CreditCard, Plug, Bell, GitCompare, Zap,
} from "lucide-react";
import { clsx } from "clsx";

const navItems = [
  { href: "/dashboard/leaks", label: "Leak Scanner", icon: Search },
  { href: "/dashboard/metrics", label: "Metrics", icon: BarChart3 },
  { href: "/dashboard/churn", label: "Churn", icon: AlertTriangle },
  { href: "/dashboard/recovery", label: "Recovery", icon: TrendingUp },
  { href: "/dashboard/scenarios", label: "Scenarios", icon: GitCompare },
  { href: "/dashboard/alerts", label: "Alerts", icon: Bell },
  { href: "/dashboard/benchmarks", label: "Benchmarks", icon: Zap },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/connect", label: "Connect", icon: Plug },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 flex-col border-r border-gray-800 bg-[#111827] lg:flex">
      <div className="flex h-16 items-center gap-2 border-b border-gray-800 px-6">
        <div className="h-8 w-8 rounded-lg bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
          R
        </div>
        <span className="text-lg font-semibold text-white tracking-tight">RevPilot</span>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              pathname.startsWith(href)
                ? "bg-blue-500/10 text-blue-400"
                : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
