/**
 * Exit Rules Engine
 * Her verdikt için stop-loss, take-profit ve zaman bazlı çıkış kuralları üretir
 */

import type { VerdictAction } from "./verdict";

// ═══ Types ═══

export interface ExitRules {
  /** Stop-loss fiyatı (TL) */
  stopLoss: number;
  /** Stop-loss yüzdesi (entry'den) */
  stopLossPct: number;
  /** Take-profit fiyatı (TL) */
  takeProfit: number;
  /** Take-profit yüzdesi (entry'den) */
  takeProfitPct: number;
  /** Trailing stop başlangıç yüzdesi (entry'den bu kadar kâra geçince aktifleşir) */
  trailingActivationPct: number;
  /** Trailing stop mesafesi (ATR çarpanı) */
  trailingAtrMultiplier: number;
  /** Maksimum pozisyon tutma süresi (gün) */
  maxHoldingDays: number;
  /** Risk/Reward oranı */
  riskRewardRatio: number;
  /** Çıkış kuralları açıklaması (Türkçe) */
  description: string;
}

// ═══ Constants ═══

/** ATR çarpanları — verdikt tipine göre */
const ATR_MULTIPLIERS: Record<VerdictAction, { sl: number; tp: number }> = {
  GUCLU_AL: { sl: 2.5, tp: 4.0 },   // Geniş stop, yüksek hedef
  AL:       { sl: 2.0, tp: 3.0 },   // Standart
  TUT:      { sl: 1.5, tp: 2.0 },   // Dar aralık (hold pozisyonu)
  SAT:      { sl: 2.0, tp: 3.0 },   // Standart (short tarafı)
  GUCLU_SAT:{ sl: 2.5, tp: 4.0 },   // Geniş stop, yüksek hedef (short)
};

/** Maksimum holding süreleri (gün) */
const MAX_HOLDING_DAYS: Record<VerdictAction, number> = {
  GUCLU_AL: 30,
  AL: 20,
  TUT: 10,   // TUT verdikti uzun tutulmaz
  SAT: 20,
  GUCLU_SAT: 30,
};

/** Trailing stop aktivasyon eşikleri (kâr yüzdesi) */
const TRAILING_ACTIVATION: Record<VerdictAction, number> = {
  GUCLU_AL: 3.0,   // %3 kâr sonrası trailing başlar
  AL: 2.0,
  TUT: 1.5,
  SAT: 2.0,
  GUCLU_SAT: 3.0,
};

// ═══ Main Function ═══

/**
 * Verdikt, fiyat ve ATR bilgisine göre çıkış kuralları üretir.
 *
 * @param action - Verdikt aksiyonu (GUCLU_AL, AL, vb.)
 * @param entryPrice - Giriş fiyatı
 * @param atr14 - 14 günlük ATR (Average True Range)
 * @param confidence - Verdikt güven seviyesi (0-100)
 */
export function generateExitRules(
  action: VerdictAction,
  entryPrice: number,
  atr14: number | null,
  confidence: number = 50,
): ExitRules {
  // ATR yoksa fiyatın %5'ini proxy olarak kullan
  const atr = atr14 ?? entryPrice * 0.05;

  const multipliers = ATR_MULTIPLIERS[action];
  const isShort = action === "SAT" || action === "GUCLU_SAT";

  // Güven seviyesine göre stop/TP ayarla
  // Yüksek güven → daha geniş stop (daha fazla nefes alanı), daha yüksek hedef
  // Düşük güven → daha dar stop (riski sınırla)
  const confMultiplier = confidence >= 70 ? 1.15 : confidence >= 45 ? 1.0 : 0.85;

  const slDistance = atr * multipliers.sl * confMultiplier;
  const tpDistance = atr * multipliers.tp * confMultiplier;

  let stopLoss: number;
  let takeProfit: number;

  if (isShort) {
    // Short pozisyon: stop yukarıda, TP aşağıda
    stopLoss = entryPrice + slDistance;
    takeProfit = entryPrice - tpDistance;
  } else {
    // Long pozisyon: stop aşağıda, TP yukarıda
    stopLoss = entryPrice - slDistance;
    takeProfit = entryPrice + tpDistance;
  }

  // Negatif stop-loss engelle
  stopLoss = Math.max(stopLoss, entryPrice * 0.01);

  const stopLossPct = Math.abs((stopLoss - entryPrice) / entryPrice) * 100;
  const takeProfitPct = Math.abs((takeProfit - entryPrice) / entryPrice) * 100;
  const riskRewardRatio = stopLossPct > 0 ? takeProfitPct / stopLossPct : 0;

  const maxHoldingDays = MAX_HOLDING_DAYS[action];
  const trailingActivationPct = TRAILING_ACTIVATION[action];
  const trailingAtrMultiplier = multipliers.sl * 0.8; // Trailing stop biraz daha dar

  const actionLabels: Record<string, string> = {
    GUCLU_AL: "Güçlü Al", AL: "Al", TUT: "Tut", SAT: "Sat", GUCLU_SAT: "Güçlü Sat",
  };

  const description = isShort
    ? `${actionLabels[action]}: Stop ₺${stopLoss.toFixed(2)} (+%${stopLossPct.toFixed(1)}), Hedef ₺${takeProfit.toFixed(2)} (-%${takeProfitPct.toFixed(1)}). ${maxHoldingDays}g max süre. R:R ${riskRewardRatio.toFixed(1)}:1.`
    : `${actionLabels[action]}: Stop ₺${stopLoss.toFixed(2)} (-%${stopLossPct.toFixed(1)}), Hedef ₺${takeProfit.toFixed(2)} (+%${takeProfitPct.toFixed(1)}). ${maxHoldingDays}g max süre. R:R ${riskRewardRatio.toFixed(1)}:1.`;

  return {
    stopLoss: Math.round(stopLoss * 100) / 100,
    stopLossPct: Math.round(stopLossPct * 100) / 100,
    takeProfit: Math.round(takeProfit * 100) / 100,
    takeProfitPct: Math.round(takeProfitPct * 100) / 100,
    trailingActivationPct,
    trailingAtrMultiplier: Math.round(trailingAtrMultiplier * 100) / 100,
    maxHoldingDays,
    riskRewardRatio: Math.round(riskRewardRatio * 100) / 100,
    description,
  };
}
