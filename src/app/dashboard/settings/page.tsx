import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { DangerZone } from "./danger-zone";

export default async function Page() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const userEmail = user.email ?? "";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Settings</h1>

      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h2 className="text-lg font-semibold text-white">Account</h2>
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-gray-400">Email</dt>
            <dd className="mt-1 font-mono text-sm text-gray-100">{userEmail || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-400">User ID</dt>
            <dd className="mt-1 font-mono text-xs text-gray-300">{user.id}</dd>
          </div>
        </dl>
        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2">
          <Link
            href="/dashboard/settings/activity"
            className="inline-flex items-center text-sm text-blue-400 hover:text-blue-300"
          >
            View activity log →
          </Link>
          <Link
            href="/dashboard/settings/integrations"
            className="inline-flex items-center text-sm text-blue-400 hover:text-blue-300"
          >
            Manage integrations →
          </Link>
        </div>
      </div>

      {userEmail && <DangerZone userEmail={userEmail} />}
    </div>
  );
}
