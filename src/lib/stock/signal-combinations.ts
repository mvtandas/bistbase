/**
 * Sinyal Kombinasyonu Analizi v2
 * Güç-ağırlıklı confluence, sinyal hiyerarşisi, çakışma kalitesi
 */

import type { DetectedSignal } from "./signals";

export interface CombinationAnalysis {
  totalBullish: number;
  totalBearish: number;
  confluenceType: "STRONG_BULLISH" | "STRONG_BEARISH" | "MIXED" | "WEAK" | null;
  confluenceLabel: string;
  conflicting: boolean;
  strengthBoost: number;
  // v2 additions
  dominanceRatio: number; // 0-1: ne kadar tek yönlü (1 = tam uyum, 0.5 = eşit)
  avgBullStrength: number;
  avgBearStrength: number;
}

// Sinyal hiyerarşisi — yüksek tier sinyaller confluence'da daha ağırlıklı
const SIGNAL_TIER: Record<string, number> = {
  // Tier 1 — Güçlü trend sinyalleri (ağırlık 3x)
  GOLDEN_CROSS: 3, DEATH_CROSS: 3,
  STRONG_UPTREND: 3, STRONG_DOWNTREND: 3,
  RESISTANCE_BREAK: 3, SUPPORT_BREAK: 3,
  // Tier 2 — Önemli sinyaller (ağırlık 2x)
  MACD_BULLISH_CROSS: 2, MACD_BEARISH_CROSS: 2,
  RSI_BULLISH_DIVERGENCE: 2, RSI_BEARISH_DIVERGENCE: 2,
  VOLUME_ANOMALY: 2,
  MA_STRONG_BULLISH: 2, MA_STRONG_BEARISH: 2,
  OBV_BULLISH_DIVERGENCE: 2, OBV_BEARISH_DIVERGENCE: 2,
  // Tier 3 — Standart sinyaller (ağırlık 1x)
  // Diğer tüm sinyaller varsayılan 1
};

function getTier(type: string): number {
  return SIGNAL_TIER[type] ?? 1;
}

export function analyzeSignalCombinations(signals: DetectedSignal[]): CombinationAnalysis {
  if (signals.length === 0) {
    return {
      totalBullish: 0, totalBearish: 0,
      confluenceType: null, confluenceLabel: "Sinyal yok",
      conflicting: false, strengthBoost: 0,
      dominanceRatio: 0.5, avgBullStrength: 0, avgBearStrength: 0,
    };
  }

  const bullish = signals.filter(s => s.direction === "BULLISH");
  const bearish = signals.filter(s => s.direction === "BEARISH");

  // Ağırlıklı güç hesabı (tier × strength)
  const bullWeighted = bullish.reduce((sum, s) => sum + s.strength * getTier(s.type), 0);
  const bearWeighted = bearish.reduce((sum, s) => sum + s.strength * getTier(s.type), 0);
  const totalWeighted = bullWeighted + bearWeighted;

  // Dominance ratio: 0.5 = eşit, 1.0 = tam boğa/ayı dominansı
  const dominanceRatio = totalWeighted > 0
    ? Math.max(bullWeighted, bearWeighted) / totalWeighted
    : 0.5;

  // Ortalama güçler
  const avgBullStrength = bullish.length > 0
    ? bullish.reduce((s, sig) => s + sig.strength, 0) / bullish.length
    : 0;
  const avgBearStrength = bearish.length > 0
    ? bearish.reduce((s, sig) => s + sig.strength, 0) / bearish.length
    : 0;

  // Çakışma: her iki tarafta da ağırlıklı güç yüksekse
  const conflicting = bullWeighted > 120 && bearWeighted > 120;

  let confluenceType: CombinationAnalysis["confluenceType"] = null;
  let confluenceLabel = "";
  let strengthBoost = 0;

  if (conflicting) {
    confluenceType = "MIXED";
    confluenceLabel = "Kararsız piyasa — çelişen sinyaller";
    strengthBoost = 0;
  } else if (bullish.length >= 3 && bearish.length === 0) {
    // Tam boğa uyumu
    confluenceType = "STRONG_BULLISH";
    confluenceLabel = `Güçlü sinyal yoğunlaşması — ${bullish.length} uyumlu boğa sinyali`;
    strengthBoost = Math.min(25, Math.round(bullish.length * 4 + (dominanceRatio - 0.5) * 20));
  } else if (bearish.length >= 3 && bullish.length === 0) {
    // Tam ayı uyumu
    confluenceType = "STRONG_BEARISH";
    confluenceLabel = `Güçlü sinyal yoğunlaşması — ${bearish.length} uyumlu ayı sinyali`;
    strengthBoost = Math.min(25, Math.round(bearish.length * 4 + (dominanceRatio - 0.5) * 20));
  } else if (bullWeighted > bearWeighted * 1.5) {
    // Ağırlıklı boğa dominansı (1.5x eşik — basit sayı farkı yerine)
    confluenceType = "STRONG_BULLISH";
    confluenceLabel = `Ağırlıklı boğa — ${bullish.length} boğa vs ${bearish.length} ayı (güç oranı: ${dominanceRatio.toFixed(2)})`;
    strengthBoost = Math.min(15, Math.round((dominanceRatio - 0.5) * 30));
  } else if (bearWeighted > bullWeighted * 1.5) {
    confluenceType = "STRONG_BEARISH";
    confluenceLabel = `Ağırlıklı ayı — ${bearish.length} ayı vs ${bullish.length} boğa (güç oranı: ${dominanceRatio.toFixed(2)})`;
    strengthBoost = Math.min(15, Math.round((dominanceRatio - 0.5) * 30));
  } else {
    confluenceType = "WEAK";
    confluenceLabel = "Dengeli — net yön yok";
    strengthBoost = 0;
  }

  return {
    totalBullish: bullish.length,
    totalBearish: bearish.length,
    confluenceType,
    confluenceLabel,
    conflicting,
    strengthBoost,
    dominanceRatio: Math.round(dominanceRatio * 100) / 100,
    avgBullStrength: Math.round(avgBullStrength),
    avgBearStrength: Math.round(avgBearStrength),
  };
}
