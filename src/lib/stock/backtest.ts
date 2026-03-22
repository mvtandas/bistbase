/**
 * Bistbase Signal Backtest Engine
 * Her sinyal tipinin geçmiş performansını hesaplar
 * "Bu sinyal son 6 ayda 12 kez tetiklendi, 9'unda doğru çıktı"
 */

import { prisma } from "@/lib/prisma";

// ═══ Types ═══

export interface TimeHorizonStats {
  winRate: number;       // 0-100
  avgWinPct: number;     // ortalama kazanç %
  avgLossPct: number;    // ortalama kayıp % (negatif)
  profitFactor: number;  // toplam kazanç / toplam kayıp (>1 = kârlı)
  sampleSize: number;
}

export interface StreakStats {
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  currentStreak: number;
  currentStreakType: "WIN" | "LOSS" | "NONE";
}

export interface RegimePerformance {
  bullMarket: { winRate: number; avgReturn: number; count: number } | null;
  bearMarket: { winRate: number; avgReturn: number; count: number } | null;
  neutral: { winRate: number; avgReturn: number; count: number } | null;
}

export interface SignalPerformance {
  signalType: string;
  signalDirection: string;

  horizon1D: TimeHorizonStats;
  horizon5D: TimeHorizonStats;
  horizon10D: TimeHorizonStats;
  bestHorizon: "1D" | "5D" | "10D";

  bestOutcome: { percent: number; date: string } | null;
  worstOutcome: { percent: number; date: string } | null;

  streaks: StreakStats;
  regimePerformance: RegimePerformance;

  confidence: "HIGH" | "MEDIUM" | "LOW";
  confidenceScore: number;

  recentOutcomes: { date: string; outcome1D: number | null; outcome5D: number | null; wasAccurate: boolean | null }[];

  summaryTr: string;
}

export interface BacktestResult {
  stockCode: string | null;
  performances: SignalPerformance[];
  generatedAt: string;
  totalSignalsAnalyzed: number;
  dataSpanDays: number;
}

// ═══ Helpers ═══

