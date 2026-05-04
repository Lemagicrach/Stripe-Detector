import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server-clients";
import { handleApiError } from "@/lib/server-error";
import { verifyCronAuth } from "@/lib/cron-auth";
import { log } from "@/lib/logger";
import { pingHealthcheck } from "@/lib/healthcheck";

const ROUTE = "/api/cron/detect-revenue-signals";

export const maxDuration = 120;

interface Snapshot {
  mrr: number;
  churn_rate: number;
  active_customers: number;
  nrr: number;
  snapshot_date: string;
}

interface Signal {
  user_id: string;
  type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  data: Record<string, unknown>;
}

function detectSignals(
  userId: string,
  today: Snapshot,
  yesterday: Snapshot
): Signal[] {
  const signals: Signal[] = [];

  const mrrChange = today.mrr - yesterday.mrr;
  const mrrChangePct = yesterday.mrr > 0 ? mrrChange / yesterday.mrr : 0;

  if (mrrChangePct <= -0.1) {
    signals.push({
      user_id: userId,
      type: "mrr_drop",
      severity: mrrChangePct <= -0.2 ? "critical" : "warning",
      title: `MRR dropped ${(Math.abs(mrrChangePct) * 100).toFixed(1)}%`,
      description: `MRR fell from $${yesterday.mrr.toFixed(0)} to $${today.mrr.toFixed(0)} — a loss of $${Math.abs(mrrChange).toFixed(0)}.`,
      data: { previous_mrr: yesterday.mrr, current_mrr: today.mrr, change_pct: mrrChangePct },
    });
  } else if (mrrChangePct >= 0.1) {
    signals.push({
      user_id: userId,
      type: "mrr_spike",
      severity: "info",
      title: `MRR grew ${(mrrChangePct * 100).toFixed(1)}%`,
      description: `MRR rose from $${yesterday.mrr.toFixed(0)} to $${today.mrr.toFixed(0)}, adding $${mrrChange.toFixed(0)}.`,
      data: { previous_mrr: yesterday.mrr, current_mrr: today.mrr, change_pct: mrrChangePct },
    });
  }

  const churnChange = today.churn_rate - yesterday.churn_rate;
  if (churnChange >= 0.02) {
    signals.push({
      user_id: userId,
      type: "churn_spike",
      severity: churnChange >= 0.05 ? "critical" : "warning",
      title: `Churn rate jumped ${(churnChange * 100).toFixed(1)}pp`,
      description: `Monthly churn went from ${(yesterday.churn_rate * 100).toFixed(1)}% to ${(today.churn_rate * 100).toFixed(1)}%.`,
      data: { previous_churn: yesterday.churn_rate, current_churn: today.churn_rate },
    });
  }

  const customerChange = today.active_customers - yesterday.active_customers;
  if (customerChange < 0 && Math.abs(customerChange) >= 3) {
    signals.push({
      user_id: userId,
      type: "customer_loss",
      severity: Math.abs(customerChange) >= 10 ? "critical" : "warning",
      title: `Lost ${Math.abs(customerChange)} customer${Math.abs(customerChange) > 1 ? "s" : ""} today`,
      description: `Active customers dropped from ${yesterday.active_customers} to ${today.active_customers}.`,
      data: { previous_customers: yesterday.active_customers, current_customers: today.active_customers },
    });
  }

  if (today.nrr < 0.9 && yesterday.nrr >= 0.9) {
    signals.push({
      user_id: userId,
      type: "nrr_below_threshold",
      severity: "warning",
      title: "Net Revenue Retention dropped below 90%",
      description: `NRR is ${(today.nrr * 100).toFixed(1)}%, indicating contraction from existing customers.`,
      data: { nrr: today.nrr },
    });
  }

  return signals;
}

export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const HC = process.env.HC_DETECT_SIGNALS_URL;
  await pingHealthcheck(HC, "start");

  try {
    const admin = getSupabaseAdminClient();

    const { data: connections } = await admin
      .from("stripe_connections")
      .select("id, user_id")
      .eq("status", "active");

    if (!connections?.length) {
      await pingHealthcheck(HC);
      return NextResponse.json({ success: true, processed: 0 });
    }

    let processed = 0;
    let signalsCreated = 0;

    for (const conn of connections) {
      try {
        // Fetch the two most recent snapshots for this connection
        const { data: snapshots } = await admin
          .from("metrics_snapshots")
          .select("mrr, churn_rate, active_customers, nrr, snapshot_date")
          .eq("connection_id", conn.id)
          .order("snapshot_date", { ascending: false })
          .limit(2);

        if (!snapshots || snapshots.length < 2) continue;

        const [today, yesterday] = snapshots as [Snapshot, Snapshot];
        const signals = detectSignals(conn.user_id, today, yesterday);

        if (signals.length > 0) {
          await admin.from("revenue_signals").insert(
            signals.map((s) => ({
              user_id: s.user_id,
              type: s.type,
              severity: s.severity,
              title: s.title,
              description: s.description,
              data: s.data,
            }))
          );
          signalsCreated += signals.length;
        }

        processed++;
      } catch (err) {
        log("error", "Cron iteration failed", { route: ROUTE, connectionId: conn.id, error: err });
      }
    }

    await pingHealthcheck(HC);
    return NextResponse.json({ success: true, processed, signalsCreated });
  } catch (error) {
    await pingHealthcheck(HC, "fail");
    return handleApiError(error, "CRON_SIGNALS");
  }
}
