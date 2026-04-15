"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Zap,
  TrendingUp,
  UserMinus,
  RefreshCcw,
  Bot,
  Bell,
  BarChart2,
  FileText,
  FlaskConical,
  CreditCard,
  Link2,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  comingSoon?: boolean;
};

const mainNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/leaks", label: "Leak Scanner", icon: Zap },
  { href: "/dashboard/metrics", label: "Metrics", icon: TrendingUp },
  { href: "/dashboard/reports", label: "Reports", icon: FileText },
  { href: "/dashboard/churn", label: "Churn", icon: UserMinus },
  { href: "/dashboard/recovery", label: "Recovery", icon: RefreshCcw },
  { href: "/dashboard/copilot", label: "AI Copilot", icon: Bot },
];

const insightsNav: NavItem[] = [
  { href: "/dashboard/alerts", label: "Alerts", icon: Bell, comingSoon: true },
  { href: "/dashboard/benchmarks", label: "Benchmarks", icon: BarChart2, comingSoon: true },
  { href: "/dashboard/scenarios", label: "Scenarios", icon: FlaskConical, comingSoon: true },
];

const accountNav: NavItem[] = [
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/connect", label: "Connect", icon: Link2 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, comingSoon: true },
];

function NavLink({ href, label, icon: Icon, comingSoon, isActive }: NavItem & { isActive: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors relative",
        isActive
          ? "bg-blue-500/10 text-blue-400 border-l-2 border-blue-500 pl-[10px]"
          : "text-gray-400 hover:bg-gray-800 hover:text-gray-200 border-l-2 border-transparent pl-[10px]"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {comingSoon && (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-gray-700 text-gray-400 border-0">
          Soon
        </Badge>
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  async function handleSignOut() {
    if (supabase) {
      await supabase.auth.signOut();
    }
    router.push("/login");
  }

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <aside className="hidden w-64 flex-col border-r border-gray-800 bg-[#0F172A] lg:flex">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-gray-800 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-sm shadow-lg shadow-blue-500/20">
          R
        </div>
        <span className="text-lg font-bold text-white tracking-tight">Corvidet</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {/* Main */}
        <div className="space-y-0.5">
          {mainNav.map((item) => (
            <NavLink key={item.href} {...item} isActive={isActive(item.href)} />
          ))}
        </div>

        <div className="py-2">
          <Separator />
        </div>

        {/* Insights */}
        <div>
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
            Insights
          </p>
          <div className="space-y-0.5">
            {insightsNav.map((item) => (
              <NavLink key={item.href} {...item} isActive={isActive(item.href)} />
            ))}
          </div>
        </div>

        <div className="py-2">
          <Separator />
        </div>

        {/* Account */}
        <div>
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
            Account
          </p>
          <div className="space-y-0.5">
            {accountNav.map((item) => (
              <NavLink key={item.href} {...item} isActive={isActive(item.href)} />
            ))}
          </div>
        </div>
      </nav>

      {/* Sign out */}
      <div className="border-t border-gray-800 p-3">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-800 hover:text-gray-300 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
