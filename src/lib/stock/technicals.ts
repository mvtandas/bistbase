/**
 * Bistbase Technical Analysis Engine v2
 * Saf matematik — AI yok, halüsinasyon yok.
 * Tüm hesaplamalar finansal standartlara uygun.
 */

import { getAdaptivePeriod, getAdaptiveRSIPeriod, getAdaptiveBBMultiplier } from "./adaptive";

export interface HistoricalBar {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

export interface FullTechnicalData {
  // RSI
  rsi14: number | null;
  rsiSignal: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL" | null;

  // Moving Averages
  ma20: number | null;
  ma50: number | null;
  ma200: number | null;
  ema12: number | null;
  ema26: number | null;
  maAlignment: "STRONG_BULLISH" | "BULLISH" | "BEARISH" | "STRONG_BEARISH" | "MIXED" | null;

  // MACD (12, 26, 9)
  macdLine: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  macdCrossover: "BULLISH_CROSS" | "BEARISH_CROSS" | null;

  // Bollinger Bands (20, 2)
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
  bbWidth: number | null;
  bbPercentB: number | null;
  bbSqueeze: boolean;

  // ATR (14)
  atr14: number | null;
  atrPercent: number | null;

  // Stochastic (14, 3, 3)
  stochK: number | null;
  stochD: number | null;
  stochSignal: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL" | null;

  // OBV
  obv: number | null;
  obvMa20: number | null;
  obvTrend: "RISING" | "FALLING" | "FLAT" | null;
  obvDivergence: "BULLISH" | "BEARISH" | null;

  // ADX (14)
  adx14: number | null;
  plusDI: number | null;
  minusDI: number | null;
  trendStrength: "STRONG" | "MODERATE" | "WEAK" | "NO_TREND" | null;

  // Support / Resistance (cluster-based)
  support: number | null;
  resistance: number | null;
  breakoutSignal: "RESISTANCE_BREAK" | "SUPPORT_BREAK" | null;

  // Volume
  volumeAvg20: number | null;
  volumeRatio: number | null;
  volumeAnomaly: boolean;

  // Chaikin Money Flow (20) — gerçek para akışı
  cmf20: number | null;
  cmfSignal: "ACCUMULATION" | "DISTRIBUTION" | "NEUTRAL" | null;

  // Money Flow Index (14) — hacim ağırlıklı RSI
  mfi14: number | null;
  mfiSignal: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL" | null;

  // Cross signals
  crossSignal: "GOLDEN_CROSS" | "DEATH_CROSS" | null;

  // Divergence
  rsiBullishDivergence: boolean;
  rsiBearishDivergence: boolean;

  // Ichimoku Cloud
  ichimoku: {
    tenkan: number;
    kijun: number;
    senkouA: number;
    senkouB: number;
    cloudTop: number;
    cloudBottom: number;
    cloudColor: "GREEN" | "RED";
    priceVsCloud: "ABOVE" | "INSIDE" | "BELOW";
    tkCross: "BULLISH" | "BEARISH" | null;
    kumoBreakout: "BULLISH" | "BEARISH" | null;
  } | null;

