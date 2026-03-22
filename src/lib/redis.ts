import { Redis } from "@upstash/redis";

// Lazy singleton — only connects when first used
let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis) return _redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null; // graceful fallback — cache simply won't be used
  }

  _redis = new Redis({ url, token });
  return _redis;
}

/**
 * Get a cached value from Redis.
 * Returns null if Redis is unavailable or key doesn't exist.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const data = await redis.get<T>(key);
    return data ?? null;
  } catch (err) {
    console.error("[redis] GET error:", (err as Error).message);
    return null;
  }
}

/**
 * Set a cached value in Redis with TTL (seconds).
 */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch (err) {
    console.error("[redis] SET error:", (err as Error).message);
  }
}

/**
 * Delete a cached key from Redis.
 */
export async function cacheDel(key: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.del(key);
  } catch (err) {
    console.error("[redis] DEL error:", (err as Error).message);
  }
}

/**
 * Delete all keys matching a pattern (e.g., "portfolio:user123:*").
 * Use sparingly — SCAN is O(N) in Redis.
 */
export async function cacheDelPattern(pattern: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    let cursor = 0;
    do {
      const [nextCursor, keys] = await redis.scan(cursor, { match: pattern, count: 100 });
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== 0);
  } catch (err) {
    console.error("[redis] DEL pattern error:", (err as Error).message);
  }
}

/**
 * Cache-through helper: try cache first, compute on miss, store result.
 */
export async function cacheThrough<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;

  const result = await compute();
  await cacheSet(key, result, ttlSeconds);
  return result;
}

/** Check if Redis is configured and available */
export function isRedisAvailable(): boolean {
  return getRedis() !== null;
}

/** Export raw client for advanced use (e.g., rate limiting) */
export { getRedis };
