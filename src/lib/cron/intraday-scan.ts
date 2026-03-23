/**
 * Intraday Scan — Saatlik Tam Analiz
 * analyzeStockFull() ortak pipeline kullanır.
 * Verdict değişiminde AI tetiklenir, VerdictSnapshot kaydedilir.
 */

import { prisma } from "@/lib/prisma";
import { analyzeStockFull, type StockAnalysisResult, type AnalyzePipelineOptions } from "@/lib/stock/analyze-pipeline";
import { getSignalAccuracyMap } from "@/lib/stock/signal-calibration";
import { getMacroData } from "@/lib/stock/macro";
import { generateStockAnalysis } from "@/lib/ai/provider";
import { calculateCompositeScore } from "@/lib/stock/scoring";
import { BIST100, BIST_ALL } from "@/lib/constants";
import { getIstanbulToday } from "@/lib/date-utils";
import { getMarketState } from "@/lib/stock/market-hours";
import { getRedis, cacheGet, cacheSet } from "@/lib/redis";

const CONCURRENT_BATCH_SIZE = 10; // BIST100 için 10'lu batch → 10 batch × ~10sn = ~100sn
const PRICE_CHANGE_THRESHOLD = 0.3; // %0.3 değişim eşiği (daha hassas)

export async function runIntradayScan(forceRun = false, partition?: number): Promise<{
  processed: number;
  skipped: number;
  failed: number;
  aiTriggered: number;
}> {
  // ── Concurrent cron koruması (force modda lock atla) ──
  const redis = getRedis();
  const lockKey = partition ? `lock:intraday-scan:p${partition}` : "lock:intraday-scan";
  if (redis && !forceRun) {
    const acquired = await redis.set(lockKey, "1", { nx: true, ex: 600 });
    if (!acquired) {
      console.log(`[intraday-scan] Already running (${lockKey}), skipping`);
      return { processed: 0, skipped: 0, failed: 0, aiTriggered: 0 };
    }
  } else if (redis && forceRun) {
    await redis.del(lockKey);
  }

  // ── Piyasa saati kontrolü ──
  const { isOpen, istanbulHour } = getMarketState();
  if (!isOpen && !forceRun) {
    console.log("[intraday-scan] Market closed, skipping");
    return { processed: 0, skipped: 0, failed: 0, aiTriggered: 0 };
  }

  // Kapanışa yakın (17:45-18:00) → tüm hisseler için AI zorunlu
  const forceAI = istanbulHour >= 17;

  const today = getIstanbulToday();
  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let aiTriggered = 0;

  // ── Kapsam belirleme ──
  const portfolioStocks = await prisma.portfolio.findMany({
    distinct: ["stockCode"],
    select: { stockCode: true },
  });

  let allCodes: string[];
  if (partition) {
    // Partitioned: BIST_ALL'ı 4 parçaya böl
    const totalPartitions = 4;
    const perPartition = Math.ceil(BIST_ALL.length / totalPartitions);
    const start = (partition - 1) * perPartition;
    const end = Math.min(start + perPartition, BIST_ALL.length);
    const partitionCodes = BIST_ALL.slice(start, end);
    // Partition 1'e portföy hisselerini de ekle
    allCodes = partition === 1
      ? [...new Set([...partitionCodes, ...portfolioStocks.map((s) => s.stockCode)])]
      : [...partitionCodes];
  } else {
    // Partition yoksa: BIST100 + portföy (varsayılan)
    allCodes = [...new Set([...BIST100, ...portfolioStocks.map((s) => s.stockCode)])];
  }

  const stockCodes = allCodes;

  console.log(`[intraday-scan] isOpen=${isOpen}, forceRun=${forceRun}, stocks=${stockCodes.length}, hour=${istanbulHour}`);
  if (stockCodes.length === 0) return { processed: 0, skipped: 0, failed: 0, aiTriggered: 0 };

  // ── Paylaşılan veriler (1 kez çek) ──
  const [accuracyMap, macroData] = await Promise.all([
    getSignalAccuracyMap().catch(() => new Map()),
    getMacroData().catch(() => null),
  ]);

  // ── Mevcut DailySummary'leri oku (karşılaştırma + sentiment koruma) ──
  const existingSummaries = await prisma.dailySummary.findMany({
    where: { date: today, stockCode: { in: stockCodes }, timeframe: "daily" },
    select: {
      stockCode: true, verdictAction: true, compositeScore: true,
      closePrice: true, sentimentValue: true,
    },
  });
  const prevState = new Map(
    existingSummaries.map((s) => [s.stockCode, {
      verdict: s.verdictAction,
      score: s.compositeScore,
      price: s.closePrice,
      sentimentValue: s.sentimentValue,
    }])
  );

  // ── Batch analiz ──
  for (let i = 0; i < stockCodes.length; i += CONCURRENT_BATCH_SIZE) {
    const batch = stockCodes.slice(i, i + CONCURRENT_BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((code) => processStock(code, today, istanbulHour, accuracyMap, macroData, prevState, forceAI))
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        if (result.value === "skipped") skipped++;
        else if (result.value === "ai_triggered") { processed++; aiTriggered++; }
        else processed++;
      } else {
        console.error("[intraday-scan] Failed:", result.reason);
        failed++;
      }
    }
  }

  // ── Lock serbest bırak ──
  if (redis) await redis.del(lockKey);

  return { processed, skipped, failed, aiTriggered };
}

