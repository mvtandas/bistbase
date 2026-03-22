/**
 * Verdict Backtesting Engine
 * Karar bazında performans analizi + BIST-gerçekçi portföy simülasyonu
 */

import { prisma } from "@/lib/prisma";
import {
  EFFECTIVE_COST_PER_SIDE,
  MAX_POSITION_WEIGHT,
  calculateLots,
  calculateCommission,
  roundToTick,
} from "./bist-constants";

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════

export interface HorizonMetrics {
  winRate: number;
  avgReturn: number;
  avgWin: number;
  avgLoss: number;
  medianReturn: number;
  profitFactor: number;
  expectancy: number;
  sampleSize: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  bestReturn: number;
  worstReturn: number;
  stdDev: number;
}

export interface VerdictPerformance {
  verdictAction: string;
  totalCount: number;
  horizons: Record<"1D" | "5D" | "10D" | "20D", HorizonMetrics | null>;
  highConfWinRate: number | null;
  lowConfWinRate: number | null;
  bestCall: { stockCode: string; date: string; returnPct: number } | null;
  worstCall: { stockCode: string; date: string; returnPct: number } | null;
  summaryTr: string;
}

export interface SimulatedTrade {
  stockCode: string;
  entryDate: string;
  entryPrice: number;
  entryVerdict: string;
  entryLots: number;
  exitDate: string;
  exitPrice: number;
  exitVerdict: string;
  grossReturn: number;
  netReturn: number;
  commission: number;
  holdingDays: number;
}

export interface PortfolioSimulation {
  startDate: string;
  endDate: string;
  initialCapital: number;
  finalValue: number;
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  maxDrawdownDuration: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  totalTrades: number;
  winRate: number;
  avgHoldingDays: number;
  totalCommission: number;
  benchmarkReturn: number;
  alpha: number;
  equityCurve: { date: string; value: number; benchmark: number }[];
  drawdownCurve: { date: string; drawdown: number }[];
  trades: SimulatedTrade[];
}

export interface VerdictBacktestResult {
  performances: VerdictPerformance[];
  simulation: PortfolioSimulation;
  overall: {
    totalVerdicts: number;
    overallWinRate: number;
    bestPerformingVerdict: string;
    worstPerformingVerdict: string;
    avgConfidenceAccuracy: { high: number; medium: number; low: number };
  };
  generatedAt: string;
  dataSpanDays: number;
}

// ═══════════════════════════════════════
// VERDICT PERFORMANCE CALCULATION
// ═══════════════════════════════════════

export async function calculateVerdictBacktest(
  stockCode: string | null,
  lookbackDays = 180,
): Promise<VerdictBacktestResult> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookbackDays);

  const where: Record<string, unknown> = {
    verdictAction: { not: null },
    date: { gte: cutoff },
    timeframe: "daily",
    status: "COMPLETED",
  };
  if (stockCode) where.stockCode = stockCode;

  const summaries = await prisma.dailySummary.findMany({
    where,
    select: {
      id: true,
      stockCode: true,
      date: true,
      closePrice: true,
      verdictAction: true,
      verdictScore: true,
      verdictConfidence: true,
      verdictAccurate: true,
      priceAfter1D: true,
      priceAfter5D: true,
      priceAfter10D: true,
      priceAfter20D: true,
      outcomePercent1D: true,
      outcomePercent5D: true,
      outcomePercent10D: true,
      outcomePercent20D: true,
      bist100Change: true,
    },
    orderBy: { date: "asc" },
  });

  // Group by verdictAction
  const groups = new Map<string, typeof summaries>();
  for (const s of summaries) {
    const action = s.verdictAction!;
    if (!groups.has(action)) groups.set(action, []);
    groups.get(action)!.push(s);
  }

  const performances: VerdictPerformance[] = [];
  for (const [action, items] of groups) {
    performances.push(buildPerformance(action, items));
  }

  // Sort by sample size
  performances.sort((a, b) => b.totalCount - a.totalCount);

  // Simulation
  const simulation = simulatePortfolio(summaries);

  // Overall stats
  const withOutcome = summaries.filter((s) => s.verdictAccurate != null);
  const accurateCount = withOutcome.filter((s) => s.verdictAccurate === true).length;
  const overallWinRate = withOutcome.length > 0 ? (accurateCount / withOutcome.length) * 100 : 0;

  const best = performances.length > 0
    ? performances.reduce((a, b) => {
        const aWr = a.horizons["20D"]?.winRate ?? a.horizons["10D"]?.winRate ?? 0;
        const bWr = b.horizons["20D"]?.winRate ?? b.horizons["10D"]?.winRate ?? 0;
        return aWr > bWr ? a : b;
      })
    : null;
  const worst = performances.length > 0
    ? performances.reduce((a, b) => {
        const aWr = a.horizons["20D"]?.winRate ?? a.horizons["10D"]?.winRate ?? 100;
        const bWr = b.horizons["20D"]?.winRate ?? b.horizons["10D"]?.winRate ?? 100;
        return aWr < bWr ? a : b;
      })
    : null;

  // Confidence accuracy
  const highConf = withOutcome.filter((s) => (s.verdictConfidence ?? 0) >= 65);
  const medConf = withOutcome.filter((s) => (s.verdictConfidence ?? 0) >= 45 && (s.verdictConfidence ?? 0) < 65);
  const lowConf = withOutcome.filter((s) => (s.verdictConfidence ?? 0) < 45);

  return {
    performances,
    simulation,
    overall: {
      totalVerdicts: summaries.length,
      overallWinRate: round2(overallWinRate),
      bestPerformingVerdict: best?.verdictAction ?? "-",
      worstPerformingVerdict: worst?.verdictAction ?? "-",
      avgConfidenceAccuracy: {
        high: calcWinRate(highConf),
        medium: calcWinRate(medConf),
        low: calcWinRate(lowConf),
      },
    },
    generatedAt: new Date().toISOString(),
    dataSpanDays: lookbackDays,
  };
}

