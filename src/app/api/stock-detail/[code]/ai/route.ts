import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { getHistoricalBars, getHistoricalBarsInterval } from "@/lib/stock/yahoo";

export const maxDuration = 60;
import { getIstanbulToday } from "@/lib/date-utils";
import { calculateFullTechnicals } from "@/lib/stock/technicals";
import { calculateCompositeScore } from "@/lib/stock/scoring";
import { detectSignals } from "@/lib/stock/signals";
import { getFundamentalData, scoreFundamentals } from "@/lib/stock/fundamentals";
import { getMacroData } from "@/lib/stock/macro";
import { calculateRiskMetrics } from "@/lib/stock/risk";
import { detectCandlestickPatterns } from "@/lib/stock/candlesticks";
import { detectChartPatterns } from "@/lib/stock/chart-patterns";
import { calculateExtraIndicators } from "@/lib/stock/extra-indicators";
import { detectSignalChains } from "@/lib/stock/signal-chains";
import { analyzeSeasonality } from "@/lib/stock/seasonality";
import { generateStockAnalysis } from "@/lib/ai/provider";
import type { AnalysisTimeframe } from "@/lib/ai/types";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = new (YahooFinance as any)({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const stockCode = code.toUpperCase();
  const tf = new URL(request.url).searchParams.get("timeframe") as AnalysisTimeframe | null;
  const timeframe: AnalysisTimeframe = tf === "weekly" || tf === "monthly" ? tf : "daily";

  const todayUTC = getIstanbulToday();

  try {
    // 1. Check DB cache first
    const existing = await prisma.dailySummary.findUnique({
      where: { stockCode_date_timeframe: { stockCode, date: todayUTC, timeframe } },
    });

    if (existing?.status === "COMPLETED" && existing.aiSummaryText && existing.sentimentValue != null) {
      return NextResponse.json({
        cached: true,
        analysis: {
          summaryText: existing.aiSummaryText,
          bullCase: existing.bullCase ?? "",
          bearCase: existing.bearCase ?? "",
          sentimentValue: existing.sentimentValue,
          confidence: existing.confidence ?? "MEDIUM",
        },
      });
    }

    // 2. Fetch data and generate
    const interval = timeframe === "weekly" ? "1wk" as const : timeframe === "monthly" ? "1mo" as const : null;

    const [bars, quote, fundamentalData, macroData] = await Promise.all([
      interval
        ? getHistoricalBarsInterval(stockCode, interval, interval === "1wk" ? 730 : 1825).catch(() => [])
        : getHistoricalBars(stockCode, 220).catch(() => []),
      yf.quote(`${stockCode}.IS`).catch(() => null),
      getFundamentalData(stockCode).catch(() => null),
      getMacroData().catch(() => null),
    ]);

    if (bars.length < 5) {
      return NextResponse.json({ error: "Yeterli veri yok" }, { status: 404 });
    }

    const price = quote?.regularMarketPrice ?? bars[bars.length - 1]?.close ?? null;
    const volume = quote?.regularMarketVolume ?? null;

    const tfKey = timeframe === "weekly" ? "weekly" as const : timeframe === "monthly" ? "monthly" as const : "daily" as const;
    const technicals = safe(() => calculateFullTechnicals(bars, price, volume, tfKey), null);
    const signals = safe(() => technicals && price ? detectSignals(technicals, price) : [], []);
    const fundScore = safe(() => fundamentalData ? scoreFundamentals(fundamentalData) : null, null);
    const score = safe(() => technicals && price ? calculateCompositeScore(technicals, price, 0, fundScore, macroData, null, tfKey) : null, null);
    const riskMetrics = safe(() => bars.length > 10 ? calculateRiskMetrics(bars, fundamentalData?.beta ?? null) : null, null);
    const candlestickPatterns = safe(() => detectCandlestickPatterns(bars), []);
    const chartPatterns = safe(() => detectChartPatterns(bars), []);
    const extraIndicators = safe(() => calculateExtraIndicators(bars, technicals?.bbUpper, technicals?.bbLower), null);
    const signalChains = await detectSignalChains(stockCode, signals).catch(() => []);
    const seasonality = safe(() => bars.length > 12 ? analyzeSeasonality(bars) : null, null);

    // Change percent
    let changePercent: number | null = null;
    if (timeframe !== "daily") {
      const dailyBars = await getHistoricalBars(stockCode, timeframe === "weekly" ? 12 : 35).catch(() => []);
      const periodBars = dailyBars.slice(-(timeframe === "weekly" ? 5 : 22));
      if (periodBars.length >= 2) {
        changePercent = Math.round(((periodBars[periodBars.length - 1].close - periodBars[0].close) / periodBars[0].close) * 10000) / 100;
      }
    } else {
      changePercent = quote?.regularMarketChangePercent ?? null;
    }

    // 3. Generate AI analysis
    const result = await generateStockAnalysis({
      stockCode, price, changePercent, volume,
      newsHeadlines: [], date: todayUTC.toISOString().split("T")[0],
      timeframe, technicals, compositeScore: score, signals,
      sectorContext: null, fundamentals: fundamentalData,
      fundamentalScore: fundScore, macroData, riskMetrics,
      candlestickPatterns, chartPatterns, extraIndicators,
      signalChains, seasonalLabel: seasonality?.seasonalLabel ?? null,
    });

    if (!result) {
      return NextResponse.json({ error: "AI analizi üretilemedi" }, { status: 500 });
    }

    // 4. Save to DB
    await prisma.dailySummary.upsert({
      where: { stockCode_date_timeframe: { stockCode, date: todayUTC, timeframe } },
      create: {
        stockCode, date: todayUTC, timeframe, status: "COMPLETED",
        closePrice: price, changePercent,
        compositeScore: score?.composite ?? null,
        aiSummaryText: result.summaryText,
        bullCase: result.bullCase, bearCase: result.bearCase,
        sentimentValue: result.sentimentValue,
        confidence: result.confidence,
        analyzedAt: new Date(),
      },
      update: {
        aiSummaryText: result.summaryText,
        bullCase: result.bullCase, bearCase: result.bearCase,
        sentimentValue: result.sentimentValue, confidence: result.confidence,
        compositeScore: score?.composite ?? null,
        closePrice: price, changePercent,
        status: "COMPLETED", analyzedAt: new Date(),
      },
    });

    return NextResponse.json({
      cached: false,
      analysis: result,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`AI analysis error for ${stockCode}:`, msg);
    return NextResponse.json({ error: "AI analizi üretilemedi", detail: msg }, { status: 500 });
  }
}
