import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { TrialBanner } from "@/components/dashboard/TrialBanner";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/server-clients";

export const dynamic = "force-dynamic";

async function getTrialState(): Promise<string | null> {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const admin = getSupabaseAdminClient();
    const { data: profile } = await admin
      .from("user_profiles")
      .select("plan, trial_ends_at")
      .eq("id", user.id)
      .single();

    const profileRow = profile as { plan?: string; trial_ends_at?: string | null } | null;
    if (!profileRow) return null;
    if (profileRow.plan !== "growth") return null;
    if (!profileRow.trial_ends_at) return null;
    if (new Date(profileRow.trial_ends_at).getTime() <= Date.now()) return null;
    return profileRow.trial_ends_at;
  } catch {
    return null;
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const trialEndsAt = await getTrialState();

  return (
    <div className="flex h-screen bg-[#0B1120] text-gray-100">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        {trialEndsAt && <TrialBanner trialEndsAt={trialEndsAt} />}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
