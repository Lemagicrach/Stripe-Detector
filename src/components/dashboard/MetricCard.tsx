import { clsx } from "clsx";
import { TrendingUp, TrendingDown } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  change?: number; // percentage
  trend?: "up" | "down" | "flat";
  accentColor?: "blue" | "green" | "amber" | "red" | "purple";
}

const accents = {
  blue: "border-blue-500/30 bg-blue-500/5",
  green: "border-emerald-500/30 bg-emerald-500/5",
  amber: "border-amber-500/30 bg-amber-500/5",
  red: "border-red-500/30 bg-red-500/5",
  purple: "border-purple-500/30 bg-purple-500/5",
};

export function MetricCard({ title, value, change, trend, accentColor = "blue" }: MetricCardProps) {
  return (
    <div className={clsx("rounded-xl border p-5 transition-colors", accents[accentColor])}>
      <p className="text-sm font-medium text-gray-400">{title}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-white font-mono">{value}</p>
      {change !== undefined && (
        <div className="mt-2 flex items-center gap-1 text-sm">
          {trend === "up" ? (
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          ) : trend === "down" ? (
            <TrendingDown className="h-4 w-4 text-red-400" />
          ) : null}
          <span className={clsx(trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-gray-500")}>
            {change > 0 ? "+" : ""}{change.toFixed(1)}%
          </span>
          <span className="text-gray-500">vs last month</span>
        </div>
      )}
    </div>
  );
}
