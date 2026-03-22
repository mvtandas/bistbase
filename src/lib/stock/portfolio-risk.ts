/**
 * Portföy Risk Analizi
 * Korelasyon matrisi, diversifikasyon skoru, portföy VaR
 */

import { getHistoricalBars } from "./yahoo";
import { STOCK_SECTOR_MAP, SECTOR_INDICES } from "./sectors";

export interface PortfolioRisk {
  // Korelasyon
  correlations: { pair: [string, string]; correlation: number }[];
  highCorrelationWarnings: string[]; // "GARAN-AKBNK: 0.91 (çok yüksek)"

  // Sektör dağılımı
  sectorDistribution: { sector: string; sectorName: string; percentage: number; stocks: string[] }[];
  concentrationWarning: string | null; // "%60 bankacılık — risk yüksek"

  // Diversifikasyon
  diversificationScore: number; // 0-100
  diversificationLabel: string;

  // Portföy risk
  avgVolatility: number | null;
  portfolioVaR95: number | null;
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 10) return 0;

  const xSlice = x.slice(-n);
  const ySlice = y.slice(-n);

  const meanX = xSlice.reduce((a, b) => a + b, 0) / n;
  const meanY = ySlice.reduce((a, b) => a + b, 0) / n;

  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xSlice[i] - meanX;
    const dy = ySlice[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const den = Math.sqrt(denX * denY);
  return den > 0 ? num / den : 0;
}

export async function analyzePortfolioRisk(stockCodes: string[]): Promise<PortfolioRisk> {
  if (stockCodes.length < 2) {
    return {
      correlations: [],
      highCorrelationWarnings: [],
      sectorDistribution: [],
      concentrationWarning: "Portföyde en az 2 hisse olmalı",
      diversificationScore: 0,
      diversificationLabel: "Yetersiz",
      avgVolatility: null,
      portfolioVaR95: null,
    };
  }

  // Fetch 90-day returns for all stocks
  const allBars = await Promise.all(
    stockCodes.map(async (code) => {
      const bars = await getHistoricalBars(code, 90);
      const returns: number[] = [];
      for (let i = 1; i < bars.length; i++) {
        if (bars[i - 1].close > 0) {
          returns.push((bars[i].close - bars[i - 1].close) / bars[i - 1].close);
        }
      }
      return { code, returns };
    })
  );

  // Korelasyon matrisi
  const correlations: PortfolioRisk["correlations"] = [];
  const highCorrelationWarnings: string[] = [];

  for (let i = 0; i < allBars.length; i++) {
    for (let j = i + 1; j < allBars.length; j++) {
      const corr = pearsonCorrelation(allBars[i].returns, allBars[j].returns);
      const rounded = Math.round(corr * 100) / 100;
      correlations.push({
        pair: [allBars[i].code, allBars[j].code],
        correlation: rounded,
      });
      if (Math.abs(rounded) > 0.8) {
        highCorrelationWarnings.push(
          `${allBars[i].code}-${allBars[j].code}: ${rounded.toFixed(2)} (${rounded > 0 ? "çok yüksek pozitif" : "çok yüksek negatif"})`
        );
      }
    }
  }

  // Sektör dağılımı
  const sectorMap = new Map<string, string[]>();
  for (const code of stockCodes) {
    const sector = STOCK_SECTOR_MAP[code] ?? "DIGER";
    const list = sectorMap.get(sector) ?? [];
    list.push(code);
    sectorMap.set(sector, list);
  }

  const sectorDistribution = Array.from(sectorMap.entries()).map(([sector, stocks]) => ({
    sector,
    sectorName: SECTOR_INDICES[sector]?.name ?? "Diğer",
    percentage: Math.round((stocks.length / stockCodes.length) * 100),
    stocks,
  })).sort((a, b) => b.percentage - a.percentage);

  // Yoğunlaşma uyarısı
  let concentrationWarning: string | null = null;
  if (sectorDistribution.length > 0 && sectorDistribution[0].percentage >= 60) {
    concentrationWarning = `Portföyünün %${sectorDistribution[0].percentage}'ı ${sectorDistribution[0].sectorName} sektöründe — yoğunlaşma riski yüksek`;
  }

  // Diversifikasyon skoru
  const sectorCount = sectorDistribution.length;
  const maxConcentration = sectorDistribution[0]?.percentage ?? 100;
  let diversificationScore = 0;

  if (stockCodes.length >= 5 && sectorCount >= 3 && maxConcentration <= 40) diversificationScore = 85;
  else if (stockCodes.length >= 3 && sectorCount >= 2 && maxConcentration <= 50) diversificationScore = 65;
  else if (stockCodes.length >= 2 && sectorCount >= 2) diversificationScore = 45;
  else if (stockCodes.length >= 2) diversificationScore = 25;
  else diversificationScore = 10;

  // Avg correlation penalty
  const avgCorr = correlations.length > 0
    ? correlations.reduce((sum, c) => sum + Math.abs(c.correlation), 0) / correlations.length
    : 0;
  if (avgCorr > 0.7) diversificationScore = Math.max(10, diversificationScore - 20);
  else if (avgCorr > 0.5) diversificationScore = Math.max(10, diversificationScore - 10);

  const diversificationLabel =
    diversificationScore >= 70 ? "İyi Çeşitlendirilmiş" :
    diversificationScore >= 45 ? "Orta" :
    diversificationScore >= 25 ? "Zayıf" :
    "Yetersiz";

  // Portföy VaR (basitleştirilmiş — eşit ağırlıklı)
  const validReturns = allBars.filter(b => b.returns.length >= 20);
  let avgVolatility: number | null = null;
  let portfolioVaR95: number | null = null;

  if (validReturns.length > 0) {
    const vols = validReturns.map(b => {
      const mean = b.returns.reduce((a, c) => a + c, 0) / b.returns.length;
      const variance = b.returns.reduce((s, r) => s + (r - mean) ** 2, 0) / b.returns.length;
      return Math.sqrt(variance) * 100;
    });
    avgVolatility = Math.round(vols.reduce((a, b) => a + b, 0) / vols.length * 100) / 100;

    // Basit portföy VaR (diversifikasyon etkisiyle düşer)
    const diversificationFactor = 1 - (1 - avgCorr) * 0.3; // Düşük korelasyon = daha az risk
    portfolioVaR95 = Math.round(avgVolatility * 1.65 * diversificationFactor * 100) / 100;
  }

  return {
    correlations,
    highCorrelationWarnings,
    sectorDistribution,
    concentrationWarning,
    diversificationScore,
    diversificationLabel,
    avgVolatility,
    portfolioVaR95,
  };
}
