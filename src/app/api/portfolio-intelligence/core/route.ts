import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getHistoricalBars } from "@/lib/stock/yahoo";
import { getMacroData } from "@/lib/stock/macro";
import { analyzePortfolioRisk } from "@/lib/stock/portfolio-risk";
import { analyzePortfolioIntelligence, type HoldingInput } from "@/lib/stock/portfolio-intelligence";
import { calculatePortfolioHealthScore } from "@/lib/stock/portfolio-health";
import { cacheGet, cacheSet, cacheGetSWR } from "@/lib/redis";
import { analyzeStockFull, type AnalyzePipelineOptions } from "@/lib/stock/analyze-pipeline";
import { getSignalAccuracyMap } from "@/lib/stock/signal-calibration";
import { computeAnalytics } from "../_lib/compute-analytics";
import { computeSimulations } from "../_lib/compute-simulations";

export const maxDuration = 60;

type Timeframe = "daily" | "weekly" | "monthly";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const timeframe = (req.nextUrl.searchParams.get("timeframe") ?? "daily") as Timeframe;
  const coreKey = `portfolio-core:${userId}:${timeframe}`;

  // SWR cache: return stale data immediately, recompute in background if stale
  const swr = await cacheGetSWR<Record<string, unknown>>(coreKey, 60);
  if (swr) {
    if (swr.stale) {
      // Recompute in background
      after(async () => {
        try {
          await computeCore(userId, timeframe);
        } catch (e) {
          console.error("[core] background recompute failed:", e);
        }
      });
    }
    return NextResponse.json(swr.data);
  }

  // Also check legacy full cache for backward compat
  const legacyCached = await cacheGet<Record<string, unknown>>(`portfolio:${userId}:${timeframe}`);
  if (legacyCached) {
    return NextResponse.json(legacyCached);
  }

  try {
    const result = await computeCore(userId, timeframe);

    // Background: pre-compute analytics and simulations so they're ready when needed
    after(async () => {
      try {
        const analyticsKey = `portfolio-analytics:${userId}:${timeframe}`;
        const existingAnalytics = await cacheGet(analyticsKey);
        if (!existingAnalytics) {
          const analytics = await computeAnalytics(userId, timeframe);
          if (analytics) {
            await cacheSet(analyticsKey, analytics, 900); // 15 min
          }
        }

        const simsKey = `portfolio-simulations:${userId}:${timeframe}`;
        const existingSims = await cacheGet(simsKey);
        if (!existingSims) {
          const sims = await computeSimulations(userId, timeframe);
          if (sims) {
            await cacheSet(simsKey, sims, 1800); // 30 min
          }
        }
      } catch (e) {
        console.error("[core] background pre-compute failed:", e);
      }
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Portfolio core failed:", error);
    return NextResponse.json({ error: "Portföy analizi başarısız" }, { status: 500 });
  }
}

async function computeCore(userId: string, timeframe: Timeframe) {
  const portfolios = await prisma.portfolio.findMany({
    where: { userId },
    select: { stockCode: true, quantity: true, avgCost: true },
  });

  if (portfolios.length === 0) {
    throw new Error("Portföy boş");
  }

  const stockCodes = portfolios.map(p => p.stockCode);

  // Shared data (1 kez çek, tüm hisseler paylaşır)
  const [macroData, accuracyMap] = await Promise.all([
    getMacroData().catch(() => null),
    getSignalAccuracyMap().catch(() => new Map()),
  ]);

  // Per-stock analysis — analyzeStockFull ortak pipeline kullanır
  const sparklineData: Record<string, number[]> = {};
  const holdingResults = await Promise.all(
    portfolios.map(async (p): Promise<HoldingInput> => {
      try {
        const r = await analyzeStockFull(p.stockCode, {
          macroData,
          accuracyMap: accuracyMap as AnalyzePipelineOptions["accuracyMap"],
          timeframe,
          skipBacktest: false,
        });

        // Sparkline
        sparklineData[p.stockCode] = r.bars.slice(-7).map(b => b.close);

        return {
          stockCode: p.stockCode,
          quantity: p.quantity,
          avgCost: p.avgCost,
          price: r.price,
          changePercent: r.changePercent,
          compositeScore: r.compositeScore?.composite ?? null,
          verdictAction: (r.verdict?.action ?? null) as HoldingInput["verdictAction"],
          verdictScore: r.verdict?.score ?? null,
          verdictConfidence: r.verdict?.confidence ?? null,
          beta: r.fundamentalData?.beta ?? null,
        };
      } catch (err) {
        console.error(`[portfolio-core] ${p.stockCode} failed:`, (err as Error)?.message);
        sparklineData[p.stockCode] = [];
        return {
          stockCode: p.stockCode, quantity: p.quantity, avgCost: p.avgCost,
          price: null, changePercent: null, compositeScore: null,
          verdictAction: null, verdictScore: null, verdictConfidence: null, beta: null,
        };
      }
    })
  );

  // Portfolio risk for correlations + diversification
  let portfolioRisk = null;
  if (stockCodes.length >= 2) {
    portfolioRisk = await analyzePortfolioRisk(stockCodes).catch(() => null);
  }

  // Aggregate
  const result = analyzePortfolioIntelligence(
    holdingResults,
    portfolioRisk?.correlations,
    portfolioRisk?.diversificationScore ?? 50,
  );

  // Simplified health score (without extended risk metrics — those come from analytics tier)
  const maxWeight = Math.max(...result.allocation.map(a => a.weight), 0);
  const positiveVerdictRatio = result.holdings.filter(h =>
    h.verdictAction === "GUCLU_AL" || h.verdictAction === "AL"
  ).length / Math.max(1, result.holdings.length);

  const healthScore = calculatePortfolioHealthScore({
    diversificationScore: portfolioRisk?.diversificationScore ?? 50,
    riskMetrics: null, // Extended metrics computed in analytics tier
    alpha: null,       // Alpha computed in analytics tier
    maxWeight,
    holdingCount: result.holdings.length,
    positiveVerdictRatio,
  });

  const coreResult = {
    ...result,
    correlations: portfolioRisk?.correlations ?? [],
    healthScore,
    sparklineData,
    timeframe,
  };

  // Cache for 5 min
  const coreKey = `portfolio-core:${userId}:${timeframe}`;
  await cacheSet(coreKey, coreResult, 300);

  // Also set legacy cache key for backward compat (AI endpoints depend on it)
  await cacheSet(`portfolio:${userId}:${timeframe}`, coreResult, 300);

  return coreResult;
}