  // Fibonacci Retracement
  fibonacci: {
    swingHigh: number;
    swingLow: number;
    levels: { level: number; price: number; label: string }[];
    nearestLevel: { level: number; price: number; distance: number } | null;
    priceZone: string;
  } | null;
}

// ════════════════════════════════════════
// CORE MATH FUNCTIONS
// ════════════════════════════════════════

function sma(data: number[], period: number): number | null {
  if (data.length < period) return null;
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function emaArray(data: number[], period: number): number[] {
  if (data.length < period) return [];
  const k = 2 / (period + 1);
  const result: number[] = [];
  // Seed with SMA
  let prev = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(prev);
  for (let i = period; i < data.length; i++) {
    prev = data[i] * k + prev * (1 - k);
    result.push(prev);
  }
  return result;
}

function emaLatest(data: number[], period: number): number | null {
  const arr = emaArray(data, period);
  return arr.length > 0 ? arr[arr.length - 1] : null;
}

function stddev(data: number[], period: number): number | null {
  if (data.length < period) return null;
  const slice = data.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / period;
  return Math.sqrt(variance);
}

function round2(v: number | null): number | null {
  return v != null ? Math.round(v * 100) / 100 : null;
}

// ════════════════════════════════════════
// RSI (14) — Wilder's Smoothing
// ════════════════════════════════════════

function calculateRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gainSum = 0, lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gainSum += diff; else lossSum += Math.abs(diff);
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

// RSI series (for divergence detection)
function calculateRSISeries(closes: number[], period = 14): number[] {
  if (closes.length < period + 1) return [];
  const result: number[] = [];
  let gainSum = 0, lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gainSum += diff; else lossSum += Math.abs(diff);
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period;
    result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }
  return result;
}

// ════════════════════════════════════════
// MACD (12, 26, 9)
// ════════════════════════════════════════

function calculateMACD(closes: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9): {
  line: number; signal: number; histogram: number;
  prevLine: number; prevSignal: number;
} | null {
  if (closes.length < slowPeriod + signalPeriod) return null;
  const emaFast = emaArray(closes, fastPeriod);
  const emaSlow = emaArray(closes, slowPeriod);
  // Align arrays: emaSlow starts at index 0 corresponding to closes[slowPeriod-1]
  const offset = slowPeriod - fastPeriod;
  const macdLine: number[] = [];
  for (let i = 0; i < emaSlow.length; i++) {
    macdLine.push(emaFast[i + offset] - emaSlow[i]);
  }
  if (macdLine.length < signalPeriod) return null;
  const signalLine = emaArray(macdLine, signalPeriod);
  if (signalLine.length < 2) return null;
  const lastMacd = macdLine[macdLine.length - 1];
  const lastSignal = signalLine[signalLine.length - 1];
  const prevMacd = macdLine[macdLine.length - 2];
  const prevSignal = signalLine[signalLine.length - 2];
  return {
    line: lastMacd,
    signal: lastSignal,
    histogram: lastMacd - lastSignal,
    prevLine: prevMacd,
    prevSignal: prevSignal,
  };
}

// ════════════════════════════════════════
// BOLLINGER BANDS (20, 2)
// ════════════════════════════════════════

function calculateBollinger(closes: number[], period = 20, multiplier = 2): {
  upper: number; middle: number; lower: number;
  width: number; percentB: number;
} | null {
  if (closes.length < period) return null;
  const middle = sma(closes, period)!;
  const sd = stddev(closes, period)!;
  const upper = middle + multiplier * sd;
  const lower = middle - multiplier * sd;
  const width = middle > 0 ? (upper - lower) / middle : 0;
  const price = closes[closes.length - 1];
  const percentB = upper !== lower ? (price - lower) / (upper - lower) : 0.5;
  return { upper, middle, lower, width, percentB };
}

// ════════════════════════════════════════
// ATR (14)
// ════════════════════════════════════════

function calculateATR(bars: HistoricalBar[], period = 14): number | null {
  if (bars.length < period + 1) return null;
  const trueRanges: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const high = bars[i].high;
    const low = bars[i].low;
    const prevClose = bars[i - 1].close;
    trueRanges.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  if (trueRanges.length < period) return null;
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }
  return atr;
}

// ════════════════════════════════════════
// STOCHASTIC (14, 3, 3)
// ════════════════════════════════════════

function calculateStochastic(bars: HistoricalBar[], period = 14): { k: number; d: number } | null {
  if (bars.length < period + 3) return null;
  const kValues: number[] = [];
  for (let i = period - 1; i < bars.length; i++) {
    const window = bars.slice(i - (period - 1), i + 1);
    const highestHigh = Math.max(...window.map((b) => b.high));
    const lowestLow = Math.min(...window.map((b) => b.low));
    const range = highestHigh - lowestLow;
    kValues.push(range > 0 ? ((bars[i].close - lowestLow) / range) * 100 : 50);
  }
  // %K = 3-period SMA of raw K
  if (kValues.length < 3) return null;
  const smoothK: number[] = [];
  for (let i = 2; i < kValues.length; i++) {
    smoothK.push((kValues[i] + kValues[i - 1] + kValues[i - 2]) / 3);
  }
  // %D = 3-period SMA of %K
  if (smoothK.length < 3) return null;
  const lastK = smoothK[smoothK.length - 1];
  const d = (smoothK[smoothK.length - 1] + smoothK[smoothK.length - 2] + smoothK[smoothK.length - 3]) / 3;
  return { k: lastK, d };
}

