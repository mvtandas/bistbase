import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import YahooFinance from "yahoo-finance2";
import { getHistoricalBars, getHistoricalBarsInterval } from "@/lib/stock/yahoo";
import { calculateFullTechnicals } from "@/lib/stock/technicals";
import { calculateCompositeScore } from "@/lib/stock/scoring";
import { detectSignals } from "@/lib/stock/signals";
import { getFundamentalData, scoreFundamentals } from "@/lib/stock/fundamentals";
import { getMacroData } from "@/lib/stock/macro";
import { calculateRiskMetrics } from "@/lib/stock/risk";
import { calculateVerdict } from "@/lib/stock/verdict";
import { analyzePortfolioRisk } from "@/lib/stock/portfolio-risk";
import { analyzePortfolioIntelligence, type HoldingInput } from "@/lib/stock/portfolio-intelligence";
import { getSignalAccuracyMap, calibrateSignalStrength } from "@/lib/stock/signal-calibration";
import { analyzeSignalCombinations } from "@/lib/stock/signal-combinations";
import { analyzeMultiTimeframe } from "@/lib/stock/multi-timeframe";
import { calculateBacktest } from "@/lib/stock/backtest";
import { calculateRiskContributions, calculateBenchmarkComparison, calculateAttribution, calculatePortfolioDrawdown } from "@/lib/stock/portfolio-advanced";
import { calculatePortfolioEquityCurve } from "@/lib/stock/portfolio-equity";
import { calculateExtendedRiskMetrics } from "@/lib/stock/portfolio-risk-extended";
import { calculatePortfolioHealthScore } from "@/lib/stock/portfolio-health";
import { runMonteCarloSimulation } from "@/lib/stock/monte-carlo";
import { calculateStressTest } from "@/lib/stock/stress-test";
import { cacheGet, cacheSet } from "@/lib/redis";

