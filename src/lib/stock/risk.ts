/**
 * Bistbase Risk Metrics
 * Sharpe, Max Drawdown, VaR — saf matematik
 */

import type { HistoricalBar } from "./technicals";

export interface RiskMetrics {
  // Beta (piyasaya göre oynaklık) — fundamentals'dan alınır
  beta: number | null;

  // Sharpe Ratio (risk-getiri kalitesi)
  sharpeRatio: number | null;

  // Sortino Ratio (sadece aşağı yön riski — Sharpe'dan daha iyi)
  sortinoRatio: number | null;

  // Calmar Ratio (getiri / max drawdown)
  calmarRatio: number | null;

  // Maximum Drawdown (en kötü düşüş)
  maxDrawdown: number | null;       // % olarak
  maxDrawdownDays: number | null;   // kaç gün sürdü

  // Value at Risk (95% güvenle günlük kayıp riski)
  var95Daily: number | null;        // % olarak
  var95Weekly: number | null;       // % olarak

  // Volatilite
  dailyVolatility: number | null;   // günlük std dev %
  annualVolatility: number | null;  // yıllık std dev %

  // Risk seviyesi
  riskLevel: "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH" | null;
  riskLevelTr: string;

  // CVaR (Conditional VaR / Expected Shortfall)
  cvar95Daily: number | null;

  // Current drawdown
  currentDrawdown: number | null;

  // Stress test scenarios
  stressTests: { name: string; estimatedLoss: number }[];

  // Likidite
  liquidityScore: number | null;
  liquidityLevel: string | null;
}

