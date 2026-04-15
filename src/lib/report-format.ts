import type { MonthlyHealthStatus } from "@/types/reports";

type HealthBadgeVariant = "success" | "warning" | "destructive";

const NUMBER_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function getHealthBadgeVariant(status: MonthlyHealthStatus): HealthBadgeVariant {
  if (status === "healthy") return "success";
  if (status === "risk") return "destructive";
  return "warning";
}

export function formatReportCurrency(amount: number, currency: string): string {
  const normalizedCurrency = (currency || "usd").toLowerCase();
  if (normalizedCurrency === "mixed") {
    return `${NUMBER_FORMATTER.format(amount)} MIXED`;
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: normalizedCurrency.toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${NUMBER_FORMATTER.format(amount)} ${normalizedCurrency.toUpperCase()}`;
  }
}

export function formatReportPercent(ratio: number, digits = 2): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function formatDeltaPercent(percent: number, digits = 1): string {
  return `${percent > 0 ? "+" : ""}${percent.toFixed(digits)}%`;
}

export function sanitizeCsvCell(value: string | number | boolean | null | undefined): string {
  const stringValue = String(value ?? "");
  const neutralized = /^[=+\-@]/.test(stringValue) ? `'${stringValue}` : stringValue;

  if (!/[",\n]/.test(neutralized)) {
    return neutralized;
  }

  return `"${neutralized.replace(/"/g, '""')}"`;
}
