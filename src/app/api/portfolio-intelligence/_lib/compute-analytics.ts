import { prisma } from "@/lib/prisma";
import { analyzePortfolioRisk } from "@/lib/stock/portfolio-risk";
import { analyzePortfolioIntelligence, type HoldingInput } from "@/lib/stock/portfolio-intelligence";
import { calculateRiskContributions, calculateBenchmarkComparison, calculateAttribution, calculatePortfolioDrawdown } from "@/lib/stock/portfolio-advanced";
import { calculatePortfolioEquityCurve } from "@/lib/stock/portfolio-equity";
import { calculateExtendedRiskMetrics } from "@/lib/stock/portfolio-risk-extended";
import { calculatePortfolioHealthScore } from "@/lib/stock/portfolio-health";
import { cacheGet } from "@/lib/redis";

type Timeframe = "daily" | "weekly" | "monthly";

/**
 * Compute Tier 2 analytics: equity curve, risk metrics, attribution, drawdown.
 * Relies on Tier 1 core data being cached in Redis.
 */
export async function computeAnalytics(userId: string, timeframe: Timeframe) {
  // Get core data from Redis (set by Tier 1)
  const coreData = await cacheGet<Record<string, unknown>>(`portfolio-core:${userId}:${timeframe}`)
    ?? await cacheGet<Record<string, unknown>>(`portfolio:${userId}:${timeframe}`);

  if (!coreData) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = coreData as any;
  const holdings = (d.holdings ?? []) as { stockCode: string; weight: number; verdictAction: string | null; changePercent: number | null }[];
  const allocation = (d.allocation ?? []) as { stockCode: string; weight: number }[];
  const stockCodes = holdings.map((h: { stockCode: string }) => h.stockCode);

  if (stockCodes.length === 0) return null;

  const weights = new Map(allocation.map((a: { stockCode: string; weight: number }) => [a.stockCode, a.weight / 100]));

  // Compute all analytics in parallel
  const [riskContributions, benchmarkComparison, equityCurveResult, portfolioRisk] = await Promise.all([
    stockCodes.length >= 2
      ? calculateRiskContributions(stockCodes, weights).catch(() => [])
      : Promise.resolve([]),
    calculateBenchmarkComparison(stockCodes, weights).catch(() => []),
    calculatePortfolioEquityCurve(stockCodes, weights, 180).catch(() => null),
    stockCodes.length >= 2
      ? analyzePortfolioRisk(stockCodes).catch(() => null)
      : Promise.resolve(null),
  ]);

  // Attribution (Brinson-Fachler)
  const bist100Return = benchmarkComparison.length > 0 ? benchmarkComparison[0].bist100Return : 0;
  const holdingsWithReturn = holdings.filter((h: { changePercent: number | null }) => h.changePercent != null);
  const attribution = holdingsWithReturn.length > 0
    ? calculateAttribution(
        holdingsWithReturn.map((h: { stockCode: string; changePercent: number | null }) => ({
          stockCode: h.stockCode,
          weight: allocation.find((a: { stockCode: string }) => a.stockCode === h.stockCode)?.weight ?? (100 / holdings.length),
          returnPct: h.changePercent!,
        })),
        bist100Return,
      )
    : null;

  // Drawdown from equity curve
  let drawdown = null;
  if (equityCurveResult && equityCurveResult.curve.length > 10) {
    const dailyValues = equityCurveResult.curve.map((p: { date: string; portfolioValue: number }) => ({
      date: p.date,
      value: p.portfolioValue,
    }));
    drawdown = calculatePortfolioDrawdown(dailyValues);
  }

  // Extended Risk Metrics
  const extendedRiskMetrics = equityCurveResult && equityCurveResult.dailyReturns.length > 20
    ? calculateExtendedRiskMetrics(
        equityCurveResult.dailyReturns,
        drawdown?.maxDrawdown ?? 0,
      )
    : null;

  // Enhanced health score (with extended risk metrics + alpha)
  const maxWeight = Math.max(...allocation.map((a: { weight: number }) => a.weight), 0);
  const positiveVerdictRatio = holdings.filter((h: { verdictAction: string | null }) =>
    h.verdictAction === "GUCLU_AL" || h.verdictAction === "AL"
  ).length / Math.max(1, holdings.length);

  const healthScore = calculatePortfolioHealthScore({
    diversificationScore: portfolioRisk?.diversificationScore ?? 50,
    riskMetrics: extendedRiskMetrics,
    alpha: benchmarkComparison.length > 0 ? benchmarkComparison[0].alpha : null,
    maxWeight,
    holdingCount: holdings.length,
    positiveVerdictRatio,
  });

  return {
    riskContributions,
    benchmarkComparison,
    attribution,
    drawdown,
    equityCurve: equityCurveResult?.curve ?? [],
    equityCurveMeta: equityCurveResult ? {
      totalReturn: equityCurveResult.totalReturn,
      bist100TotalReturn: equityCurveResult.bist100TotalReturn,
      alpha: equityCurveResult.alpha,
    } : null,
    extendedRiskMetrics,
    healthScore,
    correlations: portfolioRisk?.correlations ?? [],
    timeframe,
  };
}
