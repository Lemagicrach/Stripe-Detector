import { MetricCard } from "@/components/dashboard/MetricCard";

export default function MetricsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Revenue Metrics</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="MRR" value="$--" accentColor="blue" />
        <MetricCard title="ARR" value="$--" accentColor="blue" />
        <MetricCard title="Active Customers" value="--" accentColor="green" />
        <MetricCard title="Churn Rate" value="--%"  accentColor="red" />
      </div>
      <div className="rounded-xl border border-gray-800 bg-[#111827] p-6 h-80 flex items-center justify-center">
        <p className="text-gray-500">MRR trend chart will render here after Stripe connection</p>
      </div>
    </div>
  );
}
