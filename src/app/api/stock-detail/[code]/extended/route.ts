import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { getHistoricalBars } from "@/lib/stock/yahoo";
import { calculateFullTechnicals } from "@/lib/stock/technicals";
import { calculateCompositeScore } from "@/lib/stock/scoring";
import { detectSignals } from "@/lib/stock/signals";
import { calculateSectorContext } from "@/lib/stock/sectors";
import { getFundamentalData, scoreFundamentals } from "@/lib/stock/fundamentals";
import { getMacroData } from "@/lib/stock/macro";
import { calculateRiskMetrics } from "@/lib/stock/risk";
import { getPeerComparison } from "@/lib/stock/peers";
import { analyzeSignalCombinations } from "@/lib/stock/signal-combinations";
import { analyzeSeasonality } from "@/lib/stock/seasonality";
import { detectCandlestickPatterns } from "@/lib/stock/candlesticks";
import { detectChartPatterns } from "@/lib/stock/chart-patterns";
import { calculateExtraIndicators } from "@/lib/stock/extra-indicators";
import { getSignalAccuracyMap, calibrateSignalStrength } from "@/lib/stock/signal-calibration";
import { detectSignalChains } from "@/lib/stock/signal-chains";
import { analyzeMultiTimeframe } from "@/lib/stock/multi-timeframe";
import { calculateBacktest } from "@/lib/stock/backtest";
import { prisma } from "@/lib/prisma";
import { calculateVolatilityRegime } from "@/lib/stock/volatility-regime";
import { calculateTurkishSeasonality } from "@/lib/stock/turkish-seasonality";
import { getIndexInclusionData } from "@/lib/stock/index-inclusion";
import { getBankMetrics } from "@/lib/stock/bank-metrics";
import { getREITMetrics } from "@/lib/stock/reit-metrics";
import { getUpcomingEvents } from "@/lib/data/economic-calendar";
import { getSearchInterest } from "@/lib/stock/search-interest";
import { getKAPFinancials } from "@/lib/data/kap";
import { cacheGet, cacheSet } from "@/lib/redis";