function calcHorizonStats(
  signals: { outcome: number | null; direction: string }[],
): TimeHorizonStats {
  const valid = signals.filter(s => s.outcome != null) as { outcome: number; direction: string }[];
  if (valid.length === 0) return { winRate: 0, avgWinPct: 0, avgLossPct: 0, profitFactor: 0, sampleSize: 0 };

  const wins: number[] = [];
  const losses: number[] = [];

  for (const s of valid) {
    const isWin = s.direction === "BEARISH" ? s.outcome < 0 : s.outcome > 0;
    if (isWin) wins.push(Math.abs(s.outcome));
    else losses.push(Math.abs(s.outcome));
  }

  const winRate = (wins.length / valid.length) * 100;
  const avgWinPct = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const avgLossPct = losses.length > 0 ? -(losses.reduce((a, b) => a + b, 0) / losses.length) : 0;

  const grossWins = wins.reduce((a, b) => a + b, 0);
  const grossLosses = losses.reduce((a, b) => a + b, 0);
  const profitFactor = grossLosses > 0 ? Math.min(999, grossWins / grossLosses) : (grossWins > 0 ? 999 : 0);

  return {
    winRate: Math.round(winRate * 10) / 10,
    avgWinPct: Math.round(avgWinPct * 100) / 100,
    avgLossPct: Math.round(avgLossPct * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    sampleSize: valid.length,
  };
}

function calcStreaks(signals: { wasAccurate: boolean | null; date: Date }[]): StreakStats {
  const sorted = [...signals].filter(s => s.wasAccurate != null).sort((a, b) => a.date.getTime() - b.date.getTime());

  let maxWins = 0, maxLosses = 0, currentCount = 0;
  let currentType: "WIN" | "LOSS" | "NONE" = "NONE";

  for (const s of sorted) {
    const isWin = s.wasAccurate!;
    if (isWin) {
      if (currentType === "WIN") { currentCount++; }
      else { currentCount = 1; currentType = "WIN"; }
      maxWins = Math.max(maxWins, currentCount);
    } else {
      if (currentType === "LOSS") { currentCount++; }
      else { currentCount = 1; currentType = "LOSS"; }
      maxLosses = Math.max(maxLosses, currentCount);
    }
  }

  return {
    maxConsecutiveWins: maxWins,
    maxConsecutiveLosses: maxLosses,
    currentStreak: currentType === "NONE" ? 0 : (currentType === "WIN" ? currentCount : -currentCount),
    currentStreakType: currentType,
  };
}

function calcConfidence(h1d: TimeHorizonStats, h5d: TimeHorizonStats, h10d: TimeHorizonStats, streaks: StreakStats): { score: number; level: "HIGH" | "MEDIUM" | "LOW" } {
  let score = 50;

  // Sample size
  const maxSample = Math.max(h1d.sampleSize, h5d.sampleSize, h10d.sampleSize);
  if (maxSample >= 20) score += 25;
  else if (maxSample >= 10) score += 15;
  else if (maxSample >= 5) score += 5;
  else score -= 20;

  // Consistency: all horizons > 55% win rate
  const rates = [h1d, h5d, h10d].filter(h => h.sampleSize >= 3).map(h => h.winRate);
  if (rates.length >= 2 && rates.every(r => r > 55)) score += 10;
  if (rates.some(r => r < 40)) score -= 10;

  // Profit factor
  const bestPF = Math.max(h1d.profitFactor, h5d.profitFactor, h10d.profitFactor);
  if (bestPF >= 2.0) score += 10;
  else if (bestPF < 1.0) score -= 15;

  // Streak health
  if (streaks.maxConsecutiveLosses > 5) score -= 10;

  score = Math.max(5, Math.min(95, score));
  const level = score >= 70 ? "HIGH" as const : score >= 45 ? "MEDIUM" as const : "LOW" as const;
  return { score, level };
}

function getBestHorizon(h1d: TimeHorizonStats, h5d: TimeHorizonStats, h10d: TimeHorizonStats): "1D" | "5D" | "10D" {
  const all: { horizon: "1D" | "5D" | "10D"; stats: TimeHorizonStats }[] = [
    { horizon: "1D", stats: h1d },
    { horizon: "5D", stats: h5d },
    { horizon: "10D", stats: h10d },
  ];
  const candidates = all.filter(c => c.stats.sampleSize >= 3);

  if (candidates.length === 0) return "1D";
  candidates.sort((a, b) => b.stats.winRate - a.stats.winRate);
  return candidates[0].horizon;
}

function turkishApostrophe(num: number): string {
  // Basit Türkçe apostrophe uyumu
  const lastDigit = num % 10;
  if ([1, 2, 7, 8].includes(lastDigit)) return "'i";
  if ([3, 4, 5].includes(lastDigit)) return "'ü";
  if (lastDigit === 6) return "'sı";
  if (lastDigit === 9) return "'u";
  if (lastDigit === 0) return "'ı";
  return "'i";
}

// ═══ Main Engine ═══

export async function calculateBacktest(
  stockCode: string | null,
  lookbackDays = 180,
): Promise<BacktestResult> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookbackDays);

  // 1. Fetch signals with outcomes
  const where: Record<string, unknown> = {
    date: { gte: cutoff },
    wasAccurate: { not: null },
  };
  if (stockCode) where.stockCode = stockCode;

  const signals = await prisma.signal.findMany({
    where,
    select: {
      signalType: true,
      signalDirection: true,
      date: true,
      stockCode: true,
      wasAccurate: true,
      outcomePercent1D: true,
      outcomePercent5D: true,
      outcomePercent10D: true,
    },
    orderBy: { date: "asc" },
  });

  if (signals.length === 0) {
    return {
      stockCode,
      performances: [],
      generatedAt: new Date().toISOString(),
      totalSignalsAnalyzed: 0,
      dataSpanDays: lookbackDays,
    };
  }

  // 2. Fetch composite scores for regime performance
  const dateStockPairs = [...new Set(signals.map(s => `${s.stockCode}|${s.date.toISOString().split("T")[0]}`))];
  const compositeMap = new Map<string, number>();

  if (dateStockPairs.length > 0) {
    const summaries = await prisma.dailySummary.findMany({
      where: {
        OR: signals.slice(0, 500).map(s => ({
          stockCode: s.stockCode,
          date: s.date,
        })),
        compositeScore: { not: null },
      },
      select: { stockCode: true, date: true, compositeScore: true },
    });

    for (const s of summaries) {
      const key = `${s.stockCode}|${s.date.toISOString().split("T")[0]}`;
      if (s.compositeScore != null) compositeMap.set(key, s.compositeScore);
    }
  }

  // 3. Group by signalType + signalDirection
  const groups = new Map<string, typeof signals>();
  for (const s of signals) {
    const key = `${s.signalType}|${s.signalDirection}`;
    const group = groups.get(key) ?? [];
    group.push(s);
    groups.set(key, group);
  }

  // 4. Calculate performance for each group
  const performances: SignalPerformance[] = [];

  for (const [key, group] of groups) {
    const [signalType, signalDirection] = key.split("|");

    // Horizon stats
    const horizon1D = calcHorizonStats(group.map(s => ({ outcome: s.outcomePercent1D, direction: s.signalDirection })));
    const horizon5D = calcHorizonStats(group.map(s => ({ outcome: s.outcomePercent5D, direction: s.signalDirection })));
    const horizon10D = calcHorizonStats(group.map(s => ({ outcome: s.outcomePercent10D, direction: s.signalDirection })));

    const bestHorizon = getBestHorizon(horizon1D, horizon5D, horizon10D);

    // Best/worst outcome (1D)
    const with1D = group.filter(s => s.outcomePercent1D != null);
    let bestOutcome: SignalPerformance["bestOutcome"] = null;
    let worstOutcome: SignalPerformance["worstOutcome"] = null;

    if (with1D.length > 0) {
      const sorted1D = [...with1D].sort((a, b) => (a.outcomePercent1D!) - (b.outcomePercent1D!));
      const best = signalDirection === "BEARISH" ? sorted1D[0] : sorted1D[sorted1D.length - 1];
      const worst = signalDirection === "BEARISH" ? sorted1D[sorted1D.length - 1] : sorted1D[0];
      bestOutcome = { percent: Math.round(best.outcomePercent1D! * 100) / 100, date: best.date.toISOString().split("T")[0] };
      worstOutcome = { percent: Math.round(worst.outcomePercent1D! * 100) / 100, date: worst.date.toISOString().split("T")[0] };
    }

    // Streaks
    const streaks = calcStreaks(group.map(s => ({ wasAccurate: s.wasAccurate, date: s.date })));

    // Regime performance
    const regimeBuckets: Record<string, { wins: number; total: number; returns: number[] }> = {
      bull: { wins: 0, total: 0, returns: [] },
      bear: { wins: 0, total: 0, returns: [] },
      neutral: { wins: 0, total: 0, returns: [] },
    };

    for (const s of group) {
      const csKey = `${s.stockCode}|${s.date.toISOString().split("T")[0]}`;
      const cs = compositeMap.get(csKey);
      if (cs == null) continue;

      const bucket = cs > 60 ? "bull" : cs < 40 ? "bear" : "neutral";
      regimeBuckets[bucket].total++;
      if (s.wasAccurate) regimeBuckets[bucket].wins++;
      if (s.outcomePercent1D != null) regimeBuckets[bucket].returns.push(s.outcomePercent1D);
    }

    const toRegime = (b: typeof regimeBuckets.bull) => b.total >= 2 ? {
      winRate: Math.round((b.wins / b.total) * 100),
      avgReturn: b.returns.length > 0 ? Math.round((b.returns.reduce((a, c) => a + c, 0) / b.returns.length) * 100) / 100 : 0,
      count: b.total,
    } : null;

    const regimePerformance: RegimePerformance = {
      bullMarket: toRegime(regimeBuckets.bull),
      bearMarket: toRegime(regimeBuckets.bear),
      neutral: toRegime(regimeBuckets.neutral),
    };

    // Confidence
    const { score: confidenceScore, level: confidence } = calcConfidence(horizon1D, horizon5D, horizon10D, streaks);

    // Recent outcomes (last 10)
    const recent = [...group].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 10);
    const recentOutcomes = recent.map(s => ({
      date: s.date.toISOString().split("T")[0],
      outcome1D: s.outcomePercent1D,
      outcome5D: s.outcomePercent5D,
      wasAccurate: s.wasAccurate,
    }));

    // Summary
    const totalCount = horizon1D.sampleSize;
    const winCount = Math.round(totalCount * horizon1D.winRate / 100);
    const horizonLabel = bestHorizon === "1D" ? "1 gün" : bestHorizon === "5D" ? "5 gün" : "10 gün";
    const bestWR = bestHorizon === "1D" ? horizon1D.winRate : bestHorizon === "5D" ? horizon5D.winRate : horizon10D.winRate;
    const summaryTr = totalCount >= 3
      ? `Bu sinyal son ${lookbackDays} günde ${totalCount} kez tetiklendi, ${winCount}${turkishApostrophe(winCount)} doğru çıktı (${horizonLabel} bazında %${bestWR} başarı).`
      : "Yeterli geçmiş veri yok.";

    performances.push({
      signalType,
      signalDirection,
      horizon1D, horizon5D, horizon10D,
      bestHorizon,
      bestOutcome, worstOutcome,
      streaks,
      regimePerformance,
      confidence, confidenceScore,
      recentOutcomes,
      summaryTr,
    });
  }

  // Sort by confidence score descending
  performances.sort((a, b) => b.confidenceScore - a.confidenceScore);

  return {
    stockCode,
    performances,
    generatedAt: new Date().toISOString(),
    totalSignalsAnalyzed: signals.length,
    dataSpanDays: lookbackDays,
  };
}
