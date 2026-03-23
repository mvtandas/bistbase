/**
 * Ortak Analiz Pipeline
 * Tüm sinyal tespiti, skor hesaplama ve verdict üretimi tek yerde.
 * analyze.ts, intraday-scan.ts, batch-analysis.ts ve stock-detail hepsi bunu kullanır.
 */

import { getStockQuote, getHistoricalBars } from "./yahoo";
import { calculateFullTechnicals, type FullTechnicalData, type Timeframe } from "./technicals";
import { calculateCompositeScore, type CompositeScore } from "./scoring";
import { detectSignals, type DetectedSignal } from "./signals";
import { calculateSectorContext } from "./sectors";
import { getFundamentalData, scoreFundamentals, type FundamentalData, type FundamentalScore } from "./fundamentals";
import { getMacroData, type MacroData } from "./macro";
import { getSignalAccuracyMap, calibrateSignalStrength, type SignalAccuracy } from "./signal-calibration";
import { detectCandlestickPatterns, type CandlestickPattern } from "./candlesticks";
import { detectChartPatterns, type ChartPattern } from "./chart-patterns";
import { calculateExtraIndicators, type ExtraIndicators } from "./extra-indicators";
import { detectSignalChains, type SignalChain } from "./signal-chains";
import { calculateVerdict, type Verdict, type VerdictInput } from "./verdict";
import { analyzeSignalCombinations, type CombinationAnalysis } from "./signal-combinations";
import { analyzeMultiTimeframe, type TimeframeAnalysis } from "./multi-timeframe";
import { calculateBacktest } from "./backtest";
import { calculateRiskMetrics, type RiskMetrics } from "./risk";
import { filterSignals } from "./signal-filter";
import type { StockQuote } from "@/types";

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════

export interface StockAnalysisResult {
  // Core
  code: string;
  quote: StockQuote | null;
  price: number | null;
  changePercent: number | null;
  volume: number | null;

  // Analysis
  bars: { date: string; open: number; close: number; high: number; low: number; volume: number }[];
  technicals: FullTechnicalData | null;
  fundamentalData: FundamentalData | null;
  fundScore: FundamentalScore | null;
  macroData: MacroData | null;

  // Signals (calibrated + filtered)
  allSignals: DetectedSignal[];       // kalibrasyon + chain dahil
  filteredSignals: DetectedSignal[];  // blacklist + cooldown sonrası
  candlestickPatterns: CandlestickPattern[];
  chartPatterns: ChartPattern[];
  extraIndicators: ExtraIndicators | null;
  signalChains: SignalChain[];
  signalCombination: CombinationAnalysis | null;

  // Scoring
  compositeScore: CompositeScore | null;
  verdict: Verdict | null;

  // Extended
  riskMetrics: RiskMetrics | null;
  multiTimeframe: TimeframeAnalysis | null;
  sectorContext: Awaited<ReturnType<typeof calculateSectorContext>> | null;
  signalBacktest: VerdictInput["signalBacktest"];
  signalAccuracyRecord: Record<string, { rate: number; count: number }>;
}

export interface AnalyzePipelineOptions {
  sentimentValue?: number;         // AI sentiment (default: önceki değer veya 0)
  accuracyMap?: Map<string, SignalAccuracy>;  // paylaşılan kalibrasyon (batch'te 1 kez çek)
  macroData?: MacroData | null;    // paylaşılan makro (batch'te 1 kez çek)
  timeframe?: Timeframe;           // daily | weekly | monthly
  skipBacktest?: boolean;          // hız için backtest atla
  skipMultiTimeframe?: boolean;    // hız için MTF atla
  filterDate?: Date;               // sinyal filtreleme tarihi
}

// ═══════════════════════════════════════
// MAIN PIPELINE
// ═══════════════════════════════════════

