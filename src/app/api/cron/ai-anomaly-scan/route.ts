import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdminClient } from "@/lib/server-clients";
import { handleApiError } from "@/lib/server-error";
import { verifyCronAuth } from "@/lib/cron-auth";

export const maxDuration = 300;

interface AnomalySignal {
  type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
}

async function analyzeWithAI(
  snapshots: Array<Record<string, unknown>>
): Promise<AnomalySignal[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[CRON_AI_ANOMALY] ANTHROPIC_API_KEY not set — skipping AI analysis");
    return [];
  }

  const client = new Anthropic({ apiKey });

  const prompt = `You are a SaaS revenue analyst. Analyze the following metrics snapshots (most recent first) and identify anomalies or concerning trends.

Metrics history (last ${snapshots.length} days):
${JSON.stringify(snapshots, null, 2)}

Return a JSON array of anomalies. Each item must have:
- type: snake_case identifier (e.g. "mrr_volatility", "churn_acceleration")
- severity: "info" | "warning" | "critical"
- title: short title (max 80 chars)
- description: 1-2 sentence explanation with specific numbers

If no anomalies are detected, return an empty array [].
Return only valid JSON, no markdown, no explanation outside the array.`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") return [];

  try {
    const parsed = JSON.parse(content.text.trim());
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is AnomalySignal =>
        typeof item.type === "string" &&
        ["info", "warning", "critical"].includes(item.severity) &&
        typeof item.title === "string" &&
        typeof item.description === "string"
    );
  } catch {
    console.error("[CRON_AI_ANOMALY] Failed to parse AI response:", content.text);
    return [];
  }
}

export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    const admin = getSupabaseAdminClient();

    const { data: connections } = await admin
      .from("stripe_connections")
      .select("id, user_id")
      .eq("status", "active");

    if (!connections?.length) {
      return NextResponse.json({ success: true, processed: 0 });
    }

    let processed = 0;
    let signalsCreated = 0;

    for (const conn of connections) {
      try {
        // Get the last 14 days of snapshots for trend analysis
        const { data: snapshots } = await admin
          .from("metrics_snapshots")
          .select("mrr, arr, churn_rate, active_customers, nrr, arpu, new_mrr, churned_mrr, snapshot_date")
          .eq("connection_id", conn.id)
          .order("snapshot_date", { ascending: false })
          .limit(14);

        if (!snapshots || snapshots.length < 3) continue;

        const anomalies = await analyzeWithAI(snapshots);

        if (anomalies.length > 0) {
          await admin.from("revenue_signals").insert(
            anomalies.map((a) => ({
              user_id: conn.user_id,
              type: `ai_${a.type}`,
              severity: a.severity,
              title: a.title,
              description: a.description,
              data: { source: "ai_anomaly_scan", connection_id: conn.id },
            }))
          );
          signalsCreated += anomalies.length;
        }

        processed++;
      } catch (err) {
        console.error(`[CRON_AI_ANOMALY] Failed for connection ${conn.id}:`, err);
      }
    }

    return NextResponse.json({ success: true, processed, signalsCreated });
  } catch (error) {
    return handleApiError(error, "CRON_AI_ANOMALY");
  }
}
