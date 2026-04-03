"use client";
export const dynamic = "force-dynamic";
import { Suspense, useState, useEffect, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

const COOLDOWN_SECONDS = 60;

/** Map raw Supabase error messages to user-friendly copy */
function humanizeError(msg: string): { text: string; isRateLimit: boolean } {
  const lower = msg.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("email rate limit")) {
    return {
      text: "Too many requests - please wait a minute then try again, or use Google to sign in instantly.",
      isRateLimit: true,
    };
  }
  if (lower.includes("after 5 seconds") || lower.includes("security purposes")) {
    return {
      text: "Please wait a few seconds before requesting another link.",
      isRateLimit: false,
    };
  }
  if (lower.includes("invalid email")) {
    return { text: "That doesn't look like a valid email address.", isRateLimit: false };
  }
  return { text: msg, isRateLimit: false };
}

function LoginForm() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "link_expired"
      ? "This link has expired or already been used. Please request a new one."
      : null
  );
  const [isRateLimit, setIsRateLimit] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Redirect to destination if already authenticated
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace(next);
    });
  }, [router, next, supabase]);

  // Parse hash-fragment errors from Supabase (e.g. expired OTP, access_denied)
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const errorCode = params.get("error_code");
    const description = params.get("error_description")?.replace(/\+/g, " ");
    if (errorCode) {
      if (errorCode === "otp_expired" || errorCode === "access_denied") {
        setError("This login link has expired or already been used. Please request a new one.");
      } else {
        setError(description || "Authentication failed. Please try again.");
      }
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  function startCooldown() {
    setCooldown(COOLDOWN_SECONDS);
    cooldownRef.current = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) {
          clearInterval(cooldownRef.current!);
          cooldownRef.current = null;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || cooldown > 0) return;
    setLoading(true);
    setError(null);
    setIsRateLimit(false);

    const callbackUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callbackUrl },
    });

    setLoading(false);
    if (error) {
      const { text, isRateLimit: rl } = humanizeError(error.message);
      setError(text);
      setIsRateLimit(rl);
    } else {
      setSent(true);
      startCooldown();
    }
  }

  async function handleGoogle() {
    setError(null);
    const callbackUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl },
    });
    if (error) setError(humanizeError(error.message).text);
  }

  const canSubmit = !loading && !!email.trim() && cooldown === 0;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B1120] p-6">
      <Card className="w-full max-w-[420px] border-gray-800 bg-gray-900 px-0 py-0">
        <CardHeader className="px-8 pt-10 pb-0">
          {/* Logo / Brand */}
          <div className="mb-8 flex flex-col items-center gap-3">
            <img
              src="/Modern Logo with Geometric Crow and Teal Accents.png"
              alt="Corvidet"
              width={56}
              height={56}
              className="rounded-xl object-contain"
            />
            <div>
              <div className="text-[1.6rem] font-extrabold tracking-tight text-gray-50 text-center">Corvidet</div>
              <p className="mt-1 text-sm text-gray-500 text-center">Secure your Stripe revenue</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-8 pb-10">
          {sent ? (
            <div className="text-center">
              <div className="mb-4 text-5xl">✉️</div>
              <h2 className="mb-2 text-xl font-semibold text-gray-50">Check your email</h2>
              <p className="mb-3 text-sm leading-relaxed text-gray-400">
                We sent a login link to{" "}
                <strong className="text-gray-50">{email}</strong>. Click the link to sign in - from any device.
              </p>
              <p className="mb-5 text-xs text-gray-500">Don&apos;t see it? Check your spam folder.</p>

              <div className="mb-4">
                {cooldown > 0 ? (
                  <p className="text-xs text-gray-500">
                    Resend available in{" "}
                    <span className="font-mono text-gray-400">{cooldown}s</span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleMagicLink as unknown as React.MouseEventHandler}
                    className="cursor-pointer border-none bg-transparent text-xs text-blue-500 underline"
                  >
                    Resend link
                  </button>
                )}
              </div>

              <button
                onClick={() => {
                  setSent(false);
                  setEmail("");
                  setError(null);
                }}
                className="cursor-pointer border-none bg-transparent text-sm text-gray-400 underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              {/* Google OAuth */}
              <Button
                type="button"
                variant="outline"
                className="mb-5 w-full border-gray-700 bg-gray-800 text-gray-50 hover:border-gray-600 hover:bg-gray-700 hover:text-gray-50 h-11"
                onClick={handleGoogle}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </Button>

              {/* Divider */}
              <div className="mb-5 flex items-center gap-4">
                <div className="h-px flex-1 bg-gray-800" />
                <span className="text-xs text-gray-500">or</span>
                <div className="h-px flex-1 bg-gray-800" />
              </div>

              {/* Email magic link */}
              <form onSubmit={handleMagicLink}>
                <label className="mb-1.5 block text-xs font-medium text-gray-400">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="mb-4 w-full rounded-lg border border-gray-800 bg-slate-900 px-3.5 py-3 text-sm text-gray-50 outline-none focus:border-gray-600"
                />
                <Button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full h-11"
                >
                  {loading ? "Sending..." : cooldown > 0 ? `Resend in ${cooldown}s` : "Send Magic Link"}
                </Button>
              </form>

              {error && (
                <Alert variant={isRateLimit ? "warning" : "destructive"} className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {error}
                    {isRateLimit && (
                      <button
                        type="button"
                        onClick={handleGoogle}
                        className="mt-2 block w-full cursor-pointer rounded-lg border border-amber-500/30 bg-amber-500/10 py-2 text-center text-xs font-medium text-amber-300 hover:bg-amber-500/20 transition-colors"
                      >
                        Sign in with Google instead - no limits
                      </button>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <p className="mt-6 text-center text-[0.7rem] leading-relaxed text-gray-500">
                No password needed. We&apos;ll email you a secure login link.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
