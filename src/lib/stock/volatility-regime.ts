/**
 * Volatility Regime Clustering via EWMA
 * Exponentially Weighted Moving Average volatility with regime classification.
 */

import type { HistoricalBar } from "./technicals";

export interface VolatilityRegimeData {
  currentVol: number;
  shortTermVol: number;
  mediumTermVol: number;
  longTermVol: number;
  regime: "LOW" | "NORMAL" | "HIGH" | "EXTREME";
  regimeTr: string;
  volExpanding: boolean;
  volContracting: boolean;
  regimeShiftSignal: string | null;
}

const LAMBDA = 0.94;
const ANNUALIZE = Math.sqrt(252);

const REGIME_LABELS_TR: Record<VolatilityRegimeData["regime"], string> = {
  LOW: "Düşük Volatilite",
  NORMAL: "Normal Volatilite",
  HIGH: "Yüksek Volatilite",
  EXTREME: "Aşırı Volatilite",
};

function classifyRegime(vol: number): VolatilityRegimeData["regime"] {
  if (vol < 15) return "LOW";
  if (vol < 30) return "NORMAL";
  if (vol < 50) return "HIGH";
  return "EXTREME";
}

/**
 * Compute EWMA variance over the last `window` log returns.
 * Uses the standard RiskMetrics formula: σ²_t = λ·σ²_{t-1} + (1-λ)·r²_t
 */
function ewmaVol(logReturns: number[], window: number): number {
  if (logReturns.length < window) return NaN;

  const slice = logReturns.slice(-window);

  // Seed with sample variance of the slice
  let variance = 0;
  for (const r of slice) {
    variance += r * r;
  }
  variance /= slice.length;

  // Run EWMA over the slice
  for (const r of slice) {
    variance = LAMBDA * variance + (1 - LAMBDA) * r * r;
  }

  return Math.sqrt(variance) * ANNUALIZE * 100;
}

export function calculateVolatilityRegime(
  bars: HistoricalBar[],
): VolatilityRegimeData | null {
  if (!bars || bars.length < 61) return null;

  // Calculate daily log returns
  const logReturns: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1].close;
    const curr = bars[i].close;
    if (prev > 0 && curr > 0) {
      logReturns.push(Math.log(curr / prev));
    }
  }

  if (logReturns.length < 60) return null;

  const shortTermVol = ewmaVol(logReturns, 5);
  const mediumTermVol = ewmaVol(logReturns, 20);
  const longTermVol = ewmaVol(logReturns, 60);

  if (isNaN(shortTermVol) || isNaN(mediumTermVol) || isNaN(longTermVol)) {
    return null;
  }

  const currentVol = shortTermVol;
  const regime = classifyRegime(currentVol);

  const volExpanding = shortTermVol > longTermVol;
  const volContracting = shortTermVol < longTermVol * 0.7;

  // Regime shift signal based on short/medium ratio
  let regimeShiftSignal: string | null = null;
  const ratio = shortTermVol / mediumTermVol;
  if (ratio > 1.3) {
    regimeShiftSignal = "EXPANSION";
  } else if (ratio < 0.7) {
    regimeShiftSignal = "CONTRACTION";
  }

  return {
    currentVol: Math.round(currentVol * 100) / 100,
    shortTermVol: Math.round(shortTermVol * 100) / 100,
    mediumTermVol: Math.round(mediumTermVol * 100) / 100,
    longTermVol: Math.round(longTermVol * 100) / 100,
    regime,
    regimeTr: REGIME_LABELS_TR[regime],
    volExpanding,
    volContracting,
    regimeShiftSignal,
  };
}
