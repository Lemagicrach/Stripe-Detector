// src/emails/AccountDeleted.tsx
//
// Transactional — always sent regardless of opt-out flag. Confirms account
// deletion and revoked Stripe Connect access.

import { Body, Container, Head, Heading, Html, Link, Preview, Text } from "@react-email/components";

export function AccountDeleted() {
  return (
    <Html>
      <Head />
      <Preview>Your Corvidet account has been deleted</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>Your Corvidet account has been deleted</Heading>
          <Text style={p}>
            Your account and all associated revenue data have been permanently removed from our systems.
          </Text>
          <Text style={p}>
            Your Stripe Connect authorization has been revoked, and any active billing subscription has been canceled.
          </Text>
          <Text style={p}>
            If this was a mistake, contact <Link href="mailto:support@corvidet.com" style={link}>support@corvidet.com</Link>.
            Note that we cannot restore deleted data.
          </Text>
          <Text style={signature}>— Corvidet</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default AccountDeleted;

const body = { fontFamily: "Arial, sans-serif", backgroundColor: "#f8fafc", color: "#0f172a", padding: "24px" };
const container = { maxWidth: "560px", margin: "0 auto", backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "28px" };
const h1 = { margin: "0 0 16px", fontSize: "22px" };
const p = { margin: "0 0 12px", lineHeight: "1.6" };
const link = { color: "#2563eb" };
const signature = { margin: "24px 0 0", color: "#64748b", fontSize: "13px" };
