/**
 * Bistbase Advanced Portfolio Analytics
 * Risk Contribution, Benchmark, What-If, Attribution, Drawdown
 * Bloomberg PORT / Morningstar X-Ray seviyesi
 */

import { getHistoricalBars } from "./yahoo";
import { STOCK_SECTOR_MAP, SECTOR_INDICES } from "./sectors";

// ═══ Types ═══

export interface RiskContribution {
  stockCode: string;
  weight: number;          // % ağırlık
  marginalRisk: number;    // MCR
  riskContribution: number; // RC = w × MCR
  riskPercent: number;     // RC / σ_p × 100 (toplam risk katkısı %)
  isOverweight: boolean;   // riskPercent > weight → riskli
}

export interface BenchmarkComparison {
  period: string;          // "1M", "3M", "6M", "1Y"
  portfolioReturn: number; // %
  bist100Return: number;   // %
  alpha: number;           // portföy - beklenen
  beta: number;
  trackingError: number;
  informationRatio: number;
  sharpePortfolio: number;
  sharpeBenchmark: number;
}

export interface WhatIfResult {
  action: "ADD" | "REMOVE";
  stockCode: string;
  before: { score: number; risk: number; beta: number; sharpe: number; verdict: string };
  after: { score: number; risk: number; beta: number; sharpe: number; verdict: string };
  delta: { score: number; risk: number; beta: number; sharpe: number };
  recommendation: string; // Türkçe
}

export interface PerformanceAttribution {
  totalExcessReturn: number;
  allocationEffect: number;  // sektör ağırlık kararı
  selectionEffect: number;   // hisse seçimi kararı
  interactionEffect: number;
  sectorDetails: {
    sector: string;
    sectorName: string;
    portfolioWeight: number;
    benchmarkWeight: number;
    portfolioReturn: number;
    benchmarkReturn: number;
    allocationContrib: number;
    selectionContrib: number;
  }[];
}

export interface DrawdownAnalysis {
  currentDrawdown: number;
  maxDrawdown: number;
  maxDrawdownPeak: string;    // tarih
  maxDrawdownTrough: string;  // tarih
  recoveryDate: string | null;
  peakToTrough: number;       // gün
  troughToRecovery: number | null; // gün
  drawdownSeries: { date: string; drawdown: number }[];
}

// ═══ Risk Contribution (Euler Decomposition) ═══

export async function calculateRiskContributions(
  stockCodes: string[],
  weights: Map<string, number>,
  lookbackDays = 90,
): Promise<RiskContribution[]> {
  if (stockCodes.length < 2) return [];

  // Fetch returns for all stocks
  const allReturns = await Promise.all(
    stockCodes.map(async (code) => {
      const bars = await getHistoricalBars(code, lookbackDays).catch(() => []);
      const returns: number[] = [];
      for (let i = 1; i < bars.length; i++) {
        if (bars[i - 1].close > 0) returns.push((bars[i].close - bars[i - 1].close) / bars[i - 1].close);
      }
      return { code, returns };
    })
  );

  // Align returns (same length)
  const minLen = Math.min(...allReturns.filter(r => r.returns.length > 10).map(r => r.returns.length));
  if (minLen < 10) return [];

  const n = stockCodes.length;
  const aligned = allReturns.map(r => r.returns.slice(-minLen));

  // Build covariance matrix
  const covMatrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    const meanI = aligned[i].reduce((a, b) => a + b, 0) / minLen;
    for (let j = i; j < n; j++) {
      const meanJ = aligned[j].reduce((a, b) => a + b, 0) / minLen;
      let cov = 0;
      for (let t = 0; t < minLen; t++) {
        cov += (aligned[i][t] - meanI) * (aligned[j][t] - meanJ);
      }
      cov /= minLen;
      covMatrix[i][j] = cov;
      covMatrix[j][i] = cov;
    }
  }

  // Weight vector
  const w = stockCodes.map(c => weights.get(c) ?? (1 / n));

  // Portfolio variance = w' × Σ × w
  let portVar = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      portVar += w[i] * w[j] * covMatrix[i][j];
    }
  }
  const portSigma = Math.sqrt(portVar);
  if (portSigma === 0) return [];

  // MCR_i = (Σw)_i / σ_p
  const sigmaW: number[] = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      sigmaW[i] += covMatrix[i][j] * w[j];
    }
  }

  const results: RiskContribution[] = [];
  for (let i = 0; i < n; i++) {
    const mcr = sigmaW[i] / portSigma;
    const rc = w[i] * mcr;
    const rcPct = (rc / portSigma) * 100;
    const weightPct = w[i] * 100;

    results.push({
      stockCode: stockCodes[i],
      weight: Math.round(weightPct * 10) / 10,
      marginalRisk: Math.round(mcr * 10000) / 10000,
      riskContribution: Math.round(rc * 10000) / 10000,
      riskPercent: Math.round(rcPct * 10) / 10,
      isOverweight: rcPct > weightPct * 1.2, // risk > 120% of weight
    });
  }

  return results.sort((a, b) => b.riskPercent - a.riskPercent);
}