// ═══════════════════════════════════════
// HORIZON METRICS
// ═══════════════════════════════════════

function buildPerformance(action: string, items: Array<{
  stockCode: string;
  date: Date;
  outcomePercent1D: number | null;
  outcomePercent5D: number | null;
  outcomePercent10D: number | null;
  outcomePercent20D: number | null;
  verdictConfidence: number | null;
  verdictAccurate: boolean | null;
}>): VerdictPerformance {
  const horizons: VerdictPerformance["horizons"] = {
    "1D": buildHorizon(items, "outcomePercent1D", action),
    "5D": buildHorizon(items, "outcomePercent5D", action),
    "10D": buildHorizon(items, "outcomePercent10D", action),
    "20D": buildHorizon(items, "outcomePercent20D", action),
  };

  // Best/worst calls (20D preferred, fallback to 10D)
  const outcomeField = items.some((i) => i.outcomePercent20D != null) ? "outcomePercent20D" : "outcomePercent10D";
  const withOutcome = items.filter((i) => i[outcomeField] != null);
  let bestCall: VerdictPerformance["bestCall"] = null;
  let worstCall: VerdictPerformance["worstCall"] = null;

  if (withOutcome.length > 0) {
    const sorted = [...withOutcome].sort((a, b) => (a[outcomeField] as number) - (b[outcomeField] as number));
    const isLong = action === "GUCLU_AL" || action === "AL";
    const bestItem = isLong ? sorted[sorted.length - 1] : sorted[0];
    const worstItem = isLong ? sorted[0] : sorted[sorted.length - 1];
    bestCall = { stockCode: bestItem.stockCode, date: bestItem.date.toISOString().split("T")[0], returnPct: round2(bestItem[outcomeField] as number) };
    worstCall = { stockCode: worstItem.stockCode, date: worstItem.date.toISOString().split("T")[0], returnPct: round2(worstItem[outcomeField] as number) };
  }

  // Confidence segmentation
  const highConfItems = items.filter((i) => (i.verdictConfidence ?? 0) >= 65 && i.verdictAccurate != null);
  const lowConfItems = items.filter((i) => (i.verdictConfidence ?? 0) < 45 && i.verdictAccurate != null);

  const actionLabels: Record<string, string> = {
    GUCLU_AL: "Güçlü Al", AL: "Al", TUT: "Tut", SAT: "Sat", GUCLU_SAT: "Güçlü Sat",
  };

  const h20 = horizons["20D"];
  const summaryTr = h20 && h20.sampleSize > 0
    ? `${actionLabels[action] ?? action} kararı ${h20.sampleSize} kez verildi, 20 günlük win rate %${h20.winRate.toFixed(1)}, ortalama getiri %${h20.avgReturn.toFixed(2)}.`
    : `${actionLabels[action] ?? action} kararı ${items.length} kez verildi, henüz yeterli outcome verisi yok.`;

  return {
    verdictAction: action,
    totalCount: items.length,
    horizons,
    highConfWinRate: highConfItems.length >= 3 ? calcWinRate(highConfItems) : null,
    lowConfWinRate: lowConfItems.length >= 3 ? calcWinRate(lowConfItems) : null,
    bestCall,
    worstCall,
    summaryTr,
  };
}

