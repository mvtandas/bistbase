/**
 * Outcome Backfill — Bar dosyalarından sinyal ve verdict outcome'larını doldurur.
 * Yahoo API'ye gerek yok, lokal bar verisinden hesaplar.
 * Kullanım: npx tsx scripts/backfill-outcomes.ts
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { HistoricalBar } from "../src/lib/stock/technicals";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const BARS_DIR = join(process.cwd(), "data", "bars");

function loadBars(code: string): HistoricalBar[] | null {
  const p = join(BARS_DIR, `${code}.json`);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, "utf-8")); } catch { return null; }
}

function round2(n: number): number { return Math.round(n * 100) / 100; }

async function main() {
  console.log("\n═══ OUTCOME BACKFILL ═══\n");

  // Tüm sinyalleri al (outcome'u boş olanlar)
  const signals = await prisma.signal.findMany({
    where: { priceAfter1Day: null },
    select: { id: true, stockCode: true, date: true, signalDirection: true, strength: true, priceAtSignal: true },
  });
  console.log(`Sinyal: ${signals.length} (outcome boş)`);

  // Tüm verdict'leri al
  const verdicts = await prisma.dailySummary.findMany({
    where: { verdictAction: { not: null }, priceAfter1D: null, timeframe: "daily" },
    select: { id: true, stockCode: true, date: true, verdictAction: true, closePrice: true },
  });
  console.log(`Verdict: ${verdicts.length} (outcome boş)\n`);

  // Hisse bazlı bar cache
  const barCache = new Map<string, Map<string, number>>();
  function getPrice(code: string, date: string): number | null {
    if (!barCache.has(code)) {
      const bars = loadBars(code);
      if (!bars) { barCache.set(code, new Map()); return null; }
      barCache.set(code, new Map(bars.map(b => [b.date, b.close])));
    }
    return barCache.get(code)!.get(date) ?? null;
  }

  // Bar'dan N iş günü sonrasının tarihini bul
  function getDateAfter(code: string, fromDate: string, daysAfter: number): string | null {
    if (!barCache.has(code)) {
      const bars = loadBars(code);
      if (!bars) { barCache.set(code, new Map()); return null; }
      barCache.set(code, new Map(bars.map(b => [b.date, b.close])));
    }
    const bars = loadBars(code);
    if (!bars) return null;
    const idx = bars.findIndex(b => b.date === fromDate);
    if (idx < 0 || idx + daysAfter >= bars.length) return null;
    return bars[idx + daysAfter].date;
  }

  // ── Signal outcomes ──
  let sig1D = 0, sig5D = 0, sig10D = 0;
  for (const signal of signals) {
    const code = signal.stockCode;
    const dateStr = signal.date.toISOString().split("T")[0];
    const entryPrice = signal.priceAtSignal;
    if (!entryPrice) continue;

    const date1D = getDateAfter(code, dateStr, 1);
    const date5D = getDateAfter(code, dateStr, 5);
    const date10D = getDateAfter(code, dateStr, 10);

    const price1D = date1D ? getPrice(code, date1D) : null;
    const price5D = date5D ? getPrice(code, date5D) : null;
    const price10D = date10D ? getPrice(code, date10D) : null;

    const data: Record<string, unknown> = {};

    if (price1D != null) {
      const outcome1D = ((price1D - entryPrice) / entryPrice) * 100;
      const minMove = signal.strength >= 70 ? 1.0 : signal.strength >= 50 ? 0.5 : 0.1;
      const wasCorrect = signal.signalDirection === "BULLISH"
        ? outcome1D >= minMove
        : signal.signalDirection === "BEARISH"
          ? outcome1D <= -minMove
          : false;

      data.priceAfter1Day = price1D;
      data.outcomePercent1D = round2(outcome1D);
      data.wasAccurate = wasCorrect;
      sig1D++;
    }
    if (price5D != null) {
      data.priceAfter5Days = price5D;
      data.outcomePercent5D = round2(((price5D - entryPrice) / entryPrice) * 100);
      sig5D++;
    }
    if (price10D != null) {
      data.priceAfter10Days = price10D;
      data.outcomePercent10D = round2(((price10D - entryPrice) / entryPrice) * 100);
      sig10D++;
    }

    if (Object.keys(data).length > 0) {
      await prisma.signal.update({ where: { id: signal.id }, data });
    }
  }

  // ── Verdict outcomes ──
  let ver1D = 0, ver5D = 0, ver10D = 0, ver20D = 0;
  for (const v of verdicts) {
    const code = v.stockCode;
    const dateStr = v.date.toISOString().split("T")[0];
    const entryPrice = v.closePrice;
    if (!entryPrice) continue;

    const date1D = getDateAfter(code, dateStr, 1);
    const date5D = getDateAfter(code, dateStr, 5);
    const date10D = getDateAfter(code, dateStr, 10);
    const date20D = getDateAfter(code, dateStr, 20);

    const price1D = date1D ? getPrice(code, date1D) : null;
    const price5D = date5D ? getPrice(code, date5D) : null;
    const price10D = date10D ? getPrice(code, date10D) : null;
    const price20D = date20D ? getPrice(code, date20D) : null;

    const data: Record<string, unknown> = {};

    if (price1D != null) {
      data.priceAfter1D = price1D;
      data.outcomePercent1D = round2(((price1D - entryPrice) / entryPrice) * 100);
      ver1D++;
    }
    if (price5D != null) {
      data.priceAfter5D = price5D;
      data.outcomePercent5D = round2(((price5D - entryPrice) / entryPrice) * 100);
      ver5D++;
    }
    if (price10D != null) {
      data.priceAfter10D = price10D;
      data.outcomePercent10D = round2(((price10D - entryPrice) / entryPrice) * 100);
      ver10D++;
    }
    if (price20D != null) {
      const outcome20D = ((price20D - entryPrice) / entryPrice) * 100;
      // verdictAccurate hesapla
      const action = v.verdictAction!;
      let accurate = false;
      if (action === "AL" || action === "GUCLU_AL") accurate = outcome20D > 0;
      else if (action === "SAT" || action === "GUCLU_SAT") accurate = outcome20D < 0;
      else if (action === "TUT") accurate = Math.abs(outcome20D) < 5;

      data.priceAfter20D = price20D;
      data.outcomePercent20D = round2(outcome20D);
      data.verdictAccurate = accurate;
      ver20D++;
    }

    if (Object.keys(data).length > 0) {
      await prisma.dailySummary.update({ where: { id: v.id }, data });
    }
  }

  // ── Sonuç ──
  const totalAcc = await prisma.signal.count({ where: { wasAccurate: { not: null } } });
  const accurate = await prisma.signal.count({ where: { wasAccurate: true } });
  const verdictAcc = await prisma.dailySummary.count({ where: { verdictAccurate: true } });
  const verdictInacc = await prisma.dailySummary.count({ where: { verdictAccurate: false } });

  console.log("═══ SONUÇ ═══");
  console.log(`Sinyal outcome: 1D=${sig1D}, 5D=${sig5D}, 10D=${sig10D}`);
  console.log(`Verdict outcome: 1D=${ver1D}, 5D=${ver5D}, 10D=${ver10D}, 20D=${ver20D}`);
  console.log(`\nSinyal accuracy: ${accurate}/${totalAcc} = ${totalAcc > 0 ? Math.round(accurate/totalAcc*100) : 0}%`);
  console.log(`Verdict accuracy: ${verdictAcc}/${verdictAcc+verdictInacc} = ${verdictAcc+verdictInacc > 0 ? Math.round(verdictAcc/(verdictAcc+verdictInacc)*100) : 0}%`);

  await prisma.$disconnect();
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