// ═══ BİST100 Benchmark ═══

export async function calculateBenchmarkComparison(
  stockCodes: string[],
  weights: Map<string, number>,
  periods: { label: string; days: number }[] = [
    { label: "1A", days: 30 },
    { label: "3A", days: 90 },
    { label: "6A", days: 180 },
  ],
): Promise<BenchmarkComparison[]> {
  // Fetch BİST100 bars
  const maxDays = Math.max(...periods.map(p => p.days)) + 10;
  const bist100Bars = await getHistoricalBars("XU100", maxDays).catch(() => []);
  if (bist100Bars.length < 20) return [];

  // Fetch portfolio stock bars
  const allBars = await Promise.all(
    stockCodes.map(async (code) => ({
      code,
      bars: await getHistoricalBars(code, maxDays).catch(() => []),
    }))
  );

  const riskFreeAnnual = parseFloat(process.env.RISK_FREE_RATE ?? "0.50");

  const results: BenchmarkComparison[] = [];

  for (const period of periods) {
    const bBars = bist100Bars.slice(-period.days);
    if (bBars.length < 10) continue;

    // BİST100 return
    const bist100Return = ((bBars[bBars.length - 1].close - bBars[0].close) / bBars[0].close) * 100;

    // Portfolio return (weighted)
    let portReturn = 0;
    let wSum = 0;
    for (const { code, bars } of allBars) {
      const sBars = bars.slice(-period.days);
      if (sBars.length < 5) continue;
      const stockReturn = ((sBars[sBars.length - 1].close - sBars[0].close) / sBars[0].close) * 100;
      const w = weights.get(code) ?? 0;
      portReturn += stockReturn * w;
      wSum += w;
    }
    if (wSum > 0) portReturn /= wSum;

    // Daily returns for beta/tracking error
    const bReturns: number[] = [];
    for (let i = 1; i < bBars.length; i++) {
      if (bBars[i - 1].close > 0) bReturns.push((bBars[i].close - bBars[i - 1].close) / bBars[i - 1].close);
    }

    // Portfolio daily returns (weighted)
    const pReturns: number[] = Array(bReturns.length).fill(0);
    for (const { code, bars } of allBars) {
      const sBars = bars.slice(-period.days);
      const w = weights.get(code) ?? 0;
      for (let i = 1; i < Math.min(sBars.length, bReturns.length + 1); i++) {
        if (sBars[i - 1].close > 0) {
          pReturns[i - 1] += ((sBars[i].close - sBars[i - 1].close) / sBars[i - 1].close) * w;
        }
      }
    }

    // Beta = Cov(Rp, Rb) / Var(Rb)
    const n = Math.min(pReturns.length, bReturns.length);
    if (n < 10) continue;
    const meanP = pReturns.slice(0, n).reduce((a, b) => a + b, 0) / n;
    const meanB = bReturns.slice(0, n).reduce((a, b) => a + b, 0) / n;

    let covPB = 0, varB = 0;
    for (let i = 0; i < n; i++) {
      covPB += (pReturns[i] - meanP) * (bReturns[i] - meanB);
      varB += (bReturns[i] - meanB) ** 2;
    }
    covPB /= n;
    varB /= n;
    const beta = varB > 0 ? covPB / varB : 1;

    // Alpha = Rp - [Rf + β(Rb - Rf)]
    const rfPeriod = riskFreeAnnual * (period.days / 365);
    const alpha = portReturn - (rfPeriod + beta * (bist100Return - rfPeriod));

    // Tracking error
    const excessReturns = pReturns.slice(0, n).map((r, i) => r - bReturns[i]);
    const meanExcess = excessReturns.reduce((a, b) => a + b, 0) / n;
    const teVar = excessReturns.reduce((s, r) => s + (r - meanExcess) ** 2, 0) / n;
    const trackingError = Math.sqrt(teVar) * Math.sqrt(252) * 100;

    // Sharpe
    const pVol = Math.sqrt(pReturns.slice(0, n).reduce((s, r) => s + (r - meanP) ** 2, 0) / n) * Math.sqrt(252);
    const bVol = Math.sqrt(varB) * Math.sqrt(252);
    const rfDaily = riskFreeAnnual / 252;
    const sharpeP = pVol > 0 ? ((meanP - rfDaily) / (pVol / Math.sqrt(252))) : 0;
    const sharpeB = bVol > 0 ? ((meanB - rfDaily) / (bVol / Math.sqrt(252))) : 0;

    // Information ratio
    const ir = trackingError > 0 ? ((portReturn - bist100Return) / trackingError) : 0;

    results.push({
      period: period.label,
      portfolioReturn: Math.round(portReturn * 100) / 100,
      bist100Return: Math.round(bist100Return * 100) / 100,
      alpha: Math.round(alpha * 100) / 100,
      beta: Math.round(beta * 100) / 100,
      trackingError: Math.round(trackingError * 100) / 100,
      informationRatio: Math.round(ir * 100) / 100,
      sharpePortfolio: Math.round(sharpeP * 100) / 100,
      sharpeBenchmark: Math.round(sharpeB * 100) / 100,
    });
  }

  return results;
}

