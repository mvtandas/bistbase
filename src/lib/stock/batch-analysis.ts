/**
 * Batch Analysis Engine
 * BIST30 hisselerini toplu analiz eder — screener için
 * stock-detail/[code]/route.ts mantığını batch olarak çalıştırır
 */

import { STOCK_LISTS, type ScreenerIndex } from "@/lib/constants";
import { getHistoricalBars, getHistoricalBarsInterval, getStockQuote } from "./yahoo";
import { calculateFullTechnicals, type Timeframe } from "./technicals";
import { calculateCompositeScore, detectVolatilityRegime, type CompositeScore, type VolatilityRegime } from "./scoring";
import { detectSignals, type DetectedSignal } from "./signals";
import { getFundamentalData, scoreFundamentals, type FundamentalScore } from "./fundamentals";
import { getMacroData, type MacroData } from "./macro";
import { calculateRiskMetrics, type RiskMetrics } from "./risk";
import { analyzeSignalCombinations, type CombinationAnalysis } from "./signal-combinations";
import { analyzeMultiTimeframe, type TimeframeAnalysis } from "./multi-timeframe";
import { calculateExtraIndicators, type ExtraIndicators } from "./extra-indicators";
import { calculateVerdict, type Verdict, type VerdictInput } from "./verdict";
import { STOCK_SECTOR_MAP, SECTOR_INDICES } from "./sectors";
import { getSignalAccuracyMap, calibrateSignalStrength } from "./signal-calibration";
import { detectCandlestickPatterns } from "./candlesticks";
import { detectChartPatterns } from "./chart-patterns";
import { detectSignalChains } from "./signal-chains";
import { calculateBacktest } from "./backtest";

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════

export interface ScreenerStockResult {
  code: string;
  name: string;
  price: number | null;
  changePercent: number | null;
  volume: number | null;

  composite: CompositeScore | null;
  verdict: Verdict | null;

  rsi14: number | null;
  macdHistogram: number | null;
  maAlignment: string | null;
  adx14: number | null;

  fundamentalScore: FundamentalScore | null;
  peRatio: number | null;
  pbRatio: number | null;
  dividendYield: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  fromFiftyTwoHigh: number | null;

  riskMetrics: RiskMetrics | null;

  signals: DetectedSignal[];
  signalCombination: CombinationAnalysis | null;
  multiTimeframe: TimeframeAnalysis | null;

  sectorCode: string | null;
  sectorName: string | null;
}

export interface SectorSummary {
  sectorName: string;
  avgScore: number;
  avgChange: number;
  stockCount: number;
  topStock: string;
}

export interface MarketSummary {
  avgComposite: number;
  strongBuyCount: number;
  buyCount: number;
  holdCount: number;
  sellCount: number;
  strongSellCount: number;
  bullishSignalCount: number;
  bearishSignalCount: number;
}

export type ScreenerTimeframe = "daily" | "weekly" | "monthly";

export interface ScreenerResult {
  stocks: ScreenerStockResult[];
  macroData: MacroData | null;
  regime: VolatilityRegime;
  generatedAt: string;
  index: ScreenerIndex;
  timeframe: ScreenerTimeframe;
  sectorSummary: Record<string, SectorSummary>;
  marketSummary: MarketSummary;
}

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
  staggerMs = 0,
): Promise<(T | null)[]> {
  const results: (T | null)[] = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(t => t()));
    for (const r of batchResults) {
      results.push(r.status === "fulfilled" ? r.value : null);
    }
    if (staggerMs > 0 && i + concurrency < tasks.length) {
      await new Promise(r => setTimeout(r, staggerMs));
    }
  }
  return results;
}

// ═══════════════════════════════════════
// SINGLE STOCK ANALYSIS (for screener)
// ═══════════════════════════════════════

