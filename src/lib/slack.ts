// src/lib/slack.ts
//
// Slack integration helpers. Encapsulates the OAuth incoming-webhook lookup
// and the actual POST to Slack. All functions are fail-silent at the network
// layer — a Slack outage must never break a leak scan, monthly report, or
// trial-end webhook.

import { decrypt } from "@/lib/encryption";
import { getSupabaseAdminClient } from "@/lib/server-clients";
import { log } from "@/lib/logger";

type SlackBlock = Record<string, unknown>;

type SlackPayload = {
  text: string;             // Fallback text for notifications/screen readers
  blocks?: SlackBlock[];    // Optional Block Kit rich layout
};

type SlackConnection = {
  id: string;
  user_id: string;
  encrypted_webhook_url: string;
  team_name: string | null;
  channel_name: string | null;
};

/** Load the active Slack integration for a user, if any. */
export async function getActiveSlackForUser(userId: string): Promise<SlackConnection | null> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("slack_integrations")
    .select("id, user_id, encrypted_webhook_url, team_name, channel_name")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    log("warn", "Failed to load Slack integration", { userId, error });
    return null;
  }
  return (data as SlackConnection | null) ?? null;
}

/** POST a message to a connected Slack workspace. Fail-silent. */
export async function sendSlackMessage(
  conn: Pick<SlackConnection, "id" | "user_id" | "encrypted_webhook_url">,
  payload: SlackPayload
): Promise<boolean> {
  let url: string;
  try {
    url = decrypt(conn.encrypted_webhook_url);
  } catch (err) {
    log("error", "Failed to decrypt Slack webhook URL", {
      slackIntegrationId: conn.id,
      userId: conn.user_id,
      error: err,
    });
    return false;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      log("warn", "Slack webhook returned non-2xx", {
        slackIntegrationId: conn.id,
        userId: conn.user_id,
        status: res.status,
        body,
      });
      return false;
    }
    return true;
  } catch (err) {
    log("warn", "Slack webhook POST failed", {
      slackIntegrationId: conn.id,
      userId: conn.user_id,
      error: err,
    });
    return false;
  }
}

/** Helper: send a Slack message to a user if they have an active connection. */
export async function notifyUserOnSlack(userId: string, payload: SlackPayload): Promise<boolean> {
  const conn = await getActiveSlackForUser(userId);
  if (!conn) return false;
  return sendSlackMessage(conn, payload);
}

// ─── Block Kit templates ────────────────────────────────────────────────────

const formatUsd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function buildCriticalLeakAlert(params: {
  count: number;
  totalLostUsd: number;
  totalRecoverableUsd: number;
  topTitle: string;
  dashboardUrl: string;
}): SlackPayload {
  const { count, totalLostUsd, totalRecoverableUsd, topTitle, dashboardUrl } = params;
  const fallback = `${count} critical revenue leak${count > 1 ? "s" : ""} detected — $${totalLostUsd.toFixed(0)} at risk, $${totalRecoverableUsd.toFixed(0)} recoverable.`;
  return {
    text: fallback,
    blocks: [
      { type: "header", text: { type: "plain_text", text: ":rotating_light: Critical revenue leaks detected" } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Critical leaks:*\n${count}` },
          { type: "mrkdwn", text: `*At risk:*\n$${totalLostUsd.toFixed(0)}` },
          { type: "mrkdwn", text: `*Recoverable:*\n$${totalRecoverableUsd.toFixed(0)}` },
          { type: "mrkdwn", text: `*Top issue:*\n${topTitle}` },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Open dashboard" },
            url: dashboardUrl,
            style: "primary",
          },
        ],
      },
    ],
  };
}

export function buildMonthlyReportReady(params: {
  periodLabel: string;
  totalRevenueUsd: number;
  failedPaymentsUsd: number;
  reportUrl: string;
}): SlackPayload {
  const { periodLabel, totalRevenueUsd, failedPaymentsUsd, reportUrl } = params;
  return {
    text: `Your ${periodLabel} revenue health report is ready ($${totalRevenueUsd.toFixed(0)} revenue, $${failedPaymentsUsd.toFixed(0)} failed payments).`,
    blocks: [
      { type: "header", text: { type: "plain_text", text: `:bar_chart: ${periodLabel} health report ready` } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Total revenue:*\n$${totalRevenueUsd.toFixed(0)}` },
          { type: "mrkdwn", text: `*Failed payments:*\n$${failedPaymentsUsd.toFixed(0)}` },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View report" },
            url: reportUrl,
            style: "primary",
          },
        ],
      },
    ],
  };
}

export function buildTrialEndingSoon(params: {
  daysLeft: number;
  billingUrl: string;
}): SlackPayload {
  const { daysLeft, billingUrl } = params;
  return {
    text: `Your Corvidet Growth trial ends in ${daysLeft} day${daysLeft > 1 ? "s" : ""}. Add a payment method to keep your features.`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:hourglass_flowing_sand: *Trial ending in ${daysLeft} day${daysLeft > 1 ? "s" : ""}*\nAdd a payment method to keep Growth features after the trial ends.`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Add payment method" },
            url: billingUrl,
            style: "primary",
          },
        ],
      },
    ],
  };
}

// Re-export the cents formatter in case callers want consistent USD formatting.
export { formatUsd };
