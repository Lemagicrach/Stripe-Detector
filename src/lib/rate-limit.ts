// src/lib/rate-limit.ts
//
// Upstash Redis-backed rate limiting. Replaces the previous in-memory Map
// implementation that reset on every cold start, providing zero protection
// across serverless instances. All limiters use sliding-window semantics.
//
// Failure mode: fail-open. If Upstash is unreachable (network blip, regional
// outage, missing env vars), we log the error and allow the request through.
// The rate limit is one defensive layer — Anthropic billing, Stripe rate
// limits, and per-plan AI quota provide additional checks downstream.

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type LimitResult = {
  success: boolean;
  /** Unix timestamp (ms) when the limit window resets. */
  reset: number;
  /** Remaining requests in the current window. */
  remaining: number;
};

const FAIL_OPEN_RESULT: LimitResult = {
  success: true,
  reset: Date.now() + 60_000,
  remaining: 0,
};

let redis: Redis | null = null;
try {
  redis = Redis.fromEnv();
} catch (err) {
  console.error("[RATE_LIMIT] Redis.fromEnv() failed; rate limiting disabled (fail-open)", err);
}

function makeLimiter(
  tokens: number,
  window: `${number} ${"s" | "m" | "h"}`,
  prefix: string
): Ratelimit | null {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    prefix,
    analytics: false,
  });
}

export const rateLimiters = {
  /** AI routes (copilot, analyze): 10 req/min per user. */
  ai:         makeLimiter(10,  "1 m", "rl:ai"),
  /** Heavy scan/analyze routes: 5 req per 5 min per user. */
  scan:       makeLimiter(5,   "5 m", "rl:scan"),
  /** Default for authed mutations not explicitly covered: 60/min per user. */
  default:    makeLimiter(60,  "1 m", "rl:def"),
  /** Public unauthenticated forms (audit-request etc.): 5/hour per IP. */
  formPublic: makeLimiter(5,   "1 h", "rl:form"),
  /** Webhook receivers: 100/min per source. Reserved for future use. */
  webhook:    makeLimiter(100, "1 m", "rl:wh"),
} as const;

export type RateLimiterKey = keyof typeof rateLimiters;

/**
 * Check the rate limit for a given key against a chosen limiter. Returns the
 * Upstash result on success, or a fail-open success result on Redis failure.
 *
 * @param limiterKey  Which bucket to charge against (ai, scan, default, ...)
 * @param identifier  The per-caller key — typically `user.id`, falling back to
 *                    the client IP (`x-forwarded-for`) for unauthenticated
 *                    routes. Never use a global string like `"ai"` — that
 *                    rate-limits the whole product to one bucket.
 */
export async function checkRateLimit(
  limiterKey: RateLimiterKey,
  identifier: string
): Promise<LimitResult> {
  const limiter = rateLimiters[limiterKey];
  if (!limiter) return FAIL_OPEN_RESULT;

  try {
    const result = await limiter.limit(identifier);
    return {
      success: result.success,
      reset: result.reset,
      remaining: result.remaining,
    };
  } catch (err) {
    console.error(`[RATE_LIMIT] ${limiterKey} limit() failed for ${identifier}; failing open`, err);
    return FAIL_OPEN_RESULT;
  }
}

/**
 * Extract a stable client identifier from a request. Use as the `identifier`
 * argument to {@link checkRateLimit} for unauthenticated routes, or as a
 * fallback when no `user.id` is available.
 */
export function clientIdentifier(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  const real = req.headers.get("x-real-ip");
  return (fwd?.split(",")[0] ?? real ?? "anon").trim() || "anon";
}
