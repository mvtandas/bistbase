/**
 * Signal Outcome Tracker
 * Geçmiş sinyallerin doğruluğunu kontrol eder.
 * "Bu sinyal gerçekten çalıştı mı?"
 */

import { prisma } from "@/lib/prisma";
import { getStockQuote } from "@/lib/stock/yahoo";
import { getIstanbulToday } from "@/lib/date-utils";

export async function trackSignalOutcomes(): Promise<{
  updated1D: number;
  updated5D: number;
  updated10D: number;
}> {
  let updated1D = 0, updated5D = 0, updated10D = 0;
  const now = new Date();

  // 1 gün önceki sinyaller (henüz 1D outcome'u olmayanlar)
  const signals1D = await prisma.signal.findMany({
    where: {
      priceAfter1Day: null,
      date: { lte: daysAgo(1) },
    },
    take: 200,
  });

  for (const signal of signals1D) {
    const quote = await getStockQuote(signal.stockCode);
    if (quote?.price != null && signal.priceAtSignal != null) {
      const outcome = ((quote.price - signal.priceAtSignal) / signal.priceAtSignal) * 100;
      // Strength'e göre minimum hareket eşiği — güçlü sinyaller daha büyük hareket gerektirmeli
      const minMove = signal.strength >= 70 ? 1.0 : signal.strength >= 50 ? 0.5 : 0.1;
      const wasCorrect = signal.signalDirection === "BULLISH"
        ? outcome >= minMove
        : signal.signalDirection === "BEARISH"
          ? outcome <= -minMove
          : false; // NEUTRAL sinyaller accuracy takibinden muaf

      await prisma.signal.update({
        where: { id: signal.id },
        data: {
          priceAfter1Day: quote.price,
          outcomePercent1D: Math.round(outcome * 100) / 100,
          wasAccurate: wasCorrect,
        },
      });
      updated1D++;
    }
    await sleep(500);
  }

  // 5 gün önceki sinyaller
  const signals5D = await prisma.signal.findMany({
    where: {
      priceAfter5Days: null,
      priceAfter1Day: { not: null }, // 1D zaten doldurulmuş
      date: { lte: daysAgo(5) },
    },
    take: 200,
  });

  for (const signal of signals5D) {
    const quote = await getStockQuote(signal.stockCode);
    if (quote?.price != null && signal.priceAtSignal != null) {
      const outcome = ((quote.price - signal.priceAtSignal) / signal.priceAtSignal) * 100;
      await prisma.signal.update({
        where: { id: signal.id },
        data: {
          priceAfter5Days: quote.price,
          outcomePercent5D: Math.round(outcome * 100) / 100,
        },
      });
      updated5D++;
    }
    await sleep(500);
  }

  // 10 gün önceki sinyaller
  const signals10D = await prisma.signal.findMany({
    where: {
      priceAfter10Days: null,
      priceAfter5Days: { not: null },
      date: { lte: daysAgo(10) },
    },
    take: 200,
  });

  for (const signal of signals10D) {
    const quote = await getStockQuote(signal.stockCode);
    if (quote?.price != null && signal.priceAtSignal != null) {
      const outcome = ((quote.price - signal.priceAtSignal) / signal.priceAtSignal) * 100;
      await prisma.signal.update({
        where: { id: signal.id },
        data: {
          priceAfter10Days: quote.price,
          outcomePercent10D: Math.round(outcome * 100) / 100,
          confirmed: true,
        },
      });
      updated10D++;
    }
    await sleep(500);
  }

  return { updated1D, updated5D, updated10D };
}

function daysAgo(days: number): Date {
  const d = getIstanbulToday();
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
