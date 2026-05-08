// src/emails/BudgetWarning.tsx
//
// Transactional — always sent. Notice that the user is approaching their
// monthly AI cost ceiling, fired by /api/cron/check-ai-budget at 80%.

import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { PlanTier } from "@/lib/stripe";

type Props = {
  plan: PlanTier;
  spentCents: number;
  capCents: number;
  percent: number;
  billingUrl: string;
};

export function BudgetWarning({ plan, spentCents, capCents, percent, billingUrl }: Props) {
  const spent = (spentCents / 100).toFixed(2);
  const cap = (capCents / 100).toFixed(2);
  return (
    <Html>
      <Head />
      <Preview>{`You're at ${percent}% of this month's AI budget`}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>{`You're at ${percent}% of this month's AI budget`}</Heading>
          <Text style={p}>
            Your <strong>{plan}</strong> plan includes up to <strong>${cap}</strong> of AI usage per calendar month. You&apos;ve used <strong>${spent}</strong> so far.
          </Text>
          <Text style={p}>
            If you hit 100%, AI features (copilot and analyze) will return an error until your usage resets at the start of next month. Upgrade to keep going without interruption:
          </Text>
          <Container style={btnContainer}>
            <Button href={billingUrl} style={btn}>Upgrade plan</Button>
          </Container>
          <Text style={small}>
            No action required — your existing usage is unaffected. This is a courtesy heads-up so you don&apos;t get cut off mid-month.
          </Text>
          <Text style={signature}>— Corvidet</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default BudgetWarning;

const body = { fontFamily: "Arial, sans-serif", backgroundColor: "#f8fafc", color: "#0f172a", padding: "24px" };
const container = { maxWidth: "560px", margin: "0 auto", backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "28px" };
const h1 = { margin: "0 0 16px", fontSize: "22px" };
const p = { margin: "0 0 12px", lineHeight: "1.6" };
const btnContainer = { margin: "20px 0", textAlign: "center" as const };
const btn = { backgroundColor: "#2563eb", color: "#ffffff", padding: "10px 20px", borderRadius: "8px", textDecoration: "none", fontWeight: 600 };
const small = { margin: "0", lineHeight: "1.6", color: "#64748b", fontSize: "14px" };
const signature = { margin: "24px 0 0", color: "#64748b", fontSize: "13px" };