// ════════════════════════════════════════
// OBV (On-Balance Volume)
// ════════════════════════════════════════

function calculateOBV(bars: HistoricalBar[]): {
  current: number; ma20: number | null;
  trend: "RISING" | "FALLING" | "FLAT";
} | null {
  if (bars.length < 2) return null;
  let obv = 0;
  const obvSeries: number[] = [0];
  for (let i = 1; i < bars.length; i++) {
    if (bars[i].close > bars[i - 1].close) obv += bars[i].volume;
    else if (bars[i].close < bars[i - 1].close) obv -= bars[i].volume;
    obvSeries.push(obv);
  }
  const obvMa20 = obvSeries.length >= 20
    ? obvSeries.slice(-20).reduce((a, b) => a + b, 0) / 20
    : null;
  // Trend: compare last 5 OBVs
  let trend: "RISING" | "FALLING" | "FLAT" = "FLAT";
  if (obvSeries.length >= 5) {
    const recent = obvSeries.slice(-5);
    const rising = recent[4] > recent[0] * 1.01;
    const falling = recent[4] < recent[0] * 0.99;
    trend = rising ? "RISING" : falling ? "FALLING" : "FLAT";
  }
  return { current: obv, ma20: obvMa20, trend };
}

// ════════════════════════════════════════
// ADX (14) — Average Directional Index
// ════════════════════════════════════════

function calculateADX(bars: HistoricalBar[], period = 14): {
  adx: number; plusDI: number; minusDI: number;
} | null {
  if (bars.length < period * 2 + 1) return null;
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const tr: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const highDiff = bars[i].high - bars[i - 1].high;
    const lowDiff = bars[i - 1].low - bars[i].low;
    plusDM.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
    minusDM.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);
    tr.push(Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close)
    ));
  }
  // Smooth with Wilder's method
  let smoothPlusDM = plusDM.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothMinusDM = minusDM.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothTR = tr.slice(0, period).reduce((a, b) => a + b, 0);
  const dxValues: number[] = [];
  for (let i = period; i < tr.length; i++) {
    smoothPlusDM = smoothPlusDM - smoothPlusDM / period + plusDM[i];
    smoothMinusDM = smoothMinusDM - smoothMinusDM / period + minusDM[i];
    smoothTR = smoothTR - smoothTR / period + tr[i];
    const pdi = smoothTR > 0 ? (smoothPlusDM / smoothTR) * 100 : 0;
    const mdi = smoothTR > 0 ? (smoothMinusDM / smoothTR) * 100 : 0;
    const diSum = pdi + mdi;
    dxValues.push(diSum > 0 ? (Math.abs(pdi - mdi) / diSum) * 100 : 0);
  }
  if (dxValues.length < period) return null;
  let adx = dxValues.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dxValues.length; i++) {
    adx = (adx * (period - 1) + dxValues[i]) / period;
  }
  // Final +DI, -DI
  const lastPDI = smoothTR > 0 ? (smoothPlusDM / smoothTR) * 100 : 0;
  const lastMDI = smoothTR > 0 ? (smoothMinusDM / smoothTR) * 100 : 0;
  return { adx, plusDI: lastPDI, minusDI: lastMDI };
}

// ════════════════════════════════════════
// CHAIKIN MONEY FLOW (20)
// ════════════════════════════════════════

function calculateCMF(bars: HistoricalBar[], period = 20): number | null {
  if (bars.length < period) return null;
  const slice = bars.slice(-period);
  let mfvSum = 0;
  let volSum = 0;
  for (const bar of slice) {
    const range = bar.high - bar.low;
    // Money Flow Multiplier: ((close - low) - (high - close)) / (high - low)
    const mfm = range > 0 ? ((bar.close - bar.low) - (bar.high - bar.close)) / range : 0;
    mfvSum += mfm * bar.volume;
    volSum += bar.volume;
  }
  return volSum > 0 ? mfvSum / volSum : 0;
}

