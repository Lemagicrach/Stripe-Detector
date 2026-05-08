import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type AuditRow = {
  id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  ip: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const ACTION_LABEL: Record<string, string> = {
  "stripe.connect.connected": "Connected Stripe account",
  "stripe.connect.disconnected": "Disconnected Stripe account",
  "subscription.upgraded": "Subscription upgraded",
  "subscription.downgraded": "Subscription downgraded",
  "account.deleted": "Account deleted",
  "leak.dismissed": "Dismissed revenue leak",
  "ai.query": "Used AI feature",
};

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function shortenUserAgent(ua: string | null): string {
  if (!ua) return "—";
  const browserMatch = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/);
  const osMatch = ua.match(/(Windows NT [\d.]+|Mac OS X [\d_.]+|Linux|iPhone|Android)/);
  const parts = [browserMatch?.[1], osMatch?.[1]?.replace(/_/g, ".")].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : ua.slice(0, 40);
}

export default async function ActivityPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, action, resource_type, resource_id, ip, user_agent, metadata, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const entries = (data ?? []) as AuditRow[];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/settings" className="text-sm text-gray-400 hover:text-gray-200">
          ← Back to settings
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">Activity log</h1>
        <p className="mt-1 text-sm text-gray-400">
          Tamper-evident record of meaningful actions on your account. Showing the 100 most recent.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-red-700 bg-red-950/40 p-4 text-sm text-red-300">
          Failed to load activity: {error.message}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/40 p-12 text-center text-sm text-gray-500">
          No activity yet. Connect Stripe, run a leak scan, or use the AI copilot to see your audit trail here.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800 bg-gray-950/40 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
              <tr>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">From</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-800/40">
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium text-gray-100">
                      {ACTION_LABEL[entry.action] ?? entry.action}
                    </div>
                    {entry.resource_type && (
                      <div className="mt-0.5 font-mono text-xs text-gray-500">
                        {entry.resource_type}
                        {entry.resource_id ? ` · ${entry.resource_id.slice(0, 12)}…` : ""}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-top text-gray-300">
                    {formatTimestamp(entry.created_at)}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="font-mono text-xs text-gray-300">{entry.ip ?? "—"}</div>
                    <div className="mt-0.5 text-xs text-gray-500">{shortenUserAgent(entry.user_agent)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
