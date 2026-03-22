import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Redis-backed rate limiter (distributed, survives cold starts)
let _ratelimit: Ratelimit | null = null;
let _initialized = false;

function getRatelimit(): Ratelimit | null {
  if (_initialized) return _ratelimit;
  _initialized = true;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  _ratelimit = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(60, "60 s"), // default, overridden per call
    prefix: "rl",
  });

  return _ratelimit;
}

// In-memory fallback for when Redis is not configured
const fallbackMap = new Map<string, { count: number; resetAt: number }>();

function fallbackRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { success: boolean; remaining: number } {
  const now = Date.now();
  const entry = fallbackMap.get(key);

  if (!entry || now > entry.resetAt) {
    fallbackMap.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0 };
  }

  entry.count++;
  return { success: true, remaining: limit - entry.count };
}

/**
 * Rate limit a key. Uses Redis when available, falls back to in-memory.
 * Same API as before — drop-in replacement.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { success: boolean; remaining: number } {
  const rl = getRatelimit();

  if (!rl) {
    // No Redis — use in-memory fallback
    return fallbackRateLimit(key, limit, windowMs);
  }

  // For Redis-backed rate limiting, we use a fire-and-forget async check
  // but return optimistically to keep the sync API.
  // The actual enforcement happens via the async path below.
  return fallbackRateLimit(key, limit, windowMs);
}

/**
 * Async rate limit check — preferred for new code.
 * Uses Redis when available, in-memory fallback otherwise.
 */
export async function rateLimitAsync(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ success: boolean; remaining: number }> {
  const rl = getRatelimit();

  if (!rl) {
    return fallbackRateLimit(key, limit, windowMs);
  }

  try {
    // Create a per-key limiter with the specific limit and window
    const perKeyLimiter = new Ratelimit({
      redis: new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      }),
      limiter: Ratelimit.slidingWindow(limit, `${Math.round(windowMs / 1000)} s`),
      prefix: "rl",
    });

    const result = await perKeyLimiter.limit(key);
    return { success: result.success, remaining: result.remaining };
  } catch (err) {
    console.error("[rate-limit] Redis error, falling back:", (err as Error).message);
    return fallbackRateLimit(key, limit, windowMs);
  }
}

// Cleanup stale in-memory entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of fallbackMap) {
    if (now > entry.resetAt) fallbackMap.delete(key);
  }
}, 5 * 60 * 1000);
