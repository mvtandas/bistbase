import { prisma } from "@/lib/prisma";
import { getStockQuote, getHistoricalBars } from "@/lib/stock/yahoo";
import { getStockNews } from "@/lib/news/kap-rss";
import { generateStockAnalysis } from "@/lib/ai/provider";
import { calculateFullTechnicals } from "@/lib/stock/technicals";
import { calculateCompositeScore } from "@/lib/stock/scoring";
import { detectSignals } from "@/lib/stock/signals";
import { calculateSectorContext } from "@/lib/stock/sectors";
import { getFundamentalData, scoreFundamentals } from "@/lib/stock/fundamentals";
import { getMacroData } from "@/lib/stock/macro";
import { getSignalAccuracyMap, calibrateSignalStrength } from "@/lib/stock/signal-calibration";
import { detectCandlestickPatterns } from "@/lib/stock/candlesticks";
import { detectChartPatterns } from "@/lib/stock/chart-patterns";
import { calculateExtraIndicators } from "@/lib/stock/extra-indicators";
import { detectSignalChains } from "@/lib/stock/signal-chains";
import { calculateVerdict, type VerdictInput } from "@/lib/stock/verdict";
import { analyzeSignalCombinations } from "@/lib/stock/signal-combinations";
import { analyzeMultiTimeframe } from "@/lib/stock/multi-timeframe";
import { calculateBacktest } from "@/lib/stock/backtest";
import { filterSignals } from "@/lib/stock/signal-filter";
import { BIST30 } from "@/lib/constants";
import { getIstanbulToday, toIstanbulDateUTC } from "@/lib/date-utils";
import { getCachedInsight, saveInsight } from "@/lib/ai/insight-cache";
import { buildAkilliOzetPrompt, buildTeknikYorumPrompt } from "@/lib/ai/specialized-prompts";
import { AkilliOzetSchema, TeknikYorumSchema } from "@/lib/ai/schemas";
import { generateSpecializedInsightWithSchema } from "@/lib/ai/specialized";
import { getPromptVersion } from "@/lib/ai/prompt-registry";
import { analyzeSeasonality } from "@/lib/stock/seasonality";

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runDailyAnalysis(): Promise<{
  processed: number;
  skipped: number;
  failed: number;
}> {
  const today = getIstanbulToday();
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  // Analiz kapsamı: BIST30 + portföydeki hisseler
  // Paper trading ve sinyal performans takibi için BIST30 her gün analiz edilmeli
  const portfolioStocks = await prisma.portfolio.findMany({
    distinct: ["stockCode"],
    select: { stockCode: true },
  });
  const portfolioCodes = portfolioStocks.map((s) => s.stockCode);
  const stockCodes = [...new Set([...BIST30, ...portfolioCodes])];

  if (stockCodes.length === 0) return { processed: 0, skipped: 0, failed: 0 };

  const existing = await prisma.dailySummary.findMany({
    where: { date: today, stockCode: { in: stockCodes }, status: "COMPLETED" },
    select: { stockCode: true },
  });
  const existingSet = new Set(existing.map((s) => s.stockCode));
  const toAnalyze = stockCodes.filter((c) => !existingSet.has(c));
  skipped = existingSet.size;

  if (toAnalyze.length === 0) return { processed: 0, skipped, failed: 0 };

  // Sinyal kalibrasyon verisi — geçmiş performansa göre güç ayarlama
  const accuracyMap = await getSignalAccuracyMap();

  for (const stockCode of toAnalyze) {
    try {
      // Mark PENDING
      await prisma.dailySummary.upsert({
        where: { stockCode_date_timeframe: { stockCode, date: today, timeframe: "daily" } },
        create: { stockCode, date: today, status: "PENDING" },
        update: { status: "PENDING" },
      });

      // ── STEP 1: Fetch all data in parallel ──
      const [quote, headlines, bars, fundamentalData, macroData] = await Promise.all([
        getStockQuote(stockCode),
        getStockNews(stockCode),
        getHistoricalBars(stockCode, 220),
        getFundamentalData(stockCode),
        getMacroData(),
      ]);

      const price = quote?.price ?? null;
      const changePercent = quote?.changePercent ?? null;
      const volume = quote?.volume ?? null;

      // ── STEP 2: Calculate technicals (CODE, not AI) ──
      const technicals = bars.length > 0
        ? calculateFullTechnicals(bars, price, volume)
        : null;

      // ── STEP 3: Detect signals (CODE, not AI) ──
      const rawSignals = technicals && price
        ? detectSignals(technicals, price)
        : [];

      // ── STEP 3b: Candlestick patterns → sinyallere ekle ──
      const candlesticks = detectCandlestickPatterns(bars);
      for (const cp of candlesticks) {
        rawSignals.push({
          type: `CANDLE_${cp.name}`,
          direction: cp.direction,
          strength: cp.strength,
          description: cp.description,
        });
      }

      // ── STEP 3c: Chart patterns → sinyallere ekle ──
      const chartPatterns = detectChartPatterns(bars);
      for (const cp of chartPatterns) {
        rawSignals.push({
          type: `CHART_${cp.name}`,
          direction: cp.direction,
          strength: cp.strength,
          description: cp.description,
        });
      }

      // ── STEP 3d: Extra indicators ──
      const extraIndicators = calculateExtraIndicators(
        bars,
        technicals?.bbUpper,
        technicals?.bbLower
      );
      // TTM Squeeze sinyali (Bollinger + Keltner)
      if (extraIndicators.ttmSqueeze) {
        rawSignals.push({
          type: "TTM_SQUEEZE",
          direction: "NEUTRAL",
          strength: 75,
          description: "TTM Squeeze: Bollinger bantları Keltner kanalının içine girdi. Çok güçlü kırılım hareketi bekleniyor.",
        });
      }
      // Parabolic SAR flip
      if (extraIndicators.sarTrend && bars.length >= 2) {
        // SAR flip tespiti için basit proxy: SAR trend yönü
        if (extraIndicators.sarTrend === "BULLISH" && extraIndicators.parabolicSar != null && price != null && price > extraIndicators.parabolicSar) {
          // SAR bullish ve fiyat SAR üstünde — devam sinyali
        }
      }

      // ── STEP 3e: Calibrate signal strengths from historical accuracy ──
      const signals = rawSignals.map((s) => ({
        ...s,
        strength: calibrateSignalStrength(s.strength, s.type, accuracyMap),
      }));

      // ── STEP 3f: Signal chains (ardışık tetikleyiciler) ──
      const signalChains = await detectSignalChains(stockCode, signals);
      // Zincir sinyallerini de ekle
      for (const chain of signalChains) {
        signals.push({
          type: `CHAIN_${chain.name}`,
          direction: chain.direction,
          strength: chain.strength,
          description: `${chain.nameTr}: ${chain.description}`,
        });
      }

      // ── STEP 4: Sector context ──
      const sectorContext = changePercent != null
        ? await calculateSectorContext(stockCode, changePercent)
        : null;

      // ── STEP 5: Fundamental scoring (CODE, not AI) ──
      const fundScore = fundamentalData
        ? scoreFundamentals(fundamentalData)
        : null;

      // ── STEP 6: Preliminary composite score (8 factors, sentiment=0 before AI) ──
      const preScore = technicals && price
        ? calculateCompositeScore(technicals, price, 0, fundScore, macroData, sectorContext?.sectorCode)
        : null;

      // ── STEP 7: Risk metrics ──
      const riskMetrics = bars.length > 30
        ? (await import("@/lib/stock/risk")).calculateRiskMetrics(bars, fundamentalData?.beta ?? null)
        : null;

      // ── STEP 8: AI — storytelling with ALL 10 layers ──
      const analysis = await generateStockAnalysis({
        stockCode,
        price,
        changePercent,
        volume,
        newsHeadlines: headlines,
        date: today.toISOString().split("T")[0],
        technicals,
        compositeScore: preScore,
        signals,
        sectorContext,
        fundamentals: fundamentalData,
        fundamentalScore: fundScore,
        macroData,
        riskMetrics,
        candlestickPatterns: candlesticks,
        chartPatterns,
        extraIndicators,
        signalChains,
      });

      if (analysis) {
        // ── STEP 8: Final composite score (with real sentiment + fundamentals + macro) ──
        const finalScore = technicals && price
          ? calculateCompositeScore(technicals, price, analysis.sentimentValue, fundScore, macroData, sectorContext?.sectorCode)
          : preScore;

        // ── STEP 8.5: Calculate verdict for persistence ──
        let verdictAction: string | null = null;
        let verdictScore: number | null = null;
        let verdictConfidence: number | null = null;
        try {
          const signalCombination = analyzeSignalCombinations(signals);
          const signalAccuracy = accuracyMap;
          const [multiTimeframe, signalBacktest] = await Promise.all([
            bars.length > 0 && technicals
              ? analyzeMultiTimeframe(stockCode, bars, { rsi14: technicals.rsi14, maAlignment: technicals.maAlignment })
              : Promise.resolve(null),
            calculateBacktest(stockCode),
          ]);
          // Convert Map to Record for verdict input
          const signalAccuracyRecord: Record<string, { rate: number; count: number }> = {};
          for (const [key, val] of signalAccuracy) {
            signalAccuracyRecord[key] = { rate: val.accuracyRate, count: val.totalCount };
          }
          const verdict = calculateVerdict({
            price,
            technicals: technicals as Record<string, unknown> | null,
            extraIndicators: extraIndicators as unknown as VerdictInput["extraIndicators"],
            score: finalScore,
            fundamentalScore: fundScore,
            signals,
            signalCombination: signalCombination ? {
              totalBullish: signalCombination.totalBullish,
              totalBearish: signalCombination.totalBearish,
              confluenceType: signalCombination.confluenceType,
              conflicting: signalCombination.conflicting,
            } : null,
            signalAccuracy: signalAccuracyRecord,
            multiTimeframe: multiTimeframe ? {
              weekly: { trend: multiTimeframe.weekly.trend },
              daily: { trend: multiTimeframe.daily?.trend ?? null },
              alignment: multiTimeframe.alignment,
            } : null,
            macroData,
            riskMetrics,
            sentimentValue: analysis.sentimentValue,
            signalBacktest: signalBacktest?.performances?.length ? {
              performances: signalBacktest.performances.map(p => ({
                signalType: p.signalType,
                horizon1D: p.horizon1D,
                bestHorizon: p.bestHorizon,
                confidenceScore: p.confidenceScore,
                streaks: p.streaks,
              })),
            } : null,
          });
          verdictAction = verdict.action;
          verdictScore = verdict.score;
          verdictConfidence = verdict.confidence;
        } catch (e) {
          console.error(`Verdict calculation failed for ${stockCode}:`, e);
        }

        // ── STEP 9: Persist everything ──

        // 9a. TechnicalSnapshot (persistent, not ephemeral!)
        if (technicals) {
          await prisma.technicalSnapshot.upsert({
            where: { stockCode_date: { stockCode, date: today } },
            create: {
              stockCode, date: today,
              closePrice: price,
              rsi14: technicals.rsi14,
              ma20: technicals.ma20, ma50: technicals.ma50, ma200: technicals.ma200,
              ema12: technicals.ema12, ema26: technicals.ema26,
              macdLine: technicals.macdLine, macdSignal: technicals.macdSignal, macdHistogram: technicals.macdHistogram,
              bbUpper: technicals.bbUpper, bbMiddle: technicals.bbMiddle, bbLower: technicals.bbLower,
              bbWidth: technicals.bbWidth, bbPercentB: technicals.bbPercentB,
              atr14: technicals.atr14,
              stochK: technicals.stochK, stochD: technicals.stochD,
              obv: technicals.obv ? Math.round(technicals.obv) : null,
              obvMa20: technicals.obvMa20,
              adx14: technicals.adx14, plusDI: technicals.plusDI, minusDI: technicals.minusDI,
              volume: volume ? BigInt(Math.round(volume)) : null,
              volumeAvg20: technicals.volumeAvg20, volumeRatio: technicals.volumeRatio,
              supportLevel: technicals.support, resistLevel: technicals.resistance,
              technicalScore: finalScore?.technical ?? null,
              momentumScore: finalScore?.momentum ?? null,
              volumeScore: finalScore?.volume ?? null,
              volatilityScore: finalScore?.volatility ?? null,
              compositeScore: finalScore?.composite ?? null,
            },
            update: {
              closePrice: price,
              rsi14: technicals.rsi14,
              compositeScore: finalScore?.composite ?? null,
            },
          });
        }

        // 8b. Signal filtering (debounce + liquidity + minimum strength)
        const avgVolumeTL = volume && price ? volume * price / 20 : null; // rough daily avg
        const { filtered: filteredSignals } = await filterSignals(signals, {
          stockCode,
          date: today,
          avgVolumeTL,
        });

        // 8b2. Signals + alert (upsert ile duplikasyon önleme)
        for (const signal of filteredSignals) {
          await prisma.signal.upsert({
            where: {
              stockCode_date_signalType_signalDirection: {
                stockCode, date: today,
                signalType: signal.type,
                signalDirection: signal.direction,
              },
            },
            create: {
              stockCode, date: today,
              signalType: signal.type,
              signalDirection: signal.direction,
              strength: signal.strength,
              description: signal.description,
              priceAtSignal: price,
            },
            update: {
              strength: signal.strength,
              description: signal.description,
              priceAtSignal: price,
            },
          });
        }

        // 8b3. Sinyal alarmı gönder (güçlü sinyaller için)
        if (filteredSignals.length > 0) {
          const strongSignals = filteredSignals.filter(s => s.strength >= 65);
          if (strongSignals.length > 0) {
            try {
              const { sendEmail, buildSignalAlertHtml } = await import("@/lib/email");
              // Bu hisseyi takip eden ve sinyal alarmı açık kullanıcıları bul
              const subscribers = await prisma.user.findMany({
                where: {
                  portfolios: { some: { stockCode } },
                  alertPrefs: { signalAlerts: true },
                },
                select: { email: true },
              });
              for (const sub of subscribers) {
                if (sub.email) {
                  await sendEmail({
                    to: sub.email,
                    subject: `Bistbase — ${stockCode} sinyali (${strongSignals.length} yeni)`,
                    html: buildSignalAlertHtml(stockCode, strongSignals),
                  });
                }
              }
            } catch {
              // Email gönderimi başarısız olsa bile analiz devam etmeli
            }
          }
        }

        // 8c. SectorSnapshot (once per sector per day)
        if (sectorContext) {
          await prisma.sectorSnapshot.upsert({
            where: { sectorCode_date: { sectorCode: sectorContext.sectorCode, date: today } },
            create: {
              sectorCode: sectorContext.sectorCode,
              sectorName: sectorContext.sectorName,
              date: today,
              changePercent: sectorContext.sectorChange,
            },
            update: {},
          });
        }

        // 8d. DailySummary (expanded)
        await prisma.dailySummary.update({
          where: { stockCode_date_timeframe: { stockCode, date: today, timeframe: "daily" } },
          data: {
            closePrice: price,
            changePercent,
            volume: volume ? BigInt(Math.round(volume)) : null,
            newsHeadlines: headlines,
            aiSummaryText: analysis.summaryText,
            bullCase: analysis.bullCase,
            bearCase: analysis.bearCase,
            sentimentScore: analysis.sentimentValue >= 30 ? "POSITIVE" : analysis.sentimentValue <= -30 ? "NEGATIVE" : "NEUTRAL",
            sentimentValue: analysis.sentimentValue,
            confidence: analysis.confidence,
            verdictReason: analysis.verdictReason ?? null,
            compositeScore: finalScore?.composite ?? null,
            sectorCode: sectorContext?.sectorCode ?? null,
            sectorChange: sectorContext?.sectorChange ?? null,
            relativeStrength: sectorContext?.relativeStrength ?? null,
            bist100Change: sectorContext?.bist100Change ?? null,
            analyzedAt: new Date(),
            status: "COMPLETED",
            verdictAction,
            verdictScore,
            verdictConfidence,
          },
        });

        processed++;

        // ── STEP 10: Pre-generate AI insights (akilli-ozet + teknik-yorum) ──
        try {
          const seasonality = bars.length > 60 ? analyzeSeasonality(bars) : null;

          // akilli-ozet
          const aoCached = await getCachedInsight(stockCode, "akilli-ozet", today);
          if (!aoCached) {
            const aoPrompt = buildAkilliOzetPrompt({
              stockCode, price, changePercent,
              compositeScore: finalScore, signals, riskMetrics,
              macroData, seasonality, fundamentalScore: fundScore,
            });
            const aoResult = await generateSpecializedInsightWithSchema(aoPrompt.system, aoPrompt.user, AkilliOzetSchema);
            if (aoResult) {
              await saveInsight(stockCode, "akilli-ozet", today, aoResult as object, "daily", { promptVersion: getPromptVersion("akilli-ozet") });
              console.log(`[analyze] Pre-generated akilli-ozet for ${stockCode}`);
            }
            await sleep(2000);
          }

          // teknik-yorum
          const tyCached = await getCachedInsight(stockCode, "teknik-yorum", today);
          if (!tyCached) {
            const tyPrompt = buildTeknikYorumPrompt({
              stockCode, price,
              candlestickPatterns: candlesticks,
              chartPatterns,
              technicals,
              signalChains,
              signalCombination: analyzeSignalCombinations(signals),
              multiTimeframe: bars.length > 0 && technicals
                ? await analyzeMultiTimeframe(stockCode, bars, { rsi14: technicals.rsi14, maAlignment: technicals.maAlignment }).catch(() => null)
                : null,
            });
            const tyResult = await generateSpecializedInsightWithSchema(tyPrompt.system, tyPrompt.user, TeknikYorumSchema, { maxTokens: 1200 });
            if (tyResult) {
              await saveInsight(stockCode, "teknik-yorum", today, tyResult as object, "daily", { promptVersion: getPromptVersion("teknik-yorum") });
              console.log(`[analyze] Pre-generated teknik-yorum for ${stockCode}`);
            }
            await sleep(2000);
          }
        } catch (insightErr) {
          console.warn(`[analyze] AI insight pre-generation failed for ${stockCode}:`, insightErr);
          // Non-fatal — main analysis already succeeded
        }

      } else {
        await prisma.dailySummary.update({
          where: { stockCode_date_timeframe: { stockCode, date: today, timeframe: "daily" } },
          data: { closePrice: price, changePercent, status: "FAILED" },
        });
        failed++;
      }

      await sleep(3000);
    } catch (error) {
      console.error(`Analysis failed for ${stockCode}:`, error);

      // Mark as FAILED in DB so we can retry later
      try {
        await prisma.dailySummary.update({
          where: { stockCode_date_timeframe: { stockCode, date: today, timeframe: "daily" } },
          data: { status: "FAILED" },
        });
      } catch { /* already failed, ignore */ }

      failed++;
    }
  }

  // ── RETRY: Re-process failed stocks (max 1 retry) ──
  if (failed > 0) {
    const failedStocks = await prisma.dailySummary.findMany({
      where: { date: today, status: "FAILED", timeframe: "daily" },
      select: { stockCode: true },
    });

    if (failedStocks.length > 0) {
      console.log(`[analyze] Retrying ${failedStocks.length} failed stocks...`);
      await sleep(10000); // Wait 10s before retry

      for (const { stockCode } of failedStocks) {
        try {
          await prisma.dailySummary.update({
            where: { stockCode_date_timeframe: { stockCode, date: today, timeframe: "daily" } },
            data: { status: "PENDING" },
          });

          const [quote, bars] = await Promise.all([
            getStockQuote(stockCode),
            getHistoricalBars(stockCode, 220),
          ]);

          const price = quote?.price ?? null;
          const changePercent = quote?.changePercent ?? null;
          const volume = quote?.volume ?? null;

          const technicals = bars.length > 0 ? calculateFullTechnicals(bars, price, volume) : null;
          const fundamentalData = await getFundamentalData(stockCode).catch(() => null);
          const fundScore = fundamentalData ? scoreFundamentals(fundamentalData) : null;
          const macroData = await getMacroData().catch(() => null);
          const score = technicals && price
            ? calculateCompositeScore(technicals, price, 0, fundScore, macroData, null)
            : null;

          // Save minimal analysis without AI (faster, cheaper)
          await prisma.dailySummary.update({
            where: { stockCode_date_timeframe: { stockCode, date: today, timeframe: "daily" } },
            data: {
              closePrice: price,
              changePercent,
              volume: volume ? BigInt(Math.round(volume)) : null,
              compositeScore: score?.composite ?? null,
              analyzedAt: new Date(),
              status: "COMPLETED",
              aiSummaryText: null, // No AI on retry — just data
            },
          });

          processed++;
          failed--;
          console.log(`[analyze] Retry succeeded for ${stockCode} (without AI)`);
          await sleep(2000);
        } catch (retryError) {
          console.error(`[analyze] Retry also failed for ${stockCode}:`, retryError);
        }
      }
    }
  }

  return { processed, skipped, failed };
}

