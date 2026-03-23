import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getScreenerSnapshots, snapshotsToScreenerResult } from "@/lib/stock/screener-db";
import { cacheGet, cacheSet } from "@/lib/redis";
import { getMarketState, getQuoteTTL } from "@/lib/stock/market-hours";
import { prisma } from "@/lib/prisma";
import { getIstanbulToday, dayRange } from "@/lib/date-utils";
import { STOCK_LISTS, type ScreenerIndex } from "@/lib/constants";
import { STOCK_SECTOR_MAP, SECTOR_INDICES } from "@/lib/stock/sectors";
import { getBatchQuotes } from "@/lib/stock/yahoo";
import { getMacroData } from "@/lib/stock/macro";
import { detectVolatilityRegime } from "@/lib/stock/scoring";
import { getSignalAccuracyMap } from "@/lib/stock/signal-calibration";

export const maxDuration = 60;

const VALID_INDICES = new Set<ScreenerIndex>(["bist30", "bist50", "bist100", "bistall", "xtm25", "xkury", "xusrd"]);

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const idx = request.nextUrl.searchParams.get("index") ?? "bist30";
  const index = VALID_INDICES.has(idx as ScreenerIndex) ? (idx as ScreenerIndex) : "bist30";

  try {
    // ── Redis cache ──
    const cacheKey = `screener:${index}`;
    const cached = await cacheGet<object>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
      });
    }

    const { isOpen } = getMarketState();
    const today = getIstanbulToday();
    const stockList = STOCK_LISTS[index];

    // ── DailySummary + TechnicalSnapshot + Signals + Macro ──
    // Bugün veri yoksa son mevcut günü bul (piyasa kapalıyken veya henüz scan çalışmamışken)
    let analysisDate = today;
    const todayCount = await prisma.dailySummary.count({
      where: { date: dayRange(today), stockCode: { in: [...stockList] }, timeframe: "daily", status: "COMPLETED" },
    });
    if (todayCount === 0) {
      const lastEntry = await prisma.dailySummary.findFirst({
        where: { stockCode: { in: [...stockList] }, timeframe: "daily", status: "COMPLETED", verdictAction: { not: null } },
        orderBy: { date: "desc" },
        select: { date: true },
      });
      if (lastEntry) analysisDate = lastEntry.date;
    }

    const [summaries, snapshots, signals, prices, macroData, accuracyMap] = await Promise.all([
      prisma.dailySummary.findMany({
        where: {
          date: dayRange(analysisDate),
          stockCode: { in: [...stockList] },
          timeframe: "daily",
          status: "COMPLETED",
        },
        orderBy: { compositeScore: "desc" },
      }),
      prisma.technicalSnapshot.findMany({
        where: {
          date: dayRange(analysisDate),
          stockCode: { in: [...stockList] },
        },
      }),
      prisma.signal.findMany({
        where: {
          date: dayRange(analysisDate),
          stockCode: { in: [...stockList] },
        },
        select: { stockCode: true, signalType: true, signalDirection: true, strength: true, description: true },
      }),
      // Fiyatları batch'ler halinde çek (getBatchQuotes max 50)
      (async () => {
        const allCodes = [...stockList];
        const result = new Map<string, { code: string; name: string; price: number | null; changePercent: number | null; volume: number | null }>();
        for (let i = 0; i < allCodes.length; i += 50) {
          const batch = allCodes.slice(i, i + 50);
          const quotes = await getBatchQuotes(batch);
          for (const [k, v] of quotes) result.set(k, v);
        }
        return result;
      })(),
      getMacroData().catch(() => null),
      getSignalAccuracyMap().catch(() => new Map()),
    ]);

    // Sinyal sayılarını ve detaylarını hisse bazında topla
    const signalCountMap = new Map<string, { bullish: number; bearish: number }>();
    const signalDetailMap = new Map<string, { type: string; direction: string; strength: number; description: string }[]>();
    for (const sig of signals) {
      const counts = signalCountMap.get(sig.stockCode) ?? { bullish: 0, bearish: 0 };
      if (sig.signalDirection === "BULLISH") counts.bullish++;
      else if (sig.signalDirection === "BEARISH") counts.bearish++;
      signalCountMap.set(sig.stockCode, counts);

      const details = signalDetailMap.get(sig.stockCode) ?? [];
      details.push({ type: sig.signalType, direction: sig.signalDirection, strength: sig.strength, description: sig.description });
      signalDetailMap.set(sig.stockCode, details);
    }

    // Sinyal accuracy kayıtları (UI'da win rate göstermek için)
    const signalAccuracyRecord: Record<string, { rate: number; count: number; reliability: string }> = {};
    for (const [type, acc] of accuracyMap) {
      signalAccuracyRecord[type] = { rate: acc.accuracyRate, count: acc.totalCount, reliability: acc.reliabilityLabel };
    }

    const regime = detectVolatilityRegime(macroData);

    const techMap = new Map(snapshots.map((s) => [s.stockCode, s]));

    // ── Tüm hisseler için response oluştur ──
    // DailySummary'de olan hisseleri DB'den, olmayanları fiyat ile göster
    const summaryMap = new Map(summaries.map((s) => [s.stockCode, s]));
    {
      const stocks = [...stockList].map((code) => {
        const s = summaryMap.get(code);
        const tech = techMap.get(code);
        const livePrice = prices.get(code);
        const sectorCode = STOCK_SECTOR_MAP[code] ?? null;

        const price = livePrice?.price ?? s?.closePrice ?? null;
        const changePercent = livePrice?.changePercent ?? s?.changePercent ?? null;
        const volume = livePrice?.volume ?? (s?.volume ? Number(s.volume) : null);
        const score = tech?.compositeScore ?? s?.compositeScore ?? null;

        return {
          code,
          name: livePrice?.name ?? code,
          price,
          changePercent,
          volume,
          composite: score != null ? {
            technical: tech?.technicalScore ?? 0,
            momentum: tech?.momentumScore ?? 0,
            volume: tech?.volumeScore ?? 0,
            volatility: tech?.volatilityScore ?? 0,
            sentiment: 0,
            fundamental: 0,
            macro: 0,
            composite: score,
            label: getScoreLabel(score),
          } : null,
          verdict: s?.verdictAction ? {
            action: s.verdictAction,
            score: s.verdictScore ?? 0,
            confidence: s.verdictConfidence ?? 50,
          } : null,
          rsi14: tech?.rsi14 ?? null,
          macdHistogram: tech?.macdHistogram ?? null,
          maAlignment: null,
          adx14: tech?.adx14 ?? null,
          fundamentalScore: null,
          peRatio: null,
          pbRatio: null,
          dividendYield: null,
          fiftyTwoWeekHigh: null,
          fiftyTwoWeekLow: null,
          fromFiftyTwoHigh: null,
          riskMetrics: null,
          signals: (signalDetailMap.get(code) ?? []).sort((a, b) => b.strength - a.strength),
          signalCombination: null,
          multiTimeframe: null,
          sectorCode,
          sectorName: sectorCode ? (SECTOR_INDICES[sectorCode]?.name ?? null) : null,
        };
      }).filter((s) => s.price != null); // fiyatı olmayan hisseleri çıkar

      // Market summary
      let strongBuy = 0, buy = 0, hold = 0, sell = 0, strongSell = 0;
      let totalScore = 0, scoreCount = 0;

      for (const s of stocks) {
        if (s.composite) { totalScore += s.composite.composite; scoreCount++; }
        switch (s.verdict?.action) {
          case "GUCLU_AL": strongBuy++; break;
          case "AL": buy++; break;
          case "TUT": hold++; break;
          case "SAT": sell++; break;
          case "GUCLU_SAT": strongSell++; break;
        }
      }

      // Sector summary
      const sectorMap: Record<string, { scores: number[]; changes: number[]; stocks: string[] }> = {};
      for (const s of stocks) {
        if (!s.sectorCode) continue;
        if (!sectorMap[s.sectorCode]) sectorMap[s.sectorCode] = { scores: [], changes: [], stocks: [] };
        if (s.composite) sectorMap[s.sectorCode].scores.push(s.composite.composite);
        if (s.changePercent != null) sectorMap[s.sectorCode].changes.push(s.changePercent);
        sectorMap[s.sectorCode].stocks.push(s.code);
      }

      const sectorSummary: Record<string, { sectorName: string; avgScore: number; avgChange: number; stockCount: number; topStock: string }> = {};
      for (const [sc, data] of Object.entries(sectorMap)) {
        const avgScore = data.scores.length > 0 ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length : 0;
        const avgChange = data.changes.length > 0 ? data.changes.reduce((a, b) => a + b, 0) / data.changes.length : 0;
        sectorSummary[sc] = {
          sectorName: SECTOR_INDICES[sc]?.name ?? sc,
          avgScore: Math.round(avgScore * 10) / 10,
          avgChange: Math.round(avgChange * 100) / 100,
          stockCount: data.stocks.length,
          topStock: data.stocks[0] ?? "",
        };
      }

      // Toplam sinyal sayıları
      let totalBullish = 0, totalBearish = 0;
      for (const [, counts] of signalCountMap) {
        totalBullish += counts.bullish;
        totalBearish += counts.bearish;
      }

      const response = {
        stocks,
        macroData,
        regime,
        generatedAt: summaries.length > 0 ? (summaries[0]?.analyzedAt?.toISOString() ?? new Date().toISOString()) : new Date().toISOString(),
        index,
        timeframe: "daily",
        sectorSummary,
        marketSummary: {
          avgComposite: scoreCount > 0 ? Math.round((totalScore / scoreCount) * 10) / 10 : 0,
          strongBuyCount: strongBuy, buyCount: buy, holdCount: hold,
          sellCount: sell, strongSellCount: strongSell,
          bullishSignalCount: totalBullish, bearishSignalCount: totalBearish,
        },
        signalAccuracy: signalAccuracyRecord,
        stale: false,
      };

      const cacheTTL = isOpen ? 60 : 300;
      await cacheSet(cacheKey, response, cacheTTL);

      return NextResponse.json(response, {
        headers: { "Cache-Control": `public, s-maxage=${cacheTTL}, stale-while-revalidate=60` },
      });
    }

    // ── DailySummary boşsa → ScreenerSnapshot fallback ──
    const { snapshots: screenerSnapshots, stale } = await getScreenerSnapshots(index);

    if (screenerSnapshots.length === 0) {
      // Son fallback: canlı hesaplama (bist30/50 için)
      if (index === "bist30" || index === "bist50") {
        try {
          const { analyzeStockIndex } = await import("@/lib/stock/batch-analysis");
          const liveResult = await analyzeStockIndex(index, "daily");
          const liveResponse = { ...liveResult, stale: false };
          await cacheSet(cacheKey, liveResponse, 120);
          return NextResponse.json(liveResponse, {
            headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
          });
        } catch (e) {
          console.error("[screener] live fallback failed:", e);
        }
      }

      return NextResponse.json({
        stocks: [], macroData: null, regime: "NORMAL",
        generatedAt: new Date().toISOString(), index, timeframe: "daily",
        sectorSummary: {}, marketSummary: {
          avgComposite: 0, strongBuyCount: 0, buyCount: 0,
          holdCount: 0, sellCount: 0, strongSellCount: 0,
          bullishSignalCount: 0, bearishSignalCount: 0,
        },
        stale: true,
        message: "Henüz analiz çalıştırılmamış.",
      });
    }

    const result = snapshotsToScreenerResult(screenerSnapshots, index, stale);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("[screener] error:", error);
    return NextResponse.json({ error: "Tarama verisi alınamadı" }, { status: 500 });
  }
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "GÜÇLÜ AL";
  if (score >= 60) return "AL";
  if (score >= 40) return "NÖTR";
  if (score >= 20) return "SAT";
  return "GÜÇLÜ SAT";
}
