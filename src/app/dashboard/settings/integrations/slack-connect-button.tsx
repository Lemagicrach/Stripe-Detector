"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

type Props = {
  isBusinessPlan: boolean;
  isConnected: boolean;
};

export function SlackConnectButton({ isBusinessPlan, isConnected }: Props) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleConnect() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/slack?action=start");
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Failed to start Slack OAuth");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect Slack? You'll stop receiving alerts in this workspace.")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/slack/disconnect", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Disconnect failed (${res.status})`);
      }
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
      setLoading(false);
    }
  }

  if (!isBusinessPlan) {
    return (
      <div>
        <Button variant="outline" disabled className="opacity-60">
          Connect Slack — Business plan only
        </Button>
        <p className="mt-2 text-xs text-gray-500">
          Upgrade to Business to receive real-time leak alerts in Slack.
        </p>
      </div>
    );
  }

  return (
    <div>
      {isConnected ? (
        <Button variant="outline" onClick={handleDisconnect} disabled={loading} type="button">
          {loading ? "Disconnecting…" : "Disconnect Slack"}
        </Button>
      ) : (
        <Button onClick={handleConnect} disabled={loading} type="button">
          {loading ? "Redirecting…" : "Connect Slack"}
        </Button>
      )}
      {error && (
        <p className="mt-2 rounded border border-red-700 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
