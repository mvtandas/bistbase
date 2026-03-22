/**
 * Chart overlay series computation
 * Generates per-bar MA, Bollinger Band series for the price chart
 */

import type { HistoricalBar } from "./technicals";

export interface OverlayPoint {
  date: string;
  value: number;
}

export interface ChartOverlays {
  ma20: OverlayPoint[];
  ma50: OverlayPoint[];
  ma200: OverlayPoint[];
  bbUpper: OverlayPoint[];
  bbLower: OverlayPoint[];
  support: number | null;
  resistance: number | null;
}

function rollingSMA(bars: HistoricalBar[], period: number): OverlayPoint[] {
  const result: OverlayPoint[] = [];
  if (bars.length < period) return result;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += bars[i].close;
  result.push({ date: bars[period - 1].date, value: Math.round(sum / period * 100) / 100 });
  for (let i = period; i < bars.length; i++) {
    sum += bars[i].close - bars[i - period].close;
    result.push({ date: bars[i].date, value: Math.round(sum / period * 100) / 100 });
  }
  return result;
}

function rollingBollingerBands(bars: HistoricalBar[], period = 20, mult = 2): { upper: OverlayPoint[]; lower: OverlayPoint[] } {
  const upper: OverlayPoint[] = [];
  const lower: OverlayPoint[] = [];
  if (bars.length < period) return { upper, lower };

  for (let i = period - 1; i < bars.length; i++) {
    const slice = bars.slice(i - period + 1, i + 1).map((b) => b.close);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    upper.push({ date: bars[i].date, value: Math.round((mean + mult * sd) * 100) / 100 });
    lower.push({ date: bars[i].date, value: Math.round((mean - mult * sd) * 100) / 100 });
  }
  return { upper, lower };
}

export function computeChartOverlays(
  bars: HistoricalBar[],
  support: number | null,
  resistance: number | null,
): ChartOverlays {
  const bb = rollingBollingerBands(bars);
  return {
    ma20: rollingSMA(bars, 20),
    ma50: rollingSMA(bars, 50),
    ma200: rollingSMA(bars, 200),
    bbUpper: bb.upper,
    bbLower: bb.lower,
    support,
    resistance,
  };
}
