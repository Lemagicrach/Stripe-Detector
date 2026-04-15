"use client";

import Link from "next/link";
import { startTransition, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ExternalLink,
  Mail,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AUDIT_MRR_BAND_LABELS,
  AUDIT_STATUS_LABELS,
  isAuditRequestActive,
  type AuditRequestRow,
  type AuditRequestStatus,
} from "@/lib/audit-requests";

type BreakdownItem = {
  label: string;
  count: number;
  share: number;
};

type DraftState = Record<
  string,
  {
    status: AuditRequestStatus;
    adminNotes: string;
  }
>;

type MessageState = Record<
  string,
  {
    type: "error" | "success";
    text: string;
  }
>;

type SavingState = Record<string, boolean>;

type GrowthDashboardClientProps = {
  initialRequests: AuditRequestRow[];
  totalRequests: number;
  requestsLastSevenDays: number;
  requestsLastThirtyDays: number;
};

const STATUS_VARIANTS: Record<
  AuditRequestStatus,
  "default" | "secondary" | "destructive" | "warning" | "info" | "success" | "outline"
> = {
  requested: "outline",
  qualified: "info",
  contacted: "secondary",
  booked: "warning",
  connected: "success",
  won: "success",
  lost: "destructive",
};

const WORKFLOW_ACTIONS: Array<{
  label: string;
  status: AuditRequestStatus;
  touchLastContactedAt?: boolean;
}> = [
  { label: "Qualify", status: "qualified" },
  { label: "Mark contacted", status: "contacted", touchLastContactedAt: true },
  { label: "Book call", status: "booked", touchLastContactedAt: true },
  { label: "Connected", status: "connected", touchLastContactedAt: true },
  { label: "Won", status: "won", touchLastContactedAt: true },
  { label: "Lost", status: "lost", touchLastContactedAt: true },
];

function buildBreakdown(rows: AuditRequestRow[], selectValue: (row: AuditRequestRow) => string, limit = 5) {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const label = selectValue(row).trim() || "Direct / unknown";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const total = rows.length || 1;
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({
      label,
      count,
      share: (count / total) * 100,
    }));
}

function extractReferrerHost(referrer: string | null) {
  if (!referrer) return "";

  try {
    return new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return referrer;
  }
}

