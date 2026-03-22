/**
 * Ek Teknik İndikatörler
 * VWAP, Williams %R, Parabolic SAR, Keltner Channels, Elder Ray
 */

import type { HistoricalBar } from "./technicals";
import { calculateKAMA } from "./adaptive";

export interface PivotPoints {
  classic: { pp: number; s1: number; s2: number; s3: number; r1: number; r2: number; r3: number };
  fibonacci: { pp: number; s1: number; s2: number; s3: number; r1: number; r2: number; r3: number };
}

export interface ExtraIndicators {
  vwap: number | null;
  priceVsVwap: "ABOVE" | "BELOW" | null;
  williamsR: number | null;
  williamsSignal: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL" | null;
  parabolicSar: number | null;
  sarTrend: "BULLISH" | "BEARISH" | null;
  keltnerUpper: number | null;
  keltnerLower: number | null;
  ttmSqueeze: boolean;
  elderBullPower: number | null;
  elderBearPower: number | null;
  kama: number | null;
  priceVsKama: "ABOVE" | "BELOW" | null;
  // Yeni indikatörler
  supertrend: number | null;
  supertrendDirection: "BULLISH" | "BEARISH" | null;
  pivotPoints: PivotPoints | null;
  nearestPivot: { level: string; price: number; distance: number } | null;
}

// ── VWAP (cumulative) ──
function calcVWAP(bars: HistoricalBar[]): number | null {
  if (bars.length < 5) return null;
  let cumTPV = 0, cumVol = 0;
  for (const b of bars.slice(-20)) {
    const tp = (b.high + b.low + b.close) / 3;
    cumTPV += tp * b.volume;
    cumVol += b.volume;
  }
  return cumVol > 0 ? cumTPV / cumVol : null;
}

// ── Williams %R (14) ──
function calcWilliamsR(bars: HistoricalBar[], period = 14): number | null {
  if (bars.length < period) return null;
  const slice = bars.slice(-period);
  const hh = Math.max(...slice.map(b => b.high));
  const ll = Math.min(...slice.map(b => b.low));
  const range = hh - ll;
  if (range === 0) return -50;
  return ((hh - bars[bars.length - 1].close) / range) * -100;
}

// ── Parabolic SAR ──
function calcParabolicSAR(bars: HistoricalBar[]): { sar: number; trend: "BULLISH" | "BEARISH" } | null {
  if (bars.length < 5) return null;
  let isUptrend = bars[1].close > bars[0].close;
  let sar = isUptrend ? bars[0].low : bars[0].high;
  let ep = isUptrend ? bars[1].high : bars[1].low;
  let af = 0.02;
  const afStep = 0.02;
  const afMax = 0.20;

  for (let i = 2; i < bars.length; i++) {
    sar = sar + af * (ep - sar);

    if (isUptrend) {
      if (bars[i].low < sar) {
        isUptrend = false;
        sar = ep;
        ep = bars[i].low;
        af = afStep;
      } else {
        if (bars[i].high > ep) {
          ep = bars[i].high;
          af = Math.min(af + afStep, afMax);
        }
      }
    } else {
      if (bars[i].high > sar) {
        isUptrend = true;
        sar = ep;
        ep = bars[i].high;
        af = afStep;
      } else {
        if (bars[i].low < ep) {
          ep = bars[i].low;
          af = Math.min(af + afStep, afMax);
        }
      }
    }
  }

  return { sar: Math.round(sar * 100) / 100, trend: isUptrend ? "BULLISH" : "BEARISH" };
}

