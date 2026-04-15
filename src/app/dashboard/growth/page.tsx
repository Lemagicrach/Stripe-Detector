import Link from "next/link";
import { BarChart3, CalendarDays, ExternalLink, Mail, Target, TrendingUp, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AUDIT_MRR_BAND_LABELS,
  AUDIT_STATUS_LABELS,
  canViewAuditDashboard,
  getAuditAdminEmails,
  getIsoDateDaysAgo,
  type AuditRequestRow,
  type AuditRequestStatus,
} from "@/lib/audit-requests";
import { getSupabaseAdminClient } from "@/lib/server-clients";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type BreakdownItem = {
  label: string;
  count: number;
  share: number;
};

const STATUS_VARIANTS: Record<
  AuditRequestStatus,
  "default" | "secondary" | "destructive" | "warning" | "info" | "success" | "outline"
> = {
  requested: "outline",
  qualified: "info",
  contacted: "secondary",
  booked: "warning",
  connected: "success",
  won: "success",
  lost: "destructive",
};

function buildBreakdown(rows: AuditRequestRow[], selectValue: (row: AuditRequestRow) => string, limit = 5) {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const label = selectValue(row).trim() || "Direct / unknown";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const total = rows.length || 1;
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({
      label,
      count,
      share: (count / total) * 100,
    }));
}

function extractReferrerHost(referrer: string | null) {
  if (!referrer) return "";

  try {
    return new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return referrer;
  }
}