// ═══ What-If Analysis ═══

export function calculateWhatIf(
  currentHoldings: { stockCode: string; weight: number; compositeScore: number; beta: number; volatility: number }[],
  action: "ADD" | "REMOVE",
  targetStock: string,
  targetData: { compositeScore: number; beta: number; volatility: number } | null,
): WhatIfResult {
  // Before metrics
  const beforeScore = currentHoldings.reduce((s, h) => s + h.compositeScore * (h.weight / 100), 0);
  const beforeBeta = currentHoldings.reduce((s, h) => s + h.beta * (h.weight / 100), 0);
  const beforeRisk = currentHoldings.reduce((s, h) => s + h.volatility * (h.weight / 100), 0);

  let afterHoldings: typeof currentHoldings;

  if (action === "ADD" && targetData) {
    // Yeni hisseyi eşit ağırlıkla ekle
    const newCount = currentHoldings.length + 1;
    const newWeight = 100 / newCount;
    afterHoldings = [
      ...currentHoldings.map(h => ({ ...h, weight: newWeight })),
      { stockCode: targetStock, weight: newWeight, ...targetData },
    ];
  } else {
    // Hisseyi çıkar, ağırlıkları normalize et
    const remaining = currentHoldings.filter(h => h.stockCode !== targetStock);
    const totalW = remaining.reduce((s, h) => s + h.weight, 0);
    afterHoldings = remaining.map(h => ({ ...h, weight: totalW > 0 ? (h.weight / totalW) * 100 : 100 / remaining.length }));
  }

  const afterScore = afterHoldings.reduce((s, h) => s + h.compositeScore * (h.weight / 100), 0);
  const afterBeta = afterHoldings.reduce((s, h) => s + h.beta * (h.weight / 100), 0);
  const afterRisk = afterHoldings.reduce((s, h) => s + h.volatility * (h.weight / 100), 0);

  const scoreToVerdict = (s: number) => s >= 65 ? "Al" : s >= 50 ? "Tut" : "Sat";

  const delta = {
    score: Math.round((afterScore - beforeScore) * 10) / 10,
    risk: Math.round((afterRisk - beforeRisk) * 100) / 100,
    beta: Math.round((afterBeta - beforeBeta) * 100) / 100,
    sharpe: 0, // simplified
  };

  let recommendation: string;
  if (action === "ADD") {
    if (delta.score > 3 && delta.risk < 0.5) recommendation = `${targetStock} eklemek portföyü güçlendirir — skor +${delta.score}, risk değişmez.`;
    else if (delta.score > 0) recommendation = `${targetStock} eklemek skoru +${delta.score} artırır ama risk +${delta.risk}% yükselir.`;
    else recommendation = `${targetStock} eklemek portföy skorunu düşürür (${delta.score}).`;
  } else {
    if (delta.score > 0) recommendation = `${targetStock} çıkarmak portföyü güçlendirir — skor +${delta.score}.`;
    else recommendation = `${targetStock} çıkarmak skoru ${delta.score} düşürür.`;
  }

  return {
    action,
    stockCode: targetStock,
    before: { score: Math.round(beforeScore), risk: Math.round(beforeRisk * 100) / 100, beta: Math.round(beforeBeta * 100) / 100, sharpe: 0, verdict: scoreToVerdict(beforeScore) },
    after: { score: Math.round(afterScore), risk: Math.round(afterRisk * 100) / 100, beta: Math.round(afterBeta * 100) / 100, sharpe: 0, verdict: scoreToVerdict(afterScore) },
    delta,
    recommendation,
  };
}

// ═══ Performance Attribution (Brinson-Fachler) ═══

// BİST100 yaklaşık sektör ağırlıkları (2024)
const BIST100_SECTOR_WEIGHTS: Record<string, number> = {
  XBANK: 0.30, XUSIN: 0.25, XHOLD: 0.15, XULAS: 0.08,
  XILTM: 0.07, XGIDA: 0.05, XMANA: 0.04, XELKT: 0.03, XTRZM: 0.03,
};

