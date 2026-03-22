/**
 * Ek Teknik İndikatörler
 * VWAP, Williams %R, Parabolic SAR, Keltner Channels, Elder Ray
 */

import type { HistoricalBar } from "./technicals";
import { calculateKAMA } from "./adaptive";

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

// ═══ MAIN ═══

export function calculateExtraIndicators(bars: HistoricalBar[], bbUpper?: number | null, bbLower?: number | null): ExtraIndicators {
  const price = bars.length > 0 ? bars[bars.length - 1].close : 0;

  const vwap = calcVWAP(bars);
  const williamsR = calcWilliamsR(bars);
  const sarResult = calcParabolicSAR(bars);
  const keltner = calcKeltner(bars);
  const elder = calcElderRay(bars);

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
    kama: (() => {
      const closes = bars.map(b => b.close);
      return calculateKAMA(closes);
    })(),
    priceVsKama: (() => {
      const closes = bars.map(b => b.close);
      const k = calculateKAMA(closes);
      if (k == null) return null;
      return price > k ? "ABOVE" : "BELOW";
    })(),
  };
}
