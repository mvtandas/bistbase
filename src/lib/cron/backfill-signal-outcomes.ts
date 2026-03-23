/**
 * Signal Outcome Backfill
 * Geçmiş sinyallerin outcome'larını DailySummary'deki fiyat verisi ile doldurur.
 * track-signals cron'u günlük çalışır ama geçmişi yakalayamaz — bu one-time backfill.
 */

import { prisma } from "@/lib/prisma";

export async function backfillSignalOutcomes(): Promise<{
  processed: number;
  skipped: number;
  failed: number;
}> {
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  // Outcome'u olmayan tüm sinyalleri al
  const signals = await prisma.signal.findMany({
    where: {
      outcomePercent1D: null,
      signalDirection: { in: ["BULLISH", "BEARISH"] },
    },
    select: {
      id: true,
      stockCode: true,
      date: true,
      signalDirection: true,
      strength: true,
      priceAtSignal: true,
    },
    orderBy: { date: "asc" },
  });

  if (signals.length === 0) return { processed: 0, skipped: 0, failed: 0 };

  // Tüm stokların tüm günlük fiyat verilerini çek (DailySummary'den)
  const stockCodes = [...new Set(signals.map(s => s.stockCode))];
  const allPrices = await prisma.dailySummary.findMany({
    where: {
      stockCode: { in: stockCodes },
      closePrice: { not: null },
      timeframe: "daily",
      status: "COMPLETED",
    },
    select: {
      stockCode: true,
      date: true,
      closePrice: true,
    },
    orderBy: { date: "asc" },
  });

  // Fiyat map: stockCode -> date string -> price
  const priceMap = new Map<string, Map<string, number>>();
  for (const p of allPrices) {
    if (p.closePrice == null) continue;
    const key = p.stockCode;
    if (!priceMap.has(key)) priceMap.set(key, new Map());
    const dateStr = p.date.toISOString().split("T")[0];
    priceMap.get(key)!.set(dateStr, p.closePrice);
  }

  // Her sinyal için outcome hesapla
  for (const signal of signals) {
    try {
      const stockPrices = priceMap.get(signal.stockCode);
      if (!stockPrices) { skipped++; continue; }

      const signalDate = signal.date;
      const entryPrice = signal.priceAtSignal ?? stockPrices.get(signalDate.toISOString().split("T")[0]);

      if (!entryPrice) { skipped++; continue; }

      // priceAtSignal boşsa dolduralım
      const needsPriceUpdate = signal.priceAtSignal == null;

      // 1D, 5D, 10D sonraki iş günü fiyatlarını bul
      const price1D = findPriceAfterDays(stockPrices, signalDate, 1);
      const price5D = findPriceAfterDays(stockPrices, signalDate, 5);
      const price10D = findPriceAfterDays(stockPrices, signalDate, 10);

      if (!price1D && !price5D && !price10D) { skipped++; continue; }

      const outcome1D = price1D ? ((price1D - entryPrice) / entryPrice) * 100 : null;
      const outcome5D = price5D ? ((price5D - entryPrice) / entryPrice) * 100 : null;
      const outcome10D = price10D ? ((price10D - entryPrice) / entryPrice) * 100 : null;

      // wasAccurate: 1D outcome bazlı
      let wasAccurate: boolean | null = null;
      if (outcome1D != null) {
        const minMove = signal.strength >= 70 ? 1.0 : signal.strength >= 50 ? 0.5 : 0.1;
        wasAccurate = signal.signalDirection === "BULLISH"
          ? outcome1D >= minMove
          : outcome1D <= -minMove;
      }

      await prisma.signal.update({
        where: { id: signal.id },
        data: {
          ...(needsPriceUpdate ? { priceAtSignal: entryPrice } : {}),
          ...(price1D != null ? { priceAfter1Day: price1D } : {}),
          ...(outcome1D != null ? { outcomePercent1D: round2(outcome1D) } : {}),
          ...(price5D != null ? { priceAfter5Days: price5D } : {}),
          ...(outcome5D != null ? { outcomePercent5D: round2(outcome5D) } : {}),
          ...(price10D != null ? { priceAfter10Days: price10D } : {}),
          ...(outcome10D != null ? { outcomePercent10D: round2(outcome10D) } : {}),
          ...(wasAccurate != null ? { wasAccurate } : {}),
          ...(outcome10D != null ? { confirmed: true } : {}),
        },
      });

      processed++;
    } catch (err) {
      console.error(`Backfill failed for signal ${signal.id}:`, (err as Error).message);
      failed++;
    }
  }

  return { processed, skipped, failed };
}

/**
 * Belirtilen günden N iş günü sonrasına en yakın fiyatı bulur
 */
function findPriceAfterDays(
  prices: Map<string, number>,
  fromDate: Date,
  targetDays: number,
): number | null {
  const d = new Date(fromDate);

  // N takvim günü ilerlet (iş günü yaklaşık)
  let businessDays = 0;
  while (businessDays < targetDays) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) businessDays++;
  }

  // Tam tarihte fiyat yoksa ±2 gün içinde ara
  for (let offset = 0; offset <= 2; offset++) {
    const check = new Date(d);
    check.setDate(check.getDate() + offset);
    const dateStr = check.toISOString().split("T")[0];
    const price = prices.get(dateStr);
    if (price != null) return price;

    if (offset > 0) {
      const checkBefore = new Date(d);
      checkBefore.setDate(checkBefore.getDate() - offset);
      const dateStrBefore = checkBefore.toISOString().split("T")[0];
      const priceBefore = prices.get(dateStrBefore);
      if (priceBefore != null) return priceBefore;
    }
  }

  return null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
