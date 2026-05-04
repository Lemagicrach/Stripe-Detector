// src/lib/logger.ts
//
// Structured JSON logger. Emits a single-line JSON object per call so logs
// stay parseable in Vercel/Datadog without extra plumbing. Errors logged at
// "error" level are also forwarded to Sentry as captured exceptions so they
// appear in the Sentry issue tracker alongside auto-captured uncaught errors.
//
// Usage:
//   import { log } from "@/lib/logger";
//   log("error", "Quota RPC failed", { route: "/api/ai/copilot", userId, error });
//
// `error` keys are normalized so Error instances keep their stack trace
// (JSON.stringify drops Error.message / Error.stack by default since they're
// non-enumerable).

import * as Sentry from "@sentry/nextjs";

type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown> & {
  route?: string;
  userId?: string;
  errorCode?: string;
  error?: unknown;
};

function normalizeError(err: unknown): unknown {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return err;
}

export function log(level: LogLevel, msg: string, ctx: LogContext = {}): void {
  const { error, ...rest } = ctx;
  const entry: Record<string, unknown> = {
    level,
    msg,
    ts: new Date().toISOString(),
    ...rest,
  };
  if (error !== undefined) {
    entry.error = normalizeError(error);
  }
  // eslint-disable-next-line no-console
  console[level === "debug" ? "log" : level](JSON.stringify(entry));

  if (level === "error") {
    const captureCtx = {
      tags: {
        route: typeof rest.route === "string" ? rest.route : undefined,
        errorCode: typeof rest.errorCode === "string" ? rest.errorCode : undefined,
      },
      user: typeof rest.userId === "string" ? { id: rest.userId } : undefined,
      extra: rest,
    };
    if (error instanceof Error) {
      Sentry.captureException(error, captureCtx);
    } else {
      Sentry.captureMessage(msg, { ...captureCtx, level: "error" });
    }
  }
}
