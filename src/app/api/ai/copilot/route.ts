// src/app/api/ai/copilot/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/server-clients";
import { handleApiError, unauthorized, badRequest } from "@/lib/server-error";
import { checkRateLimit } from "@/lib/rate-limit";
import { PLAN_LIMITS, type PlanTier } from "@/lib/stripe";

type CurrentMetrics = {
  mrr: number;
  arr: number;
  active_customers: number;
  arpu: number;
  churn_rate: number;
  nrr: number;
};

type MrrHistoryPoint = {
  snapshot_date: string;
  mrr: number;
};

type RevenueLeak = {
  category: string;
  severity: string;
  title: string;
  lost_revenue: number;
  recoverable_revenue: number;
  status: string;
};

type RecoveryEvent = {
  category: string;
  amount: number;
  recovered_at: string;
};

type CopilotContext = {
  currentMetrics: CurrentMetrics | null;
  mrrHistory: MrrHistoryPoint[];
  recentLeaks: RevenueLeak[];
  recentRecoveries: RecoveryEvent[];
};

async function assembleContext(userId: string, connectionId: string) {
  const admin = getSupabaseAdminClient();
  const [metricsRes, historyRes, leaksRes, recoveriesRes] = await Promise.all([
    admin.from("metrics_snapshots").select("*")
      .eq("connection_id", connectionId).order("snapshot_date", { ascending: false }).limit(1),
    admin.from("metrics_snapshots").select("snapshot_date, mrr")
      .eq("connection_id", connectionId).order("snapshot_date", { ascending: false }).limit(30),
    admin.from("revenue_leaks").select("category, severity, title, lost_revenue, recoverable_revenue, status")
      .eq("connection_id", connectionId).order("detected_at", { ascending: false }).limit(15),
    admin.from("recovery_events").select("category, amount, recovered_at")
      .eq("connection_id", connectionId).order("recovered_at", { ascending: false }).limit(10),
  ]);

  return {
    currentMetrics: ((metricsRes.data as unknown as CurrentMetrics[] | null)?.[0] ?? null),
    mrrHistory: (historyRes.data as unknown as MrrHistoryPoint[] | null) ?? [],
    recentLeaks: (leaksRes.data as unknown as RevenueLeak[] | null) ?? [],
    recentRecoveries: (recoveriesRes.data as unknown as RecoveryEvent[] | null) ?? [],
  };
}

function buildSystemPrompt(context: CopilotContext) {
  const m = context.currentMetrics;
  const parts = ["You are Corvidet AI, a Stripe revenue copilot. Be concise, data-driven, and action-oriented."];

  if (m) {
    parts.push(`\nCurrent Metrics:\n- MRR: $${m.mrr}\n- ARR: $${m.arr}\n- Active Customers: ${m.active_customers}\n- ARPU: $${m.arpu}\n- Churn Rate: ${(m.churn_rate * 100).toFixed(2)}%\n- NRR: ${(m.nrr * 100).toFixed(1)}%`);
  }

  if (context.mrrHistory.length > 1) {
    const trend = context.mrrHistory.map((h) => `${h.snapshot_date}: $${h.mrr}`).join(", ");
    parts.push(`\nMRR Trend (30d): ${trend}`);
  }

  if (context.recentLeaks.length > 0) {
    const leakLines = context.recentLeaks.map(
      (l) => `- [${l.severity}] ${l.title}: $${l.lost_revenue} lost, $${l.recoverable_revenue} recoverable (${l.status})`
    );
    parts.push(`\nDetected Revenue Leaks:\n${leakLines.join("\n")}`);
  }

  if (context.recentRecoveries.length > 0) {
    const total = context.recentRecoveries.reduce((s, r) => s + (r.amount || 0), 0);
    parts.push(`\nRecovered Revenue: $${total.toFixed(0)} in the last 30 days`);
  }

  parts.push("\nRules:\n- Always be specific with dollar amounts and customer counts\n- Prioritize advice by dollar impact\n- Keep answers concise (3-4 bullet points max)\n- Suggest concrete, actionable next steps");

  return parts.join("\n");
}

export async function POST(req: NextRequest) {
  try {
    // Burst rate limit (global) â€” prevents API abuse regardless of plan
    const { allowed } = checkRateLimit({ key: "ai-copilot", limit: 20, windowMs: 60_000 });
    if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return unauthorized();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return badRequest("AI copilot not configured");

    const body = await req.json();
    const { message, chatHistory } = body;
    if (!message) return badRequest("message is required");

    const admin = getSupabaseAdminClient();

    // â”€â”€ Per-plan monthly AI query enforcement â”€â”€
    const { data: profileRaw } = await admin
      .from("user_profiles")
      .select("plan")
      .eq("id", user.id)
      .single();
    const plan = ((profileRaw as { plan?: string } | null)?.plan ?? "free") as PlanTier;
    const limit = PLAN_LIMITS[plan]?.aiQueriesPerMonth ?? PLAN_LIMITS.free.aiQueriesPerMonth;

    // Count AI queries used this calendar month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: usedThisMonth } = await admin
      .from("usage_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("event_type", "ai_query")
      .gte("created_at", startOfMonth.toISOString());

    const used = usedThisMonth ?? 0;
    if (used >= limit) {
      return NextResponse.json(
        {
          error: "Monthly AI query limit reached",
          plan,
          limit,
          used,
          upgradeUrl: "/dashboard/billing",
        },
        { status: 402 }
      );
    }

    // Track this query before calling the API (fail-open on insert error)
    void admin.from("usage_events").insert({
      user_id: user.id,
      event_type: "ai_query",
      metadata: { plan, used: used + 1, limit },
    });

    const { data: connectionRaw } = await admin
      .from("stripe_connections").select("id")
      .eq("user_id", user.id).eq("status", "active").limit(1).single();
    const connection = connectionRaw as unknown as { id: string } | null;

    const context = connection
      ? await assembleContext(user.id, connection.id)
      : { currentMetrics: null, mrrHistory: [], recentLeaks: [], recentRecoveries: [] };

    const systemPrompt = buildSystemPrompt(context);

    const messages: Array<{ role: string; content: string }> = [];
    if (chatHistory?.length) {
      for (const turn of chatHistory.slice(-10)) {
        messages.push({ role: turn.role, content: turn.content });
      }
    }
    messages.push({ role: "user", content: message });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4096,
        system: systemPrompt,
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Claude API error:", response.status, errBody);
      return NextResponse.json({ error: "AI service error" }, { status: 502 });
    }

    // Proxy SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) { controller.enqueue(encoder.encode("data: [DONE]\n\n")); controller.close(); break; }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === "content_block_delta" && data.delta?.text) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: data.delta.text })}\n\n`));
                } else if (data.type === "message_stop") {
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                }
              } catch { /* skip non-JSON lines */ }
            }
          }
        }
      },
    });

    return new NextResponse(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  } catch (error) {
    return handleApiError(error, "AI_COPILOT");
  }
}