async function processStock(
  stockCode: string,
  today: Date,
  hour: number,
  accuracyMap: Map<string, unknown>,
  macroData: unknown,
  prevState: Map<string, { verdict: string | null; score: number | null; price: number | null; sentimentValue: number | null }>,
  forceAI = false,
): Promise<"processed" | "skipped" | "ai_triggered"> {

  const prev = prevState.get(stockCode);

  // ── Sentiment koruma: önceki AI sentiment'ı kullan ──
  const sentimentValue = prev?.sentimentValue ?? 0;

  // ── Ortak pipeline ile analiz ──
  const result = await analyzeStockFull(stockCode, {
    sentimentValue,
    accuracyMap: accuracyMap as AnalyzePipelineOptions["accuracyMap"],
    macroData: macroData as AnalyzePipelineOptions["macroData"],
    filterDate: today,
  });

  if (!result.price) return "skipped";

  // ── Fiyat değişim kontrolü (ilk analiz yoksa atla) ──
  const hasExistingAnalysis = prev?.score != null;
  if (hasExistingAnalysis && prev?.price && Math.abs((result.price - prev.price) / prev.price * 100) < PRICE_CHANGE_THRESHOLD) {
    return "skipped";
  }

  // ── DB'ye yaz: DailySummary ──
  await prisma.dailySummary.upsert({
    where: { stockCode_date_timeframe: { stockCode, date: today, timeframe: "daily" } },
    create: {
      stockCode, date: today,
      closePrice: result.price, changePercent: result.changePercent,
      volume: result.volume ? BigInt(Math.round(result.volume)) : null,
      compositeScore: result.compositeScore?.composite ?? null,
      verdictAction: result.verdict?.action ?? null,
      verdictScore: result.verdict?.score ?? null,
      verdictConfidence: result.verdict?.confidence ?? null,
      sentimentValue,
      status: "COMPLETED",
      analyzedAt: new Date(),
    },
    update: {
      closePrice: result.price, changePercent: result.changePercent,
      volume: result.volume ? BigInt(Math.round(result.volume)) : null,
      compositeScore: result.compositeScore?.composite ?? null,
      verdictAction: result.verdict?.action ?? null,
      verdictScore: result.verdict?.score ?? null,
      verdictConfidence: result.verdict?.confidence ?? null,
      analyzedAt: new Date(),
    },
  });

  // ── DB'ye yaz: TechnicalSnapshot ──
  if (result.technicals) {
    const t = result.technicals;
    await prisma.technicalSnapshot.upsert({
      where: { stockCode_date: { stockCode, date: today } },
      create: {
        stockCode, date: today, closePrice: result.price,
        rsi14: t.rsi14, ma20: t.ma20, ma50: t.ma50, ma200: t.ma200,
        ema12: t.ema12, ema26: t.ema26,
        macdLine: t.macdLine, macdSignal: t.macdSignal, macdHistogram: t.macdHistogram,
        bbUpper: t.bbUpper, bbMiddle: t.bbMiddle, bbLower: t.bbLower,
        bbWidth: t.bbWidth, bbPercentB: t.bbPercentB, atr14: t.atr14,
        stochK: t.stochK, stochD: t.stochD,
        obv: t.obv ? Math.round(t.obv) : null, obvMa20: t.obvMa20,
        adx14: t.adx14, plusDI: t.plusDI, minusDI: t.minusDI,
        volume: result.volume ? BigInt(Math.round(result.volume)) : null,
        volumeAvg20: t.volumeAvg20, volumeRatio: t.volumeRatio,
        supportLevel: t.support, resistLevel: t.resistance,
        technicalScore: result.compositeScore?.technical ?? null,
        momentumScore: result.compositeScore?.momentum ?? null,
        volumeScore: result.compositeScore?.volume ?? null,
        volatilityScore: result.compositeScore?.volatility ?? null,
        compositeScore: result.compositeScore?.composite ?? null,
      },
      update: {
        closePrice: result.price, rsi14: t.rsi14,
        compositeScore: result.compositeScore?.composite ?? null,
      },
    });
  }

  // ── DB'ye yaz: Signals ──
  for (const signal of result.filteredSignals) {
    await prisma.signal.upsert({
      where: {
        stockCode_date_signalType_signalDirection: {
          stockCode, date: today, signalType: signal.type, signalDirection: signal.direction,
        },
      },
      create: {
        stockCode, date: today, signalType: signal.type, signalDirection: signal.direction,
        strength: signal.strength, description: signal.description, priceAtSignal: result.price,
      },
      update: { strength: signal.strength, description: signal.description, priceAtSignal: result.price },
    });
  }

  // ── Redis'e yaz: stock-detail cache (Adım 4) ──
  const stockDetailCache = buildStockDetailCache(result);
  await cacheSet(`stock-detail:critical:${stockCode}`, stockDetailCache, 960); // 16dk (scan her 15dk, 1dk buffer)

  // ── Verdict snapshot (değişim varsa) ──
  const verdictChanged = result.verdict?.action && result.verdict.action !== prev?.verdict;
  const scoreChanged = result.compositeScore?.composite != null && prev?.score != null
    && Math.abs(result.compositeScore.composite - prev.score) >= 10;

  if (verdictChanged || scoreChanged) {
    await prisma.verdictSnapshot.upsert({
      where: { stockCode_date_hour: { stockCode, date: today, hour } },
      create: {
        stockCode, date: today, hour,
        verdictAction: result.verdict!.action,
        verdictScore: result.verdict?.score ?? 0,
        compositeScore: result.compositeScore?.composite ?? null,
        price: result.price,
      },
      update: {
        verdictAction: result.verdict!.action,
        verdictScore: result.verdict?.score ?? 0,
        compositeScore: result.compositeScore?.composite ?? null,
        price: result.price,
      },
    });
  }

  // ── AI koşullu tetikleme ──
  const hasNewStrongSignals = result.filteredSignals.some((s) => s.strength >= 65);
  const shouldTriggerAI = forceAI || verdictChanged || scoreChanged || hasNewStrongSignals;

  if (shouldTriggerAI) {
    // Email flood kontrolü
    const emailKey = `email-sent:${stockCode}:${today.toISOString().split("T")[0]}`;
    const alreadySentEmail = await cacheGet<boolean>(emailKey);

    try {
      const headlines = await (await import("@/lib/news/kap-rss")).getStockNews(stockCode).catch(() => []);
      const analysis = await generateStockAnalysis({
        stockCode, price: result.price, changePercent: result.changePercent, volume: result.volume,
        newsHeadlines: headlines, date: today.toISOString().split("T")[0],
        technicals: result.technicals, compositeScore: result.compositeScore,
        signals: result.allSignals, sectorContext: result.sectorContext,
        fundamentals: result.fundamentalData, fundamentalScore: result.fundScore,
        macroData: result.macroData, riskMetrics: result.riskMetrics,
        candlestickPatterns: result.candlestickPatterns, chartPatterns: result.chartPatterns,
        extraIndicators: result.extraIndicators, signalChains: result.signalChains,
      });

      if (analysis) {
        const finalScore = result.technicals && result.price != null
          ? calculateCompositeScore(
              result.technicals, result.price, analysis.sentimentValue,
              result.fundScore, result.macroData, result.sectorContext?.sectorCode,
            )
          : result.compositeScore;

        await prisma.dailySummary.update({
          where: { stockCode_date_timeframe: { stockCode, date: today, timeframe: "daily" } },
          data: {
            aiSummaryText: analysis.summaryText,
            bullCase: analysis.bullCase, bearCase: analysis.bearCase,
            sentimentScore: analysis.sentimentValue >= 30 ? "POSITIVE" : analysis.sentimentValue <= -30 ? "NEGATIVE" : "NEUTRAL",
            sentimentValue: analysis.sentimentValue,
            confidence: analysis.confidence,
            verdictReason: analysis.verdictReason ?? null,
            compositeScore: finalScore?.composite ?? result.compositeScore?.composite ?? null,
          },
        });

        // Redis cache güncelle (AI dahil)
        const updatedCache = {
          ...stockDetailCache,
          aiSummaryText: analysis.summaryText,
          bullCase: analysis.bullCase, bearCase: analysis.bearCase,
          sentimentValue: analysis.sentimentValue,
        };
        await cacheSet(`stock-detail:critical:${stockCode}`, updatedCache, 960);
      }

      // Email (günde 1 kez)
      if (!alreadySentEmail && result.filteredSignals.filter((s) => s.strength >= 65).length > 0) {
        try {
          const { sendEmail, buildSignalAlertHtml } = await import("@/lib/email");
          const subscribers = await prisma.user.findMany({
            where: { portfolios: { some: { stockCode } }, alertPrefs: { signalAlerts: true } },
            select: { email: true },
          });
          const strongSignals = result.filteredSignals.filter((s) => s.strength >= 65);
          for (const sub of subscribers) {
            if (sub.email) {
              await sendEmail({
                to: sub.email,
                subject: `Bistbase — ${stockCode} sinyali (${strongSignals.length} yeni)`,
                html: buildSignalAlertHtml(stockCode, strongSignals),
              });
            }
          }
          await cacheSet(emailKey, true, 86400);
        } catch { /* email hatası analizi durdurmaz */ }
      }
    } catch (e) {
      console.error(`[intraday-scan] AI failed for ${stockCode}:`, e);
    }

    return "ai_triggered";
  }

  return "processed";
}

