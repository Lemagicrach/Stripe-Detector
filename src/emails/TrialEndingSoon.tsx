// src/emails/TrialEndingSoon.tsx
//
// Transactional — always sent. Stripe fires customer.subscription.trial_will_end
// 3 days before the trial expires. Without a payment method on file, the
// subscription auto-cancels and the user reverts to the free plan.

import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";

type Props = {
  trialEndsAt: Date;
  billingUrl: string;
};

export function TrialEndingSoon({ trialEndsAt, billingUrl }: Props) {
  const formatted = trialEndsAt.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  return (
    <Html>
      <Head />
      <Preview>Your Corvidet Growth trial ends in 3 days</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>Your Corvidet Growth trial ends in 3 days</Heading>
          <Text style={p}>
            Your trial ends on <strong>{formatted}</strong>. To keep your Growth features, add a payment method before then:
          </Text>
          <Container style={btnContainer}>
            <Button href={billingUrl} style={btn}>Add payment method</Button>
          </Container>
          <Text style={small}>
            If you don&apos;t add a card, your account will revert to the free plan automatically — no charge, no surprises.
          </Text>
          <Text style={signature}>— Corvidet</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default TrialEndingSoon;

const body = { fontFamily: "Arial, sans-serif", backgroundColor: "#f8fafc", color: "#0f172a", padding: "24px" };
const container = { maxWidth: "560px", margin: "0 auto", backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "28px" };
const h1 = { margin: "0 0 16px", fontSize: "22px" };
const p = { margin: "0 0 12px", lineHeight: "1.6" };
const btnContainer = { margin: "20px 0", textAlign: "center" as const };
const btn = { backgroundColor: "#2563eb", color: "#ffffff", padding: "10px 20px", borderRadius: "8px", textDecoration: "none", fontWeight: 600 };
const small = { margin: "0 0 12px", lineHeight: "1.6", color: "#64748b", fontSize: "14px" };
const signature = { margin: "24px 0 0", color: "#64748b", fontSize: "13px" };
