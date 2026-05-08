// src/app/api/integrations/slack/route.ts
//
// Single endpoint that handles both OAuth start (?action=start) and the
// callback (?code=...) for Slack incoming-webhook integration. Mirrors the
// pattern from /api/stripe/connect: timing-safe CSRF state cookie, plan
// gating, encrypted credential storage.
//
// Required env vars (set in Vercel for production):
//   SLACK_CLIENT_ID
//   SLACK_CLIENT_SECRET
//   SLACK_REDIRECT_URI      e.g. https://corvidet.com/api/integrations/slack

import { NextRequest, NextResponse } from "next/server";
import { randomUUID, timingSafeEqual } from "crypto";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/server-clients";
import { encrypt } from "@/lib/encryption";
import { handleApiError, unauthorized, badRequest } from "@/lib/server-error";
import { PLAN_LIMITS, type PlanTier } from "@/lib/stripe";
import { log } from "@/lib/logger";
import { audit } from "@/lib/audit";

const STATE_COOKIE = "slack_oauth_state";

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function redirectToIntegrations(status: "success" | "error", params: Record<string, string> = {}) {
  const url = new URL("/dashboard/settings/integrations", getAppUrl());
  url.searchParams.set("status", status);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return NextResponse.redirect(url.toString());
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  try { return timingSafeEqual(aBuf, bBuf); } catch { return false; }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return unauthorized();

    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const slackError = url.searchParams.get("error");

    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    const redirectUri = process.env.SLACK_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
      return badRequest("Slack integration not configured");
    }

    // ─── Start OAuth ───────────────────────────────────────────────────────
    if (action === "start") {
      // Plan gating: only Business can connect Slack today.
      const admin = getSupabaseAdminClient();
      const { data: profile } = await admin
        .from("user_profiles").select("plan").eq("id", user.id).single();
      const plan = ((profile as { plan?: string } | null)?.plan ?? "free") as PlanTier;
      if (!PLAN_LIMITS[plan].slackAlerts) {
        return NextResponse.json(
          { error: "Slack alerts require the Business plan", upgradeUrl: "/dashboard/billing" },
          { status: 402 }
        );
      }

      const csrfState = randomUUID();
      const slackUrl = new URL("https://slack.com/oauth/v2/authorize");
      slackUrl.searchParams.set("client_id", clientId);
      slackUrl.searchParams.set("scope", "incoming-webhook");
      slackUrl.searchParams.set("redirect_uri", redirectUri);
      slackUrl.searchParams.set("state", csrfState);

      const response = NextResponse.json({ url: slackUrl.toString() });
      response.cookies.set(STATE_COOKIE, csrfState, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 600, // 10 minutes
        path: "/",
      });
      return response;
    }

    // ─── Slack-side error (user rejected, etc.) ───────────────────────────
    if (slackError) {
      return redirectToIntegrations("error", { reason: slackError });
    }

    // ─── OAuth callback ───────────────────────────────────────────────────
    if (code && state) {
      const cookieState = req.cookies.get(STATE_COOKIE)?.value ?? "";
      if (!cookieState || !safeEqual(state, cookieState)) {
        return redirectToIntegrations("error", { reason: "state_mismatch" });
      }

      const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenData.ok) {
        log("error", "Slack OAuth exchange failed", {
          route: "/api/integrations/slack",
          userId: user.id,
          slackError: tokenData.error,
        });
        return redirectToIntegrations("error", { reason: tokenData.error ?? "oauth_failed" });
      }

      const webhookUrl = tokenData.incoming_webhook?.url;
      const channelId = tokenData.incoming_webhook?.channel_id;
      const channelName = tokenData.incoming_webhook?.channel;
      const teamId = tokenData.team?.id ?? tokenData.team_id;
      const teamName = tokenData.team?.name ?? null;
      if (!webhookUrl || !teamId) {
        return redirectToIntegrations("error", { reason: "missing_webhook_url" });
      }

      const admin = getSupabaseAdminClient();
      const { data: row, error: upsertError } = await admin
        .from("slack_integrations")
        .upsert(
          {
            user_id: user.id,
            team_id: teamId,
            team_name: teamName,
            channel_id: channelId ?? null,
            channel_name: channelName ?? null,
            encrypted_webhook_url: encrypt(webhookUrl),
            status: "active",
            revoked_at: null,
          },
          { onConflict: "user_id,team_id" }
        )
        .select("id")
        .single();

      if (upsertError || !row) {
        log("error", "Slack integration upsert failed", {
          route: "/api/integrations/slack",
          userId: user.id,
          error: upsertError,
        });
        return redirectToIntegrations("error", { reason: "save_failed" });
      }

      await audit({
        userId: user.id,
        action: "slack.integration.connected",
        resource_type: "slack_integration",
        resource_id: (row as { id: string }).id,
        request: req,
        meta: { team_id: teamId, team_name: teamName, channel_name: channelName },
      });

      const success = redirectToIntegrations("success", { team: teamName ?? teamId });
      success.cookies.delete(STATE_COOKIE);
      return success;
    }

    return badRequest("Missing action or code parameter");
  } catch (err) {
    return handleApiError(err, "INTEGRATIONS_SLACK");
  }
}
