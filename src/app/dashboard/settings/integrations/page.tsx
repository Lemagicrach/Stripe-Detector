import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/server-clients";
import { PLAN_LIMITS, type PlanTier } from "@/lib/stripe";
import { SlackConnectButton } from "./slack-connect-button";

type SlackIntegration = {
  id: string;
  team_name: string | null;
  channel_name: string | null;
  status: "active" | "revoked";
  created_at: string;
};

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; reason?: string; team?: string }>;
}) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;

  const admin = getSupabaseAdminClient();
  const { data: profileRow } = await admin
    .from("user_profiles").select("plan").eq("id", user.id).single();
  const plan = ((profileRow as { plan?: string } | null)?.plan ?? "free") as PlanTier;
  const isBusinessPlan = PLAN_LIMITS[plan].slackAlerts;

  const { data: slackRow } = await admin
    .from("slack_integrations")
    .select("id, team_name, channel_name, status, created_at")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const slack = (slackRow as SlackIntegration | null) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/settings" className="text-sm text-gray-400 hover:text-gray-200">
          ← Back to settings
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">Integrations</h1>
        <p className="mt-1 text-sm text-gray-400">
          Connect Corvidet to your team&apos;s tools.
        </p>
      </div>

      {params.status === "success" && (
        <div className="rounded-md border border-emerald-700 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">
          Slack connected{params.team ? ` to ${params.team}` : ""}. You&apos;ll receive alerts the next time a critical leak is detected.
        </div>
      )}
      {params.status === "error" && (
        <div className="rounded-md border border-red-700 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          Slack connection failed{params.reason ? ` (${params.reason})` : ""}. Try again or contact support.
        </div>
      )}

      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-lg font-semibold text-white">Slack</h2>
            <p className="mt-2 text-sm text-gray-400">
              Real-time alerts in your team&apos;s Slack workspace when a critical leak is detected, when a monthly health report is generated, or 3 days before a trial ends.
            </p>
            {slack ? (
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs text-gray-500">Workspace</dt>
                  <dd className="mt-0.5 text-gray-100">{slack.team_name ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Channel</dt>
                  <dd className="mt-0.5 font-mono text-xs text-gray-300">
                    {slack.channel_name ? `#${slack.channel_name.replace(/^#/, "")}` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Connected</dt>
                  <dd className="mt-0.5 text-gray-300">
                    {new Date(slack.created_at).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            ) : null}
          </div>
          <div className="shrink-0">
            <SlackConnectButton isBusinessPlan={isBusinessPlan} isConnected={!!slack} />
          </div>
        </div>
      </div>
    </div>
  );
}
