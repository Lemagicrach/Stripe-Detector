<# ============================================================
   RevPilot - implement-auth-ui.ps1
   Auth pages (Login + Callback)

   Run:  .\implement-auth-ui.ps1

   Creates 3 files:
     1. app/login/page.tsx         - login page
     2. app/auth/callback/route.ts - OAuth/magic-link callback
     3. proxy.ts                   - auth guard (updated)
   ============================================================ #>

$ErrorActionPreference = "Stop"

function Write-Impl {
    param([string]$Path, [string]$Content)
    $dir = Split-Path $Path -Parent
    if ($dir -and !(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    Set-Content -Path $Path -Value $Content -Encoding UTF8
    Write-Host "  [ok] $Path" -ForegroundColor Green
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "RevPilot - Auth UI (3 files)" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# ----------------------------------------------
# 1. Login Page
# ----------------------------------------------
Write-Host "Step 1 - Login Page" -ForegroundColor Yellow

Write-Impl "src/app/login/page.tsx" @'
"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Magic link login
  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  }

  // Google OAuth login
  async function handleGoogle() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) setError(error.message);
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0B1120",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        width: "100%",
        maxWidth: 420,
        background: "#111827",
        border: "1px solid #1F2937",
        borderRadius: 16,
        padding: "2.5rem 2rem",
      }}>
        {/* Logo / Brand */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            fontSize: "2rem",
            fontWeight: 800,
            fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
            color: "#F9FAFB",
            letterSpacing: "-0.02em",
          }}>
            RevPilot
          </div>
          <p style={{
            color: "#6B7280",
            fontSize: "0.85rem",
            marginTop: 6,
          }}>
            Revenue intelligence for bootstrapped SaaS
          </p>
        </div>

        {sent ? (
          /* Magic link sent confirmation */
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>Mail sent</div>
            <h2 style={{
              color: "#F9FAFB", fontSize: "1.2rem",
              fontWeight: 600, marginBottom: 8,
            }}>
              Check your email
            </h2>
            <p style={{
              color: "#9CA3AF", fontSize: "0.85rem", lineHeight: 1.6,
              marginBottom: 20,
            }}>
              We sent a login link to <strong style={{ color: "#F9FAFB" }}>{email}</strong>.
              Click the link to sign in.
            </p>
            <button
              onClick={() => { setSent(false); setEmail(""); }}
              style={{
                background: "transparent",
                color: "#3B82F6",
                border: "none",
                fontSize: "0.85rem",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Use a different email
            </button>
          </div>
        ) : (
          /* Login form */
          <>
            {/* Google OAuth */}
            <button
              onClick={handleGoogle}
              style={{
                width: "100%",
                padding: "12px 16px",
                background: "#1F2937",
                border: "1px solid #374151",
                borderRadius: 10,
                color: "#F9FAFB",
                fontSize: "0.9rem",
                fontWeight: 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                transition: "border-color 0.15s",
                marginBottom: 20,
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "#4B5563")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "#374151")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            {/* Divider */}
            <div style={{
              display: "flex", alignItems: "center",
              gap: 16, marginBottom: 20,
            }}>
              <div style={{ flex: 1, height: 1, background: "#1F2937" }} />
              <span style={{ color: "#6B7280", fontSize: "0.75rem" }}>or</span>
              <div style={{ flex: 1, height: 1, background: "#1F2937" }} />
            </div>

            {/* Email magic link */}
            <form onSubmit={handleMagicLink}>
              <label style={{
                display: "block", color: "#9CA3AF",
                fontSize: "0.8rem", fontWeight: 500, marginBottom: 6,
              }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  background: "#0F172A",
                  border: "1px solid #1F2937",
                  borderRadius: 8,
                  color: "#F9FAFB",
                  fontSize: "0.9rem",
                  outline: "none",
                  marginBottom: 16,
                  boxSizing: "border-box",
                }}
              />
              <button
                type="submit"
                disabled={loading || !email.trim()}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: loading || !email.trim() ? "#1F2937" : "#3B82F6",
                  color: loading || !email.trim() ? "#6B7280" : "#fff",
                  border: "none",
                  borderRadius: 10,
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  cursor: loading ? "wait" : "pointer",
                  transition: "background 0.15s",
                }}
              >
                {loading ? "Sending..." : "Send Magic Link"}
              </button>
            </form>

            {error && (
              <div style={{
                marginTop: 16,
                padding: "10px 14px",
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.25)",
                borderRadius: 8,
                color: "#EF4444",
                fontSize: "0.8rem",
              }}>
                {error}
              </div>
            )}

            <p style={{
              color: "#6B7280", fontSize: "0.7rem",
              textAlign: "center", marginTop: 24, lineHeight: 1.5,
            }}>
              No password needed. We'll email you a secure login link.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
'@

# ----------------------------------------------
# 2. Auth Callback
# ----------------------------------------------
Write-Host "Step 2 - Auth Callback" -ForegroundColor Yellow

Write-Impl "src/app/auth/callback/route.ts" @'
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth error -> back to login
  return NextResponse.redirect(`${origin}/login`);
}
'@

# ----------------------------------------------
# 3. Proxy
# ----------------------------------------------
Write-Host "Step 3 - Proxy (auth guard)" -ForegroundColor Yellow

Write-Impl "src/proxy.ts" @'
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Routes that don't require authentication
const publicRoutes = ["/login", "/auth/callback", "/api/webhooks"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth check for public routes
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

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

  const { data: { user } } = await supabase.auth.getUser();

  // No user → redirect to login
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Match everything except static files and Next internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
'@

Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host "Auth UI created (3 files)" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Files:" -ForegroundColor Cyan
Write-Host "  src/app/login/page.tsx         - login (Google + magic link)"
Write-Host "  src/app/auth/callback/route.ts - OAuth/magic-link callback"
Write-Host "  src/proxy.ts                   - auth guard -> /login"
Write-Host ""
Write-Host "Required package:" -ForegroundColor Yellow
Write-Host "  npm install @supabase/ssr @supabase/supabase-js"
Write-Host ""
Write-Host "Required env vars in .env.local:" -ForegroundColor Yellow
Write-Host "  NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co"
Write-Host "  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ..."
Write-Host ""
