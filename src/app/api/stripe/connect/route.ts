import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getStripeServerClient, getSupabaseAdminClient } from "@/lib/server-clients";
import { encrypt } from "@/lib/encryption";
import { handleApiError, unauthorized, badRequest } from "@/lib/server-error";
import { checkRateLimit } from "@/lib/rate-limit";

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function redirectToConnect(status: "success" | "error", params: Record<string, string>) {
  const url = new URL("/dashboard/connect", getAppUrl());
  url.searchParams.set("status", status);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url.toString());
}

function fallbackEmail(userId: string) {
  return `${userId}@placeholder.local`;
}

async function ensureUserProfile(user: { id: string; email?: string | null }) {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("user_profiles").upsert(
    {
      id: user.id,
      email: user.email || fallbackEmail(user.id),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    throw new Error(`Failed to ensure user profile: ${error.message}`);
  }
}

async function trackUsageEvent(userId: string, eventType: string, metadata: Record<string, unknown>) {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("usage_events").insert({
    user_id: userId,
    event_type: eventType,
    metadata,
  });

  if (error) {
    // Usage logging should never block auth/connect flow.
    console.warn(`[STRIPE_CONNECT] usage event "${eventType}" failed:`, error.message);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { allowed } = checkRateLimit({ key: "stripe-connect", limit: 10, windowMs: 60_000 });
    if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return unauthorized();

    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const action = url.searchParams.get("action");

    if (action === "start") {
      const clientId = process.env.STRIPE_CLIENT_ID;
      const redirectUri = process.env.STRIPE_CONNECT_REDIRECT_URI;
      if (!clientId || !redirectUri) return badRequest("Stripe Connect not configured");

      await ensureUserProfile(user);

      const state = crypto.randomUUID();
      await trackUsageEvent(user.id, "stripe_oauth_start", { state });

      const oauthUrl = new URL("https://connect.stripe.com/oauth/authorize");
      oauthUrl.searchParams.set("response_type", "code");
      oauthUrl.searchParams.set("client_id", clientId);
      oauthUrl.searchParams.set("scope", "read_write");
      oauthUrl.searchParams.set("redirect_uri", redirectUri);
      oauthUrl.searchParams.set("state", state);
      oauthUrl.searchParams.set("stripe_user[email]", user.email || "");

      return NextResponse.json({ url: oauthUrl.toString() });
    }

    if (code) {
      const stripe = getStripeServerClient();
      const oauth = await stripe.oauth.token({ grant_type: "authorization_code", code });

      if (!oauth.stripe_user_id) {
        return redirectToConnect("error", { reason: "stripe_oauth_failed" });
      }

      await ensureUserProfile(user);

      const account = await stripe.accounts.retrieve(oauth.stripe_user_id);
      const admin = getSupabaseAdminClient();
      const { data: conn, error: connErr } = await admin
        .from("stripe_connections")
        .upsert(
          {
            user_id: user.id,
            stripe_account_id: oauth.stripe_user_id,
            account_name:
              account.business_profile?.name ||
              account.settings?.dashboard?.display_name ||
              account.email ||
              "Connected Account",
            encrypted_access_token: encrypt(oauth.access_token || ""),
            encrypted_refresh_token: oauth.refresh_token ? encrypt(oauth.refresh_token) : null,
            status: "active",
            last_sync_at: null,
          },
          { onConflict: "user_id,stripe_account_id" }
        )
        .select("id")
        .single();

      if (connErr || !conn) {
        const reason = connErr?.message || "save_connection_failed";
        return redirectToConnect("error", { reason });
      }

      await trackUsageEvent(user.id, "stripe_connected", {
        connection_id: (conn as { id: string }).id,
        account_id: oauth.stripe_user_id,
      });

      return redirectToConnect("success", { account: oauth.stripe_user_id });
    }

    const error = url.searchParams.get("error");
    if (error) {
      return redirectToConnect("error", { reason: error });
    }

    return badRequest("Missing code or action parameter");
  } catch (error) {
    return handleApiError(error, "STRIPE_CONNECT");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return unauthorized();

    const body = await req.json();
    if (!body.connectionId) return badRequest("connectionId required");

    const admin = getSupabaseAdminClient();
    const { error } = await admin
      .from("stripe_connections")
      .update({ status: "disconnected" })
      .eq("id", body.connectionId)
      .eq("user_id", user.id);

    if (error) return badRequest("Failed to disconnect");

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "STRIPE_DISCONNECT");
  }
}