function formatRequestedAt(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function SourceList({ items }: { items: BreakdownItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-500">No attribution data yet.</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-medium text-gray-200">{item.label}</p>
            <span className="text-xs text-gray-400">
              {item.count} ({item.share.toFixed(0)}%)
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-800">
            <div
              className="h-2 rounded-full bg-blue-500"
              style={{ width: `${Math.max(item.share, 6)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function DashboardGrowthPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const adminEmails = getAuditAdminEmails();
  const isConfigured = adminEmails.length > 0;
  const isAllowed = canViewAuditDashboard(user?.email);

  if (!isConfigured) {
    return (
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardHeader>
          <CardTitle>Growth dashboard is not configured yet</CardTitle>
          <CardDescription>
            Add <code className="rounded bg-black/30 px-1 py-0.5">AUDIT_ADMIN_EMAILS</code> to enable lead attribution
            visibility for founder accounts.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!isAllowed) {
    return (
      <Card className="border-gray-700 bg-gray-900/70">
        <CardHeader>
          <CardTitle>Owner access only</CardTitle>
          <CardDescription>
            This page is reserved for the email addresses listed in <code className="rounded bg-black/30 px-1 py-0.5">AUDIT_ADMIN_EMAILS</code>.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const admin = getSupabaseAdminClient();
  const recentLimit = 250;
  const sevenDaysAgo = getIsoDateDaysAgo(7);
  const thirtyDaysAgo = getIsoDateDaysAgo(30);

  const [
    recentRequestsResult,
    totalCountResult,
    lastSevenCountResult,
    lastThirtyCountResult,
  ] = await Promise.all([
    admin
      .from("audit_requests")
      .select(
        "id, requested_at, name, work_email, company, website, mrr_band, billing_model, biggest_leak, landing_variant, utm_source, utm_medium, utm_campaign, utm_term, utm_content, referrer, user_agent, status"
      )
      .order("requested_at", { ascending: false })
      .limit(recentLimit),
    admin.from("audit_requests").select("*", { count: "exact", head: true }),
    admin
      .from("audit_requests")
      .select("*", { count: "exact", head: true })
      .gte("requested_at", sevenDaysAgo),
    admin
      .from("audit_requests")
      .select("*", { count: "exact", head: true })
      .gte("requested_at", thirtyDaysAgo),
  ]);

  if (recentRequestsResult.error) {
    throw recentRequestsResult.error;
  }
  if (totalCountResult.error) {
    throw totalCountResult.error;
  }
  if (lastSevenCountResult.error) {
    throw lastSevenCountResult.error;
  }
  if (lastThirtyCountResult.error) {
    throw lastThirtyCountResult.error;
  }

  const recentRequests = (recentRequestsResult.data ?? []) as AuditRequestRow[];
  const totalRequests = totalCountResult.count ?? recentRequests.length;
  const requestsLastSevenDays = lastSevenCountResult.count ?? 0;
  const requestsLastThirtyDays = lastThirtyCountResult.count ?? 0;
  const activePipeline = recentRequests.filter((request) =>
    ["requested", "qualified", "contacted", "booked", "connected"].includes(request.status)
  ).length;

  const sourceBreakdown = buildBreakdown(
    recentRequests,
    (request) => request.utm_source || extractReferrerHost(request.referrer) || "Direct / unknown"
  );
  const campaignBreakdown = buildBreakdown(
    recentRequests,
    (request) => request.utm_campaign || request.utm_medium || "No campaign set"
  );
  const variantBreakdown = buildBreakdown(
    recentRequests,
    (request) => request.landing_variant || "stripe-b2b-saas-audit"
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Growth Attribution</h1>
          <p className="mt-1 text-sm text-gray-400">
            Track which audit campaigns, referrers, and landing variants are producing qualified pipeline.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/audit"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
          >
            <ExternalLink className="h-4 w-4" />
            Open audit funnel
          </Link>
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
          >
            <Target className="h-4 w-4" />
            View demo
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total requests</CardDescription>
            <CardTitle className="text-3xl">{totalRequests}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-gray-500">All captured audit requests in Supabase.</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Last 30 days</CardDescription>
            <CardTitle className="text-3xl">{requestsLastThirtyDays}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-gray-500">Recent demand generation momentum.</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Last 7 days</CardDescription>
            <CardTitle className="text-3xl">{requestsLastSevenDays}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-gray-500">What your current week is producing.</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active pipeline</CardDescription>
            <CardTitle className="text-3xl">{activePipeline}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-gray-500">Recent requests not yet marked won or lost.</CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-blue-400" />
              Top sources
            </CardTitle>
            <CardDescription>UTM source first, referrer host as fallback.</CardDescription>
          </CardHeader>
          <CardContent>
            <SourceList items={sourceBreakdown} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              Top campaigns
            </CardTitle>
            <CardDescription>Campaign or medium driving audit requests.</CardDescription>
          </CardHeader>
          <CardContent>
            <SourceList items={campaignBreakdown} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-amber-400" />
              Landing variants
            </CardTitle>
            <CardDescription>Which funnel entry points are getting traction.</CardDescription>
          </CardHeader>
          <CardContent>
            <SourceList items={variantBreakdown} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Recent audit requests</CardTitle>
            <CardDescription>
              Showing the most recent {recentRequests.length} request{recentRequests.length === 1 ? "" : "s"}
              {totalRequests > recentRequests.length ? ` out of ${totalRequests}` : ""}.
            </CardDescription>
          </div>
          <Badge variant="outline">{recentRequests.length ? "Live pipeline" : "No requests yet"}</Badge>
        </CardHeader>
        <CardContent>
          {recentRequests.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-700 bg-gray-950/50 p-10 text-center text-sm text-gray-400">
              Submit your first request from the public audit page to start tracking channel performance.
            </div>
          ) : (
            <div className="space-y-3">
              {recentRequests.map((request) => (
                <div
                  key={request.id}
                  className="grid gap-4 rounded-xl border border-gray-800 bg-gray-950/60 p-4 lg:grid-cols-[1.2fr_1fr_1fr_auto]"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-white">{request.company}</p>
                      <Badge variant={STATUS_VARIANTS[request.status]}>{AUDIT_STATUS_LABELS[request.status]}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-gray-400">
                      {request.name} · {AUDIT_MRR_BAND_LABELS[request.mrr_band]}
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm text-gray-500">{request.biggest_leak}</p>
                  </div>

                  <div className="space-y-1 text-sm">
                    <p className="text-gray-500">Attribution</p>
                    <p className="text-gray-200">
                      {request.utm_source || extractReferrerHost(request.referrer) || "Direct / unknown"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {request.utm_campaign || request.utm_medium || request.landing_variant}
                    </p>
                  </div>

                  <div className="space-y-1 text-sm">
                    <p className="flex items-center gap-2 text-gray-500">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatRequestedAt(request.requested_at)}
                    </p>
                    <p className="text-gray-500">{request.website || "No website provided"}</p>
                  </div>

                  <div className="flex items-start justify-end">
                    <a
                      href={`mailto:${request.work_email}?subject=Corvidet audit follow-up for ${encodeURIComponent(request.company)}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
                    >
                      <Mail className="h-4 w-4" />
                      Email
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
