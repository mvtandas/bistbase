/**
 * Signal Backfill Script — doğrudan çalıştır
 * npx tsx -r tsconfig-paths/register scripts/run-backfill.ts
 */

import "dotenv/config";
import { resolve } from "path";

// tsconfig paths workaround for tsx
const srcDir = resolve(__dirname, "..", "src");

// Manual path resolution since tsx doesn't resolve tsconfig paths
async function loadModules() {
  const { PrismaClient } = await import(resolve(srcDir, "generated/prisma/client.js"));
  const { PrismaPg } = await import("@prisma/adapter-pg");

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  const { getHistoricalBars } = await import(resolve(srcDir, "lib/stock/yahoo.js"));
  const { calculateFullTechnicals } = await import(resolve(srcDir, "lib/stock/technicals.js"));
  const { detectSignals } = await import(resolve(srcDir, "lib/stock/signals.js"));

  return { prisma, getHistoricalBars, calculateFullTechnicals, detectSignals };
}

const BIST30 = [
  "AKBNK", "ARCLK", "ASELS", "BIMAS", "EKGYO",
  "ENERY", "EREGL", "FROTO", "GARAN", "GUBRF",
  "HEKTS", "ISCTR", "KCHOL", "KOZAA", "KOZAL",
  "KRDMD", "MGROS", "ODAS", "OYAKC", "PETKM",
  "PGSUS", "SAHOL", "SASA", "SISE", "TAVHL",
  "TCELL", "THYAO", "TOASO", "TUPRS", "YKBNK",
];

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const days = 180;
  console.log(`\n=== SINYAL BACKFILL BASLIYOR ===`);
  console.log(`Hisse: ${BIST30.length} adet (BIST30)`);
  console.log(`Geri: ${days} gun\n`);

  const { prisma, getHistoricalBars, calculateFullTechnicals, detectSignals } = await loadModules();

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  for (let si = 0; si < BIST30.length; si++) {
    const stockCode = BIST30[si];
    const progress = `[${si + 1}/${BIST30.length}]`;

    try {
      const bars = await getHistoricalBars(stockCode, Math.max(220, days + 50));
      if (bars.length < 50) {
        console.log(`${progress} ${stockCode}: Yetersiz veri (${bars.length} bar), atlandi`);
        continue;
      }

      const startIdx = Math.max(50, bars.length - days);
      let created = 0, updated = 0;

      for (let i = startIdx; i < bars.length; i++) {
        const windowBars = bars.slice(0, i + 1);
        const currentBar = bars[i];
        const price = currentBar.close;
        const volume = currentBar.volume;

        if (!price || price <= 0) continue;

        const dateUTC = new Date(currentBar.date + "T00:00:00Z");

        let technicals: any;
        try {
          technicals = calculateFullTechnicals(
            windowBars.map((b: any) => ({ date: b.date, open: b.open, close: b.close, high: b.high, low: b.low, volume: b.volume })),
            price, volume,
          );
        } catch { continue; }

        const signals = detectSignals(technicals, price);
        if (signals.length === 0) continue;

        const bar1D = bars[i + 1] ?? null;
        const bar5D = bars[i + 5] ?? null;
        const bar10D = bars[i + 10] ?? null;

        for (const signal of signals) {
          if (signal.direction === "NEUTRAL") continue;

          const outcome1D = bar1D ? Math.round(((bar1D.close - price) / price) * 10000) / 100 : null;
          const outcome5D = bar5D ? Math.round(((bar5D.close - price) / price) * 10000) / 100 : null;
          const outcome10D = bar10D ? Math.round(((bar10D.close - price) / price) * 10000) / 100 : null;

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
                  stockCode, date: dateUTC,
                  signalType: signal.type,
                  signalDirection: signal.direction,
                },
              },
              select: { id: true, wasAccurate: true },
            });

            if (existing) {
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
                updated++;
              }
            } else {
              await prisma.signal.create({
                data: {
                  stockCode, date: dateUTC,
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
              created++;
            }
          } catch {
            totalErrors++;
          }
        }
      }

      totalCreated += created;
      totalUpdated += updated;
      console.log(`${progress} ${stockCode}: +${created} yeni, ~${updated} guncellendi (${bars.length} bar)`);

      await sleep(1500);
    } catch (err) {
      console.error(`${progress} ${stockCode}: HATA — ${(err as Error)?.message}`);
      totalErrors++;
    }
  }

  console.log(`\n=== SONUC ===`);
  console.log(`Olusturulan: ${totalCreated}`);
  console.log(`Guncellenen: ${totalUpdated}`);
  console.log(`Hatalar: ${totalErrors}`);
  console.log(`Toplam: ${totalCreated + totalUpdated}\n`);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error("FATAL:", e);
  process.exit(1);
});
