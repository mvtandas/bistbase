/**
 * Position Sizing Engine
 * Risk-bazlı pozisyon büyüklüğü hesaplama
 * Her trade'de maksimum risk yüzdesini aşmamayı garanti eder
 */

import type { VerdictAction } from "./verdict";
import { calculateLots, EFFECTIVE_COST_PER_SIDE } from "./bist-constants";

// ═══ Types ═══

export interface PositionSize {
  /** Alınacak lot sayısı */
  lots: number;
  /** Pozisyon değeri (TL) */
  positionValue: number;
  /** Portföy yüzdesi */
  portfolioWeight: number;
  /** Riske edilen miktar (TL) */
  riskAmount: number;
  /** Riske edilen yüzde */
  riskPercent: number;
  /** Tahmini komisyon (alım) */
  commission: number;
  /** Toplam maliyet (pozisyon + komisyon) */
  totalCost: number;
  /** Neden bu büyüklük seçildi */
  reason: string;
}

// ═══ Constants ═══

/** Verdikt bazlı risk yüzdeleri (hesap büyüklüğüne göre) */
const RISK_PER_TRADE: Record<VerdictAction, { highConf: number; medConf: number; lowConf: number }> = {
  GUCLU_AL: { highConf: 0.020, medConf: 0.015, lowConf: 0.008 },  // max %2
  AL:       { highConf: 0.015, medConf: 0.010, lowConf: 0.005 },  // max %1.5
  TUT:      { highConf: 0.005, medConf: 0.003, lowConf: 0.002 },  // TUT = minimum risk
  SAT:      { highConf: 0.015, medConf: 0.010, lowConf: 0.005 },
  GUCLU_SAT:{ highConf: 0.020, medConf: 0.015, lowConf: 0.008 },
};

/** Tek pozisyonda maksimum portföy ağırlığı */
const MAX_SINGLE_POSITION_WEIGHT = 0.10; // %10

/** Tek sektörde maksimum portföy ağırlığı */
const MAX_SECTOR_WEIGHT = 0.30; // %30

/** Minimum lot */
const MIN_LOTS = 1;

// ═══ Main Function ═══

/**
 * Risk-bazlı pozisyon büyüklüğü hesapla.
 *
 * Formula: lots = (account × risk%) / (entry - stop)
 *
 * @param accountSize - Toplam hesap büyüklüğü (TL)
 * @param entryPrice - Giriş fiyatı
 * @param stopLossPrice - Stop-loss fiyatı
 * @param action - Verdikt aksiyonu
 * @param confidence - Verdikt güven seviyesi (0-100)
 * @param currentPortfolioWeight - Bu hissenin mevcut portföy ağırlığı (0-1)
 * @param currentSectorWeight - Bu sektörün mevcut portföy ağırlığı (0-1)
 */
export function calculatePositionSize(
  accountSize: number,
  entryPrice: number,
  stopLossPrice: number,
  action: VerdictAction,
  confidence: number = 50,
  currentPortfolioWeight: number = 0,
  currentSectorWeight: number = 0,
): PositionSize {
  // 1. Risk yüzdesi belirle
  const riskConfig = RISK_PER_TRADE[action];
  const riskPercent = confidence >= 70
    ? riskConfig.highConf
    : confidence >= 45
      ? riskConfig.medConf
      : riskConfig.lowConf;

  const riskAmount = accountSize * riskPercent;

  // 2. Risk per share (giriş ile stop arasındaki fark)
  const riskPerShare = Math.abs(entryPrice - stopLossPrice);

  if (riskPerShare <= 0) {
    return emptyPosition("Stop-loss fiyatı entry fiyatına eşit veya geçersiz");
  }

  // 3. Teorik lot sayısı
  let lots = Math.floor(riskAmount / riskPerShare);

  // 4. Pozisyon ağırlığı kontrolü
  const positionValue = lots * entryPrice;
  let weight = positionValue / accountSize;

  // Max tek pozisyon ağırlığı
  const remainingPositionWeight = Math.max(0, MAX_SINGLE_POSITION_WEIGHT - currentPortfolioWeight);
  if (weight > remainingPositionWeight) {
    lots = Math.floor((accountSize * remainingPositionWeight) / entryPrice);
    weight = (lots * entryPrice) / accountSize;
  }

  // Max sektör ağırlığı
  const remainingSectorWeight = Math.max(0, MAX_SECTOR_WEIGHT - currentSectorWeight);
  if (weight > remainingSectorWeight) {
    lots = Math.floor((accountSize * remainingSectorWeight) / entryPrice);
    weight = (lots * entryPrice) / accountSize;
  }

  // 5. BIST lot hesabı ile uyumlu hale getir
  const bistLots = calculateLots(lots * entryPrice, entryPrice);
  lots = Math.max(MIN_LOTS, Math.min(lots, bistLots));

  // 6. Yeterli nakit kontrolü
  const finalValue = lots * entryPrice;
  const commission = finalValue * EFFECTIVE_COST_PER_SIDE;
  const totalCost = finalValue + commission;

  if (totalCost > accountSize * 0.95) { // %5 nakit rezervi bırak
    lots = Math.floor((accountSize * 0.90) / (entryPrice * (1 + EFFECTIVE_COST_PER_SIDE)));
  }

  if (lots < MIN_LOTS) {
    return emptyPosition("Hesap büyüklüğü yetersiz");
  }

  const actualValue = lots * entryPrice;
  const actualRisk = lots * riskPerShare;
  const actualCommission = actualValue * EFFECTIVE_COST_PER_SIDE;
  const actualWeight = actualValue / accountSize;
  const actualRiskPct = actualRisk / accountSize;

  const confLabel = confidence >= 70 ? "yüksek" : confidence >= 45 ? "orta" : "düşük";
  const reason = `${lots} lot × ₺${entryPrice.toFixed(2)} = ₺${actualValue.toFixed(0)}. Risk: ₺${actualRisk.toFixed(0)} (%${(actualRiskPct * 100).toFixed(2)}). Güven: ${confLabel} (${confidence}).`;

  return {
    lots,
    positionValue: Math.round(actualValue * 100) / 100,
    portfolioWeight: Math.round(actualWeight * 10000) / 10000,
    riskAmount: Math.round(actualRisk * 100) / 100,
    riskPercent: Math.round(actualRiskPct * 10000) / 10000,
    commission: Math.round(actualCommission * 100) / 100,
    totalCost: Math.round((actualValue + actualCommission) * 100) / 100,
    reason,
  };
}

function emptyPosition(reason: string): PositionSize {
  return {
    lots: 0,
    positionValue: 0,
    portfolioWeight: 0,
    riskAmount: 0,
    riskPercent: 0,
    commission: 0,
    totalCost: 0,
    reason,
  };
}