// ════════════════════════════════════════
// MONEY FLOW INDEX (14) — Hacim ağırlıklı RSI
// ════════════════════════════════════════

function calculateMFI(bars: HistoricalBar[], period = 14): number | null {
  if (bars.length < period + 1) return null;
  let posFlow = 0;
  let negFlow = 0;
  for (let i = bars.length - period; i < bars.length; i++) {
    const typicalPrice = (bars[i].high + bars[i].low + bars[i].close) / 3;
    const prevTypical = (bars[i - 1].high + bars[i - 1].low + bars[i - 1].close) / 3;
    const rawMoneyFlow = typicalPrice * bars[i].volume;
    if (typicalPrice > prevTypical) posFlow += rawMoneyFlow;
    else negFlow += rawMoneyFlow;
  }
  if (negFlow === 0) return 100;
  const mfRatio = posFlow / negFlow;
  return 100 - 100 / (1 + mfRatio);
}

// ════════════════════════════════════════
// CLUSTER-BASED SUPPORT / RESISTANCE
// ════════════════════════════════════════

function calculateClusterSR(bars: HistoricalBar[], atr: number | null): {
  support: number | null; resistance: number | null;
} {
  if (bars.length < 10) return { support: null, resistance: null };
  const last30 = bars.slice(-60);
  const tolerance = atr != null ? atr * 0.5 : (last30[0].close * 0.02);

  // Collect all swing lows and highs
  const swingLows: number[] = [];
  const swingHighs: number[] = [];
  for (let i = 1; i < last30.length - 1; i++) {
    if (last30[i].low <= last30[i - 1].low && last30[i].low <= last30[i + 1].low) {
      swingLows.push(last30[i].low);
    }
    if (last30[i].high >= last30[i - 1].high && last30[i].high >= last30[i + 1].high) {
      swingHighs.push(last30[i].high);
    }
  }

  // Cluster and find most-touched level
  function findCluster(levels: number[]): number | null {
    if (levels.length === 0) return null;
    const clusters: { center: number; count: number }[] = [];
    for (const level of levels) {
      const existing = clusters.find((c) => Math.abs(c.center - level) < tolerance);
      if (existing) {
        existing.center = (existing.center * existing.count + level) / (existing.count + 1);
        existing.count++;
      } else {
        clusters.push({ center: level, count: 1 });
      }
    }
    clusters.sort((a, b) => b.count - a.count);
    return clusters[0]?.center ?? null;
  }

  const currentPrice = last30[last30.length - 1].close;
  const supportLevels = swingLows.filter((l) => l < currentPrice);
  const resistLevels = swingHighs.filter((h) => h > currentPrice);

  return {
    support: findCluster(supportLevels),
    resistance: findCluster(resistLevels),
  };
}

// ════════════════════════════════════════
// ICHIMOKU CLOUD
// ════════════════════════════════════════

function highestHigh(bars: HistoricalBar[], period: number): number {
  return Math.max(...bars.slice(-period).map(b => b.high));
}

function lowestLow(bars: HistoricalBar[], period: number): number {
  return Math.min(...bars.slice(-period).map(b => b.low));
}