export function calculateAttribution(
  holdings: { stockCode: string; weight: number; returnPct: number }[],
  bist100Return: number,
): PerformanceAttribution {
  // Sektör bazlı gruplama
  const sectorMap = new Map<string, { pWeight: number; pReturn: number; pCount: number }>();

  for (const h of holdings) {
    const sector = STOCK_SECTOR_MAP[h.stockCode] ?? "DIGER";
    const existing = sectorMap.get(sector) ?? { pWeight: 0, pReturn: 0, pCount: 0 };
    existing.pWeight += h.weight;
    existing.pReturn += h.returnPct * (h.weight / 100);
    existing.pCount++;
    sectorMap.set(sector, existing);
  }

  const totalPortWeight = holdings.reduce((s, h) => s + h.weight, 0);
  let allocationEffect = 0;
  let selectionEffect = 0;
  let interactionEffect = 0;
  const sectorDetails: PerformanceAttribution["sectorDetails"] = [];

  for (const [sector, data] of sectorMap) {
    const wp = data.pWeight / totalPortWeight; // portfolio weight
    const wb = BIST100_SECTOR_WEIGHTS[sector] ?? 0.02; // benchmark weight
    const rp = data.pCount > 0 ? data.pReturn / (data.pWeight / 100) : 0; // portfolio sector return
    const rb = bist100Return * (wb > 0 ? 1 : 0); // simplified benchmark sector return

    const aa = (wp - wb) * (rb - bist100Return);
    const ss = wb * (rp - rb);
    const ii = (wp - wb) * (rp - rb);

    allocationEffect += aa;
    selectionEffect += ss;
    interactionEffect += ii;

    sectorDetails.push({
      sector,
      sectorName: SECTOR_INDICES[sector]?.name ?? "Diğer",
      portfolioWeight: Math.round(wp * 1000) / 10,
      benchmarkWeight: Math.round(wb * 1000) / 10,
      portfolioReturn: Math.round(rp * 100) / 100,
      benchmarkReturn: Math.round(rb * 100) / 100,
      allocationContrib: Math.round(aa * 100) / 100,
      selectionContrib: Math.round(ss * 100) / 100,
    });
  }

  const portfolioReturn = holdings.reduce((s, h) => s + h.returnPct * (h.weight / 100), 0) / (totalPortWeight / 100);

  return {
    totalExcessReturn: Math.round((portfolioReturn - bist100Return) * 100) / 100,
    allocationEffect: Math.round(allocationEffect * 100) / 100,
    selectionEffect: Math.round(selectionEffect * 100) / 100,
    interactionEffect: Math.round(interactionEffect * 100) / 100,
    sectorDetails: sectorDetails.sort((a, b) => Math.abs(b.allocationContrib + b.selectionContrib) - Math.abs(a.allocationContrib + a.selectionContrib)),
  };
}

// ═══ Portfolio Drawdown ═══

export function calculatePortfolioDrawdown(
  dailyValues: { date: string; value: number }[],
): DrawdownAnalysis {
  if (dailyValues.length < 2) {
    return { currentDrawdown: 0, maxDrawdown: 0, maxDrawdownPeak: "", maxDrawdownTrough: "", recoveryDate: null, peakToTrough: 0, troughToRecovery: null, drawdownSeries: [] };
  }

  let runningMax = dailyValues[0].value;
  let maxDD = 0;
  let peakIdx = 0, troughIdx = 0;
  let currentPeakIdx = 0;

  const series: { date: string; drawdown: number }[] = [];

  for (let i = 0; i < dailyValues.length; i++) {
    const v = dailyValues[i].value;
    if (v > runningMax) {
      runningMax = v;
      currentPeakIdx = i;
    }
    const dd = runningMax > 0 ? ((v - runningMax) / runningMax) * 100 : 0;
    series.push({ date: dailyValues[i].date, drawdown: Math.round(dd * 100) / 100 });

    if (dd < maxDD) {
      maxDD = dd;
      peakIdx = currentPeakIdx;
      troughIdx = i;
    }
  }

  // Recovery
  let recoveryIdx: number | null = null;
  const peakValue = dailyValues[peakIdx].value;
  for (let i = troughIdx + 1; i < dailyValues.length; i++) {
    if (dailyValues[i].value >= peakValue) {
      recoveryIdx = i;
      break;
    }
  }

  const currentDD = series.length > 0 ? series[series.length - 1].drawdown : 0;

  return {
    currentDrawdown: currentDD,
    maxDrawdown: Math.round(maxDD * 100) / 100,
    maxDrawdownPeak: dailyValues[peakIdx]?.date ?? "",
    maxDrawdownTrough: dailyValues[troughIdx]?.date ?? "",
    recoveryDate: recoveryIdx != null ? dailyValues[recoveryIdx].date : null,
    peakToTrough: troughIdx - peakIdx,
    troughToRecovery: recoveryIdx != null ? recoveryIdx - troughIdx : null,
    drawdownSeries: series,
  };
}
