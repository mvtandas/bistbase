import { prisma } from "@/lib/prisma";
import { cacheGet, cacheSet } from "@/lib/redis";

/**
 * Check for cached AI insight — Redis first, then DB.
 * Returns the cached result JSON if found, null otherwise.
 */
export async function getCachedInsight(
  stockCode: string,
  insightType: string,
  todayUTC: Date,
  timeframe = "daily",
): Promise<{ data: unknown; source: "redis" | "db" } | null> {
  const redisKey = `ai:${stockCode}:${insightType}:${timeframe}:${todayUTC.toISOString().split("T")[0]}`;

  // 1. Redis (fastest)
  const redisCached = await cacheGet<unknown>(redisKey);
  if (redisCached) {
    return { data: redisCached, source: "redis" };
  }

  // 2. Database
  const dbCached = await prisma.aiInsight.findUnique({
    where: {
      stockCode_date_insightType_timeframe: {
        stockCode,
        date: todayUTC,
        insightType,
        timeframe,
      },
    },
  });

  if (dbCached?.status === "COMPLETED" && dbCached.resultJson) {
    // Backfill Redis for next request
    await cacheSet(redisKey, dbCached.resultJson, 43200); // 12 hours
    return { data: dbCached.resultJson, source: "db" };
  }

  return null;
}

/**
 * Save AI insight to both DB and Redis.
 */
export async function saveInsight(
  stockCode: string,
  insightType: string,
  todayUTC: Date,
  result: object,
  timeframe = "daily",
): Promise<void> {
  const redisKey = `ai:${stockCode}:${insightType}:${timeframe}:${todayUTC.toISOString().split("T")[0]}`;

  // Save to DB
  await prisma.aiInsight.upsert({
    where: {
      stockCode_date_insightType_timeframe: {
        stockCode,
        date: todayUTC,
        insightType,
        timeframe,
      },
    },
    create: {
      stockCode,
      date: todayUTC,
      insightType,
      timeframe,
      resultJson: result,
      status: "COMPLETED",
    },
    update: {
      resultJson: result,
      status: "COMPLETED",
    },
  });

  // Save to Redis (12 hours)
  await cacheSet(redisKey, result, 43200);
}
