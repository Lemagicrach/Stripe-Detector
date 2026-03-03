const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

interface RateLimitOptions {
  key: string;
  limit?: number;
  windowMs?: number;
}

export function checkRateLimit({ key, limit = 60, windowMs = 60_000 }: RateLimitOptions): {
  allowed: boolean;
  remaining: number;
} {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count };
}