/** stock-detail API response formatında cache objesi oluştur */
function buildStockDetailCache(r: StockAnalysisResult) {
  const { computeChartOverlays } = require("@/lib/stock/chart-overlays");
  const chartOverlays = r.bars.length > 0 && r.technicals
    ? computeChartOverlays(r.bars, r.technicals.support ?? null, r.technicals.resistance ?? null)
    : { ma20: [], ma50: [], ma200: [], bbUpper: [], bbLower: [], support: null, resistance: null };

  return {
    code: r.code,
    name: r.quote?.name ?? r.code,
    price: r.price,
    changePercent: r.changePercent,
    volume: r.volume,
    technicals: r.technicals,
    score: r.compositeScore,
    signals: r.allSignals,
    verdict: r.verdict,
    fundamentalScore: r.fundScore,
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
    macroData: r.macroData,
    priceHistory: r.bars.slice(-30).map((b) => ({ date: b.date, close: b.close })),
    chartBars: r.bars.map((b) => ({ date: b.date, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume })),
    chartOverlays,
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
    // Lazy fields
    seasonality: null, scoreTrend: null, peerComparison: null,
    volatilityRegime: null, turkishSeasonality: null, indexInclusion: null,
    bankMetrics: null, reitMetrics: null, economicCalendar: null,
    searchInterest: null, kapFinancials: null, recentSignals: [],
  };
}
