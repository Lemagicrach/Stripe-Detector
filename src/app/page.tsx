"use client";
import Link from "next/link";

export default function LandingPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#0B1120", color: "#F9FAFB" }}>
      <section style={{ maxWidth: 1000, margin: "0 auto", padding: "120px 24px 80px" }}>
        <div
          style={{
            display: "inline-block",
            padding: "6px 12px",
            borderRadius: 999,
            border: "1px solid rgba(59,130,246,.3)",
            background: "rgba(59,130,246,.12)",
            color: "#93C5FD",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: ".04em",
            textTransform: "uppercase",
          }}
        >
          Built for bootstrapped SaaS
        </div>

        <h1
          style={{
            marginTop: 20,
            marginBottom: 16,
            fontSize: "clamp(2.2rem, 6vw, 4.2rem)",
            lineHeight: 1.05,
            letterSpacing: "-.03em",
          }}
        >
          Find revenue leaks in your Stripe account
        </h1>

        <p style={{ maxWidth: 680, color: "#9CA3AF", lineHeight: 1.7, fontSize: 18 }}>
          RevPilot detects failed payments, expiring cards, churn risks, and recoverable MRR.
          Connect Stripe, run a scan, and get a fix plan in minutes.
        </p>

        <div style={{ display: "flex", gap: 12, marginTop: 30, flexWrap: "wrap" }}>
          <Link
            href="/login"
            style={{
              textDecoration: "none",
              padding: "12px 20px",
              borderRadius: 10,
              background: "linear-gradient(135deg,#3B82F6,#2563EB)",
              color: "#fff",
              fontWeight: 700,
            }}
          >
            Start free scan
          </Link>
          <Link
            href="/dashboard"
            style={{
              textDecoration: "none",
              padding: "12px 20px",
              borderRadius: 10,
              border: "1px solid #334155",
              color: "#E5E7EB",
              fontWeight: 600,
            }}
          >
            Open dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
