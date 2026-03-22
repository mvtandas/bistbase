/**
 * Bistbase Composite Scoring Engine v3
 * 8 faktörlü ağırlıklı skor
 * Teknik + Temel + Makro = Tam resim
 */

import type { FullTechnicalData, Timeframe } from "./technicals";
import type { FundamentalScore } from "./fundamentals";
import type { MacroData } from "./macro";

export interface CompositeScore {
  // Sub-scores (0-100)
  technical: number;
  momentum: number;
  volume: number;
  volatility: number;
  sentiment: number;
  fundamental: number;
  macro: number;
  // Composite
  composite: number;
  label: "STRONG_BUY_ZONE" | "BULLISH" | "NEUTRAL" | "BEARISH" | "STRONG_SELL_ZONE";
  labelTr: string;
}

// ═══ REJİM TESPİTİ ═══

export type VolatilityRegime = "LOW" | "NORMAL" | "HIGH" | "CRISIS";

interface Weights {
  technical: number; momentum: number; volume: number;
  volatility: number; sentiment: number; fundamental: number; macro: number;
}

// Dinamik ağırlık tablosu — rejime göre (günlük bazlı)
const REGIME_WEIGHTS: Record<VolatilityRegime, Weights> = {
  LOW:    { fundamental: 0.30, technical: 0.25, momentum: 0.15, macro: 0.05, sentiment: 0.10, volume: 0.05, volatility: 0.10 },
  NORMAL: { fundamental: 0.25, technical: 0.20, momentum: 0.15, macro: 0.10, sentiment: 0.10, volume: 0.15, volatility: 0.05 },
  HIGH:   { fundamental: 0.20, technical: 0.15, momentum: 0.10, macro: 0.20, sentiment: 0.05, volume: 0.15, volatility: 0.15 },
  CRISIS: { fundamental: 0.15, technical: 0.10, momentum: 0.05, macro: 0.30, sentiment: 0.05, volume: 0.15, volatility: 0.20 },
};

// Timeframe bazlı ağırlık ayarları — haftalık/aylıkta temel ve makro daha önemli
const TIMEFRAME_ADJUSTMENTS: Record<Timeframe, Partial<Weights>> = {
  daily:   {},
  weekly:  { fundamental: 0.05, macro: 0.05, technical: 0.03, momentum: -0.03, volume: -0.05 },
  monthly: { fundamental: 0.10, macro: 0.10, technical: -0.05, momentum: -0.07, volume: -0.08 },
};

// Sektöre göre ağırlık ayarı
const SECTOR_ADJUSTMENTS: Record<string, Partial<Weights>> = {
  XBANK: { fundamental: 0.05, macro: 0.05, technical: -0.05, momentum: -0.05 },
  XUSIN: { fundamental: 0.05, volume: 0.05, macro: -0.05, sentiment: -0.05 },
  XULAS: { momentum: 0.05, technical: 0.05, fundamental: -0.05, volatility: -0.05 },
  XHOLD: { fundamental: 0.10, technical: -0.05, momentum: -0.05 },
};

export function detectVolatilityRegime(macroData?: MacroData | null): VolatilityRegime {
  const vix = macroData?.vix;
  let regime: VolatilityRegime = "NORMAL";

  // VIX bazlı global rejim
  if (vix != null) {
    if (vix > 30) regime = "CRISIS";
    else if (vix > 20) regime = "HIGH";
    else if (vix < 12) regime = "LOW";
  }

  // Yerel piyasa koşulları — VIX düşükken bile Türk piyasası kriz yaşayabilir
  const bist100Change = Math.abs(macroData?.bist100Change ?? 0);
  const usdTryChange = Math.abs(macroData?.usdTryChange ?? 0);

  if (bist100Change > 5 || usdTryChange > 3) {
    // Yerel kriz — en az CRISIS'e yükselt
    regime = "CRISIS";
  } else if (bist100Change > 3 || usdTryChange > 2) {
    // Yerel stres — en az HIGH'a yükselt
    if (regime === "LOW" || regime === "NORMAL") regime = "HIGH";
  }

  return regime;
}