function calculateIchimoku(bars: HistoricalBar[], price: number): FullTechnicalData["ichimoku"] {
  if (bars.length < 52) return null;

  const tenkan = (highestHigh(bars, 9) + lowestLow(bars, 9)) / 2;
  const kijun = (highestHigh(bars, 26) + lowestLow(bars, 26)) / 2;
  const senkouA = (tenkan + kijun) / 2;
  const senkouB = (highestHigh(bars, 52) + lowestLow(bars, 52)) / 2;
  const cloudTop = Math.max(senkouA, senkouB);
  const cloudBottom = Math.min(senkouA, senkouB);
  const cloudColor: "GREEN" | "RED" = senkouA > senkouB ? "GREEN" : "RED";

  const priceVsCloud: "ABOVE" | "INSIDE" | "BELOW" =
    price > cloudTop ? "ABOVE" : price < cloudBottom ? "BELOW" : "INSIDE";

  // TK Cross: compare current vs previous
  let tkCross: "BULLISH" | "BEARISH" | null = null;
  if (bars.length >= 53) {
    const prevBars = bars.slice(0, -1);
    const prevTenkan = (highestHigh(prevBars, 9) + lowestLow(prevBars, 9)) / 2;
    const prevKijun = (highestHigh(prevBars, 26) + lowestLow(prevBars, 26)) / 2;
    if (prevTenkan <= prevKijun && tenkan > kijun) tkCross = "BULLISH";
    if (prevTenkan >= prevKijun && tenkan < kijun) tkCross = "BEARISH";
  }

  // Kumo breakout
  let kumoBreakout: "BULLISH" | "BEARISH" | null = null;
  if (bars.length >= 2) {
    const prevPrice = bars[bars.length - 2].close;
    if (prevPrice <= cloudTop && price > cloudTop) kumoBreakout = "BULLISH";
    if (prevPrice >= cloudBottom && price < cloudBottom) kumoBreakout = "BEARISH";
  }

  return {
    tenkan: round2(tenkan)!,
    kijun: round2(kijun)!,
    senkouA: round2(senkouA)!,
    senkouB: round2(senkouB)!,
    cloudTop: round2(cloudTop)!,
    cloudBottom: round2(cloudBottom)!,
    cloudColor,
    priceVsCloud,
    tkCross,
    kumoBreakout,
  };
}

// ════════════════════════════════════════
// FIBONACCI RETRACEMENT
// ════════════════════════════════════════

function calculateFibonacci(bars: HistoricalBar[], price: number): FullTechnicalData["fibonacci"] {
  if (bars.length < 30) return null;

  const last60 = bars.slice(-60);
  let swingHigh = -Infinity, swingLow = Infinity;
  for (const b of last60) {
    if (b.high > swingHigh) swingHigh = b.high;
    if (b.low < swingLow) swingLow = b.low;
  }

  if (swingHigh === swingLow) return null;

  const range = swingHigh - swingLow;
  const fibLevels = [
    { level: 0, label: "0% (Zirve)" },
    { level: 0.236, label: "23.6%" },
    { level: 0.382, label: "38.2%" },
    { level: 0.5, label: "50%" },
    { level: 0.618, label: "61.8% (Altın Oran)" },
    { level: 0.786, label: "78.6%" },
    { level: 1, label: "100% (Dip)" },
  ];

  const levels = fibLevels.map(f => ({
    level: f.level,
    price: round2(swingHigh - range * f.level)!,
    label: f.label,
  }));

  // En yakın seviye
  let nearest: { level: number; price: number; distance: number } | null = null;
  let minDist = Infinity;
  for (const l of levels) {
    const dist = Math.abs(price - l.price);
    if (dist < minDist) {
      minDist = dist;
      nearest = { level: l.level, price: l.price, distance: round2((dist / price) * 100)! };
    }
  }

  // Price zone
  const ratio = (swingHigh - price) / range;
  let priceZone = "BETWEEN_382_500";
  if (ratio <= 0) priceZone = "ABOVE_ALL";
  else if (ratio <= 0.236) priceZone = "BETWEEN_0_236";
  else if (ratio <= 0.382) priceZone = "BETWEEN_236_382";
  else if (ratio <= 0.5) priceZone = "BETWEEN_382_500";
  else if (ratio <= 0.618) priceZone = "BETWEEN_500_618";
  else if (ratio <= 0.786) priceZone = "BETWEEN_618_786";
  else priceZone = "BELOW_ALL";

  return {
    swingHigh: round2(swingHigh)!,
    swingLow: round2(swingLow)!,
    levels,
    nearestLevel: nearest,
    priceZone,
  };
}

// ════════════════════════════════════════
// DIVERGENCE DETECTION
// ════════════════════════════════════════