// ── Keltner Channels (20, 1.5) ──
function calcKeltner(bars: HistoricalBar[]): { upper: number; lower: number } | null {
  if (bars.length < 20) return null;
  // EMA(20)
  const closes = bars.map(b => b.close);
  const k = 2 / 21;
  let ema = closes.slice(0, 20).reduce((a, b) => a + b, 0) / 20;
  for (let i = 20; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  // ATR(10) — Wilder's smoothing
  const atrPeriod = 10;
  let atr = 0;
  if (bars.length < atrPeriod + 1) return null;
  // Initial ATR = SMA of first N true ranges
  for (let i = 1; i <= atrPeriod; i++) {
    atr += Math.max(bars[i].high - bars[i].low, Math.abs(bars[i].high - bars[i - 1].close), Math.abs(bars[i].low - bars[i - 1].close));
  }
  atr /= atrPeriod;
  // Wilder's smoothing for remaining bars
  for (let i = atrPeriod + 1; i < bars.length; i++) {
    const tr = Math.max(bars[i].high - bars[i].low, Math.abs(bars[i].high - bars[i - 1].close), Math.abs(bars[i].low - bars[i - 1].close));
    atr = (atr * (atrPeriod - 1) + tr) / atrPeriod;
  }
  return { upper: Math.round((ema + 1.5 * atr) * 100) / 100, lower: Math.round((ema - 1.5 * atr) * 100) / 100 };
}

// ── Elder Ray (13) ──
function calcElderRay(bars: HistoricalBar[]): { bull: number; bear: number } | null {
  if (bars.length < 13) return null;
  const closes = bars.map(b => b.close);
  const k = 2 / 14;
  let ema = closes.slice(0, 13).reduce((a, b) => a + b, 0) / 13;
  for (let i = 13; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  const last = bars[bars.length - 1];
  return {
    bull: Math.round((last.high - ema) * 100) / 100,
    bear: Math.round((last.low - ema) * 100) / 100,
  };
}

// ── Supertrend (ATR-based, period=10, multiplier=3) ──
function calcSupertrend(bars: HistoricalBar[], period = 10, multiplier = 3): { value: number; direction: "BULLISH" | "BEARISH" } | null {
  if (bars.length < period + 1) return null;

  // ATR hesapla
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    trs.push(Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close)
    ));
  }

  // ATR SMA başlangıç
  let atr = 0;
  for (let i = 0; i < period; i++) atr += trs[i];
  atr /= period;

  let upperBand = 0, lowerBand = 0;
  let prevUpperBand = 0, prevLowerBand = 0;
  let supertrend = 0;
  let direction: "BULLISH" | "BEARISH" = "BULLISH";

  for (let i = period; i < trs.length; i++) {
    // Wilder ATR
    atr = (atr * (period - 1) + trs[i]) / period;

    const barIdx = i + 1; // bars index (trs is offset by 1)
    const hl2 = (bars[barIdx].high + bars[barIdx].low) / 2;

    const basicUpper = hl2 + multiplier * atr;
    const basicLower = hl2 - multiplier * atr;

    // Final upper: min(basicUpper, prevUpperBand) if prevClose > prevUpperBand
    upperBand = (basicUpper < prevUpperBand || bars[barIdx - 1].close > prevUpperBand)
      ? basicUpper : prevUpperBand;
    // Final lower: max(basicLower, prevLowerBand) if prevClose < prevLowerBand
    lowerBand = (basicLower > prevLowerBand || bars[barIdx - 1].close < prevLowerBand)
      ? basicLower : prevLowerBand;

    // Direction
    if (supertrend === prevUpperBand) {
      direction = bars[barIdx].close > upperBand ? "BULLISH" : "BEARISH";
    } else {
      direction = bars[barIdx].close < lowerBand ? "BEARISH" : "BULLISH";
    }

    supertrend = direction === "BULLISH" ? lowerBand : upperBand;
    prevUpperBand = upperBand;
    prevLowerBand = lowerBand;
  }

  return { value: Math.round(supertrend * 100) / 100, direction };
}