export const maxDuration = 120;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = new (YahooFinance as any)({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

type Timeframe = "daily" | "weekly" | "monthly";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const timeframe = (req.nextUrl.searchParams.get("timeframe") ?? "daily") as Timeframe;
  const redisCacheKey = `portfolio:${userId}:${timeframe}`;

  // Redis cache check (5 min)
  const cached = await cacheGet<Record<string, unknown>>(redisCacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  const portfolios = await prisma.portfolio.findMany({
    where: { userId },
    select: { stockCode: true, quantity: true, avgCost: true },
  });

  if (portfolios.length === 0) {
    return NextResponse.json({ error: "Portföy boş" }, { status: 400 });
  }

  const stockCodes = portfolios.map(p => p.stockCode);

  try {
    // Shared data
    const [macroData, accuracyMap] = await Promise.all([
      getMacroData().catch(() => null),
      getSignalAccuracyMap().catch(() => new Map()),
    ]);

    // Per-stock analysis in parallel
    const holdingResults = await Promise.all(
      portfolios.map(async (p): Promise<HoldingInput> => {
        try {
          // Timeframe-aware bar fetching
          const barsPromise = timeframe === "daily"
            ? getHistoricalBars(p.stockCode, 220).catch(() => [])
            : getHistoricalBarsInterval(p.stockCode, timeframe === "weekly" ? "1wk" : "1mo").catch(() => []);

          const [quote, bars, fundamentalData] = await Promise.all([
            yf.quote(`${p.stockCode}.IS`).catch(() => null),
            barsPromise,
            getFundamentalData(p.stockCode).catch(() => null),
          ]);

          const price = quote?.regularMarketPrice ?? null;
          const changePercent = quote?.regularMarketChangePercent ?? null;
          const volume = quote?.regularMarketVolume ?? null;

          // Timeframe-aware technicals and scoring
          const tfKey = timeframe as "daily" | "weekly" | "monthly";
          const technicals = safe(() => bars.length > 0 ? calculateFullTechnicals(bars, price, volume, tfKey) : null, null);
          let signals = safe(() => technicals && price ? detectSignals(technicals, price) : [], []);
          const fundScore = safe(() => fundamentalData ? scoreFundamentals(fundamentalData) : null, null);
          const score = safe(() => technicals && price ? calculateCompositeScore(technicals, price, 0, fundScore, macroData, null, tfKey) : null, null);
          const riskMetrics = safe(() => bars.length >= 30 ? calculateRiskMetrics(bars, fundamentalData?.beta ?? null) : null, null);
          const signalCombination = safe(() => analyzeSignalCombinations(signals), null);
          const multiTimeframe = await analyzeMultiTimeframe(p.stockCode, bars, technicals).catch(() => null);
          const backtest = await calculateBacktest(p.stockCode, 180).catch(() => null);

          // Calibrate signals
          if (accuracyMap) {
            for (const s of signals) {
              s.strength = calibrateSignalStrength(s.strength, s.type, accuracyMap);
            }
          }

          // Calculate verdict
          let verdictAction = null;
          let verdictScore = null;
          let verdictConfidence = null;

          if (price && technicals) {
            const verdict = calculateVerdict({
              price, technicals: technicals as unknown as Record<string, unknown>,
              extraIndicators: null, score, fundamentalScore: fundScore,
              signals, signalCombination, signalAccuracy: {},
              multiTimeframe, macroData, riskMetrics,
              signalBacktest: backtest,
            });
            verdictAction = verdict.action;
            verdictScore = verdict.score;
            verdictConfidence = verdict.confidence;
          }

          return {
            stockCode: p.stockCode,
            quantity: p.quantity,
            avgCost: p.avgCost,
            price,
            changePercent,
            compositeScore: score?.composite ?? null,
            verdictAction: verdictAction as HoldingInput["verdictAction"],
            verdictScore,
            verdictConfidence,
            beta: fundamentalData?.beta ?? null,
          };
        } catch (err) {
          console.error(`[portfolio-intelligence] ${p.stockCode} failed:`, (err as Error)?.message);
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

    // Advanced analytics (parallel)
    const weights = new Map(result.allocation.map(a => [a.stockCode, a.weight / 100]));
    const [riskContributions, benchmarkComparison] = await Promise.all([
      stockCodes.length >= 2 ? calculateRiskContributions(stockCodes, weights).catch(() => []) : Promise.resolve([]),
      calculateBenchmarkComparison(stockCodes, weights).catch(() => []),
    ]);

    // Attribution (Brinson-Fachler)
    const bist100Return = benchmarkComparison.length > 0 ? benchmarkComparison[0].bist100Return : 0;
    const attribution = holdingResults.some(h => h.changePercent != null)
      ? calculateAttribution(
          holdingResults.filter(h => h.changePercent != null).map(h => ({
            stockCode: h.stockCode,
            weight: result.allocation.find(a => a.stockCode === h.stockCode)?.weight ?? (100 / holdingResults.length),
            returnPct: h.changePercent!,
          })),
          bist100Return,
        )
      : null;

    // ═══ Equity Curve (gerçek hesaplama) ═══
    const equityCurveResult = await calculatePortfolioEquityCurve(stockCodes, weights, 180).catch(() => null);

    // Drawdown — equity curve'den gerçek hesaplama
    let drawdown = null;
    if (equityCurveResult && equityCurveResult.curve.length > 10) {
      const dailyValues = equityCurveResult.curve.map(p => ({
        date: p.date,
        value: p.portfolioValue,
      }));
      drawdown = calculatePortfolioDrawdown(dailyValues);
    }

    // ═══ Extended Risk Metrics ═══
    const extendedRiskMetrics = equityCurveResult && equityCurveResult.dailyReturns.length > 20
      ? calculateExtendedRiskMetrics(
          equityCurveResult.dailyReturns,
          drawdown?.maxDrawdown ?? 0,
        )
      : null;

    // ═══ Health Score ═══
    const maxWeight = Math.max(...result.allocation.map(a => a.weight), 0);
    const positiveVerdictRatio = result.holdings.filter(h =>
      h.verdictAction === "GUCLU_AL" || h.verdictAction === "AL"
    ).length / Math.max(1, result.holdings.length);

    const healthScore = calculatePortfolioHealthScore({
      diversificationScore: portfolioRisk?.diversificationScore ?? 50,
      riskMetrics: extendedRiskMetrics,
      alpha: benchmarkComparison.length > 0 ? benchmarkComparison[0].alpha : null,
      maxWeight,
      holdingCount: result.holdings.length,
      positiveVerdictRatio,
    });

    // ═══ Monte Carlo ═══
    const monteCarlo = equityCurveResult && equityCurveResult.dailyReturns.length > 20
      ? runMonteCarloSimulation(equityCurveResult.dailyReturns, 1000, 126)
      : null;

    // ═══ Stress Test ═══
    const stressTest = calculateStressTest(
      holdingResults.map(h => ({
        stockCode: h.stockCode,
        weight: result.allocation.find(a => a.stockCode === h.stockCode)?.weight ?? 0,
        beta: h.beta,
      }))
    );

    // ═══ Sparkline Data (her hisse için son 7 gün fiyatları) ═══
    const sparklineData: Record<string, number[]> = {};
    await Promise.all(
      stockCodes.map(async (code) => {
        try {
          const bars = await getHistoricalBars(code, 10).catch(() => []);
          sparklineData[code] = bars.slice(-7).map(b => b.close);
        } catch {
          sparklineData[code] = [];
        }
      })
    );

    const fullResult = {
      ...result,
      riskContributions,
      benchmarkComparison,
      correlations: portfolioRisk?.correlations ?? [],
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
      monteCarlo,
      stressTest,
      sparklineData,
    };

    const responseData = { ...fullResult, timeframe };
    await cacheSet(redisCacheKey, responseData, 300); // 5 min
    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Portfolio intelligence failed:", error);
    return NextResponse.json({ error: "Portföy analizi başarısız" }, { status: 500 });
  }
}
