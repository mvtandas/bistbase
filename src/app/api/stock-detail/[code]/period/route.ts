import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { getHistoricalBars, getHistoricalBarsInterval } from "@/lib/stock/yahoo";
import { calculateFullTechnicals } from "@/lib/stock/technicals";
import { calculateCompositeScore } from "@/lib/stock/scoring";
import { detectSignals } from "@/lib/stock/signals";
import { getFundamentalData, scoreFundamentals } from "@/lib/stock/fundamentals";
import { getMacroData } from "@/lib/stock/macro";
import { calculateRiskMetrics } from "@/lib/stock/risk";
import { analyzeSignalCombinations } from "@/lib/stock/signal-combinations";
import { analyzeSeasonality } from "@/lib/stock/seasonality";
import { detectCandlestickPatterns } from "@/lib/stock/candlesticks";
import { detectChartPatterns } from "@/lib/stock/chart-patterns";
import { calculateExtraIndicators } from "@/lib/stock/extra-indicators";
import { getSignalAccuracyMap, calibrateSignalStrength } from "@/lib/stock/signal-calibration";
import { detectSignalChains } from "@/lib/stock/signal-chains";
import { computeChartOverlays } from "@/lib/stock/chart-overlays";
import { generateStockAnalysis } from "@/lib/ai/provider";
import type { AnalysisTimeframe } from "@/lib/ai/types";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = new (YahooFinance as any)({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch (e) { console.warn("[period] calc error:", e); return fallback; }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const stockCode = code.toUpperCase();
  const range = new URL(request.url).searchParams.get("range");

  if (range !== "week" && range !== "month") {
    return NextResponse.json({ error: "range must be 'week' or 'month'" }, { status: 400 });
  }

  const interval = range === "week" ? "1wk" as const : "1mo" as const;
  const timeframeLabel = range === "week" ? "Haftalık" : "Aylık";

  try {
    // 1. Fetch timeframe bars + daily bars + supporting data in parallel
    const tradingDays = range === "week" ? 7 : 30;
    const [bars, dailyBars, quote, fundamentalData, macroData] = await Promise.all([
      getHistoricalBarsInterval(stockCode, interval, interval === "1wk" ? 730 : 2190).catch(() => []),
      getHistoricalBars(stockCode, tradingDays + 5).catch(() => []),
      yf.quote(`${stockCode}.IS`).catch(() => null),
      getFundamentalData(stockCode).catch(() => null),
      getMacroData().catch(() => null),
    ]);


    if (bars.length < 5) {
      return NextResponse.json({ error: `Yeterli ${timeframeLabel.toLowerCase()} veri yok` }, { status: 404 });
    }

    const price = quote?.regularMarketPrice ?? bars[bars.length - 1]?.close ?? null;
    const volume = quote?.regularMarketVolume ?? null;

    // 2. Full technical analysis on timeframe bars (timeframe-aware periyotlar)
    const tfKey = range === "week" ? "weekly" as const : "monthly" as const;

    const technicals = safe(
      () => calculateFullTechnicals(bars, price, volume, tfKey),
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
      () => technicals && price ? calculateCompositeScore(technicals, price, 0, fundScore, macroData, null, tfKey) : null,
      null
    );

    const riskMetrics = safe(
      () => bars.length > 10 ? calculateRiskMetrics(bars, fundamentalData?.beta ?? null) : null,
      null
    );

    // 3. Pattern detection on timeframe bars
    const candlestickPatterns = safe(() => detectCandlestickPatterns(bars), []);
    const chartPatterns = safe(() => detectChartPatterns(bars), []);
    const extraIndicators = safe(
      () => calculateExtraIndicators(bars, technicals?.bbUpper, technicals?.bbLower),
      null
    );
    const signalCombination = safe(() => analyzeSignalCombinations(signals), null);
    const seasonality = safe(() => bars.length > 12 ? analyzeSeasonality(bars) : null, null);

    // 4. Signal calibration
    let accuracyMap: Awaited<ReturnType<typeof getSignalAccuracyMap>> | null = null;
    try {
      accuracyMap = await getSignalAccuracyMap();
      for (const s of signals) {
        s.strength = calibrateSignalStrength(s.strength, s.type, accuracyMap);
      }
    } catch { /* continue with original strengths */ }

    // 5. Signal chains
    const signalChains = await detectSignalChains(stockCode, signals).catch(() => []);

    // 6. Signal accuracy for display
    const signalAccuracy: Record<string, { rate: number; count: number }> = {};
    if (accuracyMap) {
      for (const [type, acc] of accuracyMap) {
        signalAccuracy[type] = { rate: acc.accuracyRate, count: acc.totalCount };
      }
    }

    // 7. Financials
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

    // 8. Price history (last 30 bars of this timeframe)
    const priceHistory = bars.slice(-30).map((b) => ({
      date: b.date,
      close: b.close,
    }));

    // 8b. Chart data (OHLCV bars + overlays, last 200 bars)
    const chartBars = bars.slice(-200).map((b) => ({
      date: b.date, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume,
    }));
    const chartOverlays = safe(
      () => computeChartOverlays(bars, technicals?.support ?? null, technicals?.resistance ?? null),
      { ma20: [], ma50: [], ma200: [], bbUpper: [], bbLower: [], support: null, resistance: null },
    );

    // 9. Ichimoku & Fibonacci are inside technicals already

    // 10. Macro response
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

    // 11. Change percent — use daily bars for accuracy
    const periodDailyBars = dailyBars.slice(-(range === "week" ? 5 : 22));
    let changePercent: number | null = null;
    if (periodDailyBars.length >= 2) {
      const periodStart = periodDailyBars[0].close;
      const periodEnd = periodDailyBars[periodDailyBars.length - 1].close;
      changePercent = Math.round(((periodEnd - periodStart) / periodStart) * 10000) / 100;
    }

    // 12. Past analyses from DB (fast, no AI call)
    const timeframe: AnalysisTimeframe = range === "week" ? "weekly" : "monthly";
    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

    type PeriodSummary = { id: string; date: string; closePrice: number | null; changePercent: number | null; aiSummaryText: string | null; compositeScore: number | null; bullCase: string | null; bearCase: string | null; confidence: string | null; sentimentValue: number | null };
    let pastAnalyses: PeriodSummary[] = [];
    let aiAnalysis: { summaryText: string; bullCase: string; bearCase: string; sentimentValue: number; confidence: string } | null = null;
    try {
      const historyDays = range === "week" ? 90 : 365;
      const historyStart = new Date();
      historyStart.setDate(historyStart.getDate() - historyDays);
      const dbAll = await prisma.dailySummary.findMany({
        where: { stockCode, timeframe, status: "COMPLETED", date: { gte: historyStart } },
        orderBy: { date: "desc" },
        take: 11,
      });
      // Today's cached analysis
      const todayEntry = dbAll.find(s => s.date.toISOString().split("T")[0] === todayUTC.toISOString().split("T")[0]);
      if (todayEntry?.aiSummaryText && todayEntry.sentimentValue != null) {
        aiAnalysis = {
          summaryText: todayEntry.aiSummaryText,
          bullCase: todayEntry.bullCase ?? "",
          bearCase: todayEntry.bearCase ?? "",
          sentimentValue: todayEntry.sentimentValue,
          confidence: todayEntry.confidence ?? "MEDIUM",
        };
      }

      // No cache — generate AI using already-calculated data
      if (!aiAnalysis) {
        try {
          const result = await generateStockAnalysis({
            stockCode, price, changePercent, volume,
            newsHeadlines: [], date: todayUTC.toISOString().split("T")[0],
            timeframe, technicals, compositeScore: score, signals,
            sectorContext: null, fundamentals: fundamentalData,
            fundamentalScore: fundScore, macroData, riskMetrics,
            candlestickPatterns, chartPatterns, extraIndicators,
            signalChains, seasonalLabel: seasonality?.seasonalLabel ?? null,
          });
          if (result) {
            aiAnalysis = result;
            // Save to DB for future cache
            await prisma.dailySummary.upsert({
              where: { stockCode_date_timeframe: { stockCode, date: todayUTC, timeframe } },
              create: {
                stockCode, date: todayUTC, timeframe, status: "COMPLETED",
                closePrice: price, changePercent, compositeScore: score?.composite ?? null,
                aiSummaryText: result.summaryText, bullCase: result.bullCase,
                bearCase: result.bearCase, sentimentValue: result.sentimentValue,
                confidence: result.confidence, analyzedAt: new Date(),
              },
              update: {
                aiSummaryText: result.summaryText, bullCase: result.bullCase,
                bearCase: result.bearCase, sentimentValue: result.sentimentValue,
                confidence: result.confidence, compositeScore: score?.composite ?? null,
                closePrice: price, changePercent, status: "COMPLETED", analyzedAt: new Date(),
              },
            });
          }
        } catch (e) { console.warn("[period] AI generation error:", e); }
      }

      // Fallback: AI failed → build summary from calculated data
      if (!aiAnalysis && score && technicals) {
        const s = score;
        const label = s.composite >= 65 ? "güçlü pozitif" : s.composite >= 55 ? "pozitif" : s.composite >= 45 ? "nötr" : s.composite >= 35 ? "negatif" : "güçlü negatif";
        const rsiText = technicals.rsi14 != null ? (technicals.rsi14 >= 70 ? "aşırı alım" : technicals.rsi14 <= 30 ? "aşırı satım" : "normal") : null;
        const trendText = technicals.maAlignment === "STRONG_BULLISH" ? "güçlü yükseliş" : technicals.maAlignment === "BULLISH" ? "yükseliş" : technicals.maAlignment === "BEARISH" ? "düşüş" : technicals.maAlignment === "STRONG_BEARISH" ? "güçlü düşüş" : "karışık";
        const sigBull = signals.filter(sg => sg.direction === "BULLISH").length;
        const sigBear = signals.filter(sg => sg.direction === "BEARISH").length;

        const summaryParts = [
          `${stockCode} ${timeframe === "weekly" ? "haftalık" : "aylık"} bazda ${s.composite}/100 puanla ${label} görünüm sergiliyor.`,
          `Teknik skor ${s.technical}, momentum ${s.momentum}, hacim ${s.volume}.`,
          rsiText ? `RSI ${technicals.rsi14?.toFixed(0)} ile ${rsiText} bölgesinde.` : null,
          `Hareketli ortalama trendi: ${trendText}.`,
          sigBull + sigBear > 0 ? `${sigBull} boğa, ${sigBear} ayı sinyali aktif.` : null,
        ].filter(Boolean).join(" ");

        const bullParts = [
          technicals.support != null ? `Destek seviyesi ₺${technicals.support}.` : null,
          s.technical >= 50 ? `Teknik görünüm olumlu (${s.technical}/100).` : null,
          sigBull > 0 ? `${sigBull} aktif boğa sinyali mevcut.` : null,
          rsiText === "aşırı satım" ? "RSI aşırı satım bölgesinde — dip fırsatı olabilir." : null,
        ].filter(Boolean).join(" ");

        const bearParts = [
          technicals.resistance != null ? `Direnç seviyesi ₺${technicals.resistance}.` : null,
          s.technical < 50 ? `Teknik görünüm zayıf (${s.technical}/100).` : null,
          sigBear > 0 ? `${sigBear} aktif ayı sinyali mevcut.` : null,
          rsiText === "aşırı alım" ? "RSI aşırı alım bölgesinde — düzeltme riski." : null,
        ].filter(Boolean).join(" ");

        const sv = Math.round((s.composite - 50) * 2);
        aiAnalysis = {
          summaryText: summaryParts,
          bullCase: bullParts || "Belirgin boğa sinyali tespit edilmedi.",
          bearCase: bearParts || "Belirgin ayı sinyali tespit edilmedi.",
          sentimentValue: Math.max(-100, Math.min(100, sv)),
          confidence: sigBull + sigBear >= 4 ? "HIGH" : sigBull + sigBear >= 2 ? "MEDIUM" : "LOW",
        };
      }

      pastAnalyses = dbAll
        .filter(s => s.date.toISOString().split("T")[0] !== todayUTC.toISOString().split("T")[0])
        .slice(0, 10)
        .map(s => ({
          id: s.id, date: s.date.toISOString(),
          closePrice: s.closePrice, changePercent: s.changePercent,
          aiSummaryText: s.aiSummaryText, compositeScore: s.compositeScore,
          bullCase: s.bullCase, bearCase: s.bearCase,
          confidence: s.confidence, sentimentValue: s.sentimentValue,
        }));
    } catch { /* DB error */ }

    return NextResponse.json({
      code: stockCode,
      name: quote?.shortName ?? quote?.longName ?? stockCode,
      price,
      changePercent: changePercent != null ? Math.round(changePercent * 100) / 100 : null,
      volume,
      timeframe: range,
      timeframeLabel,
      totalBars: bars.length,
      financials,
      fundamentalScore: fundScore,
      technicals,
      score,
      signals,
      signalCombination,
      signalAccuracy,
      signalChains,
      candlestickPatterns,
      chartPatterns,
      extraIndicators,
      seasonality,
      riskMetrics,
      macroData: macroResponse,
      priceHistory,
      chartBars,
      chartOverlays,
      aiAnalysis,
      pastAnalyses,
    });
  } catch (error) {
    console.error(`Period API error for ${stockCode}:`, error);
    return NextResponse.json({ error: "Dönem verileri alınamadı" }, { status: 500 });
  }
}