function detectDivergence(closes: number[], rsiSeries: number[]): {
  bullish: boolean; bearish: boolean;
} {
  if (rsiSeries.length < 20 || closes.length < 20) return { bullish: false, bearish: false };
  // Compare last 2 swing lows (for bullish) and last 2 swing highs (for bearish)
  const len = Math.min(closes.length, rsiSeries.length);
  const priceSlice = closes.slice(-len);
  const rsiSlice = rsiSeries.slice(-len);
  const lookback = Math.min(20, len);

  // Find 2 most recent troughs in last N bars
  const troughs: { idx: number; price: number; rsi: number }[] = [];
  const peaks: { idx: number; price: number; rsi: number }[] = [];

  for (let i = lookback - 2; i >= 1; i--) {
    const pi = priceSlice.length - lookback + i;
    const ri = rsiSlice.length - lookback + i;
    if (pi >= 1 && pi < priceSlice.length - 1 && ri >= 1 && ri < rsiSlice.length - 1) {
      if (priceSlice[pi] <= priceSlice[pi - 1] && priceSlice[pi] <= priceSlice[pi + 1]) {
        troughs.push({ idx: pi, price: priceSlice[pi], rsi: rsiSlice[ri] });
      }
      if (priceSlice[pi] >= priceSlice[pi - 1] && priceSlice[pi] >= priceSlice[pi + 1]) {
        peaks.push({ idx: pi, price: priceSlice[pi], rsi: rsiSlice[ri] });
      }
    }
  }

  // Bullish divergence: price making lower lows, RSI making higher lows
  let bullish = false;
  if (troughs.length >= 2) {
    const [recent, prev] = troughs;
    if (recent.price < prev.price && recent.rsi > prev.rsi) bullish = true;
  }

  // Bearish divergence: price making higher highs, RSI making lower highs
  let bearish = false;
  if (peaks.length >= 2) {
    const [recent, prev] = peaks;
    if (recent.price > prev.price && recent.rsi < prev.rsi) bearish = true;
  }

  return { bullish, bearish };
}

// ════════════════════════════════════════
// MA ALIGNMENT
// ════════════════════════════════════════

function checkMAAlignment(
  price: number, ma20: number | null, ma50: number | null, ma200: number | null
): FullTechnicalData["maAlignment"] {
  if (ma20 == null || ma50 == null) return null;
  if (ma200 != null) {
    if (price > ma20 && ma20 > ma50 && ma50 > ma200) return "STRONG_BULLISH";
    if (price < ma20 && ma20 < ma50 && ma50 < ma200) return "STRONG_BEARISH";
  }
  if (price > ma20 && ma20 > ma50) return "BULLISH";
  if (price < ma20 && ma20 < ma50) return "BEARISH";
  return "MIXED";
}

// ════════════════════════════════════════
// GOLDEN / DEATH CROSS
// ════════════════════════════════════════

function detectCross(closes: number[], midPeriod = 50, longPeriod = 200): "GOLDEN_CROSS" | "DEATH_CROSS" | null {
  if (closes.length < longPeriod + 1) return null;
  const maMidNow = sma(closes, midPeriod);
  const maLongNow = sma(closes, longPeriod);
  const maMidPrev = sma(closes.slice(0, -1), midPeriod);
  const maLongPrev = sma(closes.slice(0, -1), longPeriod);
  if (!maMidNow || !maLongNow || !maMidPrev || !maLongPrev) return null;
  if (maMidPrev <= maLongPrev && maMidNow > maLongNow) return "GOLDEN_CROSS";
  if (maMidPrev >= maLongPrev && maMidNow < maLongNow) return "DEATH_CROSS";
  return null;
}

// ════════════════════════════════════════
// MAIN ENTRY POINT
// ════════════════════════════════════════

export type Timeframe = "daily" | "weekly" | "monthly";

// Timeframe bazlı indikatör periyotları
const TIMEFRAME_PERIODS = {
  daily:   { rsi: 14, maShort: 20, maMid: 50, maLong: 200, bb: 20, macdFast: 12, macdSlow: 26, macdSignal: 9, stoch: 14, atr: 14, ichimokuMin: 52, cmf: 20, mfi: 14 },
  weekly:  { rsi: 14, maShort: 10, maMid: 20, maLong: 40,  bb: 20, macdFast: 12, macdSlow: 26, macdSignal: 9, stoch: 14, atr: 14, ichimokuMin: 52, cmf: 20, mfi: 14 },
  monthly: { rsi: 12, maShort: 6,  maMid: 12, maLong: 24,  bb: 12, macdFast: 9,  macdSlow: 18, macdSignal: 6, stoch: 10, atr: 10, ichimokuMin: 52, cmf: 12, mfi: 10 },
} as const;

