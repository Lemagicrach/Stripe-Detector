// src/lib/email-token.ts
//
// Stateless HMAC tokens for unsubscribe URLs. We sign user_id with a server-
// side secret (re-uses ENCRYPTION_KEY since it's already 64 hex chars of
// entropy and present in every environment), so the unsubscribe handler can
// verify the token without a DB lookup and without storing one-time tokens.
//
// Token format in the URL: `?u=<user_id>&t=<base64url(hmac)>`. URL-safe
// base64 = base64 with `+/=` replaced by `-_` and padding stripped.

import { createHmac, timingSafeEqual } from "crypto";

function getSecret(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be 64 hex characters (32 bytes)");
  }
  return Buffer.from(key, "hex");
}

function toBase64Url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Buffer {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  return Buffer.from(padded, "base64");
}

export function signUnsubscribeToken(userId: string): string {
  const hmac = createHmac("sha256", getSecret()).update(`unsub:${userId}`).digest();
  return toBase64Url(hmac);
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  let provided: Buffer;
  try {
    provided = fromBase64Url(token);
  } catch {
    return false;
  }
  const expected = createHmac("sha256", getSecret()).update(`unsub:${userId}`).digest();
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(provided, expected);
  } catch {
    return false;
  }
}

/** Build the absolute unsubscribe URL for a given user. */
export function buildUnsubscribeUrl(userId: string, appUrl?: string): string {
  const base = appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://corvidet.com";
  const token = signUnsubscribeToken(userId);
  return `${base}/api/email/unsubscribe?u=${encodeURIComponent(userId)}&t=${encodeURIComponent(token)}`;
}
