import { MetricCard } from "@/components/dashboard/MetricCard";

export default function LeaksPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Revenue Leak Scanner</h1>
          <p className="text-sm text-gray-400 mt-1">Find and fix the revenue your Stripe account is losing</p>
        </div>
        <button className="rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-600 transition-colors">
          Run Leak Scan
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard title="Leak Risk Score" value="--" accentColor="amber" />
        <MetricCard title="Estimated Lost Revenue" value="$--/mo" accentColor="red" />
        <MetricCard title="Recoverable Revenue" value="$--/mo" accentColor="green" />
      </div>

      <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/50 p-12 text-center">
        <p className="text-gray-400">Connect your Stripe account and run your first scan to see results.</p>
      </div>
    </div>
  );
}
