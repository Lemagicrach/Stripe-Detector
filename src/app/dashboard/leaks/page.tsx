"use client";

import { useState, useCallback } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Loader2, ScanLine, CheckCircle } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type Leak = {
  id: string;
  title: string;
  description: string;
  severity: string;
  category: string;
  lostRevenue: number;
  recoverableRevenue: number;
  affectedCustomers: string[];
  fixSteps: string[];
};

type ScanResult = {
  leakScore: number;
  totalLeaks: number;
  totalLostRevenue: number;
  totalRecoverableRevenue: number;
  leaks: Leak[];
  scannedAt: string;
};

const SEVERITY_VARIANT: Record<string, "destructive" | "warning" | "info"> = {
  critical: "destructive",
  warning: "warning",
  info: "info",
};

const SEVERITY_PROGRESS_COLOR: Record<string, string> = {
  critical: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-blue-500",
};

const SEVERITY_ICON_COLOR: Record<string, string> = {
  critical: "text-red-400",
  warning: "text-amber-400",
  info: "text-blue-400",
};

function LeakCard({ leak }: { leak: Leak }) {
  const [open, setOpen] = useState(false);
  const progressColor = SEVERITY_PROGRESS_COLOR[leak.severity] ?? SEVERITY_PROGRESS_COLOR.info;
  const iconColor = SEVERITY_ICON_COLOR[leak.severity] ?? SEVERITY_ICON_COLOR.info;
  const severityValue = leak.severity === "critical" ? 90 : leak.severity === "warning" ? 55 : 25;

  return (
    <Card className={`border-${leak.severity === "critical" ? "red" : leak.severity === "warning" ? "amber" : "blue"}-500/20`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-4 p-5 text-left"
      >
        <div className="mt-0.5 shrink-0">
          <AlertTriangle className={`h-4 w-4 ${iconColor}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={SEVERITY_VARIANT[leak.severity] ?? "info"}>
              {leak.severity}
            </Badge>
            <span className="text-xs text-gray-500">{leak.category}</span>
          </div>
          <p className="mt-1 text-sm font-semibold text-white">{leak.title}</p>
          <p className="mt-1 text-xs text-gray-400 leading-relaxed">{leak.description}</p>
          <div className="mt-3">
            <Progress
              value={severityValue}
              className="h-1.5"
              style={
                { "--progress-color": leak.severity === "critical" ? "#ef4444" : leak.severity === "warning" ? "#f59e0b" : "#3b82f6" } as React.CSSProperties
              }
            />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-6 text-sm">
          <div className="text-right">
            <p className="font-mono font-semibold text-red-300">-${leak.lostRevenue.toLocaleString()}</p>
            <p className="text-xs text-gray-500">lost/mo</p>
          </div>
          <div className="text-right">
            <p className="font-mono font-semibold text-emerald-300">+${leak.recoverableRevenue.toLocaleString()}</p>
            <p className="text-xs text-gray-500">recoverable</p>
          </div>
          {open ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-800 px-5 pb-5 pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Fix steps</p>
          <ol className="space-y-3">
            {leak.fixSteps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-400">
                  {i + 1}
                </span>
                <span className="text-sm text-gray-300 leading-relaxed pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
          {leak.affectedCustomers.length > 0 && (
            <p className="mt-4 text-xs text-gray-500">
              {leak.affectedCustomers.length} affected customer
              {leak.affectedCustomers.length > 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

function ScanSkeleton() {
  return (
    <div className="space-y-3">
      {[
        "Syncing Stripe subscriptions...",
        "Checking failed payments...",
        "Scanning expiring cards...",
        "Detecting zombie subscriptions...",
      ].map((step, i) => (
        <Card key={i} className="px-5 py-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-blue-400 shrink-0" />
            <span className="text-sm text-gray-400">{step}</span>
            <Skeleton className="ml-auto h-3 w-24" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function LeaksPage() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runScan = useCallback(async () => {
    setScanning(true);
    setError(null);
    try {
      const res = await fetch("/api/leaks/run-scan", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Scan failed");
        return;
      }
      setResult(data);
    } catch {
      setError("Network error - check your connection.");
    } finally {
      setScanning(false);
    }
  }, []);

  const scoreColor = result
    ? result.leakScore >= 70
      ? "text-emerald-400"
      : result.leakScore >= 40
      ? "text-amber-400"
      : "text-red-400"
    : "text-gray-400";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Revenue Leak Scanner</h1>
          <p className="mt-1 text-sm text-gray-400">
            Find and fix the revenue your Stripe account is silently losing
          </p>
        </div>
        <Button onClick={runScan} disabled={scanning} size="default">
          {scanning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Scanning...
            </>
          ) : (
            <>
              <ScanLine className="h-4 w-4" /> Run Leak Scan
            </>
          )}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Scan failed</AlertTitle>
          <AlertDescription>
            {error}{" "}
            {error.includes("Connect") && (
              <Link href="/dashboard/connect" className="underline font-medium">
                Connect Stripe â†'
              </Link>
            )}
          </AlertDescription>
        </Alert>
      )}

      {result && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="p-5 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Leak Risk Score</p>
            <p className={`mt-2 font-mono text-4xl font-bold ${scoreColor}`}>{result.leakScore}</p>
            <p className="mt-1 text-xs text-gray-500">out of 100</p>
          </Card>
          <Card className="border-red-900/30 bg-red-500/5 p-5 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-red-400">Lost / mo</p>
            <p className="mt-2 font-mono text-4xl font-bold text-red-300">
              ${result.totalLostRevenue.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-red-400/60">
              {result.totalLeaks} leak{result.totalLeaks !== 1 ? "s" : ""} detected
            </p>
          </Card>
          <Card className="border-emerald-900/30 bg-emerald-500/5 p-5 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">Recoverable</p>
            <p className="mt-2 font-mono text-4xl font-bold text-emerald-300">
              ${result.totalRecoverableRevenue.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-emerald-400/60">with the fix steps below</p>
          </Card>
        </div>
      )}

      {result && result.leaks.length === 0 && (
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <CheckCircle className="h-10 w-10 text-emerald-400" />
            <p className="font-semibold text-emerald-300">No revenue leaks detected</p>
            <p className="text-sm text-gray-400">
              Your Stripe account looks clean. Check back after your next billing cycle.
            </p>
          </CardContent>
        </Card>
      )}

      {result && result.leaks.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            {result.leaks.length} issue{result.leaks.length > 1 ? "s" : ""} found - click any to see fix steps
          </p>
          {result.leaks.map((leak) => (
            <LeakCard key={leak.id} leak={leak} />
          ))}
        </div>
      )}

      {!result && !scanning && !error && (
        <Card className="border-dashed border-gray-700 bg-gray-900/50">
          <CardContent className="py-16 text-center">
            <ScanLine className="mx-auto h-10 w-10 text-gray-600" />
            <p className="mt-3 text-sm text-gray-400">
              Click <strong className="text-white">Run Leak Scan</strong> to analyse your Stripe account in real time.
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Checks failed payments, expiring cards, pending cancels, and zombie subs.
            </p>
          </CardContent>
        </Card>
      )}

      {scanning && <ScanSkeleton />}
    </div>
  );
}