// ── Pivot Points (Klasik + Fibonacci) ──
function calcPivotPoints(bars: HistoricalBar[]): PivotPoints | null {
  if (bars.length < 2) return null;
  // Önceki günün OHLC'sini kullan
  const prev = bars[bars.length - 2];
  const h = prev.high, l = prev.low, c = prev.close;

  const pp = (h + l + c) / 3;

  const r = (n: number) => Math.round(n * 100) / 100;

  return {
    classic: {
      pp: r(pp),
      s1: r(2 * pp - h),
      s2: r(pp - (h - l)),
      s3: r(l - 2 * (h - pp)),
      r1: r(2 * pp - l),
      r2: r(pp + (h - l)),
      r3: r(h + 2 * (pp - l)),
    },
    fibonacci: {
      pp: r(pp),
      s1: r(pp - 0.382 * (h - l)),
      s2: r(pp - 0.618 * (h - l)),
      s3: r(pp - 1.000 * (h - l)),
      r1: r(pp + 0.382 * (h - l)),
      r2: r(pp + 0.618 * (h - l)),
      r3: r(pp + 1.000 * (h - l)),
    },
  };
}

function findNearestPivot(price: number, pivots: PivotPoints): { level: string; price: number; distance: number } {
  const levels: { level: string; price: number }[] = [
    { level: "PP", price: pivots.classic.pp },
    { level: "S1", price: pivots.classic.s1 },
    { level: "S2", price: pivots.classic.s2 },
    { level: "S3", price: pivots.classic.s3 },
    { level: "R1", price: pivots.classic.r1 },
    { level: "R2", price: pivots.classic.r2 },
    { level: "R3", price: pivots.classic.r3 },
  ];

  let nearest = levels[0];
  let minDist = Math.abs(price - levels[0].price);
  for (const lv of levels) {
    const dist = Math.abs(price - lv.price);
    if (dist < minDist) { nearest = lv; minDist = dist; }
  }

  return {
    level: nearest.level,
    price: nearest.price,
    distance: Math.round(((price - nearest.price) / nearest.price) * 10000) / 100, // %
  };
}

// ═══ MAIN ═══

export function calculateExtraIndicators(bars: HistoricalBar[], bbUpper?: number | null, bbLower?: number | null): ExtraIndicators {
  const price = bars.length > 0 ? bars[bars.length - 1].close : 0;

  const vwap = calcVWAP(bars);
  const williamsR = calcWilliamsR(bars);
  const sarResult = calcParabolicSAR(bars);
  const keltner = calcKeltner(bars);
  const elder = calcElderRay(bars);
  const kamaValue = calculateKAMA(bars.map(b => b.close));
  const stResult = calcSupertrend(bars);
  const pivots = calcPivotPoints(bars);

  // TTM Squeeze: Bollinger inside Keltner
  let ttmSqueeze = false;
  if (bbUpper != null && bbLower != null && keltner) {
    ttmSqueeze = bbUpper < keltner.upper && bbLower > keltner.lower;
  }

  return {
    vwap: vwap != null ? Math.round(vwap * 100) / 100 : null,
    priceVsVwap: vwap != null ? (price > vwap ? "ABOVE" : "BELOW") : null,
    williamsR: williamsR != null ? Math.round(williamsR * 100) / 100 : null,
    williamsSignal: williamsR == null ? null : williamsR > -20 ? "OVERBOUGHT" : williamsR < -80 ? "OVERSOLD" : "NEUTRAL",
    parabolicSar: sarResult?.sar ?? null,
    sarTrend: sarResult?.trend ?? null,
    keltnerUpper: keltner?.upper ?? null,
    keltnerLower: keltner?.lower ?? null,
    ttmSqueeze,
    elderBullPower: elder?.bull ?? null,
    elderBearPower: elder?.bear ?? null,
    kama: kamaValue,
    priceVsKama: kamaValue != null ? (price > kamaValue ? "ABOVE" : "BELOW") : null,
    // Yeni indikatörler
    supertrend: stResult?.value ?? null,
    supertrendDirection: stResult?.direction ?? null,
    pivotPoints: pivots,
    nearestPivot: pivots ? findNearestPivot(price, pivots) : null,
  };
}