export async function analyzeStockFull(
  code: string,
  options: AnalyzePipelineOptions = {},
): Promise<StockAnalysisResult> {
  const {
    sentimentValue = 0,
    timeframe = "daily",
    skipBacktest = false,
    skipMultiTimeframe = false,
  } = options;

  // ── 1: Veri çek (paralel) ──
  const [quote, bars, fundamentalData, macroData, accuracyMap] = await Promise.all([
    getStockQuote(code),
    timeframe === "daily"
      ? getHistoricalBars(code, 220).catch(() => [])
      : getHistoricalBars(code, 220).catch(() => []), // TODO: interval bars for weekly/monthly
    getFundamentalData(code).catch(() => null),
    options.macroData !== undefined ? Promise.resolve(options.macroData) : getMacroData().catch(() => null),
    options.accuracyMap ? Promise.resolve(options.accuracyMap) : getSignalAccuracyMap().catch(() => new Map()),
  ]);

  const price = quote?.price ?? null;
  const changePercent = quote?.changePercent ?? null;
  const volume = quote?.volume ?? null;

  // ── 2: Teknik analiz ──
  const technicals = bars.length > 0 && price != null
    ? safeCalc(() => calculateFullTechnicals(bars, price, volume, timeframe), null)
    : null;

  // ── 3: Sinyal tespiti (tam pipeline) ──
  const rawSignals: DetectedSignal[] = technicals && price
    ? safeCalc(() => detectSignals(technicals, price!), [])
    : [];

  // Candlestick patterns
  const candlestickPatterns = safeCalc(() => detectCandlestickPatterns(bars), []);
  for (const cp of candlestickPatterns) {
    rawSignals.push({ type: `CANDLE_${cp.name}`, direction: cp.direction, strength: cp.strength, description: cp.description });
  }

  // Chart patterns
  const chartPatterns = safeCalc(() => detectChartPatterns(bars), []);
  for (const cp of chartPatterns) {
    rawSignals.push({ type: `CHART_${cp.name}`, direction: cp.direction, strength: cp.strength, description: cp.description });
  }

  // Extra indicators
  const extraIndicators = safeCalc(
    () => calculateExtraIndicators(bars, technicals?.bbUpper, technicals?.bbLower),
    null,
  );
  if (extraIndicators?.ttmSqueeze) {
    rawSignals.push({
      type: "TTM_SQUEEZE", direction: "NEUTRAL", strength: 75,
      description: "TTM Squeeze: Bollinger bantları Keltner kanalının içine girdi. Çok güçlü kırılım hareketi bekleniyor.",
    });
  }

  // ── 4: Sinyal kalibrasyonu ──
  const allSignals = rawSignals.map((s) => ({
    ...s,
    strength: calibrateSignalStrength(s.strength, s.type, accuracyMap),
  }));

  // Signal chains
  const signalChains = await detectSignalChains(code, allSignals).catch(() => []);
  for (const chain of signalChains) {
    allSignals.push({
      type: `CHAIN_${chain.name}`, direction: chain.direction,
      strength: chain.strength, description: `${chain.nameTr}: ${chain.description}`,
    });
  }

  // ── 5: Temel analiz + Sektör ──
  const fundScore = fundamentalData ? safeCalc(() => scoreFundamentals(fundamentalData!), null) : null;
  const sectorContext = changePercent != null
    ? await calculateSectorContext(code, changePercent).catch(() => null)
    : null;

  // ── 6: Composite skor ──
  const compositeScore = technicals && price != null
    ? safeCalc(() => calculateCompositeScore(
        technicals!, price!, sentimentValue, fundScore, macroData, sectorContext?.sectorCode, timeframe,
      ), null)
    : null;

  // ── 7: Signal combinations ──
  const signalCombination = safeCalc(() => analyzeSignalCombinations(allSignals), null);

  // ── 8: Risk metrikleri ──
  const riskMetrics = bars.length > 30
    ? safeCalc(() => calculateRiskMetrics(bars, fundamentalData?.beta ?? null), null)
    : null;

  // ── 9: Multi-timeframe ──
  const multiTimeframe = !skipMultiTimeframe && timeframe === "daily"
    ? await analyzeMultiTimeframe(code, bars, technicals ? { rsi14: technicals.rsi14, maAlignment: technicals.maAlignment } : null).catch(() => null)
    : null;

  // ── 10: Signal backtest ──
  let signalBacktest: VerdictInput["signalBacktest"] = null;
  if (!skipBacktest) {
    try {
      const bt = await calculateBacktest(code);
      if (bt?.performances?.length) {
        signalBacktest = {
          performances: bt.performances.map((p) => ({
            signalType: p.signalType, horizon1D: p.horizon1D, bestHorizon: p.bestHorizon,
            confidenceScore: p.confidenceScore, streaks: p.streaks,
          })),
        };
      }
    } catch { /* continue */ }
  }

  // ── 11: Signal accuracy record ──
  const signalAccuracyRecord: Record<string, { rate: number; count: number }> = {};
  for (const [key, val] of accuracyMap) {
    signalAccuracyRecord[key] = { rate: val.accuracyRate, count: val.totalCount };
  }

  // ── 12: Sinyal filtreleme (verdict'ten ÖNCE — blacklisted sinyaller verdict'i bozuyordu) ──
  const filterDate = options.filterDate ?? new Date();
  const avgVolumeTL = volume && price ? volume * price / 20 : null;
  const { filtered: filteredSignals } = await filterSignals(allSignals, {
    stockCode: code, date: filterDate, avgVolumeTL,
  });

  // ── 13: Verdict ──
  let verdict: Verdict | null = null;
  try {
    verdict = calculateVerdict({
      price,
      technicals: technicals as unknown as Record<string, unknown> | null,
      extraIndicators: extraIndicators as unknown as VerdictInput["extraIndicators"],
      score: compositeScore,
      fundamentalScore: fundScore ? {
        valuationScore: fundScore.valuationScore, profitabilityScore: fundScore.profitabilityScore,
        growthScore: fundScore.growthScore, healthScore: fundScore.healthScore,
        fundamentalScore: fundScore.fundamentalScore,
      } : null,
      signals: filteredSignals,  // FIX: eskisi: allSignals
      signalCombination: signalCombination ? {
        totalBullish: signalCombination.totalBullish, totalBearish: signalCombination.totalBearish,
        confluenceType: signalCombination.confluenceType, conflicting: signalCombination.conflicting,
      } : null,
      signalAccuracy: signalAccuracyRecord,
      multiTimeframe: multiTimeframe ? {
        weekly: { trend: multiTimeframe.weekly.trend },
        daily: { trend: multiTimeframe.daily?.trend ?? null },
        alignment: multiTimeframe.alignment,
      } : null,
      macroData: macroData ? {
        vix: macroData.vix ?? null, bist100Change: macroData.bist100Change ?? null,
        usdTryChange: macroData.usdTryChange ?? null, macroScore: macroData.macroScore ?? 50,
      } : null,
      riskMetrics: riskMetrics ? {
        var95Daily: riskMetrics.var95Daily, currentDrawdown: riskMetrics.currentDrawdown,
        riskLevel: riskMetrics.riskLevel, liquidityScore: riskMetrics.liquidityScore,
        stressTests: riskMetrics.stressTests,
      } : null,
      sentimentValue,
      signalBacktest,
    });
  } catch { /* continue without verdict */ }

  return {
    code,
    quote,
    price,
    changePercent,
    volume,
    bars,
    technicals,
    fundamentalData,
    fundScore,
    macroData,
    allSignals,
    filteredSignals,
    candlestickPatterns,
    chartPatterns,
    extraIndicators,
    signalChains,
    signalCombination,
    compositeScore,
    verdict,
    riskMetrics,
    multiTimeframe,
    sectorContext,
    signalBacktest,
    signalAccuracyRecord,
  };
}

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════

function safeCalc<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}
