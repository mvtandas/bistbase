/**
 * GYO (Gayrimenkul Yatırım Ortaklığı) Özel Metrikleri
 * NAV ve P/NAV iskontosu
 */

export interface REITMetrics {
  stockCode: string;
  isREIT: boolean;
  navPerShare: number | null;       // Net Aktif Değer / Hisse
  pToNav: number | null;            // Fiyat / NAV oranı — <1 iskontolu, >1 primli
  navDiscount: number | null;       // % iskonto (negatif = prim)
  riskAssessment: "DISCOUNT" | "FAIR" | "PREMIUM" | null;
  description: string;
}

const REIT_STOCKS = ["EKGYO", "ISGYO", "HLGYO", "TRGYO", "KLGYO", "SRVGY", "VKGYO", "YGGYO", "AKFGY", "ALGYO", "MSGYO", "PEGYO", "MRGYO"];

export function isREIT(stockCode: string): boolean {
  return REIT_STOCKS.includes(stockCode.toUpperCase());
}

export function getREITMetrics(stockCode: string, fundamentals?: { pbRatio?: number | null } | null): REITMetrics {
  if (!isREIT(stockCode)) {
    return { stockCode, isREIT: false, navPerShare: null, pToNav: null, navDiscount: null, riskAssessment: null, description: "GYO değil" };
  }

  // P/B ≈ P/NAV for REITs (yaklaşık)
  const pToNav = fundamentals?.pbRatio ?? null;
  const navDiscount = pToNav != null ? Math.round((1 - pToNav) * 100 * 10) / 10 : null;

  let riskAssessment: "DISCOUNT" | "FAIR" | "PREMIUM" | null = null;
  if (pToNav != null) {
    riskAssessment = pToNav < 0.8 ? "DISCOUNT" : pToNav > 1.2 ? "PREMIUM" : "FAIR";
  }

  return {
    stockCode,
    isREIT: true,
    navPerShare: null,   // Gerçek NAV KAP'tan gelecek
    pToNav,
    navDiscount,
    riskAssessment,
    description: pToNav != null ? `GYO P/NAV: ${pToNav.toFixed(2)} (${navDiscount! > 0 ? `%${navDiscount} iskonto` : `%${Math.abs(navDiscount!)} prim`})` : "GYO metrikleri hesaplanamadı",
  };
}