/**
 * Geçmiş günler için analiz backfill
 * Yahoo'dan tarihsel barlar çekip her iş günü için analiz + AI çalıştırır
 */
export async function runBackfill(daysBack: number = 30, skipAI: boolean = false): Promise<{
  processed: number;
  skipped: number;
  failed: number;
}> {
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  const stocks = await prisma.portfolio.findMany({
    distinct: ["stockCode"],
    select: { stockCode: true },
  });

  if (stocks.length === 0) return { processed: 0, skipped: 0, failed: 0 };

  const stockCodes = stocks.map((s) => s.stockCode);
  const accuracyMap = await getSignalAccuracyMap();

  for (const stockCode of stockCodes) {
    try {
      // 220 günlük bar çek
      const [allBars, fundamentalData, macroData] = await Promise.all([
        getHistoricalBars(stockCode, 220),
        getFundamentalData(stockCode).catch(() => null),
        getMacroData().catch(() => null),
      ]);

      if (allBars.length < 30) {
        console.warn(`[backfill] ${stockCode}: Not enough bars (${allBars.length})`);
        failed++;
        continue;
      }

      const fundScore = fundamentalData ? scoreFundamentals(fundamentalData) : null;

      // Son N iş günü için analiz yap
      const startIdx = Math.max(30, allBars.length - daysBack);

      for (let i = startIdx; i < allBars.length; i++) {
        const bar = allBars[i];
        const barDate = new Date(bar.date + "T00:00:00Z");
        const dateUTC = toIstanbulDateUTC(barDate);

        // Zaten COMPLETED varsa atla
        const existing = await prisma.dailySummary.findUnique({
          where: { stockCode_date_timeframe: { stockCode, date: dateUTC, timeframe: "daily" } },
          select: { status: true },
        });
        if (existing?.status === "COMPLETED") {
          skipped++;
          continue;
        }

        try {
          // Barların bu güne kadarki kısmını al
          const windowBars = allBars.slice(0, i + 1);
          const price = bar.close;
          const volume = bar.volume;
          const prevBar = i > 0 ? allBars[i - 1] : null;
          const changePercent = prevBar ? ((price - prevBar.close) / prevBar.close) * 100 : null;

          // Teknikler
          const technicals = calculateFullTechnicals(windowBars, price, volume);
          const rawSignals = detectSignals(technicals, price);

          // Candlestick + chart patterns
          const candlesticks = detectCandlestickPatterns(windowBars);
          for (const cp of candlesticks) {
            rawSignals.push({ type: `CANDLE_${cp.name}`, direction: cp.direction, strength: cp.strength, description: cp.description });
          }
          const chartPatterns = detectChartPatterns(windowBars);
          for (const cp of chartPatterns) {
            rawSignals.push({ type: `CHART_${cp.name}`, direction: cp.direction, strength: cp.strength, description: cp.description });
          }

          // Calibrate
          const signals = rawSignals.map((s) => ({
            ...s,
            strength: calibrateSignalStrength(s.strength, s.type, accuracyMap),
          }));

          // Sektör
          const sectorContext = changePercent != null
            ? await calculateSectorContext(stockCode, changePercent).catch(() => null)
            : null;

          // Pre-score
          const preScore = calculateCompositeScore(technicals, price, 0, fundScore, macroData, sectorContext?.sectorCode);

          // Risk
          const riskMetrics = windowBars.length > 30
            ? (await import("@/lib/stock/risk")).calculateRiskMetrics(windowBars, fundamentalData?.beta ?? null)
            : null;

          // AI analizi (opsiyonel)
          let analysis: { summaryText: string; bullCase: string; bearCase: string; sentimentValue: number; confidence: string; verdictReason?: string } | null = null;
          if (!skipAI) {
            const headlines = await getStockNews(stockCode).catch(() => []);
            analysis = await generateStockAnalysis({
              stockCode, price, changePercent, volume,
              newsHeadlines: headlines,
              date: bar.date,
              technicals, compositeScore: preScore, signals, sectorContext,
              fundamentals: fundamentalData, fundamentalScore: fundScore,
              macroData, riskMetrics,
              candlestickPatterns: candlesticks, chartPatterns,
              extraIndicators: calculateExtraIndicators(windowBars, technicals?.bbUpper, technicals?.bbLower),
              signalChains: [],
            });
          }

          const sentiment = analysis?.sentimentValue ?? 0;
          const finalScore = calculateCompositeScore(technicals, price, sentiment, fundScore, macroData, sectorContext?.sectorCode);

          // TechnicalSnapshot
          await prisma.technicalSnapshot.upsert({
            where: { stockCode_date: { stockCode, date: dateUTC } },
            create: {
              stockCode, date: dateUTC, closePrice: price,
              rsi14: technicals.rsi14, ma20: technicals.ma20, ma50: technicals.ma50, ma200: technicals.ma200,
              ema12: technicals.ema12, ema26: technicals.ema26,
              macdLine: technicals.macdLine, macdSignal: technicals.macdSignal, macdHistogram: technicals.macdHistogram,
              bbUpper: technicals.bbUpper, bbMiddle: technicals.bbMiddle, bbLower: technicals.bbLower,
              bbWidth: technicals.bbWidth, bbPercentB: technicals.bbPercentB,
              atr14: technicals.atr14, stochK: technicals.stochK, stochD: technicals.stochD,
              obv: technicals.obv ? Math.round(technicals.obv) : null, obvMa20: technicals.obvMa20,
              adx14: technicals.adx14, plusDI: technicals.plusDI, minusDI: technicals.minusDI,
              volume: volume ? BigInt(Math.round(volume)) : null,
              volumeAvg20: technicals.volumeAvg20, volumeRatio: technicals.volumeRatio,
              supportLevel: technicals.support, resistLevel: technicals.resistance,
              technicalScore: finalScore?.technical ?? null, momentumScore: finalScore?.momentum ?? null,
              volumeScore: finalScore?.volume ?? null, volatilityScore: finalScore?.volatility ?? null,
              compositeScore: finalScore?.composite ?? null,
            },
            update: { closePrice: price, compositeScore: finalScore?.composite ?? null },
          });

          // Sinyaller (upsert ile duplikasyon önleme)
          for (const signal of signals) {
            await prisma.signal.upsert({
              where: {
                stockCode_date_signalType_signalDirection: {
                  stockCode, date: dateUTC,
                  signalType: signal.type, signalDirection: signal.direction,
                },
              },
              create: {
                stockCode, date: dateUTC,
                signalType: signal.type, signalDirection: signal.direction,
                strength: signal.strength, description: signal.description,
                priceAtSignal: price,
              },
              update: {
                strength: signal.strength, description: signal.description,
                priceAtSignal: price,
              },
            });
          }

          // SectorSnapshot
          if (sectorContext) {
            await prisma.sectorSnapshot.upsert({
              where: { sectorCode_date: { sectorCode: sectorContext.sectorCode, date: dateUTC } },
              create: { sectorCode: sectorContext.sectorCode, sectorName: sectorContext.sectorName, date: dateUTC, changePercent: sectorContext.sectorChange },
              update: {},
            });
          }

          // Verdict hesapla (gerçek 3-pillar engine)
          let bfVerdictAction: string | null = null;
          let bfVerdictScore: number | null = null;
          let bfVerdictConfidence: number | null = null;
          try {
            const extraIndicators = calculateExtraIndicators(windowBars, technicals?.bbUpper, technicals?.bbLower);
            const signalCombination = analyzeSignalCombinations(signals);
            const signalAccuracyRecord: Record<string, { rate: number; count: number }> = {};
            for (const [key, val] of accuracyMap) {
              signalAccuracyRecord[key] = { rate: val.accuracyRate, count: val.totalCount };
            }
            const verdict = calculateVerdict({
              price,
              technicals: technicals as unknown as Record<string, unknown> | null,
              extraIndicators: extraIndicators as unknown as VerdictInput["extraIndicators"],
              score: finalScore,
              fundamentalScore: fundScore,
              signals,
              signalCombination: signalCombination ? {
                totalBullish: signalCombination.totalBullish,
                totalBearish: signalCombination.totalBearish,
                confluenceType: signalCombination.confluenceType,
                conflicting: signalCombination.conflicting,
              } : null,
              signalAccuracy: signalAccuracyRecord,
              multiTimeframe: null, // Backfill'de MTF hesaplamıyoruz (performans)
              macroData,
              riskMetrics,
              sentimentValue: sentiment,
              signalBacktest: null,
            });
            bfVerdictAction = verdict.action;
            bfVerdictScore = verdict.score;
            bfVerdictConfidence = verdict.confidence;
          } catch {
            // Verdict hesaplanamadıysa null kalır
          }

          // DailySummary
          await prisma.dailySummary.upsert({
            where: { stockCode_date_timeframe: { stockCode, date: dateUTC, timeframe: "daily" } },
            create: {
              stockCode, date: dateUTC,
              closePrice: price, changePercent, volume: volume ? BigInt(Math.round(volume)) : null,
              aiSummaryText: analysis?.summaryText ?? null, bullCase: analysis?.bullCase ?? null, bearCase: analysis?.bearCase ?? null,
              sentimentScore: sentiment >= 30 ? "POSITIVE" : sentiment <= -30 ? "NEGATIVE" : "NEUTRAL",
              sentimentValue: sentiment, confidence: analysis?.confidence ?? null, verdictReason: analysis?.verdictReason ?? null,
              compositeScore: finalScore?.composite ?? null,
              sectorCode: sectorContext?.sectorCode ?? null, sectorChange: sectorContext?.sectorChange ?? null,
              relativeStrength: sectorContext?.relativeStrength ?? null, bist100Change: sectorContext?.bist100Change ?? null,
              verdictAction: bfVerdictAction,
              verdictScore: bfVerdictScore,
              verdictConfidence: bfVerdictConfidence,
              status: "COMPLETED",
            },
            update: {
              closePrice: price, changePercent,
              compositeScore: finalScore?.composite ?? null,
              verdictAction: bfVerdictAction,
              verdictScore: bfVerdictScore,
              verdictConfidence: bfVerdictConfidence,
              status: "COMPLETED",
            },
          });

          processed++;

          await sleep(skipAI ? 500 : 8000); // AI yoksa hızlı, varsa Groq limiti
        } catch (err) {
          console.error(`[backfill] ${stockCode} ${bar.date} failed:`, (err as Error)?.message ?? err);
          failed++;
        }
      }
    } catch (err) {
      console.error(`[backfill] ${stockCode} failed entirely:`, err);
      failed++;
    }
  }

  return { processed, skipped, failed };
}
