import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

/**
 * Verifies the Authorization header for cron job routes.
 *
 * Returns null if auth passes, or a 401 NextResponse if it fails.
 * Uses timing-safe comparison to prevent timing attacks.
 * Guards against undefined CRON_SECRET (which would match "Bearer undefined").
 */
export function verifyCronAuth(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[CRON_AUTH] CRON_SECRET is not set — rejecting request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;

  // Constant-time comparison to prevent timing attacks.
  // Pad both to the same length so timingSafeEqual doesn't throw,
  // then separately verify length equality to reject mismatched strings.
  try {
    const maxLen = Math.max(authHeader.length, expected.length);
    const a = Buffer.from(authHeader.padEnd(maxLen));
    const b = Buffer.from(expected.padEnd(maxLen));
    const lengthsMatch = authHeader.length === expected.length;
    const valuesMatch = timingSafeEqual(a, b);
    if (!lengthsMatch || !valuesMatch) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