export const maxDuration = 60;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = new (YahooFinance as any)({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch (e) { console.warn("[stock-detail-extended] calc error:", e); return fallback; }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const stockCode = code.toUpperCase();

  try {
    // Route-level Redis cache (3 min TTL)
    const cacheKey = `stock-detail:extended:${stockCode}`;
    const cached = await cacheGet<object>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // 1. Fetch base data (needed for calculations)
    const [quote, bars, fundamentalData, macroData, peerData, kapFinancials] = await Promise.all([
      yf.quote(`${stockCode}.IS`).catch(() => null),
      getHistoricalBars(stockCode, 220).catch(() => []),
      getFundamentalData(stockCode).catch(() => null),
      getMacroData().catch(() => null),
      getPeerComparison(stockCode).catch(() => null),
      getKAPFinancials(stockCode).catch(() => null),
    ]);

    const price = quote?.regularMarketPrice ?? null;
    const changePercent = quote?.regularMarketChangePercent ?? null;
    const volume = quote?.regularMarketVolume ?? null;

    // 2. Sync calculations (needed as inputs for async ops)
    const technicals = safe(
      () => bars.length > 0 ? calculateFullTechnicals(bars, price, volume) : null,
      null
    );
    const signals = safe(
      () => technicals && price ? detectSignals(technicals, price) : [],
      []
    );
    const fundScore = safe(
      () => fundamentalData ? scoreFundamentals(fundamentalData) : null,
      null
    );

    // Sync pattern/indicator calcs
    const candlestickPatterns = safe(() => detectCandlestickPatterns(bars), []);
    const chartPatterns = safe(() => detectChartPatterns(bars), []);
    const extraIndicators = safe(
      () => calculateExtraIndicators(bars, technicals?.bbUpper, technicals?.bbLower),
      null
    );
    const signalCombination = safe(() => analyzeSignalCombinations(signals), null);
    const seasonality = safe(() => bars.length > 60 ? analyzeSeasonality(bars) : null, null);
    const volatilityRegime = safe(() => calculateVolatilityRegime(bars), null);
    const turkishSeasonality = safe(() => calculateTurkishSeasonality(), null);
    const bankMetrics = safe(() => getBankMetrics(stockCode, fundamentalData), null);
    const reitMetrics = safe(() => getREITMetrics(stockCode, fundamentalData), null);
    const economicCalendar = safe(() => getUpcomingEvents(14), null);
    const riskMetrics = safe(
      () => bars.length > 30 ? calculateRiskMetrics(bars, fundamentalData?.beta ?? null) : null,
      null
    );

    // 3. ALL async operations in a single Promise.all
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      sectorContext,
      indexInclusion,
      searchInterest,
      accuracyMap,
      signalChains,
      multiTimeframe,
      signalBacktest,
      scoreTrend,
      dbSignals,
    ] = await Promise.all([
      changePercent != null ? calculateSectorContext(stockCode, changePercent).catch(() => null) : null,
      getIndexInclusionData(stockCode).catch(() => null),
      getSearchInterest(stockCode).catch(() => null),
      getSignalAccuracyMap().catch(() => null),
      detectSignalChains(stockCode, signals).catch(() => []),
      analyzeMultiTimeframe(
        stockCode, bars,
        technicals ? { rsi14: technicals.rsi14, maAlignment: technicals.maAlignment } : null
      ).catch(() => null),
      calculateBacktest(stockCode, 180).catch(() => null),
      prisma.dailySummary.findMany({
        where: { stockCode, compositeScore: { not: null }, date: { gte: twoWeeksAgo } },
        orderBy: { date: "asc" },
        select: { date: true, compositeScore: true },
        take: 10,
      }).catch(() => [] as { date: Date; compositeScore: number | null }[]),
      prisma.signal.findMany({
        where: { stockCode, date: { gte: thirtyDaysAgo } },
        orderBy: { date: "desc" },
        take: 20,
      }).catch(() => [] as { id: string; date: Date; signalType: string; signalDirection: string; strength: number; description: string; wasAccurate: boolean | null; outcomePercent1D: number | null; outcomePercent5D: number | null }[]),
    ]);

    // 4. Post-parallel sync operations
    // Signal calibration
    const signalAccuracy: Record<string, { rate: number; count: number }> = {};
    if (accuracyMap) {
      for (const s of signals) {
        s.strength = calibrateSignalStrength(s.strength, s.type, accuracyMap);
      }
      for (const [type, acc] of accuracyMap) {
        signalAccuracy[type] = { rate: acc.accuracyRate, count: acc.totalCount };
      }
    }

    // Enriched composite score (with indexInclusion)
    const score = safe(
      () => technicals && price ? calculateCompositeScore(technicals, price, 0, fundScore, macroData, null, "daily", {
        volatilityRegime,
        turkishSeasonality,
        indexInclusion,
      }) : null,
      null
    );

    // Score trend analysis
    const scores = scoreTrend.filter(s => s.compositeScore != null).map(s => s.compositeScore!);
    const scoreTrendDirection = scores.length >= 2
      ? scores[scores.length - 1] > scores[0] ? "RISING" : scores[scores.length - 1] < scores[0] ? "FALLING" : "FLAT"
      : null;
    const scoreDailyChange = scores.length >= 2
      ? (scores[scores.length - 1] - scores[0]) / (scores.length - 1)
      : null;

    const responseBody = {
      score,
      signals,
      signalCombination,
      signalAccuracy,
      signalBacktest,
      signalChains,
      multiTimeframe,
      candlestickPatterns,
      chartPatterns,
      extraIndicators,
      seasonality,
      sectorContext,
      riskMetrics,
      scoreTrend: {
        scores: scoreTrend.map(s => ({ date: s.date.toISOString(), score: s.compositeScore })),
        direction: scoreTrendDirection,
        dailyChange: scoreDailyChange != null ? Math.round(scoreDailyChange * 10) / 10 : null,
        momentum: scoreDailyChange != null
          ? scoreDailyChange > 1.5 ? "İvme kazanıyor" : scoreDailyChange < -1.5 ? "Zayıflıyor" : "Stabil"
          : null,
      },
      peerComparison: peerData,
      volatilityRegime,
      turkishSeasonality,
      indexInclusion,
      bankMetrics: bankMetrics?.isBankStock ? bankMetrics : null,
      reitMetrics: reitMetrics?.isREIT ? reitMetrics : null,
      economicCalendar,
      searchInterest,
      kapFinancials,
      recentSignals: dbSignals.map((s) => ({
        id: s.id,
        date: s.date.toISOString(),
        type: s.signalType,
        direction: s.signalDirection,
        strength: s.strength,
        description: s.description,
        wasAccurate: s.wasAccurate,
        outcomePercent1D: s.outcomePercent1D,
        outcomePercent5D: s.outcomePercent5D,
      })),
    };

    // Fire-and-forget cache write
    cacheSet(cacheKey, responseBody, 180);

    return NextResponse.json(responseBody);
  } catch (error) {
    console.error(`Stock detail extended error for ${code}:`, error);
    return NextResponse.json({ error: "Detay verisi alınamadı" }, { status: 500 });
  }
}
