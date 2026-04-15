import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GrowthDashboardClient } from "@/components/growth/GrowthDashboardClient";
import {
  canViewAuditDashboard,
  getAuditAdminEmails,
  getIsoDateDaysAgo,
  type AuditRequestRow,
} from "@/lib/audit-requests";
import { getSupabaseAdminClient } from "@/lib/server-clients";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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

  const [recentRequestsResult, totalCountResult, lastSevenCountResult, lastThirtyCountResult] = await Promise.all([
    admin
      .from("audit_requests")
      .select(
        "id, requested_at, name, work_email, company, website, mrr_band, billing_model, biggest_leak, landing_variant, utm_source, utm_medium, utm_campaign, utm_term, utm_content, referrer, user_agent, status, admin_notes, last_contacted_at"
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

  return (
    <GrowthDashboardClient
      initialRequests={recentRequests}
      totalRequests={totalRequests}
      requestsLastSevenDays={requestsLastSevenDays}
      requestsLastThirtyDays={requestsLastThirtyDays}
    />
  );
}
