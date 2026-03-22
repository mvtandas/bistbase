/**
 * Signal Backfill Endpoint
 * Geçmiş fiyat verilerinden sinyalleri geriye dönük oluşturur ve
 * sonuçlarını (1D/5D/10D) anında doldurur.
 *
 * GET /api/cron/backfill-signals?days=180
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BIST30 } from "@/lib/constants";
import { getHistoricalBars } from "@/lib/stock/yahoo";
import { calculateFullTechnicals } from "@/lib/stock/technicals";
import { detectSignals } from "@/lib/stock/signals";

export const maxDuration = 300; // 5 min timeout

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const days = Math.min(365, Math.max(30, Number(req.nextUrl.searchParams.get("days") ?? "180")));

  // 1. BİST30 + portföydeki ek hisseler
  const portfolioStocks = await prisma.portfolio.findMany({
    distinct: ["stockCode"],
    select: { stockCode: true },
  });
  const portfolioCodes = portfolioStocks.map(s => s.stockCode);
  const allCodes = [...new Set([...BIST30, ...portfolioCodes])];
  const stocks = allCodes.map(code => ({ stockCode: code }));

  if (stocks.length === 0) {
    return NextResponse.json({ message: "Hisse bulunamadı", stats: { created: 0, updated: 0 } });
  }

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  for (const { stockCode } of stocks) {
    try {
      // 2. 220+ günlük geçmiş veri çek (MA200 için 220, sinyal hesabı için en az 50)
      const bars = await getHistoricalBars(stockCode, Math.max(220, days + 50));
      if (bars.length < 50) continue;

      // 3. Her gün için sliding window ile sinyal tespit et
      const startIdx = Math.max(50, bars.length - days);

      for (let i = startIdx; i < bars.length; i++) {
        const windowBars = bars.slice(0, i + 1); // O güne kadar olan barlar (future leak yok)
        const currentBar = bars[i];
        const price = currentBar.close;
        const volume = currentBar.volume;

        if (!price || price <= 0) continue;

        const dateUTC = new Date(currentBar.date + "T00:00:00Z");

        // Teknik hesapla
        let technicals;
        try {
          technicals = calculateFullTechnicals(
            windowBars.map(b => ({ date: b.date, open: b.open, close: b.close, high: b.high, low: b.low, volume: b.volume })),
            price,
            volume,
          );
        } catch { continue; }

        // Sinyalleri tespit et
        const signals = detectSignals(technicals, price);
        if (signals.length === 0) continue;

        // 4. Gelecek barlardan sonuçları hesapla
        const bar1D = bars[i + 1] ?? null;
        const bar5D = bars[i + 5] ?? null;
        const bar10D = bars[i + 10] ?? null;

        for (const signal of signals) {
          if (signal.direction === "NEUTRAL") continue;

          // Outcome hesapla
          const outcome1D = bar1D ? Math.round(((bar1D.close - price) / price) * 10000) / 100 : null;
          const outcome5D = bar5D ? Math.round(((bar5D.close - price) / price) * 10000) / 100 : null;
          const outcome10D = bar10D ? Math.round(((bar10D.close - price) / price) * 10000) / 100 : null;

          // wasAccurate hesapla (1D bazlı, mevcut track-signals mantığıyla aynı)
          let wasAccurate: boolean | null = null;
          if (outcome1D != null) {
            const minMove = signal.strength >= 70 ? 1.0 : signal.strength >= 50 ? 0.5 : 0.1;
            wasAccurate = signal.direction === "BULLISH"
              ? outcome1D >= minMove
              : outcome1D <= -minMove;
          }

          try {
            const existing = await prisma.signal.findUnique({
              where: {
                stockCode_date_signalType_signalDirection: {
                  stockCode,
                  date: dateUTC,
                  signalType: signal.type,
                  signalDirection: signal.direction,
                },
              },
              select: { id: true, wasAccurate: true },
            });

            if (existing) {
              // Sadece outcome eksikse güncelle
              if (existing.wasAccurate == null && wasAccurate != null) {
                await prisma.signal.update({
                  where: { id: existing.id },
                  data: {
                    priceAfter1Day: bar1D?.close ?? null,
                    outcomePercent1D: outcome1D,
                    priceAfter5Days: bar5D?.close ?? null,
                    outcomePercent5D: outcome5D,
                    priceAfter10Days: bar10D?.close ?? null,
                    outcomePercent10D: outcome10D,
                    wasAccurate,
                    confirmed: outcome10D != null,
                  },
                });
                totalUpdated++;
              }
            } else {
              // Yeni sinyal oluştur + outcome'ları hemen doldur
              await prisma.signal.create({
                data: {
                  stockCode,
                  date: dateUTC,
                  signalType: signal.type,
                  signalDirection: signal.direction,
                  strength: signal.strength,
                  description: signal.description,
                  priceAtSignal: price,
                  priceAfter1Day: bar1D?.close ?? null,
                  outcomePercent1D: outcome1D,
                  priceAfter5Days: bar5D?.close ?? null,
                  outcomePercent5D: outcome5D,
                  priceAfter10Days: bar10D?.close ?? null,
                  outcomePercent10D: outcome10D,
                  wasAccurate,
                  confirmed: outcome10D != null,
                },
              });
              totalCreated++;
            }
          } catch {
            // Duplicate key veya başka DB hatası — devam et
            totalErrors++;
          }
        }
      }

      // Rate limit — Yahoo Finance
      await sleep(2000);
    } catch (err) {
      console.error(`[backfill-signals] ${stockCode} failed:`, (err as Error)?.message);
      totalErrors++;
    }
  }

  return NextResponse.json({
    message: `Sinyal backfill tamamlandı`,
    stats: {
      stocks: stocks.length,
      created: totalCreated,
      updated: totalUpdated,
      errors: totalErrors,
      days,
    },
  });
}