export async function analyzeStock(
  code: string,
  macroData: MacroData | null,
  timeframe: ScreenerTimeframe = "daily",
  accuracyMap?: Map<string, { accuracyRate: number; totalCount: number; adjustedStrength: number; reliabilityLabel: string; signalType: string; accurateCount: number }>,
): Promise<ScreenerStockResult> {
  // 1. Fetch data in parallel
  const barsPromise = timeframe === "daily"
    ? getHistoricalBars(code, 220).catch(() => [])
    : getHistoricalBarsInterval(code, timeframe === "weekly" ? "1wk" : "1mo", timeframe === "weekly" ? 730 : 2190).catch(() => []);

  const [quote, bars, fundamentalData] = await Promise.all([
    getStockQuote(code),
    barsPromise,
    getFundamentalData(code).catch(() => null),
  ]);

  const price = quote?.price ?? null;
  const changePercent = quote?.changePercent ?? null;
  const volume = quote?.volume ?? null;

  // 2. Technicals (timeframe-aware)
  const tfKey: Timeframe = timeframe;
  const technicals = safe(
    () => bars.length > 0 ? calculateFullTechnicals(bars, price, volume, tfKey) : null,
    null,
  );

  // 3. Signals (tam pipeline — daily analysis ile aynı)
  const rawSignals = safe(
    () => technicals && price ? detectSignals(technicals, price) : [],
    [] as DetectedSignal[],
  );

  // 3b. Candlestick patterns
  const candlesticks = safe(() => detectCandlestickPatterns(bars), []);
  for (const cp of candlesticks) {
    rawSignals.push({
      type: `CANDLE_${cp.name}`,
      direction: cp.direction,
      strength: cp.strength,
      description: cp.description,
    });
  }

  // 3c. Chart patterns
  const chartPatterns = safe(() => detectChartPatterns(bars), []);
  for (const cp of chartPatterns) {
    rawSignals.push({
      type: `CHART_${cp.name}`,
      direction: cp.direction,
      strength: cp.strength,
      description: cp.description,
    });
  }

  // 3d. Extra indicators (TTM Squeeze, Parabolic SAR)
  const extraIndicators = safe(
    () => calculateExtraIndicators(bars, technicals?.bbUpper, technicals?.bbLower),
    null,
  );
  if (extraIndicators?.ttmSqueeze) {
    rawSignals.push({
      type: "TTM_SQUEEZE",
      direction: "NEUTRAL",
      strength: 75,
      description: "TTM Squeeze: Bollinger bantları Keltner kanalının içine girdi. Çok güçlü kırılım hareketi bekleniyor.",
    });
  }

  // 3e. Kalibrasyon (geçmiş doğruluğa göre güç ayarla)
  const signals = accuracyMap
    ? rawSignals.map((s) => ({
        ...s,
        strength: calibrateSignalStrength(s.strength, s.type, accuracyMap as Parameters<typeof calibrateSignalStrength>[2]),
      }))
    : rawSignals;

  // 3f. Signal chains
  let signalChainSignals: DetectedSignal[] = [];
  try {
    const chains = await detectSignalChains(code, signals);
    signalChainSignals = chains.map((chain) => ({
      type: `CHAIN_${chain.name}`,
      direction: chain.direction,
      strength: chain.strength,
      description: `${chain.nameTr}: ${chain.description}`,
    }));
    signals.push(...signalChainSignals);
  } catch { /* continue without chains */ }

  // 4. Fundamentals
  const fundScore = safe(
    () => fundamentalData ? scoreFundamentals(fundamentalData) : null,
    null,
  );

  // 5. Composite score (timeframe-aware)
  const score = safe(
    () => technicals && price ? calculateCompositeScore(technicals, price, 0, fundScore, macroData, null, tfKey) : null,
    null,
  );

  // 6. Signal combinations
  const signalCombination = safe(() => analyzeSignalCombinations(signals), null);

  // 7. Risk
  const riskMetrics = safe(
    () => bars.length > 30 ? calculateRiskMetrics(bars, fundamentalData?.beta ?? null) : null,
    null,
  );

  // 8. Multi-timeframe (only for daily — compares daily vs weekly)
  let multiTimeframe: TimeframeAnalysis | null = null;
  if (timeframe === "daily") {
    try {
      multiTimeframe = await analyzeMultiTimeframe(
        code,
        bars,
        technicals ? { rsi14: technicals.rsi14, maAlignment: technicals.maAlignment } : null,
      );
    } catch { /* continue without */ }
  }

  // 9. Signal backtest
  let signalBacktest: VerdictInput["signalBacktest"] = null;
  try {
    const bt = await calculateBacktest(code);
    if (bt?.performances?.length) {
      signalBacktest = {
        performances: bt.performances.map((p) => ({
          signalType: p.signalType,
          horizon1D: p.horizon1D,
          bestHorizon: p.bestHorizon,
          confidenceScore: p.confidenceScore,
          streaks: p.streaks,
        })),
      };
    }
  } catch { /* continue without */ }

  // 10. Signal accuracy record (for verdict)
  const signalAccuracyRecord: Record<string, { rate: number; count: number }> = {};
  if (accuracyMap) {
    for (const [key, val] of accuracyMap) {
      signalAccuracyRecord[key] = { rate: val.accuracyRate, count: val.totalCount };
    }
  }

  // 11. Verdict (tam 3-pillar — daily analysis ile aynı)
  let verdict: Verdict | null = null;
  try {
    const verdictInput: VerdictInput = {
      price,
      technicals: technicals as unknown as Record<string, unknown> | null,
      extraIndicators: extraIndicators as VerdictInput["extraIndicators"],
      score: score ? {
        technical: score.technical,
        momentum: score.momentum,
        volume: score.volume,
        volatility: score.volatility,
        sentiment: score.sentiment,
        fundamental: score.fundamental,
        macro: score.macro,
        composite: score.composite,
        label: score.label,
      } : null,
      fundamentalScore: fundScore ? {
        valuationScore: fundScore.valuationScore,
        profitabilityScore: fundScore.profitabilityScore,
        growthScore: fundScore.growthScore,
        healthScore: fundScore.healthScore,
        fundamentalScore: fundScore.fundamentalScore,
      } : null,
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
        daily: { trend: multiTimeframe.daily.trend },
        alignment: multiTimeframe.alignment,
      } : null,
      macroData: macroData ? {
        vix: macroData.vix ?? null,
        bist100Change: macroData.bist100Change ?? null,
        usdTryChange: macroData.usdTryChange ?? null,
        macroScore: macroData.macroScore ?? 50,
      } : null,
      riskMetrics: riskMetrics ? {
        var95Daily: riskMetrics.var95Daily,
        currentDrawdown: riskMetrics.currentDrawdown,
        riskLevel: riskMetrics.riskLevel,
        liquidityScore: riskMetrics.liquidityScore,
        stressTests: riskMetrics.stressTests,
      } : null,
      sentimentValue: 0,
      signalBacktest,
    };
    verdict = calculateVerdict(verdictInput);
  } catch { /* continue without verdict */ }

  // Sector
  const sectorCode = STOCK_SECTOR_MAP[code] ?? null;
  const sectorName = sectorCode ? (SECTOR_INDICES[sectorCode]?.name ?? null) : null;

  return {
    code,
    name: quote?.name ?? code,
    price,
    changePercent,
    volume,
    composite: score,
    verdict,
    rsi14: technicals?.rsi14 ?? null,
    macdHistogram: technicals?.macdHistogram ?? null,
    maAlignment: technicals?.maAlignment ?? null,
    adx14: technicals?.adx14 ?? null,
    fundamentalScore: fundScore,
    peRatio: fundamentalData?.peRatio ?? null,
    pbRatio: fundamentalData?.pbRatio ?? null,
    dividendYield: fundamentalData?.dividendYield ?? null,
    fiftyTwoWeekHigh: fundamentalData?.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow: fundamentalData?.fiftyTwoWeekLow ?? null,
    fromFiftyTwoHigh: fundamentalData?.fromFiftyTwoHigh ?? null,
    riskMetrics,
    signals,
    signalCombination,
    multiTimeframe,
    sectorCode,
    sectorName,
  };
}