function buildHorizon(
  items: Array<{ [k: string]: unknown }>,
  field: string,
  action: string,
): HorizonMetrics | null {
  const returns = items
    .map((i) => i[field] as number | null)
    .filter((v): v is number => v != null);

  if (returns.length < 2) return null;

  // For SAT/GUCLU_SAT, a "win" is negative return (price went down)
  const isShort = action === "SAT" || action === "GUCLU_SAT";
  const isTut = action === "TUT";

  const wins = returns.filter((r) =>
    isTut ? Math.abs(r) < 3 : isShort ? r < 0 : r > 0,
  );
  const losses = returns.filter((r) =>
    isTut ? Math.abs(r) >= 3 : isShort ? r >= 0 : r <= 0,
  );

  // Effective returns for profit calculation (invert for shorts)
  const effectiveReturns = isShort ? returns.map((r) => -r) : returns;
  const effectiveWins = effectiveReturns.filter((r) => r > 0);
  const effectiveLosses = effectiveReturns.filter((r) => r < 0);

  const totalWinPct = effectiveWins.reduce((a, b) => a + b, 0);
  const totalLossPct = Math.abs(effectiveLosses.reduce((a, b) => a + b, 0));

  const winRate = (wins.length / returns.length) * 100;
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const avgWin = effectiveWins.length > 0 ? totalWinPct / effectiveWins.length : 0;
  const avgLoss = effectiveLosses.length > 0 ? totalLossPct / effectiveLosses.length : 0;

  const sorted = [...returns].sort((a, b) => a - b);
  const medianReturn = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];

  const profitFactor = totalLossPct > 0 ? Math.min(totalWinPct / totalLossPct, 99) : totalWinPct > 0 ? 99 : 0;
  const expectancy = (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss;

  // Streaks
  let maxW = 0, maxL = 0, curW = 0, curL = 0;
  for (const r of returns) {
    const isWin = isTut ? Math.abs(r) < 3 : isShort ? r < 0 : r > 0;
    if (isWin) { curW++; curL = 0; maxW = Math.max(maxW, curW); }
    else { curL++; curW = 0; maxL = Math.max(maxL, curL); }
  }

  const mean = avgReturn;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;

  return {
    winRate: round2(winRate),
    avgReturn: round2(avgReturn),
    avgWin: round2(avgWin),
    avgLoss: round2(avgLoss),
    medianReturn: round2(medianReturn),
    profitFactor: round2(profitFactor),
    expectancy: round2(expectancy),
    sampleSize: returns.length,
    maxConsecutiveWins: maxW,
    maxConsecutiveLosses: maxL,
    bestReturn: round2(Math.max(...returns)),
    worstReturn: round2(Math.min(...returns)),
    stdDev: round2(Math.sqrt(variance)),
  };
}

// ═══════════════════════════════════════
// PORTFOLIO SIMULATION (BIST-Gerçekçi)
// ═══════════════════════════════════════

interface Position {
  stockCode: string;
  entryDate: string;
  entryPrice: number;
  entryVerdict: string;
  lots: number;
  cost: number; // komisyon dahil toplam maliyet
}

