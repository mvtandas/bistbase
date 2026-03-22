/**
 * Bistbase Portfolio Equity Curve Engine
 * Gerçek tarihi portföy değeri hesaplama — normalize edilmiş equity curve
 */

import { getHistoricalBars } from "./yahoo";

export interface EquityCurvePoint {
  date: string;
  portfolioValue: number;   // 100'e normalize
  bist100Value: number;      // 100'e normalize
  excessReturn: number;      // portföy - benchmark (%)
}

export interface EquityCurveResult {
  curve: EquityCurvePoint[];
  totalReturn: number;       // %
  bist100TotalReturn: number; // %
  alpha: number;             // excess return %
  dailyReturns: number[];    // raw daily returns (for other calculations)
}

/**
 * Gerçek ağırlıklı portföy equity curve hesapla
 * Her hisse için tarihi fiyatları çeker, ağırlıklara göre birleştirir
 */
export async function calculatePortfolioEquityCurve(
  stockCodes: string[],
  weights: Map<string, number>,
  lookbackDays = 180,
): Promise<EquityCurveResult> {
  if (stockCodes.length === 0) {
    return { curve: [], totalReturn: 0, bist100TotalReturn: 0, alpha: 0, dailyReturns: [] };
  }

  // Tüm hisseler + BİST100 barlarını paralel çek
  const [bist100Bars, ...stockBarResults] = await Promise.all([
    getHistoricalBars("XU100", lookbackDays).catch(() => []),
    ...stockCodes.map(code =>
      getHistoricalBars(code, lookbackDays).catch(() => [])
    ),
  ]);

  if (bist100Bars.length < 10) {
    return { curve: [], totalReturn: 0, bist100TotalReturn: 0, alpha: 0, dailyReturns: [] };
  }

  // Tarihleri BİST100 referansıyla hizala (en güvenilir takvim)
  const dateSet = new Set(bist100Bars.map(b => b.date));
  const sortedDates = [...dateSet].sort();

  // Her hisse için tarih→fiyat map oluştur
  const stockPriceMap = new Map<string, Map<string, number>>();
  stockCodes.forEach((code, i) => {
    const bars = stockBarResults[i];
    const priceMap = new Map<string, number>();
    for (const bar of bars) {
      if (bar.close > 0) priceMap.set(bar.date, bar.close);
    }
    stockPriceMap.set(code, priceMap);
  });

  // BİST100 tarih→fiyat map
  const bist100Map = new Map<string, number>();
  for (const bar of bist100Bars) {
    if (bar.close > 0) bist100Map.set(bar.date, bar.close);
  }

  // İlk geçerli tarihi bul (tüm hisselerin verisi olan)
  let startIdx = -1;
  for (let i = 0; i < sortedDates.length; i++) {
    const date = sortedDates[i];
    const allHaveData = stockCodes.every(code => stockPriceMap.get(code)?.has(date));
    if (allHaveData && bist100Map.has(date)) {
      startIdx = i;
      break;
    }
  }

  if (startIdx === -1 || sortedDates.length - startIdx < 5) {
    return { curve: [], totalReturn: 0, bist100TotalReturn: 0, alpha: 0, dailyReturns: [] };
  }

  const activeDates = sortedDates.slice(startIdx);
  const startDate = activeDates[0];

  // Başlangıç fiyatları (normalize için)
  const startPrices = new Map<string, number>();
  for (const code of stockCodes) {
    startPrices.set(code, stockPriceMap.get(code)!.get(startDate)!);
  }
  const bist100Start = bist100Map.get(startDate)!;

  // Toplam ağırlık normalize
  const totalWeight = stockCodes.reduce((sum, code) => sum + (weights.get(code) ?? 0), 0);

  const curve: EquityCurvePoint[] = [];
  const dailyReturns: number[] = [];
  let prevPortValue = 100;

  for (const date of activeDates) {
    // Portföy değeri: Σ(w_i × P_i(t) / P_i(0)) × 100
    let portfolioValue = 0;
    let validWeight = 0;

    for (const code of stockCodes) {
      const price = stockPriceMap.get(code)?.get(date);
      const startPrice = startPrices.get(code);
      const w = weights.get(code) ?? 0;

      if (price && startPrice && startPrice > 0) {
        portfolioValue += (w / totalWeight) * (price / startPrice) * 100;
        validWeight += w;
      }
    }

    // Eksik hisseleri eşit ağırlıkla doldur
    if (validWeight < totalWeight && validWeight > 0) {
      portfolioValue = portfolioValue * (totalWeight / validWeight);
    }

    // BİST100 normalize
    const bist100Price = bist100Map.get(date);
    const bist100Value = bist100Price ? (bist100Price / bist100Start) * 100 : 100;

    // Daily return
    if (curve.length > 0) {
      dailyReturns.push(prevPortValue > 0 ? (portfolioValue - prevPortValue) / prevPortValue : 0);
    }
    prevPortValue = portfolioValue;

    curve.push({
      date,
      portfolioValue: Math.round(portfolioValue * 100) / 100,
      bist100Value: Math.round(bist100Value * 100) / 100,
      excessReturn: Math.round((portfolioValue - bist100Value) * 100) / 100,
    });
  }

  const totalReturn = curve.length > 0 ? Math.round((curve[curve.length - 1].portfolioValue - 100) * 100) / 100 : 0;
  const bist100TotalReturn = curve.length > 0 ? Math.round((curve[curve.length - 1].bist100Value - 100) * 100) / 100 : 0;

  return {
    curve,
    totalReturn,
    bist100TotalReturn,
    alpha: Math.round((totalReturn - bist100TotalReturn) * 100) / 100,
    dailyReturns,
  };
}
