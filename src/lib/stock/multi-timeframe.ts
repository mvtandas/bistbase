/**
 * Multi-Timeframe Analysis
 * Haftalık ve günlük trendlerin uyumunu kontrol eder
 */

import YahooFinance from "yahoo-finance2";
import { calculateFullTechnicals, type HistoricalBar } from "./technicals";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = new (YahooFinance as any)({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

export interface TimeframeAnalysis {
  weekly: {
    trend: "STRONG_UP" | "UP" | "SIDEWAYS" | "DOWN" | "STRONG_DOWN";
    rsi: number | null;
    maAlignment: string | null;
  };
  daily: {
    trend: string | null;
    rsi: number | null;
    maAlignment: string | null;
  };
  alignment: "STRONG_ALIGNED" | "ALIGNED" | "MIXED" | "CONFLICTING";
  alignmentTr: string;
  signalBonus: number; // Mevcut sinyallere bonus/ceza
}

export async function getWeeklyBars(stockCode: string): Promise<HistoricalBar[]> {
  try {
    const symbol = `${stockCode.toUpperCase()}.IS`;
    const start = new Date();
    start.setFullYear(start.getFullYear() - 1);
    const data = await yf.historical(symbol, { period1: start, period2: new Date(), interval: "1wk" });
    if (!data || !Array.isArray(data)) return [];
    return data.map((b: Record<string, unknown>) => ({
      date: b.date ? new Date(b.date as string).toISOString().split("T")[0] : "",
      open: (b.open as number) ?? 0,
      close: (b.close as number) ?? 0,
      high: (b.high as number) ?? 0,
      low: (b.low as number) ?? 0,
      volume: (b.volume as number) ?? 0,
    }));
  } catch {
    return [];
  }
}

function detectTrend(closes: number[]): "STRONG_UP" | "UP" | "SIDEWAYS" | "DOWN" | "STRONG_DOWN" {
  if (closes.length < 10) return "SIDEWAYS";
  const start = closes[0];
  const end = closes[closes.length - 1];
  const change = ((end - start) / start) * 100;
  const greenCount = closes.filter((c, i) => i > 0 && c > closes[i - 1]).length;
  const ratio = greenCount / (closes.length - 1);

  if (change > 10 && ratio > 0.6) return "STRONG_UP";
  if (change > 3 && ratio > 0.5) return "UP";
  if (change < -10 && ratio < 0.4) return "STRONG_DOWN";
  if (change < -3 && ratio < 0.5) return "DOWN";
  return "SIDEWAYS";
}

export async function analyzeMultiTimeframe(
  stockCode: string,
  dailyBars: HistoricalBar[],
  dailyTechnicals: { rsi14: number | null; maAlignment: string | null } | null
): Promise<TimeframeAnalysis> {
  const weeklyBars = await getWeeklyBars(stockCode);

  // Haftalık analiz
  const weeklyClosed = weeklyBars.map(b => b.close);
  const weeklyTrend = detectTrend(weeklyClosed);
  let weeklyRsi: number | null = null;
  let weeklyMaAlign: string | null = null;

  if (weeklyBars.length >= 20) {
    const wTech = calculateFullTechnicals(weeklyBars, weeklyBars[weeklyBars.length - 1]?.close ?? null, null, "weekly");
    weeklyRsi = wTech.rsi14;
    weeklyMaAlign = wTech.maAlignment;
  }

  // Günlük
  const dailyClosed = dailyBars.map(b => b.close);
  const dailyTrend = detectTrend(dailyClosed.slice(-20));

  // Alignment
  const wUp = weeklyTrend === "STRONG_UP" || weeklyTrend === "UP";
  const wDown = weeklyTrend === "STRONG_DOWN" || weeklyTrend === "DOWN";
  const dUp = dailyTrend === "STRONG_UP" || dailyTrend === "UP";
  const dDown = dailyTrend === "STRONG_DOWN" || dailyTrend === "DOWN";

  let alignment: TimeframeAnalysis["alignment"] = "MIXED";
  let alignmentTr = "Haftalık trend belirsiz";
  let signalBonus = 0;

  if (wUp && dUp) {
    alignment = "STRONG_ALIGNED";
    alignmentTr = "Haftalık ve günlük trendler güçlü uyum içinde (yükseliş)";
    signalBonus = 15;
  } else if (wDown && dDown) {
    alignment = "STRONG_ALIGNED";
    alignmentTr = "Haftalık ve günlük trendler güçlü uyum içinde (düşüş)";
    signalBonus = 15;
  } else if ((wUp && dailyTrend === "SIDEWAYS") || (weeklyTrend === "SIDEWAYS" && dUp)) {
    alignment = "ALIGNED";
    alignmentTr = "Haftalık trend destekliyor, günlük konsolidasyon";
    signalBonus = 8;
  } else if ((wDown && dUp) || (wUp && dDown)) {
    alignment = "CONFLICTING";
    alignmentTr = "Haftalık ve günlük trendler çelişiyor — dikkat!";
    signalBonus = -12;
  } else {
    alignment = "MIXED";
    alignmentTr = "Haftalık trend belirsiz, dikkatli olunmalı";
    signalBonus = 0;
  }

  return {
    weekly: { trend: weeklyTrend, rsi: weeklyRsi, maAlignment: weeklyMaAlign },
    daily: { trend: dailyTrend, rsi: dailyTechnicals?.rsi14 ?? null, maAlignment: dailyTechnicals?.maAlignment ?? null },
    alignment,
    alignmentTr,
    signalBonus,
  };
}
