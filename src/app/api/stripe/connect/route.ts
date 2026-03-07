// src/app/api/stripe/connect/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getStripeServerClient, getSupabaseAdminClient } from "@/lib/server-clients";
import { encrypt } from "@/lib/encryption";
import { handleApiError, unauthorized, badRequest } from "@/lib/server-error";
import { checkRateLimit } from "@/lib/rate-limit";

type UsageEventInsert = {
  user_id: string;
  event_type: string;
  metadata: Record<string, unknown>;
};

type StripeConnectionUpsert = {
  user_id: string;
  stripe_account_id: string;
  account_name: string;
  encrypted_access_token: string;
  encrypted_refresh_token: string | null;
  status: string;
  last_sync_at: string | null;
};

type StripeConnectionRow = {
  id: string;
};

type SupabaseWriteResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

function usageEventsTable(admin: ReturnType<typeof getSupabaseAdminClient>) {
  return admin.from("usage_events") as unknown as {
    insert: (values: UsageEventInsert) => Promise<unknown>;
  };
}

function stripeConnectionsTable(admin: ReturnType<typeof getSupabaseAdminClient>) {
  return admin.from("stripe_connections") as unknown as {
    upsert: (values: StripeConnectionUpsert, options: { onConflict: string }) => {
      select: (columns: string) => {
        single: () => Promise<SupabaseWriteResult<StripeConnectionRow>>;
      };
    };
    update: (values: { status: string }) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => Promise<unknown>;
      };
    };
  };
}

export async function GET(req: NextRequest) {
  try {
    const { allowed } = checkRateLimit({ key: "stripe-connect", limit: 10, windowMs: 60_000 });
    if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return unauthorized();

    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const action = url.searchParams.get("action");

    // Initiate OAuth
    if (action === "start") {
      const clientId = process.env.STRIPE_CLIENT_ID;
      const redirectUri = process.env.STRIPE_CONNECT_REDIRECT_URI;
      if (!clientId || !redirectUri) return badRequest("Stripe Connect not configured");

      const state = crypto.randomUUID();
      const admin = getSupabaseAdminClient();
      await usageEventsTable(admin).insert({
        user_id: user.id, event_type: "stripe_oauth_start", metadata: { state }
      });

      const oauthUrl = new URL("https://connect.stripe.com/oauth/authorize");
      oauthUrl.searchParams.set("response_type", "code");
      oauthUrl.searchParams.set("client_id", clientId);
      oauthUrl.searchParams.set("scope", "read_write");
      oauthUrl.searchParams.set("redirect_uri", redirectUri);
      oauthUrl.searchParams.set("state", state);
      oauthUrl.searchParams.set("stripe_user[email]", user.email || "");
      return NextResponse.json({ url: oauthUrl.toString() });
    }

    // OAuth Callback
    if (code) {
      const stripe = getStripeServerClient();
      const response = await stripe.oauth.token({ grant_type: "authorization_code", code });
      if (!response.stripe_user_id) return badRequest("Failed to connect");

      const admin = getSupabaseAdminClient();
      const encryptedAccess = encrypt(response.access_token || "");
      const encryptedRefresh = response.refresh_token ? encrypt(response.refresh_token) : null;
      const account = await stripe.accounts.retrieve(response.stripe_user_id);
      const stripeConnections = stripeConnectionsTable(admin);

      const { data: conn, error: connErr } = await stripeConnections
        .upsert({
          user_id: user.id,
          stripe_account_id: response.stripe_user_id,
          account_name: account.business_profile?.name || account.settings?.dashboard?.display_name || account.email || "Connected Account",
          encrypted_access_token: encryptedAccess,
          encrypted_refresh_token: encryptedRefresh,
          status: "active",
          last_sync_at: null,
        }, { onConflict: "user_id,stripe_account_id" })
        .select("id").single();

      if (connErr) return badRequest("Failed to save connection");
      if (!conn) return badRequest("Failed to save connection");

      await usageEventsTable(admin).insert({
        user_id: user.id, event_type: "stripe_connected",
        metadata: { connection_id: conn.id, account_id: response.stripe_user_id }
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      return NextResponse.redirect(`${appUrl}/dashboard/connect?status=success&account=${response.stripe_user_id}`);
    }

    const error = url.searchParams.get("error");
    if (error) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      return NextResponse.redirect(`${appUrl}/dashboard/connect?status=error&reason=${error}`);
    }

    return badRequest("Missing code or action parameter");
  } catch (error) {
    return handleApiError(error, "STRIPE_CONNECT");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return unauthorized();
    const body = await req.json();
    if (!body.connectionId) return badRequest("connectionId required");
    const admin = getSupabaseAdminClient();
    await stripeConnectionsTable(admin)
      .update({ status: "disconnected" })
      .eq("id", body.connectionId)
      .eq("user_id", user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "STRIPE_DISCONNECT");
  }
}
