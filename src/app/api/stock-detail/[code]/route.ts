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
import { computeChartOverlays } from "@/lib/stock/chart-overlays";
import { calculateBacktest } from "@/lib/stock/backtest";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = new (YahooFinance as any)({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch (e) { console.warn("[stock-detail] calc error:", e); return fallback; }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const stockCode = code.toUpperCase();

  try {
    // 1. Fetch everything in parallel — each source independently caught
    const [quote, bars, fundamentalData, macroData, peerData] = await Promise.all([
      yf.quote(`${stockCode}.IS`).catch(() => null),
      getHistoricalBars(stockCode, 220).catch(() => []),
      getFundamentalData(stockCode).catch(() => null),
      getMacroData().catch(() => null),
      getPeerComparison(stockCode).catch(() => null),
    ]);

    const price = quote?.regularMarketPrice ?? null;
    const changePercent = quote?.regularMarketChangePercent ?? null;
    const volume = quote?.regularMarketVolume ?? null;

    // 2. Calculations — each wrapped independently
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

    const score = safe(
      () => technicals && price ? calculateCompositeScore(technicals, price, 0, fundScore, macroData) : null,
      null
    );

    const sectorContext = changePercent != null
      ? await calculateSectorContext(stockCode, changePercent).catch(() => null)
      : null;

    const riskMetrics = safe(
      () => bars.length > 30 ? calculateRiskMetrics(bars, fundamentalData?.beta ?? null) : null,
      null
    );

    // 3. Pattern detection — wrapped
    const candlestickPatterns = safe(() => detectCandlestickPatterns(bars), []);
    const chartPatterns = safe(() => detectChartPatterns(bars), []);
    const extraIndicators = safe(
      () => calculateExtraIndicators(bars, technicals?.bbUpper, technicals?.bbLower),
      null
    );
    const signalCombination = safe(() => analyzeSignalCombinations(signals), null);
    const seasonality = safe(() => bars.length > 60 ? analyzeSeasonality(bars) : null, null);

    // 3b. Signal calibration — apply accuracy to signal strengths
    let accuracyMap: Map<string, { signalType: string; totalCount: number; accurateCount: number; accuracyRate: number; adjustedStrength: number }> | null = null;
    try {
      accuracyMap = await getSignalAccuracyMap();
      for (const s of signals) {
        s.strength = calibrateSignalStrength(s.strength, s.type, accuracyMap);
      }
    } catch { /* calibration error — continue with original strengths */ }

    // 3c. Signal chains + multi-timeframe (async, parallel)
    const [signalChains, multiTimeframe] = await Promise.all([
      detectSignalChains(stockCode, signals).catch(() => []),
      analyzeMultiTimeframe(
        stockCode,
        bars,
        technicals ? { rsi14: technicals.rsi14, maAlignment: technicals.maAlignment } : null
      ).catch(() => null),
    ]);

    // 4. Financials object
    const financials = {
      marketCap: quote?.marketCap ?? null,
      peRatio: fundamentalData?.peRatio ?? quote?.trailingPE ?? null,
      pbRatio: fundamentalData?.pbRatio ?? quote?.priceToBook ?? null,
      evToEbitda: fundamentalData?.evToEbitda ?? null,
      roe: fundamentalData?.roe ?? null,
      roa: fundamentalData?.roa ?? null,
      profitMargin: fundamentalData?.profitMargin ?? null,
      operatingMargin: fundamentalData?.operatingMargin ?? null,
      revenueGrowth: fundamentalData?.revenueGrowth ?? null,
      earningsGrowth: fundamentalData?.earningsGrowth ?? null,
      debtToEquity: fundamentalData?.debtToEquity ?? null,
      currentRatio: fundamentalData?.currentRatio ?? null,
      dividendYield: fundamentalData?.dividendYield ?? null,
      fiftyTwoWeekHigh: fundamentalData?.fiftyTwoWeekHigh ?? quote?.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: fundamentalData?.fiftyTwoWeekLow ?? quote?.fiftyTwoWeekLow ?? null,
      fromFiftyTwoHigh: fundamentalData?.fromFiftyTwoHigh ?? null,
      avgVolume: quote?.averageDailyVolume3Month ?? null,
      earningsDate: fundamentalData?.earningsDate ?? null,
    };

    // 5. Price history for sparkline
    const priceHistory = (bars ?? []).slice(-30).map((b) => ({
      date: b.date,
      close: b.close,
    }));

    // 5b. Chart data (full OHLCV bars + overlays)
    const chartBars = (bars ?? []).map((b) => ({
      date: b.date, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume,
    }));
    const chartOverlays = safe(
      () => computeChartOverlays(bars ?? [], technicals?.support ?? null, technicals?.resistance ?? null),
      { ma20: [], ma50: [], ma200: [], bbUpper: [], bbLower: [], support: null, resistance: null },
    );

    // 6. DB queries — wrapped
    let scoreTrend: { date: Date; compositeScore: number | null }[] = [];
    try {
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      scoreTrend = await prisma.dailySummary.findMany({
        where: { stockCode, compositeScore: { not: null }, date: { gte: twoWeeksAgo } },
        orderBy: { date: "asc" },
        select: { date: true, compositeScore: true },
        take: 10,
      });
    } catch { /* DB error — continue without score trend */ }

    const signalAccuracy: Record<string, { rate: number; count: number }> = {};
    if (accuracyMap) {
      for (const [type, acc] of accuracyMap) {
        signalAccuracy[type] = { rate: acc.accuracyRate, count: acc.totalCount };
      }
    }

    // Backtest — sinyal geçmiş performansı
    let signalBacktest = null;
    try {
      signalBacktest = await calculateBacktest(stockCode, 180);
    } catch { /* backtest error — continue without */ }

    let dbSignals: { id: string; date: Date; signalType: string; signalDirection: string; strength: number; description: string; wasAccurate: boolean | null; outcomePercent1D: number | null; outcomePercent5D: number | null }[] = [];
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      dbSignals = await prisma.signal.findMany({
        where: { stockCode, date: { gte: thirtyDaysAgo } },
        orderBy: { date: "desc" },
        take: 20,
      });
    } catch { /* DB error — continue without recent signals */ }

    // 7. Score trend analysis
    const scores = scoreTrend.filter(s => s.compositeScore != null).map(s => s.compositeScore!);
    const scoreTrendDirection = scores.length >= 2
      ? scores[scores.length - 1] > scores[0] ? "RISING" : scores[scores.length - 1] < scores[0] ? "FALLING" : "FLAT"
      : null;
    const scoreDailyChange = scores.length >= 2
      ? (scores[scores.length - 1] - scores[0]) / (scores.length - 1)
      : null;

    // 8. Macro data (null-safe)
    const macroResponse = macroData ? {
      usdTry: macroData.usdTry ?? null,
      usdTryChange: macroData.usdTryChange ?? null,
      bist100: macroData.bist100 ?? null,
      bist100Change: macroData.bist100Change ?? null,
      dxy: macroData.dxy ?? null,
      dxyChange: macroData.dxyChange ?? null,
      vix: macroData.vix ?? null,
      macroScore: macroData.macroScore ?? 50,
      macroLabel: macroData.macroLabel ?? "Veri Yok",
    } : null;

    return NextResponse.json({
      code: stockCode,
      name: quote?.shortName ?? quote?.longName ?? stockCode,
      price,
      changePercent,
      volume,
      financials,
      fundamentalScore: fundScore,
      technicals,
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
      macroData: macroResponse,
      scoreTrend: {
        scores: scoreTrend.map(s => ({ date: s.date.toISOString(), score: s.compositeScore })),
        direction: scoreTrendDirection,
        dailyChange: scoreDailyChange != null ? Math.round(scoreDailyChange * 10) / 10 : null,
        momentum: scoreDailyChange != null
          ? scoreDailyChange > 1.5 ? "İvme kazanıyor" : scoreDailyChange < -1.5 ? "Zayıflıyor" : "Stabil"
          : null,
      },
      peerComparison: peerData,
      priceHistory,
      chartBars,
      chartOverlays,
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
    });
  } catch (error) {
    console.error(`Stock detail error for ${code}:`, error);
    return NextResponse.json({ error: "Veri alınamadı" }, { status: 500 });
  }
}
