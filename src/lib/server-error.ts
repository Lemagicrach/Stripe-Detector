import { NextResponse } from "next/server";

export function handleApiError(error: unknown, context?: string): NextResponse {
  const message = error instanceof Error ? error.message : "Unknown error";
  const prefix = context ? `[${context}] ` : "";

  console.error(`${prefix}API Error:`, message);

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

export function rateLimited(): NextResponse {
  return NextResponse.json({ error: "Too many requests" }, { status: 429 });
}
