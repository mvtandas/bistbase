/**
 * Bankacılık Sektörü (XBANK) Özel Metrikleri
 * SYR (CAR), TGA (NPL), NIM — KAP finansal tablolarından veya yaklaşık hesapla
 */

export interface BankMetrics {
  stockCode: string;
  isBankStock: boolean;
  car: number | null;              // Sermaye Yeterlilik Rasyosu (Capital Adequacy Ratio) — min %8
  nplRatio: number | null;         // Takipteki Alacak Oranı (Non-Performing Loan) — düşük=iyi
  nim: number | null;              // Net Faiz Marjı (Net Interest Margin) — yüksek=iyi
  costToIncome: number | null;     // Maliyet/Gelir Oranı — düşük=iyi
  loanGrowth: number | null;       // Kredi büyümesi YoY %
  riskAssessment: "STRONG" | "ADEQUATE" | "WEAK" | null;
  description: string;
}

// XBANK hisseleri
const BANK_STOCKS = ["GARAN", "AKBNK", "YKBNK", "ISCTR", "HALKB", "VAKBN", "TSKB", "ALBRK", "QNBFB", "SKBNK", "ICBCT"];

export function isBankStock(stockCode: string): boolean {
  return BANK_STOCKS.includes(stockCode.toUpperCase());
}

export function getBankMetrics(stockCode: string, fundamentals?: { roe?: number | null; profitMargin?: number | null; debtToEquity?: number | null; currentRatio?: number | null } | null): BankMetrics {
  if (!isBankStock(stockCode)) {
    return { stockCode, isBankStock: false, car: null, nplRatio: null, nim: null, costToIncome: null, loanGrowth: null, riskAssessment: null, description: "Banka hissesi değil" };
  }

  // Yaklaşık metrikler (gerçek değerler KAP'tan gelecek)
  // ROE'den NIM tahmini, profitMargin'den costToIncome tahmini
  const roe = fundamentals?.roe;
  const profitMargin = fundamentals?.profitMargin;

  const nimEstimate = roe != null ? Math.round(roe * 0.3 * 10) / 10 : null;  // ROE ile korelasyon
  const costToIncomeEstimate = profitMargin != null ? Math.round((100 - profitMargin) * 10) / 10 : null;

  let riskAssessment: "STRONG" | "ADEQUATE" | "WEAK" | null = null;
  if (roe != null) {
    riskAssessment = roe > 20 ? "STRONG" : roe > 10 ? "ADEQUATE" : "WEAK";
  }

  const parts: string[] = [];
  if (nimEstimate != null) parts.push(`Tahmini NIM: %${nimEstimate}`);
  if (costToIncomeEstimate != null) parts.push(`Tahmini M/G: %${costToIncomeEstimate}`);
  if (riskAssessment) parts.push(`Risk: ${riskAssessment}`);

  return {
    stockCode,
    isBankStock: true,
    car: null,           // KAP entegrasyonu ile gelecek
    nplRatio: null,      // KAP entegrasyonu ile gelecek
    nim: nimEstimate,
    costToIncome: costToIncomeEstimate,
    loanGrowth: null,    // KAP entegrasyonu ile gelecek
    riskAssessment,
    description: parts.length > 0 ? `Bankacılık: ${parts.join(", ")}` : "Bankacılık metrikleri hesaplanamadı",
  };
}