function simulatePortfolio(
  summaries: Array<{
    stockCode: string;
    date: Date;
    closePrice: number | null;
    verdictAction: string | null;
    verdictConfidence: number | null;
    bist100Change: number | null;
  }>,
  initialCapital = 100000,
): PortfolioSimulation {
  const positions = new Map<string, Position>();
  let cash = initialCapital;
  const trades: SimulatedTrade[] = [];
  let totalCommission = 0;
  const dailyValues: { date: string; value: number; benchmark: number }[] = [];
  const dailyReturns: number[] = [];
  let prevValue = initialCapital;
  let benchmarkValue = initialCapital;

  // T+2 settlement queue: [availableDate, amount]
  const settlementQueue: [Date, number][] = [];

  // Sort by date
  const sorted = [...summaries]
    .filter((s) => s.closePrice != null && s.verdictAction != null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // Group by date for daily processing
  const byDate = new Map<string, typeof sorted>();
  for (const s of sorted) {
    const key = s.date.toISOString().split("T")[0];
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(s);
  }

  for (const [dateStr, dayItems] of byDate) {
    const currentDate = new Date(dateStr);

    // Release settled funds
    for (let i = settlementQueue.length - 1; i >= 0; i--) {
      if (settlementQueue[i][0] <= currentDate) {
        cash += settlementQueue[i][1];
        settlementQueue.splice(i, 1);
      }
    }

    // Update benchmark
    const bist100Change = dayItems[0]?.bist100Change;
    if (bist100Change != null) {
      benchmarkValue *= 1 + bist100Change / 100;
    }

    // Process each stock for this day
    for (const item of dayItems) {
      const action = item.verdictAction!;
      const price = roundToTick(item.closePrice!);
      const code = item.stockCode;

      // SELL signals
      if ((action === "SAT" || action === "GUCLU_SAT") && positions.has(code)) {
        const pos = positions.get(code)!;
        const grossValue = pos.lots * price;
        const sellComm = calculateCommission(grossValue);
        const netProceeds = grossValue - sellComm;
        totalCommission += sellComm;

        const grossReturn = ((price - pos.entryPrice) / pos.entryPrice) * 100;
        const netReturn = ((netProceeds - pos.cost) / pos.cost) * 100;
        const holdingDays = Math.round((currentDate.getTime() - new Date(pos.entryDate).getTime()) / (1000 * 60 * 60 * 24));

        trades.push({
          stockCode: code,
          entryDate: pos.entryDate,
          entryPrice: pos.entryPrice,
          entryVerdict: pos.entryVerdict,
          entryLots: pos.lots,
          exitDate: dateStr,
          exitPrice: price,
          exitVerdict: action,
          grossReturn: round2(grossReturn),
          netReturn: round2(netReturn),
          commission: round2(sellComm + (pos.cost - pos.lots * pos.entryPrice)),
          holdingDays,
        });

        // T+2: funds available after 2 business days
        const settlementDate = addBusinessDays(currentDate, 2);
        settlementQueue.push([settlementDate, netProceeds]);
        positions.delete(code);
      }

      // BUY signals
      if ((action === "GUCLU_AL" || action === "AL") && !positions.has(code)) {
        // Max position weight check
        const portfolioValue = cash + getPositionsValue(positions, dayItems);
        const maxAlloc = portfolioValue * MAX_POSITION_WEIGHT;
        const allocCapital = Math.min(cash * 0.9, maxAlloc); // Keep 10% cash reserve

        if (allocCapital > price * 2) { // En az 2 lot alabilecek sermaye
          const lots = calculateLots(allocCapital, price);
          if (lots >= 1) {
            const grossValue = lots * price;
            const buyComm = calculateCommission(grossValue);
            const totalCost = grossValue + buyComm;
            totalCommission += buyComm;

            if (totalCost <= cash) {
              cash -= totalCost;
              positions.set(code, {
                stockCode: code,
                entryDate: dateStr,
                entryPrice: price,
                entryVerdict: action,
                lots,
                cost: totalCost,
              });
            }
          }
        }
      }
    }

    // Daily portfolio value
    const positionsValue = getPositionsValue(positions, dayItems);
    const pendingSettlement = settlementQueue.reduce((s, [, amt]) => s + amt, 0);
    const totalValue = cash + positionsValue + pendingSettlement;
    const dailyReturn = prevValue > 0 ? ((totalValue - prevValue) / prevValue) * 100 : 0;
    dailyReturns.push(dailyReturn);

    dailyValues.push({
      date: dateStr,
      value: round2(totalValue),
      benchmark: round2(benchmarkValue),
    });
    prevValue = totalValue;
  }

  // Close remaining positions at last known prices
  for (const [code, pos] of positions) {
    const lastItem = sorted.filter((s) => s.stockCode === code).pop();
    if (lastItem?.closePrice) {
      const grossValue = pos.lots * lastItem.closePrice;
      const sellComm = calculateCommission(grossValue);
      totalCommission += sellComm;
      cash += grossValue - sellComm;
    }
  }

  // Release pending settlements
  for (const [, amt] of settlementQueue) {
    cash += amt;
  }

  const finalValue = cash;
  const totalReturn = ((finalValue - initialCapital) / initialCapital) * 100;
  const dayCount = dailyValues.length;
  const years = dayCount / 252;
  const annualizedReturn = years > 0 ? (Math.pow(finalValue / initialCapital, 1 / years) - 1) * 100 : totalReturn;
  const benchmarkReturn = ((benchmarkValue - initialCapital) / initialCapital) * 100;

  // Drawdown
  let peak = initialCapital;
  let maxDD = 0;
  let ddStart = 0;
  let maxDDDuration = 0;
  let currentDDStart = 0;
  const drawdownCurve: { date: string; drawdown: number }[] = [];

  for (let i = 0; i < dailyValues.length; i++) {
    const v = dailyValues[i].value;
    if (v > peak) {
      peak = v;
      if (currentDDStart > 0) {
        maxDDDuration = Math.max(maxDDDuration, i - currentDDStart);
        currentDDStart = 0;
      }
    }
    const dd = ((peak - v) / peak) * 100;
    if (dd > 0 && currentDDStart === 0) currentDDStart = i;
    if (dd > maxDD) { maxDD = dd; ddStart = currentDDStart; }
    drawdownCurve.push({ date: dailyValues[i].date, drawdown: round2(-dd) });
  }

  // Risk metrics — yıllık risk-free rate'i günlüğe çevir (compound)
  const riskFreeAnnual = parseFloat(process.env.RISK_FREE_RATE ?? "0.50");
  const riskFreeDaily = Math.pow(1 + riskFreeAnnual, 1 / 252) - 1;
  const excessReturns = dailyReturns.map((r) => r / 100 - riskFreeDaily);
  const meanExcess = excessReturns.length > 0 ? excessReturns.reduce((a, b) => a + b, 0) / excessReturns.length : 0;
  const stdDev = Math.sqrt(excessReturns.reduce((s, r) => s + (r - meanExcess) ** 2, 0) / Math.max(excessReturns.length - 1, 1));
  const downsideReturns = excessReturns.filter((r) => r < 0);
  const downsideStd = Math.sqrt(downsideReturns.reduce((s, r) => s + r ** 2, 0) / Math.max(downsideReturns.length - 1, 1));

  const sharpeRatio = stdDev > 0 ? (meanExcess / stdDev) * Math.sqrt(252) : 0;
  const sortinoRatio = downsideStd > 0 ? (meanExcess / downsideStd) * Math.sqrt(252) : 0;
  const calmarRatio = maxDD > 0 ? annualizedReturn / maxDD : 0;

  const winningTrades = trades.filter((t) => t.netReturn > 0);

  return {
    startDate: dailyValues[0]?.date ?? "",
    endDate: dailyValues[dailyValues.length - 1]?.date ?? "",
    initialCapital,
    finalValue: round2(finalValue),
    totalReturn: round2(totalReturn),
    annualizedReturn: round2(annualizedReturn),
    maxDrawdown: round2(maxDD),
    maxDrawdownDuration: maxDDDuration,
    sharpeRatio: round2(sharpeRatio),
    sortinoRatio: round2(sortinoRatio),
    calmarRatio: round2(calmarRatio),
    totalTrades: trades.length,
    winRate: trades.length > 0 ? round2((winningTrades.length / trades.length) * 100) : 0,
    avgHoldingDays: trades.length > 0 ? round2(trades.reduce((s, t) => s + t.holdingDays, 0) / trades.length) : 0,
    totalCommission: round2(totalCommission),
    benchmarkReturn: round2(benchmarkReturn),
    alpha: round2(totalReturn - benchmarkReturn),
    equityCurve: dailyValues,
    drawdownCurve,
    trades,
  };
}

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════

function getPositionsValue(
  positions: Map<string, Position>,
  dayItems: Array<{ stockCode: string; closePrice: number | null }>,
): number {
  let value = 0;
  for (const [code, pos] of positions) {
    const current = dayItems.find((i) => i.stockCode === code);
    const price = current?.closePrice ?? pos.entryPrice;
    value += pos.lots * price;
  }
  return value;
}

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

function calcWinRate(items: Array<{ verdictAccurate: boolean | null }>): number {
  const valid = items.filter((i) => i.verdictAccurate != null);
  if (valid.length < 2) return 0;
  const wins = valid.filter((i) => i.verdictAccurate === true).length;
  return round2((wins / valid.length) * 100);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