// ═══════════════════════════════════════
// BATCH ANALYSIS — ALL BIST30
// ═══════════════════════════════════════

function buildSectorSummary(stocks: ScreenerStockResult[]): Record<string, SectorSummary> {
  const map: Record<string, { scores: number[]; changes: number[]; stocks: ScreenerStockResult[] }> = {};

  for (const s of stocks) {
    const sc = s.sectorCode;
    if (!sc) continue;
    if (!map[sc]) map[sc] = { scores: [], changes: [], stocks: [] };
    if (s.composite) map[sc].scores.push(s.composite.composite);
    if (s.changePercent != null) map[sc].changes.push(s.changePercent);
    map[sc].stocks.push(s);
  }

  const result: Record<string, SectorSummary> = {};
  for (const [code, data] of Object.entries(map)) {
    const avgScore = data.scores.length > 0 ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length : 0;
    const avgChange = data.changes.length > 0 ? data.changes.reduce((a, b) => a + b, 0) / data.changes.length : 0;
    const topStock = data.stocks
      .filter(s => s.composite)
      .sort((a, b) => (b.composite?.composite ?? 0) - (a.composite?.composite ?? 0))[0];

    result[code] = {
      sectorName: SECTOR_INDICES[code]?.name ?? code,
      avgScore: Math.round(avgScore * 10) / 10,
      avgChange: Math.round(avgChange * 100) / 100,
      stockCount: data.stocks.length,
      topStock: topStock?.code ?? data.stocks[0]?.code ?? "",
    };
  }
  return result;
}

