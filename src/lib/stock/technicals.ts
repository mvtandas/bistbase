/**
 * Teknik gösterge hesaplamaları — saf matematik, AI yok.
 * Sonuçlar AI'a "yorumlama" için verilir.
 */

export interface HistoricalBar {
  date: string;
  close: number;
  high: number;
  low: number;
  volume: number;
}

export interface TechnicalSignals {
  // RSI
  rsi14: number | null;
  rsiSignal: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL" | null;

  // Hareketli Ortalamalar
  ma20: number | null;
  ma50: number | null;
  ma200: number | null;

  // Golden Cross / Death Cross
  crossSignal: "GOLDEN_CROSS" | "DEATH_CROSS" | null;

  // Destek / Direnç (son 30 gün)
  support: number | null;
  resistance: number | null;
  breakoutSignal: "RESISTANCE_BREAK" | "SUPPORT_BREAK" | null;

  // Hacim Anomalisi
  volumeAvg20: number | null;
  volumeRatio: number | null; // bugünkü hacim / 20 gün ort
  volumeAnomaly: boolean;
}

// ── RSI (14 gün) ──
function calculateRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;

  let gainSum = 0;
  let lossSum = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gainSum += diff;
    else lossSum += Math.abs(diff);
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// ── Hareketli Ortalama ──
function calculateMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// ── Golden Cross / Death Cross ──
function detectCross(
  closes: number[]
): "GOLDEN_CROSS" | "DEATH_CROSS" | null {
  if (closes.length < 201) return null;

  const ma50Now = calculateMA(closes, 50);
  const ma200Now = calculateMA(closes, 200);
  const ma50Prev = calculateMA(closes.slice(0, -1), 50);
  const ma200Prev = calculateMA(closes.slice(0, -1), 200);

  if (!ma50Now || !ma200Now || !ma50Prev || !ma200Prev) return null;

  // Golden Cross: MA50 dünden bugüne MA200'ü yukarı kesti
  if (ma50Prev <= ma200Prev && ma50Now > ma200Now) return "GOLDEN_CROSS";
  // Death Cross: MA50 dünden bugüne MA200'ü aşağı kesti
  if (ma50Prev >= ma200Prev && ma50Now < ma200Now) return "DEATH_CROSS";

  return null;
}

// ── Destek / Direnç (son 30 günün min/max) ──
function calculateSupportResistance(
  bars: HistoricalBar[]
): { support: number | null; resistance: number | null } {
  if (bars.length < 5)
    return { support: null, resistance: null };

  const last30 = bars.slice(-30);
  const lows = last30.map((b) => b.low);
  const highs = last30.map((b) => b.high);

  return {
    support: Math.min(...lows),
    resistance: Math.max(...highs),
  };
}

// ── Ana fonksiyon ──
export function calculateTechnicals(
  bars: HistoricalBar[],
  currentPrice: number | null,
  currentVolume: number | null
): TechnicalSignals {
  const closes = bars.map((b) => b.close);

  // RSI
  const rsi14 = calculateRSI(closes);
  let rsiSignal: TechnicalSignals["rsiSignal"] = null;
  if (rsi14 != null) {
    if (rsi14 >= 70) rsiSignal = "OVERBOUGHT";
    else if (rsi14 <= 30) rsiSignal = "OVERSOLD";
    else rsiSignal = "NEUTRAL";
  }

  // MA
  const ma20 = calculateMA(closes, 20);
  const ma50 = calculateMA(closes, 50);
  const ma200 = calculateMA(closes, 200);

  // Cross
  const crossSignal = detectCross(closes);

  // Destek / Direnç
  const { support, resistance } = calculateSupportResistance(bars);
  let breakoutSignal: TechnicalSignals["breakoutSignal"] = null;
  if (currentPrice != null && resistance != null && currentPrice > resistance) {
    breakoutSignal = "RESISTANCE_BREAK";
  } else if (
    currentPrice != null &&
    support != null &&
    currentPrice < support
  ) {
    breakoutSignal = "SUPPORT_BREAK";
  }

  // Hacim Anomalisi
  const volumes = bars.slice(-20).map((b) => b.volume);
  const volumeAvg20 =
    volumes.length >= 20
      ? volumes.reduce((a, b) => a + b, 0) / volumes.length
      : null;
  const volumeRatio =
    currentVolume != null && volumeAvg20 != null && volumeAvg20 > 0
      ? currentVolume / volumeAvg20
      : null;
  const volumeAnomaly = volumeRatio != null && volumeRatio >= 3;

  return {
    rsi14: rsi14 != null ? Math.round(rsi14 * 100) / 100 : null,
    rsiSignal,
    ma20: ma20 != null ? Math.round(ma20 * 100) / 100 : null,
    ma50: ma50 != null ? Math.round(ma50 * 100) / 100 : null,
    ma200: ma200 != null ? Math.round(ma200 * 100) / 100 : null,
    crossSignal,
    support: support != null ? Math.round(support * 100) / 100 : null,
    resistance: resistance != null ? Math.round(resistance * 100) / 100 : null,
    breakoutSignal,
    volumeAvg20: volumeAvg20 != null ? Math.round(volumeAvg20) : null,
    volumeRatio: volumeRatio != null ? Math.round(volumeRatio * 100) / 100 : null,
    volumeAnomaly,
  };
}
