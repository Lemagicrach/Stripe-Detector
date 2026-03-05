<# ============================================================
   RevPilot - implement-landing.ps1
   Creates public landing page and auth proxy

   Run:  .\implement-landing.ps1

   Creates:
     1. src/app/page.tsx
     2. src/proxy.ts
   ============================================================ #>

$ErrorActionPreference = "Stop"

function Write-Impl {
    param([string]$Path, [string]$Content)
    $dir = Split-Path $Path -Parent
    if ($dir -and !(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    Set-Content -Path $Path -Value $Content -Encoding UTF8
    Write-Host "  [ok] $Path" -ForegroundColor Green
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "RevPilot - Landing setup" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Step 1 - src/app/page.tsx" -ForegroundColor Yellow
Write-Impl "src/app/page.tsx" @'
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
'@

Write-Host "Step 2 - src/proxy.ts" -ForegroundColor Yellow
Write-Impl "src/proxy.ts" @'
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const publicRoutes = ["/", "/login", "/auth/callback", "/api/webhooks", "/api/cron", "/api/health"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (publicRoutes.some((route) => pathname === route || pathname.startsWith(route + "/"))) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
'@

Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host "Landing and proxy files created" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host ""
