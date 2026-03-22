import { getCachedInsight, saveInsight } from "./insight-cache";

/**
 * Portfolio-level insight cache — wraps the stock-level cache
 * using "PORTFOLIO:{userId}" as the stockCode convention.
 * No DB migration needed.
 */

export async function getCachedPortfolioInsight(
  userId: string,
  insightType: string,
  todayUTC: Date,
) {
  return getCachedInsight(`PORTFOLIO:${userId}`, insightType, todayUTC);
}

export async function savePortfolioInsight(
  userId: string,
  insightType: string,
  todayUTC: Date,
  result: object,
) {
  return saveInsight(`PORTFOLIO:${userId}`, insightType, todayUTC, result);
}
