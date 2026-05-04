// src/lib/stripe-connect.ts
//
// Wrapper that runs a function against a Stripe Connect account, transparently
// refreshing the OAuth access token if it has expired. Stripe Connect access
// tokens last 6-12 months; without a refresh path the product silently breaks
// for any customer past that horizon.
//
// Usage:
//
//   const metrics = await withStripeConnect(connection.id, async (stripe) => {
//     return await stripe.subscriptions.list({ limit: 100 });
//   });
//
// On `StripeAuthenticationError` / `expired_token` / 401, the wrapper:
//   1. Loads the encrypted refresh token from `stripe_connections`
//   2. Calls `oauth.token` with the *platform* secret key (not the connected
//      account key — the OAuth API only accepts the platform key)
//   3. Re-encrypts and persists the new access (and refresh, if rotated) token
//   4. Updates `stripe_connections.last_refreshed_at`
//   5. Retries the user function once with the new token
//
// Any other error (network, application logic) bubbles up unmodified.

import Stripe from "stripe";
import { decrypt, encrypt } from "@/lib/encryption";
import { getSupabaseAdminClient } from "@/lib/server-clients";
import { log } from "@/lib/logger";

const STRIPE_API_VERSION = "2026-02-25.clover" as const;

function isExpiredTokenError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { type?: string; code?: string; statusCode?: number };
  return (
    e.type === "StripeAuthenticationError" ||
    e.code === "expired_token" ||
    e.statusCode === 401
  );
}

export async function withStripeConnect<T>(
  connectionId: string,
  fn: (stripe: Stripe) => Promise<T>
): Promise<T> {
  const admin = getSupabaseAdminClient();
  const { data: conn, error } = await admin
    .from("stripe_connections")
    .select("id, encrypted_access_token, encrypted_refresh_token")
    .eq("id", connectionId)
    .single();

  if (error || !conn) {
    throw new Error(`Stripe connection not found: ${connectionId}`);
  }

  const stripe = new Stripe(decrypt(conn.encrypted_access_token), {
    apiVersion: STRIPE_API_VERSION,
  });

  try {
    return await fn(stripe);
  } catch (err) {
    if (!isExpiredTokenError(err)) throw err;

    if (!conn.encrypted_refresh_token) {
      log("error", "Access token expired but no refresh token stored", {
        connectionId,
        errorCode: "no_refresh_token",
      });
      throw err;
    }

    const platformKey = process.env.STRIPE_SECRET_KEY;
    if (!platformKey) {
      log("error", "STRIPE_SECRET_KEY missing, cannot refresh", {
        connectionId,
        errorCode: "missing_platform_key",
      });
      throw err;
    }

    const refreshToken = decrypt(conn.encrypted_refresh_token);
    const platformStripe = new Stripe(platformKey, {
      apiVersion: STRIPE_API_VERSION,
    });

    let refreshed: Stripe.OAuthToken;
    try {
      refreshed = await platformStripe.oauth.token({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      });
    } catch (refreshErr) {
      log("error", "OAuth refresh call failed", {
        connectionId,
        errorCode: "oauth_refresh_failed",
        error: refreshErr,
      });
      throw refreshErr;
    }

    if (!refreshed.access_token) {
      throw new Error("Stripe oauth.token returned no access_token");
    }

    const updates: Record<string, unknown> = {
      encrypted_access_token: encrypt(refreshed.access_token),
      last_refreshed_at: new Date().toISOString(),
    };
    if (refreshed.refresh_token) {
      updates.encrypted_refresh_token = encrypt(refreshed.refresh_token);
    }

    const { error: updateError } = await admin
      .from("stripe_connections")
      .update(updates)
      .eq("id", connectionId);

    if (updateError) {
      log("error", "Failed to persist refreshed tokens", {
        connectionId,
        errorCode: "token_persist_failed",
        error: updateError,
      });
      // Continue — we'll still retry with the new token, but next call will
      // re-trigger the refresh flow because the DB still has the old token.
    }

    log("info", "Stripe access token refreshed", { connectionId });

    const newStripe = new Stripe(refreshed.access_token, {
      apiVersion: STRIPE_API_VERSION,
    });
    return await fn(newStripe);
  }
}
