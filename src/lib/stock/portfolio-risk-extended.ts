/**
 * Bistbase Extended Risk Metrics
 * Sortino, Calmar, CVaR, Omega — dünya standartlarında risk analizi
 */

export interface ExtendedRiskMetrics {
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  omegaRatio: number;
  cvar95: number;           // Conditional VaR (Expected Shortfall) %
  var95: number;            // Value at Risk %
  maxConsecutiveLoss: number; // gün
  maxConsecutiveGain: number; // gün
  winRate: number;          // kazançlı gün %
  avgWin: number;           // ortalama kazanç %
  avgLoss: number;          // ortalama kayıp %
  profitFactor: number;     // toplam kazanç / toplam kayıp
  annualizedVolatility: number; // yıllıklaştırılmış volatilite %
  annualizedReturn: number; // yıllıklaştırılmış getiri %
}

/**
 * Genişletilmiş risk metrikleri hesapla
 * @param dailyReturns — günlük getiri dizisi (0.01 = %1)
 * @param maxDrawdownPct — max drawdown yüzde (negatif, örn: -15.3)
 * @param riskFreeAnnual — yıllık risksiz faiz (default: %50 Türkiye)
 */
export function calculateExtendedRiskMetrics(
  dailyReturns: number[],
  maxDrawdownPct: number = 0,
  riskFreeAnnual: number = 0.50,
): ExtendedRiskMetrics {
  const n = dailyReturns.length;

  if (n < 10) {
    return {
      sharpeRatio: 0, sortinoRatio: 0, calmarRatio: 0, omegaRatio: 0,
      cvar95: 0, var95: 0, maxConsecutiveLoss: 0, maxConsecutiveGain: 0,
      winRate: 0, avgWin: 0, avgLoss: 0, profitFactor: 0,
      annualizedVolatility: 0, annualizedReturn: 0,
    };
  }

  const rfDaily = riskFreeAnnual / 252;
  const mean = dailyReturns.reduce((a, b) => a + b, 0) / n;

  // Annualized return & volatility
  const annualizedReturn = mean * 252 * 100;
  const variance = dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / n;
  const dailyStd = Math.sqrt(variance);
  const annualizedVolatility = dailyStd * Math.sqrt(252) * 100;

  // Sharpe Ratio
  const excessReturn = mean - rfDaily;
  const sharpeRatio = dailyStd > 0 ? (excessReturn / dailyStd) * Math.sqrt(252) : 0;

  // Sortino Ratio — sadece aşağı yönlü sapma
  const downsideReturns = dailyReturns.filter(r => r < rfDaily);
  const downsideVariance = downsideReturns.length > 0
    ? downsideReturns.reduce((s, r) => s + (r - rfDaily) ** 2, 0) / n
    : 0;
  const downsideStd = Math.sqrt(downsideVariance);
  const sortinoRatio = downsideStd > 0 ? (excessReturn / downsideStd) * Math.sqrt(252) : 0;

  // Calmar Ratio — yıllıklaştırılmış getiri / |max drawdown|
  const absMaxDD = Math.abs(maxDrawdownPct);
  const calmarRatio = absMaxDD > 0 ? annualizedReturn / absMaxDD : 0;

  // VaR (95%) — parametrik
  const sorted = [...dailyReturns].sort((a, b) => a - b);
  const varIndex = Math.floor(n * 0.05);
  const var95 = Math.round(sorted[varIndex] * 10000) / 100; // %

  // CVaR (Expected Shortfall) — VaR'ın altındaki ortalama kayıp
  const tailReturns = sorted.slice(0, varIndex + 1);
  const cvar95 = tailReturns.length > 0
    ? Math.round((tailReturns.reduce((a, b) => a + b, 0) / tailReturns.length) * 10000) / 100
    : 0;

  // Omega Ratio — kazanç/kayıp alan oranı (threshold = 0)
  const gains = dailyReturns.filter(r => r > 0).reduce((s, r) => s + r, 0);
  const losses = Math.abs(dailyReturns.filter(r => r < 0).reduce((s, r) => s + r, 0));
  const omegaRatio = losses > 0 ? gains / losses : gains > 0 ? 99 : 1;

  // Win rate, avg win, avg loss
  const winDays = dailyReturns.filter(r => r > 0);
  const lossDays = dailyReturns.filter(r => r < 0);
  const winRate = Math.round((winDays.length / n) * 10000) / 100;
  const avgWin = winDays.length > 0
    ? Math.round((winDays.reduce((a, b) => a + b, 0) / winDays.length) * 10000) / 100
    : 0;
  const avgLoss = lossDays.length > 0
    ? Math.round((lossDays.reduce((a, b) => a + b, 0) / lossDays.length) * 10000) / 100
    : 0;
  const profitFactor = losses > 0 ? Math.round((gains / losses) * 100) / 100 : 0;

  // Max consecutive loss/gain days
  let maxConsLoss = 0, maxConsGain = 0, curLoss = 0, curGain = 0;
  for (const r of dailyReturns) {
    if (r < 0) { curLoss++; curGain = 0; maxConsLoss = Math.max(maxConsLoss, curLoss); }
    else if (r > 0) { curGain++; curLoss = 0; maxConsGain = Math.max(maxConsGain, curGain); }
    else { curLoss = 0; curGain = 0; }
  }

  return {
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    sortinoRatio: Math.round(sortinoRatio * 100) / 100,
    calmarRatio: Math.round(calmarRatio * 100) / 100,
    omegaRatio: Math.round(omegaRatio * 100) / 100,
    cvar95,
    var95,
    maxConsecutiveLoss: maxConsLoss,
    maxConsecutiveGain: maxConsGain,
    winRate,
    avgWin,
    avgLoss,
    profitFactor,
    annualizedVolatility: Math.round(annualizedVolatility * 100) / 100,
    annualizedReturn: Math.round(annualizedReturn * 100) / 100,
  };
}
