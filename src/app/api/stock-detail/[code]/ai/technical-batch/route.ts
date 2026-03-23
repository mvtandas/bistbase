import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { getHistoricalBars } from "@/lib/stock/yahoo";
import { getIstanbulToday } from "@/lib/date-utils";
import { calculateFullTechnicals } from "@/lib/stock/technicals";
import { detectSignals } from "@/lib/stock/signals";
import { detectCandlestickPatterns } from "@/lib/stock/candlesticks";
import { detectChartPatterns } from "@/lib/stock/chart-patterns";
import { calculateExtraIndicators } from "@/lib/stock/extra-indicators";
import { detectSignalChains } from "@/lib/stock/signal-chains";
import { analyzeSignalCombinations } from "@/lib/stock/signal-combinations";
import { analyzeMultiTimeframe } from "@/lib/stock/multi-timeframe";
import { calculateBacktest } from "@/lib/stock/backtest";
import { generateSpecializedInsightWithSchema } from "@/lib/ai/specialized";
import { buildTeknikYorumPrompt, buildSinyalCozumPrompt, buildIslemKurulumuPrompt } from "@/lib/ai/specialized-prompts";
import { TeknikYorumSchema, SinyalCozumSchema, IslemKurulumuSchema } from "@/lib/ai/schemas";
import type { SinyalCozumOutput } from "@/lib/ai/schemas";
import { getCachedInsight, saveInsight } from "@/lib/ai/insight-cache";
import { getPromptVersion } from "@/lib/ai/prompt-registry";

export const maxDuration = 60;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = new (YahooFinance as any)({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const stockCode = code.toUpperCase();
  const todayUTC = getIstanbulToday();

  try {
    // 1. Check all 3 caches in parallel
    const [tyCache, scCache, ikCache] = await Promise.all([
      getCachedInsight(stockCode, "teknik-yorum", todayUTC),
      getCachedInsight(stockCode, "sinyal-cozum", todayUTC),
      getCachedInsight(stockCode, "islem-kurulumu", todayUTC),
    ]);

    // If all cached, return immediately
    if (tyCache && scCache && ikCache) {
      return NextResponse.json({
        teknikYorum: { cached: true, data: tyCache.data },
        sinyalCozum: { cached: true, data: scCache.data },
        islemKurulumu: { cached: true, data: ikCache.data },
      });
    }

    // 2. Fetch shared data ONCE
    const [bars, quote] = await Promise.all([
      getHistoricalBars(stockCode, 220).catch(() => []),
      yf.quote(`${stockCode}.IS`).catch(() => null),
    ]);

    if (bars.length < 5) {
      return NextResponse.json({ error: "Yeterli veri yok" }, { status: 404 });
    }

    const price = quote?.regularMarketPrice ?? bars[bars.length - 1]?.close ?? null;
    const volume = quote?.regularMarketVolume ?? null;

    // 3. Shared calculations ONCE
    const technicals = safe(() => calculateFullTechnicals(bars, price, volume, "daily"), null);
    const signals = safe(() => technicals && price ? detectSignals(technicals, price) : [], []);
    const candlestickPatterns = safe(() => detectCandlestickPatterns(bars), []);
    const chartPatterns = safe(() => detectChartPatterns(bars), []);
    const extraIndicators = safe(() => calculateExtraIndicators(bars, technicals?.bbUpper, technicals?.bbLower), null);
    const signalCombination = safe(() => analyzeSignalCombinations(signals), null);

    // Shared async ops in parallel
    const [signalChains, multiTimeframe, signalBacktest] = await Promise.all([
      detectSignalChains(stockCode, signals).catch(() => []),
      analyzeMultiTimeframe(stockCode, bars, technicals).catch(() => null),
      calculateBacktest(stockCode).catch(() => null),
    ]);

    // 4. Generate uncached insights
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: Record<string, any> = {};

    // teknik-yorum
    if (tyCache) {
      results.teknikYorum = { cached: true, data: tyCache.data };
    } else {
      const prompt = buildTeknikYorumPrompt({
        stockCode, price, candlestickPatterns, chartPatterns,
        technicals, signalChains, signalCombination, multiTimeframe,
      });
      const result = await generateSpecializedInsightWithSchema(prompt.system, prompt.user, TeknikYorumSchema, { maxTokens: 1200 });
      if (result) {
        saveInsight(stockCode, "teknik-yorum", todayUTC, result as object, "daily", { promptVersion: getPromptVersion("teknik-yorum") });
      }
      results.teknikYorum = { cached: false, data: result };
    }

    // sinyal-cozum
    if (scCache) {
      results.sinyalCozum = { cached: true, data: scCache.data };
    } else {
      const hasConflict = signalCombination?.conflicting || (signalCombination && signalCombination.totalBullish > 0 && signalCombination.totalBearish > 0);
      if (!hasConflict) {
        const noConflictResult: SinyalCozumOutput = {
          hasConflict: false,
          conflictSummary: "Sinyaller arasinda belirgin catisma yok.",
          resolution: "Sinyaller genel olarak ayni yonu isaret ediyor.",
          dominantSignal: { name: "", direction: "BULLISH", whyTrust: "" },
          ignoredSignals: [],
          netConclusion: "Sinyaller uyumlu, catisma analizi gerekmiyor.",
          confidenceInResolution: "HIGH",
        };
        results.sinyalCozum = { cached: false, data: noConflictResult };
      } else {
        const prompt = buildSinyalCozumPrompt({
          stockCode, price, signals, signalBacktest, multiTimeframe, signalCombination,
        });
        const result = await generateSpecializedInsightWithSchema(prompt.system, prompt.user, SinyalCozumSchema);
        if (result) {
          saveInsight(stockCode, "sinyal-cozum", todayUTC, result as object, "daily", { promptVersion: getPromptVersion("sinyal-cozum") });
        }
        results.sinyalCozum = { cached: false, data: result };
      }
    }

    // islem-kurulumu
    if (ikCache) {
      results.islemKurulumu = { cached: true, data: ikCache.data };
    } else {
      const prompt = buildIslemKurulumuPrompt({
        stockCode, price, chartPatterns, candlestickPatterns,
        signalChains, technicals, extraIndicators, multiTimeframe, signals,
      });
      const result = await generateSpecializedInsightWithSchema(prompt.system, prompt.user, IslemKurulumuSchema);
      if (result) {
        saveInsight(stockCode, "islem-kurulumu", todayUTC, result as object, "daily", { promptVersion: getPromptVersion("islem-kurulumu") });
      }
      results.islemKurulumu = { cached: false, data: result };
    }

    return NextResponse.json(results);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`Technical batch error for ${stockCode}: ${msg}`);
    return NextResponse.json({ error: "AI analizi uretilemedi", detail: msg }, { status: 500 });
  }
}
