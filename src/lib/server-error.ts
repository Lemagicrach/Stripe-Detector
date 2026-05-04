import { NextResponse } from "next/server";
import { log } from "@/lib/logger";

export function handleApiError(error: unknown, context?: string): NextResponse {
  const message = error instanceof Error ? error.message : "Unknown error";

  log("error", "API error", { route: context, error });

  // Never leak internal errors to client
  return NextResponse.json(
    { error: "Internal server error", ...(process.env.NODE_ENV === "development" && { detail: message }) },
    { status: 500 }
  );
}

export function unauthorized(message = "Unauthorized"): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function rateLimited(reset?: number): NextResponse {
  const headers: Record<string, string> = {};
  if (typeof reset === "number") {
    const retryAfterSeconds = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    headers["Retry-After"] = String(retryAfterSeconds);
  }
  return NextResponse.json(
    { error: "Too many requests" },
    { status: 429, headers }
  );
}
