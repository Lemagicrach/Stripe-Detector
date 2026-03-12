import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { EmailOtpType } from "@supabase/supabase-js";

function buildSupabase(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
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
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get("next") ?? "/dashboard";
  const destination = `${origin}${next}`;
  const loginError = `${origin}/login?error=link_expired`;

  const cookieStore = await cookies();

  // ── Path 1: token_hash (cross-device magic link, no PKCE required) ──────────
  // Supabase sends this when the email template uses {{ .TokenHash }}.
  // Works regardless of which device or browser opens the link.
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  if (token_hash && type) {
    const supabase = buildSupabase(cookieStore);
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    return error
      ? NextResponse.redirect(loginError)
      : NextResponse.redirect(destination);
  }

  // ── Path 2: PKCE authorization code (same-browser flow) ─────────────────────
  // Used when the magic link is opened in the same browser that requested it,
  // or after Google OAuth.
  const code = searchParams.get("code");
  if (code) {
    const supabase = buildSupabase(cookieStore);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return error
      ? NextResponse.redirect(loginError)
      : NextResponse.redirect(destination);
  }

  // No recognised params — direct visit to /auth/callback
  return NextResponse.redirect(`${origin}/login`);
}
