import { NextRequest, NextResponse } from "next/server";

// In-memory rate limiting for MVP
// For production with multiple instances, use Redis or Vercel KV
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitConfig {
  maxRequests: number; // e.g., 10
  windowMs: number; // e.g., 60000 (1 minute)
  keyExtractor?: (req: NextRequest, userId?: string) => string;
}

export async function checkRateLimit(
  request: NextRequest,
  userId: string | undefined,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  // Get IP address from headers (Vercel/Next.js 16 compatible)
  const ip = request.headers.get("x-forwarded-for") ||
             request.headers.get("x-real-ip") ||
             "unknown";

  const key = config.keyExtractor
    ? config.keyExtractor(request, userId)
    : `rate_limit:${userId || "anonymous"}:${ip}`;

  const now = Date.now();
  const record = rateLimitMap.get(key);

  // Clean expired entries
  if (record && now > record.resetAt) {
    rateLimitMap.delete(key);
  }

  const current = rateLimitMap.get(key);

  if (!current) {
    // First request in window
    rateLimitMap.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowMs,
    };
  }

  if (current.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  return {
    allowed: true,
    remaining: config.maxRequests - current.count,
    resetAt: current.resetAt,
  };
}

export function rateLimitResponse(resetAt: number) {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": retryAfter.toString(),
        "X-RateLimit-Reset": new Date(resetAt).toISOString(),
      },
    }
  );
}

// Cleanup task (run periodically to prevent memory leaks)
export function cleanupRateLimitMap() {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}

// Auto-cleanup every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(cleanupRateLimitMap, 5 * 60 * 1000);
}