export function calculateRiskMetrics(
  bars: HistoricalBar[],
  beta: number | null = null
): RiskMetrics {
  if (bars.length < 30) {
    return {
      beta, sharpeRatio: null, sortinoRatio: null, calmarRatio: null,
      maxDrawdown: null, maxDrawdownDays: null,
      var95Daily: null, var95Weekly: null, dailyVolatility: null,
      annualVolatility: null, riskLevel: null, riskLevelTr: "Veri yetersiz",
      cvar95Daily: null, currentDrawdown: null, stressTests: [], liquidityScore: null, liquidityLevel: null,
    };
  }

  // Günlük getiriler
  const returns: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    if (bars[i - 1].close > 0) {
      returns.push((bars[i].close - bars[i - 1].close) / bars[i - 1].close);
    }
  }

  if (returns.length < 20) {
    return {
      beta, sharpeRatio: null, sortinoRatio: null, calmarRatio: null,
      maxDrawdown: null, maxDrawdownDays: null,
      var95Daily: null, var95Weekly: null, dailyVolatility: null,
      annualVolatility: null, riskLevel: null, riskLevelTr: "Veri yetersiz",
      cvar95Daily: null, currentDrawdown: null, stressTests: [], liquidityScore: null, liquidityLevel: null,
    };
  }

  // Ortalama ve standart sapma
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + (r - meanReturn) ** 2, 0) / returns.length;
  const dailyVol = Math.sqrt(variance);
  const annualVol = dailyVol * Math.sqrt(252);

  // Risk-free rate: TCMB politika faizi (env ile ayarlanabilir)
  // Varsayılan %50 ama env ile override edilebilir
  const riskFreeAnnual = parseFloat(process.env.RISK_FREE_RATE ?? "0.50");
  const riskFreeDaily = riskFreeAnnual / 252;

  // Sharpe Ratio
  const sharpeRatio = dailyVol > 0
    ? ((meanReturn - riskFreeDaily) / dailyVol) * Math.sqrt(252)
    : null;

  // Sortino Ratio — sadece aşağı yön volatilitesini kullanır (Sharpe'dan daha adil)
  const downsideReturns = returns.filter(r => r < riskFreeDaily);
  const downsideVariance = downsideReturns.length > 0
    ? downsideReturns.reduce((sum, r) => sum + (r - riskFreeDaily) ** 2, 0) / downsideReturns.length
    : 0;
  const downsideVol = Math.sqrt(downsideVariance);
  const sortinoRatio = downsideVol > 0
    ? ((meanReturn - riskFreeDaily) / downsideVol) * Math.sqrt(252)
    : null;

  // Maximum Drawdown
  let peak = bars[0].close;
  let maxDD = 0;
  let ddStart = 0;
  let maxDDDays = 0;
  let currentDDStart = 0;

  for (let i = 0; i < bars.length; i++) {
    if (bars[i].close > peak) {
      peak = bars[i].close;
      currentDDStart = i;
    }
    const dd = (peak - bars[i].close) / peak;
    if (dd > maxDD) {
      maxDD = dd;
      ddStart = currentDDStart;
      maxDDDays = i - ddStart;
    }
  }

  // VaR (Historical Simulation — 95th percentile)
  const sortedReturns = [...returns].sort((a, b) => a - b);
  const idx95 = Math.floor(sortedReturns.length * 0.05);
  const var95Daily = sortedReturns[idx95] ? Math.abs(sortedReturns[idx95]) * 100 : null;
  const var95Weekly = var95Daily ? var95Daily * Math.sqrt(5) : null;

  // Risk seviyesi
  let riskLevel: RiskMetrics["riskLevel"] = null;
  let riskLevelTr = "";
  if (annualVol < 0.25) { riskLevel = "LOW"; riskLevelTr = "Düşük Risk"; }
  else if (annualVol < 0.40) { riskLevel = "MODERATE"; riskLevelTr = "Orta Risk"; }
  else if (annualVol < 0.60) { riskLevel = "HIGH"; riskLevelTr = "Yüksek Risk"; }
  else { riskLevel = "VERY_HIGH"; riskLevelTr = "Çok Yüksek Risk"; }

  // Calmar Ratio — yıllık getiri / max drawdown (drawdown quality)
  const annualReturn = meanReturn * 252;
  const calmarRatio = maxDD > 0 ? annualReturn / maxDD : null;

  return {
    beta,
    sharpeRatio: sharpeRatio != null ? Math.round(sharpeRatio * 100) / 100 : null,
    sortinoRatio: sortinoRatio != null ? Math.round(sortinoRatio * 100) / 100 : null,
    calmarRatio: calmarRatio != null ? Math.round(calmarRatio * 100) / 100 : null,
    maxDrawdown: Math.round(maxDD * 10000) / 100,
    maxDrawdownDays: maxDDDays,
    var95Daily: var95Daily != null ? Math.round(var95Daily * 100) / 100 : null,
    var95Weekly: var95Weekly != null ? Math.round(var95Weekly * 100) / 100 : null,
    dailyVolatility: Math.round(dailyVol * 10000) / 100,
    annualVolatility: Math.round(annualVol * 10000) / 100,
    riskLevel,
    riskLevelTr,

    // CVaR: En kötü %5'teki ortalama kayıp
    cvar95Daily: (() => {
      if (sortedReturns.length < 20) return null;
      const tail = sortedReturns.slice(0, idx95 + 1);
      if (tail.length === 0) return null;
      const avg = tail.reduce((a, b) => a + b, 0) / tail.length;
      return Math.round(Math.abs(avg) * 10000) / 100;
    })(),

    // Current drawdown
    currentDrawdown: (() => {
      const lastPrice = bars[bars.length - 1]?.close;
      if (!lastPrice || peak === 0) return null;
      return Math.round(((peak - lastPrice) / peak) * 10000) / 100;
    })(),

    // Stress tests
    stressTests: [
      { name: "2018 Döviz Krizi (BİST -25%)", estimatedLoss: Math.round((beta ?? 1) * -25 * 100) / 100 },
      { name: "2020 COVID (BİST -20%)", estimatedLoss: Math.round((beta ?? 1) * -20 * 100) / 100 },
      { name: "Orta Düzeltme (BİST -10%)", estimatedLoss: Math.round((beta ?? 1) * -10 * 100) / 100 },
    ],

    // Likidite
    liquidityScore: (() => {
      const avgVol = bars.slice(-20).reduce((s, b) => s + b.volume, 0) / Math.min(20, bars.length);
      if (avgVol >= 10_000_000) return 90;
      if (avgVol >= 2_000_000) return 75;
      if (avgVol >= 500_000) return 55;
      if (avgVol >= 100_000) return 35;
      return 15;
    })(),
    liquidityLevel: (() => {
      const avgVol = bars.slice(-20).reduce((s, b) => s + b.volume, 0) / Math.min(20, bars.length);
      if (avgVol >= 10_000_000) return "Çok Yüksek";
      if (avgVol >= 2_000_000) return "Yüksek";
      if (avgVol >= 500_000) return "Orta";
      if (avgVol >= 100_000) return "Düşük";
      return "Çok Düşük";
    })(),
  };
}
