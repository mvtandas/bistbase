import { cacheGet } from "@/lib/redis";
import { calculatePortfolioEquityCurve } from "@/lib/stock/portfolio-equity";
import { runMonteCarloSimulation } from "@/lib/stock/monte-carlo";
import { calculateStressTest } from "@/lib/stock/stress-test";

type Timeframe = "daily" | "weekly" | "monthly";

/**
 * Compute Tier 3 simulations: Monte Carlo, stress test.
 * Relies on Tier 1/2 data being cached in Redis.
 */
export async function computeSimulations(userId: string, timeframe: Timeframe) {
  // Get core data from Redis
  const coreData = await cacheGet<Record<string, unknown>>(`portfolio-core:${userId}:${timeframe}`)
    ?? await cacheGet<Record<string, unknown>>(`portfolio:${userId}:${timeframe}`);

  if (!coreData) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = coreData as any;
  const holdings = (d.holdings ?? []) as { stockCode: string; weight: number; beta: number | null }[];
  const allocation = (d.allocation ?? []) as { stockCode: string; weight: number }[];
  const stockCodes = holdings.map((h: { stockCode: string }) => h.stockCode);

  if (stockCodes.length === 0) return null;

  const weights = new Map(allocation.map((a: { stockCode: string; weight: number }) => [a.stockCode, a.weight / 100]));

  // Get equity curve for Monte Carlo (try analytics cache first, then compute)
  let dailyReturns: number[] = [];
  const analyticsData = await cacheGet<Record<string, unknown>>(`portfolio-analytics:${userId}:${timeframe}`);

  if (analyticsData) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ad = analyticsData as any;
    // Try to get daily returns from equity curve in analytics
    if (ad.equityCurve && ad.equityCurve.length > 20) {
      const values = ad.equityCurve.map((p: { portfolioValue: number }) => p.portfolioValue);
      for (let i = 1; i < values.length; i++) {
        if (values[i - 1] > 0) {
          dailyReturns.push((values[i] - values[i - 1]) / values[i - 1]);
        }
      }
    }
  }

  // If we don't have daily returns yet, compute equity curve ourselves
  if (dailyReturns.length < 20) {
    const equityCurveResult = await calculatePortfolioEquityCurve(stockCodes, weights, 180).catch(() => null);
    if (equityCurveResult) {
      dailyReturns = equityCurveResult.dailyReturns;
    }
  }

  // Monte Carlo
  const monteCarlo = dailyReturns.length > 20
    ? runMonteCarloSimulation(dailyReturns, 1000, 126)
    : null;

  // Stress Test
  const stressTest = calculateStressTest(
    holdings.map((h: { stockCode: string; weight: number; beta: number | null }) => ({
      stockCode: h.stockCode,
      weight: allocation.find((a: { stockCode: string }) => a.stockCode === h.stockCode)?.weight ?? 0,
      beta: h.beta ?? null,
    }))
  );

  return {
    monteCarlo,
    stressTest,
    timeframe,
  };
}
