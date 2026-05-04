// src/app/api/cron/refresh-stripe-tokens/route.ts
//
// Weekly cron that pre-emptively refreshes Stripe Connect access tokens
// before they hit the 6-12 month hard expiry. Iterates active connections
// where `last_refreshed_at < now() - 5 months OR null`, and triggers a cheap
// Stripe call (`balance.retrieve`) inside `withStripeConnect`. The wrapper
// itself transparently refreshes the token if Stripe returns 401, persists
// the new token, and updates `last_refreshed_at`.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server-clients";
import { handleApiError } from "@/lib/server-error";
import { verifyCronAuth } from "@/lib/cron-auth";
import { log } from "@/lib/logger";
import { pingHealthcheck } from "@/lib/healthcheck";
import { withStripeConnect } from "@/lib/stripe-connect";

const ROUTE = "/api/cron/refresh-stripe-tokens";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const HC = process.env.HC_REFRESH_TOKENS_URL;
  await pingHealthcheck(HC, "start");

  try {
    const admin = getSupabaseAdminClient();
    const cutoff = new Date(Date.now() - 5 * 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: connections, error } = await admin
      .from("stripe_connections")
      .select("id")
      .eq("status", "active")
      .or(`last_refreshed_at.is.null,last_refreshed_at.lt.${cutoff}`);

    if (error) throw error;

    let refreshed = 0;
    let errors = 0;

    for (const conn of connections ?? []) {
      try {
        await withStripeConnect(conn.id, async (stripe) => {
          await stripe.balance.retrieve();
        });
        refreshed++;
      } catch (err) {
        errors++;
        log("error", "Token refresh attempt failed", {
          route: ROUTE,
          connectionId: conn.id,
          error: err,
        });
      }
    }

    await pingHealthcheck(HC);
    return NextResponse.json({
      success: true,
      checked: connections?.length ?? 0,
      refreshed,
      errors,
      cutoff,
    });
  } catch (err) {
    await pingHealthcheck(HC, "fail");
    return handleApiError(err, "CRON_REFRESH_TOKENS");
  }
}
