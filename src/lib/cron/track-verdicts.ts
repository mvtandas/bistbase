/**
 * Verdict Outcome Tracker
 * Geçmiş kararların doğruluğunu kontrol eder.
 * "Bu karar gerçekten doğru muydu?"
 */

import { prisma } from "@/lib/prisma";
import { getStockQuote } from "@/lib/stock/yahoo";
import { getIstanbulToday } from "@/lib/date-utils";

export async function trackVerdictOutcomes(): Promise<{
  updated1D: number;
  updated5D: number;
  updated10D: number;
  updated20D: number;
}> {
  let updated1D = 0, updated5D = 0, updated10D = 0, updated20D = 0;

  // ── Phase 1: 1D outcomes ──
  const verdicts1D = await prisma.dailySummary.findMany({
    where: {
      verdictAction: { not: null },
      priceAfter1D: null,
      date: { lte: daysAgo(1) },
      timeframe: "daily",
    },
    take: 200,
  });

  for (const v of verdicts1D) {
    const quote = await getStockQuote(v.stockCode);
    if (quote?.price != null && v.closePrice != null) {
      const outcome = ((quote.price - v.closePrice) / v.closePrice) * 100;
      await prisma.dailySummary.update({
        where: { id: v.id },
        data: {
          priceAfter1D: quote.price,
          outcomePercent1D: round2(outcome),
        },
      });
      updated1D++;
    }
    await sleep(500);
  }

  // ── Phase 2: 5D outcomes ──
  const verdicts5D = await prisma.dailySummary.findMany({
    where: {
      verdictAction: { not: null },
      priceAfter1D: { not: null },
      priceAfter5D: null,
      date: { lte: daysAgo(5) },
      timeframe: "daily",
    },
    take: 200,
  });

  for (const v of verdicts5D) {
    const quote = await getStockQuote(v.stockCode);
    if (quote?.price != null && v.closePrice != null) {
      const outcome = ((quote.price - v.closePrice) / v.closePrice) * 100;
      await prisma.dailySummary.update({
        where: { id: v.id },
        data: {
          priceAfter5D: quote.price,
          outcomePercent5D: round2(outcome),
        },
      });
      updated5D++;
    }
    await sleep(500);
  }

  // ── Phase 3: 10D outcomes ──
  const verdicts10D = await prisma.dailySummary.findMany({
    where: {
      verdictAction: { not: null },
      priceAfter5D: { not: null },
      priceAfter10D: null,
      date: { lte: daysAgo(10) },
      timeframe: "daily",
    },
    take: 200,
  });

  for (const v of verdicts10D) {
    const quote = await getStockQuote(v.stockCode);
    if (quote?.price != null && v.closePrice != null) {
      const outcome = ((quote.price - v.closePrice) / v.closePrice) * 100;
      await prisma.dailySummary.update({
        where: { id: v.id },
        data: {
          priceAfter10D: quote.price,
          outcomePercent10D: round2(outcome),
        },
      });
      updated10D++;
    }
    await sleep(500);
  }

  // ── Phase 4: 20D outcomes + verdictAccurate ──
  const verdicts20D = await prisma.dailySummary.findMany({
    where: {
      verdictAction: { not: null },
      priceAfter10D: { not: null },
      priceAfter20D: null,
      date: { lte: daysAgo(20) },
      timeframe: "daily",
    },
    take: 200,
  });

  for (const v of verdicts20D) {
    const quote = await getStockQuote(v.stockCode);
    if (quote?.price != null && v.closePrice != null) {
      const outcome = ((quote.price - v.closePrice) / v.closePrice) * 100;
      const accurate = determineAccuracy(v.verdictAction!, outcome);
      await prisma.dailySummary.update({
        where: { id: v.id },
        data: {
          priceAfter20D: quote.price,
          outcomePercent20D: round2(outcome),
          verdictAccurate: accurate,
        },
      });
      updated20D++;
    }
    await sleep(500);
  }

  return { updated1D, updated5D, updated10D, updated20D };
}

function determineAccuracy(verdictAction: string, outcomePercent: number): boolean {
  switch (verdictAction) {
    case "GUCLU_AL":
    case "AL":
      return outcomePercent > 0;
    case "SAT":
    case "GUCLU_SAT":
      return outcomePercent < 0;
    case "TUT":
      return Math.abs(outcomePercent) < 3;
    default:
      return false;
  }
}

function daysAgo(days: number): Date {
  const d = getIstanbulToday();
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
