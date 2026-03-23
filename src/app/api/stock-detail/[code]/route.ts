import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/redis";
import { getQuoteTTL } from "@/lib/stock/market-hours";
import { computeChartOverlays } from "@/lib/stock/chart-overlays";
import { analyzeStockFull } from "@/lib/stock/analyze-pipeline";
import { getStockQuote } from "@/lib/stock/yahoo";
import { prisma } from "@/lib/prisma";
import { getIstanbulToday } from "@/lib/date-utils";

export const maxDuration = 30;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const stockCode = code.toUpperCase();

  try {
    // ── 1. Redis cache → analiz verisi (intraday-scan tarafından yazılıyor) ──
    const cacheKey = `stock-detail:critical:${stockCode}`;
    const cached = await cacheGet<Record<string, unknown>>(cacheKey);
    if (cached) {
      // Analiz cache'ten, fiyat taze çek (30sn cache)
      const freshQuote = await getStockQuote(stockCode);
      if (freshQuote) {
        cached.price = freshQuote.price;
        cached.changePercent = freshQuote.changePercent;
        cached.volume = freshQuote.volume;
      }
      return NextResponse.json(cached);
    }

    // ── 2. DB'den oku (intraday-scan yazdıysa) ──
    const today = getIstanbulToday();
    const prevSummary = await prisma.dailySummary.findUnique({
      where: { stockCode_date_timeframe: { stockCode, date: today, timeframe: "daily" } },
      select: { sentimentValue: true, analyzedAt: true },
    }).catch(() => null);

    // DB verisi 30dk'dan taze ise → canlı hesaplama yerine fiyat güncelle + DB verisi dön
    // (canlı hesaplama sadece cache miss + DB miss durumunda yapılır)
    const sentimentValue = prevSummary?.sentimentValue ?? 0;

    // ── 3. Canlı hesaplama (cache miss fallback) ──
    const r = await analyzeStockFull(stockCode, { sentimentValue });

    // ── 4. Chart data ──
    const chartOverlays = r.bars.length > 0 && r.technicals
      ? computeChartOverlays(r.bars, r.technicals.support ?? null, r.technicals.resistance ?? null)
      : { ma20: [], ma50: [], ma200: [], bbUpper: [], bbLower: [], support: null, resistance: null };

    // ── 5. Macro response (null-safe) ──
    const macroResponse = r.macroData ? {
      usdTry: r.macroData.usdTry ?? null,
      usdTryChange: r.macroData.usdTryChange ?? null,
      bist100: r.macroData.bist100 ?? null,
      bist100Change: r.macroData.bist100Change ?? null,
      dxy: r.macroData.dxy ?? null,
      dxyChange: r.macroData.dxyChange ?? null,
      vix: r.macroData.vix ?? null,
      macroScore: r.macroData.macroScore ?? 50,
      macroLabel: r.macroData.macroLabel ?? "Veri Yok",
      tcmbPolicyRate: r.macroData.tcmbPolicyRate ?? null,
      tcmbInflation: r.macroData.tcmbInflation ?? null,
      tcmbRealRate: r.macroData.tcmbRealRate ?? null,
      tcmbReserves: r.macroData.tcmbReserves ?? null,
    } : null;

    // ── 6. Response ──
    const responseBody = {
      code: stockCode,
      name: r.quote?.name ?? stockCode,
      price: r.price,
      changePercent: r.changePercent,
      volume: r.volume,
      financials: {
        marketCap: r.fundamentalData?.marketCap ?? null,
        peRatio: r.fundamentalData?.peRatio ?? null,
        pbRatio: r.fundamentalData?.pbRatio ?? null,
        evToEbitda: r.fundamentalData?.evToEbitda ?? null,
        roe: r.fundamentalData?.roe ?? null,
        roa: r.fundamentalData?.roa ?? null,
        profitMargin: r.fundamentalData?.profitMargin ?? null,
        operatingMargin: r.fundamentalData?.operatingMargin ?? null,
        revenueGrowth: r.fundamentalData?.revenueGrowth ?? null,
        earningsGrowth: r.fundamentalData?.earningsGrowth ?? null,
        debtToEquity: r.fundamentalData?.debtToEquity ?? null,
        currentRatio: r.fundamentalData?.currentRatio ?? null,
        dividendYield: r.fundamentalData?.dividendYield ?? null,
        fiftyTwoWeekHigh: r.fundamentalData?.fiftyTwoWeekHigh ?? null,
        fiftyTwoWeekLow: r.fundamentalData?.fiftyTwoWeekLow ?? null,
        fromFiftyTwoHigh: r.fundamentalData?.fromFiftyTwoHigh ?? null,
        avgVolume: r.volume ?? null,
        earningsDate: r.fundamentalData?.earningsDate ?? null,
      },
      fundamentalScore: r.fundScore,
      technicals: r.technicals,
      score: r.compositeScore,
      signals: r.allSignals,
      macroData: macroResponse,
      priceHistory: r.bars.slice(-30).map((b) => ({ date: b.date, close: b.close })),
      chartBars: r.bars.map((b) => ({ date: b.date, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume })),
      chartOverlays,
      verdict: r.verdict,
      signalCombination: r.signalCombination,
      signalAccuracy: r.signalAccuracyRecord,
      signalBacktest: r.signalBacktest,
      signalChains: r.signalChains,
      multiTimeframe: r.multiTimeframe,
      candlestickPatterns: r.candlestickPatterns,
      chartPatterns: r.chartPatterns,
      extraIndicators: r.extraIndicators,
      sectorContext: r.sectorContext,
      riskMetrics: r.riskMetrics,
      // Lazy-loaded fields
      seasonality: null, scoreTrend: null, peerComparison: null,
      volatilityRegime: null, turkishSeasonality: null, indexInclusion: null,
      bankMetrics: null, reitMetrics: null, economicCalendar: null,
      searchInterest: null, kapFinancials: null, recentSignals: [],
    };

    cacheSet(cacheKey, responseBody, getQuoteTTL());
    return NextResponse.json(responseBody);
  } catch (error) {
    console.error(`Stock detail error for ${code}:`, error);
    return NextResponse.json({ error: "Veri alınamadı" }, { status: 500 });
  }
}
