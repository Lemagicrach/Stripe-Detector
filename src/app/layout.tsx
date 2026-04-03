import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Corvidet - Stripe Revenue Leak Detector",
  description:
    "Find and fix revenue leaks in your Stripe account. Detect failed charges, expiring cards, and at-risk subscriptions in one scan.",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Corvidet - Stripe Revenue Leak Detector",
    description:
      "Find and fix revenue leaks in your Stripe account. Powered by Stripe + Claude AI.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    type: "website",
    siteName: "Corvidet",
  },
  twitter: {
    card: "summary_large_image",
    title: "Corvidet - Stripe Revenue Leak Detector",
    description: "Find and fix revenue leaks in your Stripe account.",
    images: ["/og-image.png"],
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