function formatRequestedAt(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatLastContactedAt(value: string | null) {
  if (!value) return "No follow-up logged";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function buildInitialDrafts(rows: AuditRequestRow[]): DraftState {
  return Object.fromEntries(
    rows.map((row) => [
      row.id,
      {
        status: row.status,
        adminNotes: row.admin_notes || "",
      },
    ])
  );
}

function SourceList({ items }: { items: BreakdownItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-500">No attribution data yet.</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-medium text-gray-200">{item.label}</p>
            <span className="text-xs text-gray-400">
              {item.count} ({item.share.toFixed(0)}%)
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-800">
            <div
              className="h-2 rounded-full bg-blue-500"
              style={{ width: `${Math.max(item.share, 6)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function getWebsiteLabel(website: string | null) {
  if (!website) return "No website provided";
  return website;
}

export function GrowthDashboardClient({
  initialRequests,
  totalRequests,
  requestsLastSevenDays,
  requestsLastThirtyDays,
}: GrowthDashboardClientProps) {
  const [requests, setRequests] = useState(initialRequests);
  const [drafts, setDrafts] = useState<DraftState>(() => buildInitialDrafts(initialRequests));
  const [messages, setMessages] = useState<MessageState>({});
  const [savingIds, setSavingIds] = useState<SavingState>({});

  const activePipeline = requests.filter((request) => isAuditRequestActive(request.status)).length;
  const sourceBreakdown = buildBreakdown(
    requests,
    (request) => request.utm_source || extractReferrerHost(request.referrer) || "Direct / unknown"
  );
  const campaignBreakdown = buildBreakdown(
    requests,
    (request) => request.utm_campaign || request.utm_medium || "No campaign set"
  );
  const variantBreakdown = buildBreakdown(
    requests,
    (request) => request.landing_variant || "stripe-b2b-saas-audit"
  );

  function updateDraft(
    requestId: string,
    patch: Partial<{
      status: AuditRequestStatus;
      adminNotes: string;
    }>
  ) {
    setDrafts((current) => ({
      ...current,
      [requestId]: {
        status: patch.status ?? current[requestId]?.status ?? "requested",
        adminNotes: patch.adminNotes ?? current[requestId]?.adminNotes ?? "",
      },
    }));
  }

  async function patchRequest(
    requestId: string,
    payload: {
      status?: AuditRequestStatus;
      adminNotes?: string;
      touchLastContactedAt?: boolean;
    },
    successText: string
  ) {
    setSavingIds((current) => ({ ...current, [requestId]: true }));
    setMessages((current) => {
      const next = { ...current };
      delete next[requestId];
      return next;
    });

    try {
      const response = await fetch(`/api/audit-requests/${encodeURIComponent(requestId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as {
        error?: string;
        request?: AuditRequestRow;
      };

      if (!response.ok || !result.request) {
        throw new Error(result.error ?? "Failed to update request");
      }

      startTransition(() => {
        setRequests((current) =>
          current.map((request) => (request.id === requestId ? result.request! : request))
        );
        setDrafts((current) => ({
          ...current,
          [requestId]: {
            status: result.request!.status,
            adminNotes: result.request!.admin_notes || "",
          },
        }));
        setMessages((current) => ({
          ...current,
          [requestId]: {
            type: "success",
            text: successText,
          },
        }));
      });
    } catch (error) {
      setMessages((current) => ({
        ...current,
        [requestId]: {
          type: "error",
          text: error instanceof Error ? error.message : "Failed to update request",
        },
      }));
    } finally {
      setSavingIds((current) => ({ ...current, [requestId]: false }));
    }
  }

  function handleSaveChanges(requestId: string) {
    const draft = drafts[requestId];
    if (!draft) return;

    void patchRequest(
      requestId,
      {
        status: draft.status,
        adminNotes: draft.adminNotes,
      },
      "Request updated"
    );
  }

  function handleWorkflowAction(requestId: string, status: AuditRequestStatus, touchLastContactedAt = false) {
    updateDraft(requestId, { status });
    void patchRequest(
      requestId,
      {
        status,
        touchLastContactedAt,
      },
      `Lead moved to ${AUDIT_STATUS_LABELS[status].toLowerCase()}`
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Growth Attribution</h1>
          <p className="mt-1 text-sm text-gray-400">
            Track which audit campaigns, referrers, and landing variants are producing qualified pipeline.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/audit"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
          >
            <ExternalLink className="h-4 w-4" />
            Open audit funnel
          </Link>
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
          >
            <Target className="h-4 w-4" />
            View demo
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total requests</CardDescription>
            <CardTitle className="text-3xl">{totalRequests}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-gray-500">All captured audit requests in Supabase.</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Last 30 days</CardDescription>
            <CardTitle className="text-3xl">{requestsLastThirtyDays}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-gray-500">Recent demand generation momentum.</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Last 7 days</CardDescription>
            <CardTitle className="text-3xl">{requestsLastSevenDays}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-gray-500">What your current week is producing.</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active pipeline</CardDescription>
            <CardTitle className="text-3xl">{activePipeline}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-gray-500">Recent requests not yet marked won or lost.</CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-blue-400" />
              Top sources
            </CardTitle>
            <CardDescription>UTM source first, referrer host as fallback.</CardDescription>
          </CardHeader>
          <CardContent>
            <SourceList items={sourceBreakdown} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              Top campaigns
            </CardTitle>
            <CardDescription>Campaign or medium driving audit requests.</CardDescription>
          </CardHeader>
          <CardContent>
            <SourceList items={campaignBreakdown} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-amber-400" />
              Landing variants
            </CardTitle>
            <CardDescription>Which funnel entry points are getting traction.</CardDescription>
          </CardHeader>
          <CardContent>
            <SourceList items={variantBreakdown} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Recent audit requests</CardTitle>
            <CardDescription>
              Showing the most recent {requests.length} request{requests.length === 1 ? "" : "s"}
              {totalRequests > requests.length ? ` out of ${totalRequests}` : ""}.
            </CardDescription>
          </div>
          <Badge variant="outline">{requests.length ? "Live pipeline" : "No requests yet"}</Badge>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-700 bg-gray-950/50 p-10 text-center text-sm text-gray-400">
              Submit your first request from the public audit page to start tracking channel performance.
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request, index) => {
                const draft = drafts[request.id] ?? {
                  status: request.status,
                  adminNotes: request.admin_notes || "",
                };
                const message = messages[request.id];
                const isSaving = savingIds[request.id] ?? false;

                return (
                  <div key={request.id} className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
                    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr_auto]">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-white">{request.company}</p>
                          <Badge variant={STATUS_VARIANTS[request.status]}>{AUDIT_STATUS_LABELS[request.status]}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-gray-400">
                          {request.name} - {AUDIT_MRR_BAND_LABELS[request.mrr_band]}
                        </p>
                        <p className="mt-2 line-clamp-2 text-sm text-gray-500">{request.biggest_leak}</p>
                      </div>

                      <div className="space-y-1 text-sm">
                        <p className="text-gray-500">Attribution</p>
                        <p className="text-gray-200">
                          {request.utm_source || extractReferrerHost(request.referrer) || "Direct / unknown"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {request.utm_campaign || request.utm_medium || request.landing_variant}
                        </p>
                      </div>

                      <div className="space-y-1 text-sm">
                        <p className="flex items-center gap-2 text-gray-500">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatRequestedAt(request.requested_at)}
                        </p>
                        <p className="text-gray-500">{getWebsiteLabel(request.website)}</p>
                        <p className="flex items-center gap-2 text-gray-500">
                          <Clock3 className="h-3.5 w-3.5" />
                          {formatLastContactedAt(request.last_contacted_at)}
                        </p>
                      </div>

                      <div className="flex items-start justify-end">
                        <a
                          href={`mailto:${request.work_email}?subject=Corvidet audit follow-up for ${encodeURIComponent(request.company)}`}
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
                        >
                          <Mail className="h-4 w-4" />
                          Email
                        </a>
                      </div>
                    </div>

                    <details className="mt-4 rounded-xl border border-gray-800 bg-[#101827]" open={index === 0}>
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-gray-200 [&::-webkit-details-marker]:hidden">
                        <span className="inline-flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          Manage qualification workflow
                        </span>
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      </summary>

                      <div className="grid gap-4 border-t border-gray-800 px-4 py-4 xl:grid-cols-[1.1fr_0.9fr]">
                        <div className="space-y-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                              Quick stage moves
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {WORKFLOW_ACTIONS.map((action) => (
                                <Button
                                  key={action.status}
                                  type="button"
                                  variant={draft.status === action.status ? "default" : "outline"}
                                  size="sm"
                                  disabled={isSaving}
                                  onClick={() =>
                                    handleWorkflowAction(
                                      request.id,
                                      action.status,
                                      action.touchLastContactedAt
                                    )
                                  }
                                >
                                  {action.label}
                                </Button>
                              ))}
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                            <label className="space-y-2">
                              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                                Status
                              </span>
                              <select
                                value={draft.status}
                                onChange={(event) =>
                                  updateDraft(request.id, {
                                    status: event.target.value as AuditRequestStatus,
                                  })
                                }
                                className="h-10 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 text-sm text-gray-100 outline-none transition-colors focus:border-blue-500"
                              >
                                {Object.entries(AUDIT_STATUS_LABELS).map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <Button
                              type="button"
                              variant="outline"
                              disabled={isSaving}
                              onClick={() => handleSaveChanges(request.id)}
                            >
                              Save changes
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                              Admin notes
                            </span>
                            <textarea
                              value={draft.adminNotes}
                              onChange={(event) =>
                                updateDraft(request.id, {
                                  adminNotes: event.target.value,
                                })
                              }
                              rows={5}
                              maxLength={2000}
                              className="w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-3 text-sm text-gray-100 outline-none transition-colors placeholder:text-gray-500 focus:border-blue-500"
                              placeholder="Add qualification context, objections, next step, or owner notes."
                            />
                          </label>

                          <div className="flex items-center justify-between gap-3">
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={isSaving}
                              onClick={() =>
                                patchRequest(
                                  request.id,
                                  {
                                    adminNotes: draft.adminNotes,
                                  },
                                  "Notes saved"
                                )
                              }
                            >
                              Save notes
                            </Button>

                            {message ? (
                              <p
                                className={`text-xs ${
                                  message.type === "error" ? "text-red-400" : "text-emerald-400"
                                }`}
                              >
                                {message.text}
                              </p>
                            ) : (
                              <p className="text-xs text-gray-500">
                                {isSaving ? "Saving..." : "Changes stay inside this lead record."}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </details>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