function buildMarketSummary(stocks: ScreenerStockResult[]): MarketSummary {
  let totalComposite = 0;
  let compositeCount = 0;
  let strongBuy = 0, buy = 0, hold = 0, sell = 0, strongSell = 0;
  let bullish = 0, bearish = 0;

  for (const s of stocks) {
    if (s.composite) { totalComposite += s.composite.composite; compositeCount++; }
    if (s.verdict) {
      switch (s.verdict.action) {
        case "GUCLU_AL": strongBuy++; break;
        case "AL": buy++; break;
        case "TUT": hold++; break;
        case "SAT": sell++; break;
        case "GUCLU_SAT": strongSell++; break;
      }
    }
    for (const sig of s.signals) {
      if (sig.direction === "BULLISH") bullish++;
      else if (sig.direction === "BEARISH") bearish++;
    }
  }

  return {
    avgComposite: compositeCount > 0 ? Math.round((totalComposite / compositeCount) * 10) / 10 : 0,
    strongBuyCount: strongBuy,
    buyCount: buy,
    holdCount: hold,
    sellCount: sell,
    strongSellCount: strongSell,
    bullishSignalCount: bullish,
    bearishSignalCount: bearish,
  };
}

export async function analyzeStockIndex(
  index: ScreenerIndex = "bist30",
  timeframe: ScreenerTimeframe = "daily",
): Promise<ScreenerResult> {
  const stockList = STOCK_LISTS[index];

  // 1. Macro data + signal accuracy — once, shared across all stocks
  const [macroData, accuracyMap] = await Promise.all([
    getMacroData().catch(() => null),
    getSignalAccuracyMap().catch(() => new Map()),
  ]);
  const regime = detectVolatilityRegime(macroData);

  // 2. Analyze all stocks with concurrency control
  const tasks = stockList.map(code => () => analyzeStock(code, macroData, timeframe, accuracyMap as Parameters<typeof analyzeStock>[3]));
  const results = await runWithConcurrency(tasks, 5, 500);

  const stocks = results.filter((r): r is ScreenerStockResult => r !== null);

  // 3. Sort by composite score (descending)
  stocks.sort((a, b) => (b.composite?.composite ?? 0) - (a.composite?.composite ?? 0));

  return {
    stocks,
    macroData,
    regime,
    generatedAt: new Date().toISOString(),
    index,
    timeframe,
    sectorSummary: buildSectorSummary(stocks),
    marketSummary: buildMarketSummary(stocks),
  };
}

/** @deprecated Use analyzeStockIndex instead */
export const analyzeAllBIST30 = (timeframe: ScreenerTimeframe = "daily") =>
  analyzeStockIndex("bist30", timeframe);

// ═══════════════════════════════════════
// DB MAPPING — ScreenerStockResult → Prisma upsert data
// ═══════════════════════════════════════

export function toScreenerSnapshotData(
  result: ScreenerStockResult,
  date: Date,
  indexFlags: { inBist30: boolean; inBist50: boolean; inBist100: boolean; inXtm25: boolean; inXkury: boolean; inXusrd: boolean },
) {
  return {
    stockCode: result.code,
    date,
    name: result.name,
    price: result.price,
    changePercent: result.changePercent,
    volume: result.volume,
    compositeScore: result.composite?.composite ?? null,
    compositeJson: result.composite as object ?? undefined,
    verdictAction: result.verdict?.action ?? null,
    verdictScore: result.verdict?.score ?? null,
    verdictConfidence: result.verdict?.confidence ?? null,
    verdictJson: result.verdict as object ?? undefined,
    rsi14: result.rsi14,
    macdHistogram: result.macdHistogram,
    maAlignment: result.maAlignment,
    adx14: result.adx14,
    fundamentalScore: result.fundamentalScore?.fundamentalScore ?? null,
    fundamentalJson: result.fundamentalScore as object ?? undefined,
    peRatio: result.peRatio,
    pbRatio: result.pbRatio,
    dividendYield: result.dividendYield,
    fiftyTwoWeekHigh: result.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: result.fiftyTwoWeekLow,
    fromFiftyTwoHigh: result.fromFiftyTwoHigh,
    riskLevel: result.riskMetrics?.riskLevel ?? null,
    sharpeRatio: result.riskMetrics?.sharpeRatio ?? null,
    maxDrawdown: result.riskMetrics?.maxDrawdown ?? null,
    riskJson: result.riskMetrics as object ?? undefined,
    signalsJson: result.signals as object[],
    signalCombinationJson: result.signalCombination as object ?? undefined,
    bullishSignalCount: result.signals.filter(s => s.direction === "BULLISH").length,
    bearishSignalCount: result.signals.filter(s => s.direction === "BEARISH").length,
    mtfAlignment: result.multiTimeframe?.alignment ?? null,
    mtfJson: result.multiTimeframe as object ?? undefined,
    sectorCode: result.sectorCode,
    sectorName: result.sectorName,
    ...indexFlags,
  };
}