export function calculateFullTechnicals(
  bars: HistoricalBar[],
  currentPrice: number | null,
  currentVolume: number | null,
  timeframe: Timeframe = "daily"
): FullTechnicalData {
  const closes = bars.map((b) => b.close);
  const price = currentPrice ?? (closes.length > 0 ? closes[closes.length - 1] : 0);
  const p = TIMEFRAME_PERIODS[timeframe];

  // ATR (hesapla önce — adaptive period için gerekli)
  const atr14 = calculateATR(bars, p.atr);
  const atrPercent = atr14 != null && price > 0 ? (atr14 / price) * 100 : null;

  // Adaptive periods (volatiliteye göre ayarla)
  const rsiPeriod = atrPercent != null ? getAdaptiveRSIPeriod(atrPercent) : p.rsi;
  const bbPeriod = getAdaptivePeriod(p.bb, atrPercent);
  const adaptiveBBMult = atrPercent != null ? getAdaptiveBBMultiplier(atrPercent) : 2;
  const stochPeriod = getAdaptivePeriod(p.stoch, atrPercent);

  // RSI
  const rsi14 = calculateRSI(closes, rsiPeriod);
  const rsiSeries = calculateRSISeries(closes, rsiPeriod);
  const rsiSignal: FullTechnicalData["rsiSignal"] =
    rsi14 == null ? null : rsi14 >= 70 ? "OVERBOUGHT" : rsi14 <= 30 ? "OVERSOLD" : "NEUTRAL";

  // Moving Averages (timeframe-aware periyotlar)
  const ma20 = sma(closes, p.maShort);
  const ma50 = sma(closes, p.maMid);
  const ma200 = sma(closes, p.maLong);
  const ema12 = emaLatest(closes, p.macdFast);
  const ema26 = emaLatest(closes, p.macdSlow);
  const maAlignment = price ? checkMAAlignment(price, ma20, ma50, ma200) : null;

  // MACD (timeframe-aware periyotlar)
  const macd = calculateMACD(closes, p.macdFast, p.macdSlow, p.macdSignal);
  let macdCrossover: FullTechnicalData["macdCrossover"] = null;
  if (macd) {
    if (macd.prevLine <= macd.prevSignal && macd.line > macd.signal) macdCrossover = "BULLISH_CROSS";
    if (macd.prevLine >= macd.prevSignal && macd.line < macd.signal) macdCrossover = "BEARISH_CROSS";
  }

  // Bollinger
  const bb = calculateBollinger(closes, bbPeriod, adaptiveBBMult);
  const bbSqueeze = bb ? bb.width < 0.05 : false;

  // Stochastic
  const stoch = calculateStochastic(bars, stochPeriod);
  const stochSignal: FullTechnicalData["stochSignal"] =
    stoch == null ? null : stoch.k >= 80 ? "OVERBOUGHT" : stoch.k <= 20 ? "OVERSOLD" : "NEUTRAL";

  // OBV
  const obv = calculateOBV(bars);
  // OBV Divergence: OBV rising but price falling = bullish accumulation
  let obvDivergence: FullTechnicalData["obvDivergence"] = null;
  if (obv && closes.length >= 5) {
    const priceDown = closes[closes.length - 1] < closes[closes.length - 5];
    const priceUp = closes[closes.length - 1] > closes[closes.length - 5];
    if (obv.trend === "RISING" && priceDown) obvDivergence = "BULLISH";
    if (obv.trend === "FALLING" && priceUp) obvDivergence = "BEARISH";
  }

  // ADX
  const adx = calculateADX(bars);
  let trendStrength: FullTechnicalData["trendStrength"] = null;
  if (adx) {
    if (adx.adx >= 40) trendStrength = "STRONG";
    else if (adx.adx >= 25) trendStrength = "MODERATE";
    else if (adx.adx >= 15) trendStrength = "WEAK";
    else trendStrength = "NO_TREND";
  }

  // Support / Resistance (cluster-based)
  const sr = calculateClusterSR(bars, atr14);
  let breakoutSignal: FullTechnicalData["breakoutSignal"] = null;
  if (currentPrice != null) {
    if (sr.resistance != null && currentPrice > sr.resistance) breakoutSignal = "RESISTANCE_BREAK";
    else if (sr.support != null && currentPrice < sr.support) breakoutSignal = "SUPPORT_BREAK";
  }

  // Volume
  const volumes = bars.slice(-20).map((b) => b.volume);
  const volumeAvg20 = volumes.length >= 20 ? volumes.reduce((a, b) => a + b, 0) / 20 : null;
  const volumeRatio = currentVolume != null && volumeAvg20 && volumeAvg20 > 0
    ? currentVolume / volumeAvg20 : null;

  // CMF (Chaikin Money Flow)
  const cmf20 = calculateCMF(bars, p.cmf);
  const cmfSignal: FullTechnicalData["cmfSignal"] =
    cmf20 == null ? null : cmf20 > 0.05 ? "ACCUMULATION" : cmf20 < -0.05 ? "DISTRIBUTION" : "NEUTRAL";

  // MFI (Money Flow Index)
  const mfi14 = calculateMFI(bars, p.mfi);
  const mfiSignal: FullTechnicalData["mfiSignal"] =
    mfi14 == null ? null : mfi14 >= 80 ? "OVERBOUGHT" : mfi14 <= 20 ? "OVERSOLD" : "NEUTRAL";

  // Cross (timeframe-aware: aylıkta MA(12) vs MA(24), haftalıkta MA(20) vs MA(40))
  const crossSignal = detectCross(closes, p.maMid, p.maLong);

  // Divergence
  const divergence = detectDivergence(closes, rsiSeries);

  // Ichimoku (aylıkta yetersiz veri → skip)
  const ichimoku = bars.length >= p.ichimokuMin ? calculateIchimoku(bars, price) : null;

  // Fibonacci
  const fibonacci = calculateFibonacci(bars, price);

  return {
    rsi14: round2(rsi14),
    rsiSignal,
    ma20: round2(ma20),
    ma50: round2(ma50),
    ma200: round2(ma200),
    ema12: round2(ema12),
    ema26: round2(ema26),
    maAlignment,
    macdLine: round2(macd?.line ?? null),
    macdSignal: round2(macd?.signal ?? null),
    macdHistogram: round2(macd?.histogram ?? null),
    macdCrossover,
    bbUpper: round2(bb?.upper ?? null),
    bbMiddle: round2(bb?.middle ?? null),
    bbLower: round2(bb?.lower ?? null),
    bbWidth: round2(bb?.width ?? null),
    bbPercentB: round2(bb?.percentB ?? null),
    bbSqueeze,
    atr14: round2(atr14),
    atrPercent: round2(atrPercent),
    stochK: round2(stoch?.k ?? null),
    stochD: round2(stoch?.d ?? null),
    stochSignal,
    obv: obv?.current ?? null,
    obvMa20: round2(obv?.ma20 ?? null),
    obvTrend: obv?.trend ?? null,
    obvDivergence,
    adx14: round2(adx?.adx ?? null),
    plusDI: round2(adx?.plusDI ?? null),
    minusDI: round2(adx?.minusDI ?? null),
    trendStrength,
    support: round2(sr.support),
    resistance: round2(sr.resistance),
    breakoutSignal,
    volumeAvg20: volumeAvg20 != null ? Math.round(volumeAvg20) : null,
    volumeRatio: round2(volumeRatio),
    volumeAnomaly: volumeRatio != null && volumeRatio >= 3,
    cmf20: round2(cmf20),
    cmfSignal,
    mfi14: round2(mfi14),
    mfiSignal,
    crossSignal,
    rsiBullishDivergence: divergence.bullish,
    rsiBearishDivergence: divergence.bearish,
    ichimoku,
    fibonacci,
  };
}

// Backward compat wrapper
export type TechnicalSignals = FullTechnicalData;
export const calculateTechnicals = calculateFullTechnicals;