function getWeights(macroData?: MacroData | null, sectorCode?: string | null, timeframe: Timeframe = "daily"): Weights {
  const regime = detectVolatilityRegime(macroData);
  const base = { ...REGIME_WEIGHTS[regime] };

  // Timeframe ayarı — haftalık/aylıkta temel ve makro ağırlığını artır
  const tfAdj = TIMEFRAME_ADJUSTMENTS[timeframe];
  for (const [key, val] of Object.entries(tfAdj)) {
    if (val && key in base) {
      (base as Record<string, number>)[key] += val;
    }
  }

  // Sektör ayarı
  if (sectorCode) {
    const adj = SECTOR_ADJUSTMENTS[sectorCode];
    if (adj) {
      for (const [key, val] of Object.entries(adj)) {
        if (val && key in base) {
          (base as Record<string, number>)[key] += val;
        }
      }
      // Normalize — toplam 1.0 olsun
      const total = Object.values(base).reduce((a, b) => a + b, 0);
      for (const key of Object.keys(base)) {
        (base as Record<string, number>)[key] /= total;
      }
    }
  }

  return base;
}

function clamp(v: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

// ── Technical Score ──
function scoreTechnical(t: FullTechnicalData, price: number): number {
  let score = 50;

  if (t.rsi14 != null) {
    if (t.rsi14 >= 70) score += t.rsiBearishDivergence ? -25 : -5;
    else if (t.rsi14 <= 30) score += t.rsiBullishDivergence ? 25 : 5;
    else if (t.rsi14 >= 40 && t.rsi14 <= 60) score += 10;
  }

  switch (t.maAlignment) {
    case "STRONG_BULLISH": score += 25; break;
    case "BULLISH": score += 15; break;
    case "BEARISH": score -= 15; break;
    case "STRONG_BEARISH": score -= 25; break;
  }

  if (t.support != null && t.resistance != null && price > 0) {
    const range = t.resistance - t.support;
    if (range > 0) {
      const position = (price - t.support) / range;
      score += Math.round((1 - position) * 15 - 7);
    }
  }

  if (t.breakoutSignal === "RESISTANCE_BREAK") score += 10;
  if (t.breakoutSignal === "SUPPORT_BREAK") score -= 10;

  return clamp(score);
}

// ── Momentum Score ──
function scoreMomentum(t: FullTechnicalData): number {
  let score = 50;

  if (t.macdHistogram != null) {
    if (t.macdHistogram > 0) score += t.macdCrossover === "BULLISH_CROSS" ? 15 : 10;
    else score -= t.macdCrossover === "BEARISH_CROSS" ? 15 : 10;
  }

  if (t.stochK != null) {
    if (t.stochK <= 20) score += 12;
    else if (t.stochK >= 80) score -= 12;
    else if (t.stochK > 40 && t.stochK < 60) score += 5;
  }

  if (t.adx14 != null && t.plusDI != null && t.minusDI != null) {
    const bullish = t.plusDI > t.minusDI;
    if (t.adx14 >= 15) {
      const adxBonus = Math.min(20, Math.round((t.adx14 - 15) * 0.8));
      score += bullish ? adxBonus : -adxBonus;
    }
    if (t.adx14 < 15) score -= 5;
  }

  if (t.crossSignal === "GOLDEN_CROSS") score += 10;
  if (t.crossSignal === "DEATH_CROSS") score -= 10;

  return clamp(score);
}

// ── Volume Score ──
function scoreVolume(t: FullTechnicalData): number {
  let score = 50;

  if (t.obvTrend != null) {
    const priceUp = (t.rsi14 ?? 50) > 50;
    if (t.obvTrend === "RISING" && priceUp) score += 20;
    else if (t.obvTrend === "RISING" && !priceUp) score += 10;
    else if (t.obvTrend === "FALLING" && priceUp) score -= 15;
    else if (t.obvTrend === "FALLING" && !priceUp) score -= 20;
  }

  if (t.obvDivergence === "BULLISH") score += 10;
  if (t.obvDivergence === "BEARISH") score -= 10;

  if (t.volumeRatio != null) {
    if (t.volumeAnomaly) {
      const priceUp = (t.rsi14 ?? 50) > 50;
      score += priceUp ? 15 : -15;
    } else if (t.volumeRatio < 0.5) {
      score -= 5;
    }
  }

  // CMF — gerçek para akışı
  if (t.cmfSignal === "ACCUMULATION") score += 12;
  else if (t.cmfSignal === "DISTRIBUTION") score -= 12;

  // MFI — hacim ağırlıklı RSI
  if (t.mfi14 != null) {
    if (t.mfi14 <= 20) score += 8; // Oversold = fırsat
    else if (t.mfi14 >= 80) score -= 8; // Overbought = risk
  }

  return clamp(score);
}

// ── Volatility Score ──
function scoreVolatility(t: FullTechnicalData): number {
  let score = 50;

  if (t.atrPercent != null) {
    if (t.atrPercent < 1.5) score += 20;
    else if (t.atrPercent < 3) score += 10;
    else if (t.atrPercent < 5) score -= 5;
    else score -= 15;
  }

  if (t.bbSqueeze) score += 10;

  if (t.bbPercentB != null) {
    if (t.bbPercentB < 0) score -= 10;
    else if (t.bbPercentB > 1) {
      // Üst band kırılımı: trend yönüne bağlı (güçlü trend = breakout, zayıf = aşırı uzanma)
      score += (t.maAlignment === "STRONG_BULLISH" || t.maAlignment === "BULLISH") ? 5 : -5;
    }
    else if (t.bbPercentB > 0.3 && t.bbPercentB < 0.7) score += 5;
  }

  return clamp(score);
}

// ── Sentiment Score ──
function scoreSentiment(sentimentValue: number): number {
  return clamp(Math.round((sentimentValue + 100) / 2));
}

// ── Label ──
function getLabel(composite: number): CompositeScore["label"] {
  if (composite >= 75) return "STRONG_BUY_ZONE";
  if (composite >= 58) return "BULLISH";
  if (composite >= 42) return "NEUTRAL";
  if (composite >= 25) return "BEARISH";
  return "STRONG_SELL_ZONE";
}

function getLabelTr(label: CompositeScore["label"]): string {
  switch (label) {
    case "STRONG_BUY_ZONE": return "Güçlü Alım Bölgesi";
    case "BULLISH": return "Pozitif";
    case "NEUTRAL": return "Nötr";
    case "BEARISH": return "Negatif";
    case "STRONG_SELL_ZONE": return "Güçlü Satış Bölgesi";
  }
}

// ════════════════════════════════════════
// MAIN ENTRY — v3 (8 faktör)
// ════════════════════════════════════════

export function calculateCompositeScore(
  technicals: FullTechnicalData,
  price: number,
  sentimentValue = 0,
  fundamentalScore?: FundamentalScore | null,
  macroData?: MacroData | null,
  sectorCode?: string | null,
  timeframe: Timeframe = "daily",
  extras?: {
    volatilityRegime?: { regime: string; volExpanding: boolean; volContracting: boolean } | null;
    turkishSeasonality?: { overallBias: string; tcmbDecisionProximity: boolean; specialPeriod: string | null } | null;
    indexInclusion?: { currentIndices: string[] } | null;
  },
): CompositeScore {
  const technical = scoreTechnical(technicals, price);
  const momentum = scoreMomentum(technicals);
  let volume = scoreVolume(technicals);
  let volatility = scoreVolatility(technicals);
  let sentiment = scoreSentiment(sentimentValue);
  const fundamental = fundamentalScore?.fundamentalScore ?? 50;
  const macro = macroData?.macroScore ?? 50;

  // A2: Türk mevsimsellik → sentiment ayarlaması (max ±8 puan)
  if (extras?.turkishSeasonality) {
    const ts = extras.turkishSeasonality;
    if (ts.overallBias === "BULLISH") sentiment = clamp(sentiment + 5);
    else if (ts.overallBias === "BEARISH") sentiment = clamp(sentiment - 5);
    if (ts.tcmbDecisionProximity) sentiment = clamp(sentiment - 3);
    if (ts.specialPeriod === "YILSONU") sentiment = clamp(sentiment + 3);
  }

  // A3: Endeks üyeliği → volume/likidite bonusu (max ±5 puan)
  if (extras?.indexInclusion) {
    const indices = extras.indexInclusion.currentIndices;
    if (indices.includes("BIST30")) volume = clamp(volume + 5);
    else if (indices.includes("BIST50")) volume = clamp(volume + 3);
    else if (indices.length === 0) volume = clamp(volume - 3);
  }

  // A1: EWMA volatilite rejimi → volatility sub-score ayarlaması
  if (extras?.volatilityRegime) {
    const vr = extras.volatilityRegime;
    if (vr.volExpanding) volatility = clamp(volatility + 5);   // kırılım fırsatı
    if (vr.volContracting) volatility = clamp(volatility - 3); // düşük hareket
    // EWMA EXTREME ama yerel rejim düşükse → volatility'yi düşür
    if (vr.regime === "EXTREME") volatility = clamp(volatility - 10);
  }

  // Dinamik ağırlıklar — rejim + sektör + timeframe bazlı
  const w = getWeights(macroData, sectorCode, timeframe);

  const composite = Math.round(
    technical * w.technical +
    momentum * w.momentum +
    volume * w.volume +
    volatility * w.volatility +
    sentiment * w.sentiment +
    fundamental * w.fundamental +
    macro * w.macro
  );

  const label = getLabel(composite);

  return {
    technical,
    momentum,
    volume,
    volatility,
    sentiment,
    fundamental,
    macro,
    composite: clamp(composite),
    label,
    labelTr: getLabelTr(label),
  };
}
