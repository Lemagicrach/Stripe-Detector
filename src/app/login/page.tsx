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
