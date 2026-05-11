// src/app/api/debug/error/route.ts
//
// TEMPORARY — Sentry validation route. Throws an uncaught error so the Next.js
// Sentry integration forwards it to the Sentry dashboard. Use this exactly
// once after a fresh production deploy to confirm the DSN is wired correctly,
// then DELETE this file.
//
// Production safety: blocked unless DEBUG_ROUTES=1. The 404 hides the route's
// existence from random probes.
//
// Note: the folder is named `debug` (not `_debug`) because Next.js App Router
// treats any folder prefixed with `_` as a "private folder" excluded from
// routing entirely. The env gate below is what actually hides the route.
//
// To run the test in production:
//   1. Set env var DEBUG_ROUTES=1 in Vercel (Production scope).
//   2. Redeploy.
//   3. curl https://corvidet.com/api/debug/error  →  expect 500.
//   4. Confirm the exception appears in Sentry within ~30s.
//   5. Unset DEBUG_ROUTES and delete this file.

import { NextResponse } from "next/server";

export async function GET() {
  if (process.env.NODE_ENV === "production" && process.env.DEBUG_ROUTES !== "1") {
    return new NextResponse("Not found", { status: 404 });
  }

  throw new Error("Sentry validation: deliberate test exception from /api/debug/error");
}
