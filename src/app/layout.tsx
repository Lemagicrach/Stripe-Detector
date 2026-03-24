import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Corvidet — Secure Your Stripe Revenue",
  description:
    "Detect Stripe revenue leaks, track MRR, and surface recovery opportunities. Built for bootstrapped SaaS founders doing $3K–$50K MRR.",
  openGraph: {
    title: "Corvidet — Secure Your Stripe Revenue",
    description:
      "Find failed charges, expiring cards, and at-risk subscriptions in one scan. Powered by Stripe + Claude AI.",
    images: [{ url: "/og-image.svg", width: 1200, height: 630 }],
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
