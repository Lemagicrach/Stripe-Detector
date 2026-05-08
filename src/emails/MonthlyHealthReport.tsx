// src/emails/MonthlyHealthReport.tsx
//
// Marketing/digest — respects email_notifications_enabled opt-out. Sent
// monthly via the /api/cron/run-monthly-health flow. Mirrors the data
// structure produced by lib/monthly-reports.ts generateMonthlyRevenueHealthReport.

import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Text } from "@react-email/components";

type Props = {
  accountName: string | null;
  period: string;
  totalRevenue: number;
  failedPaymentsCount: number;
  failedPaymentsAmount: number;
  recoveredRevenue: number;
  activeSubscriptions: number;
  canceledSubscriptions: number;
  churnRate: number;          // 0..1
  revenueChangePercent: number;
  healthStatus: "healthy" | "moderate" | "risk";
  reportUrl: string;
  unsubscribeUrl: string;
};

const HEALTH_LABEL: Record<Props["healthStatus"], { label: string; color: string }> = {
  healthy: { label: "Healthy", color: "#10b981" },
  moderate: { label: "Moderate", color: "#f59e0b" },
  risk: { label: "At risk", color: "#ef4444" },
};

const fmtUsd = (n: number) => `$${n.toFixed(0)}`;
const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

export function MonthlyHealthReport(props: Props) {
  const status = HEALTH_LABEL[props.healthStatus];
  return (
    <Html>
      <Head />
      <Preview>{`${props.period} health report — ${fmtUsd(props.totalRevenue)} revenue, ${status.label}`}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>{`${props.period} health report`}</Heading>
          <Text style={subtitle}>
            {props.accountName ?? "Your Stripe account"} — <span style={{ color: status.color, fontWeight: 600 }}>{status.label}</span>
          </Text>

          <Hr style={hr} />

          <Heading as="h2" style={h2}>Revenue</Heading>
          <Text style={metricRow}>
            <span style={metricLabel}>Total revenue:</span> <strong>{fmtUsd(props.totalRevenue)}</strong>
            {" · "}
            <span style={changeColor(props.revenueChangePercent)}>
              {props.revenueChangePercent >= 0 ? "+" : ""}{props.revenueChangePercent.toFixed(1)}% vs previous month
            </span>
          </Text>
          <Text style={metricRow}>
            <span style={metricLabel}>Recovered revenue:</span> <strong>{fmtUsd(props.recoveredRevenue)}</strong>
          </Text>

          <Heading as="h2" style={h2}>Subscriptions</Heading>
          <Text style={metricRow}>
            <span style={metricLabel}>Active:</span> <strong>{props.activeSubscriptions}</strong>
            {" · "}
            <span style={metricLabel}>Canceled:</span> <strong>{props.canceledSubscriptions}</strong>
            {" · "}
            <span style={metricLabel}>Churn:</span> <strong>{fmtPct(props.churnRate)}</strong>
          </Text>

          <Heading as="h2" style={h2}>Failed payments</Heading>
          <Text style={metricRow}>
            <strong>{props.failedPaymentsCount}</strong> failed for <strong>{fmtUsd(props.failedPaymentsAmount)}</strong> in at-risk revenue
          </Text>

          <Container style={btnContainer}>
            <Button href={props.reportUrl} style={btn}>View full report</Button>
          </Container>

          <Hr style={hr} />
          <Text style={footer}>
            You&apos;re receiving this because you have monthly digests enabled.{" "}
            <Link href={props.unsubscribeUrl} style={unsubLink}>Unsubscribe</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default MonthlyHealthReport;

const body = { fontFamily: "Arial, sans-serif", backgroundColor: "#f8fafc", color: "#0f172a", padding: "24px" };
const container = { maxWidth: "640px", margin: "0 auto", backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "28px" };
const h1 = { margin: "0 0 8px", fontSize: "24px" };
const subtitle = { margin: "0 0 4px", color: "#64748b" };
const h2 = { margin: "20px 0 8px", fontSize: "15px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.04em", color: "#475569" };
const hr = { borderColor: "#e2e8f0", margin: "16px 0" };
const metricRow = { margin: "0 0 6px", lineHeight: "1.6" };
const metricLabel = { color: "#64748b" };
const btnContainer = { margin: "20px 0 0", textAlign: "center" as const };
const btn = { backgroundColor: "#2563eb", color: "#ffffff", padding: "10px 20px", borderRadius: "8px", textDecoration: "none", fontWeight: 600 };
const footer = { margin: "16px 0 0", color: "#94a3b8", fontSize: "12px", textAlign: "center" as const };
const unsubLink = { color: "#94a3b8", textDecoration: "underline" };

function changeColor(pct: number): React.CSSProperties {
  if (pct >= 5) return { color: "#10b981" };
  if (pct <= -5) return { color: "#ef4444" };
  return { color: "#64748b" };
}
