// src/emails/HighSeverityLeakAlert.tsx
//
// Marketing/alert — respects email_notifications_enabled opt-out. Fired
// from /api/cron/detect-revenue-leaks when one or more critical-severity
// leaks are detected on the user's account. Same trigger as the Slack
// alert (Task 2.6) but for users without Slack connected.

import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Text } from "@react-email/components";

type Props = {
  count: number;
  totalLostUsd: number;
  totalRecoverableUsd: number;
  topTitle: string;
  dashboardUrl: string;
  unsubscribeUrl: string;
};

const fmtUsd = (n: number) => `$${n.toFixed(0)}`;

export function HighSeverityLeakAlert(props: Props) {
  return (
    <Html>
      <Head />
      <Preview>{`${props.count} critical revenue leak${props.count > 1 ? "s" : ""} detected — ${fmtUsd(props.totalLostUsd)} at risk`}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>🚨 Critical revenue leaks detected</Heading>
          <Text style={p}>
            We found <strong>{props.count}</strong> critical leak{props.count > 1 ? "s" : ""} in your Stripe account during the last scan.
          </Text>

          <table style={table}>
            <tbody>
              <tr>
                <td style={cellLabel}>At risk</td>
                <td style={cellValue}><strong>{fmtUsd(props.totalLostUsd)}</strong></td>
              </tr>
              <tr>
                <td style={cellLabel}>Recoverable</td>
                <td style={cellValue}><strong>{fmtUsd(props.totalRecoverableUsd)}</strong></td>
              </tr>
              <tr>
                <td style={cellLabel}>Top issue</td>
                <td style={cellValue}>{props.topTitle}</td>
              </tr>
            </tbody>
          </table>

          <Container style={btnContainer}>
            <Button href={props.dashboardUrl} style={btn}>Open dashboard</Button>
          </Container>

          <Hr style={hr} />
          <Text style={footer}>
            Sent because critical leak alerts are enabled.{" "}
            <Link href={props.unsubscribeUrl} style={unsubLink}>Unsubscribe</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default HighSeverityLeakAlert;

const body = { fontFamily: "Arial, sans-serif", backgroundColor: "#f8fafc", color: "#0f172a", padding: "24px" };
const container = { maxWidth: "560px", margin: "0 auto", backgroundColor: "#ffffff", border: "1px solid #fecaca", borderRadius: "16px", padding: "28px" };
const h1 = { margin: "0 0 16px", fontSize: "22px", color: "#dc2626" };
const p = { margin: "0 0 12px", lineHeight: "1.6" };
const table = { width: "100%", margin: "16px 0", borderCollapse: "collapse" as const };
const cellLabel = { padding: "8px 12px", color: "#64748b", borderBottom: "1px solid #e2e8f0", width: "40%" };
const cellValue = { padding: "8px 12px", borderBottom: "1px solid #e2e8f0" };
const btnContainer = { margin: "20px 0 0", textAlign: "center" as const };
const btn = { backgroundColor: "#dc2626", color: "#ffffff", padding: "10px 20px", borderRadius: "8px", textDecoration: "none", fontWeight: 600 };
const hr = { borderColor: "#e2e8f0", margin: "20px 0 16px" };
const footer = { margin: 0, color: "#94a3b8", fontSize: "12px", textAlign: "center" as const };
const unsubLink = { color: "#94a3b8", textDecoration: "underline" };
