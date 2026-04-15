export type MonthlyHealthStatus = "healthy" | "moderate" | "risk";

export interface ActiveStripeConnection {
  id: string;
  stripeAccountId: string;
  accountName: string | null;
}

export interface GenerateMonthlyRevenueHealthInput {
  userId: string;
  connectionId?: string;
  startDate: string;
  endDate: string;
}

export interface MonthlyRevenueHealthReport {
  reportId: string;
  connectionId: string;
  userId: string;
  stripeAccountId: string;
  accountName: string | null;
  periodStart: string;
  periodEnd: string;
  period: string;
  currency: string;
  totalRevenue: number;
  failedPaymentsCount: number;
  failedPaymentsAmount: number;
  recoveredRevenue: number;
  activeSubscriptions: number;
  canceledSubscriptions: number;
  churnRate: number;
  revenueChangePercent: number;
  healthStatus: MonthlyHealthStatus;
  reportPayload: Record<string, unknown>;
  createdAt: string | null;
}
