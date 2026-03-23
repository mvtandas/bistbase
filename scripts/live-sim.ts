/**
 * Canlı Sistem Simülasyonu
 * DB'deki gerçek verdiktleri (ScreenerSnapshot) kullanarak paper trading simülasyonu
 * Tüm veri dahil: fundamental + sentiment + makro + multi-timeframe
 *
 * Kullanım: npx tsx scripts/live-sim.ts --scope bist30 --days 60
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { generateExitRules } from "../src/lib/stock/exit-rules";
import { calculateCommission } from "../src/lib/stock/bist-constants";
import { BIST30, BIST50, BIST100 } from "../src/lib/constants";
import type { HistoricalBar } from "../src/lib/stock/technicals";
import type { VerdictAction } from "../src/lib/stock/verdict";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ═══ Config ═══

const MAX_POSITIONS = 10;
const MIN_CONFIDENCE = 30;

interface Position {
  stockCode: string;
  lots: number;
  entryPrice: number;
  entryDate: string;
  stopLoss: number;
  takeProfit: number;
  trailingStop: number | null;
  verdictAction: string;
  confidence: number;
  maxDays: number;
  dayCount: number;
}

interface ClosedTrade {
  stockCode: string;
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  lots: number;
  pnl: number;
  pnlPct: number;
  exitReason: string;
  verdictAction: string;
  holdingDays: number;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const getArg = (name: string, def: string) => {
    const eq = args.find(a => a.startsWith(`--${name}=`))?.split("=")[1];
    if (eq) return eq;
    const idx = args.indexOf(`--${name}`);
    if (idx >= 0 && idx + 1 < args.length) return args[idx + 1];
    return def;
  };
  return {
    scope: getArg("scope", "bist30"),
    days: parseInt(getArg("days", "60")),
    capital: parseInt(getArg("capital", "100000")),
  };
}

function getScopeStocks(scope: string): string[] {
  switch (scope) {
    case "bist30": return [...new Set(BIST30)];
    case "bist50": return [...new Set(BIST50)];
    case "bist100": return [...new Set(BIST100)];
    default: return [...new Set(BIST30)];
  }
}

async function main() {
  const { scope, days, capital } = parseArgs();
  const stocks = getScopeStocks(scope);
  const barsDir = join(process.cwd(), "data", "bars");

  console.log(`\n═══ CANLI SİSTEM SİMÜLASYONU ═══`);
  console.log(`Scope: ${scope.toUpperCase()} | Süre: ${days} gün | Sermaye: ₺${capital.toLocaleString()}`);
  console.log(`Veri kaynağı: DailySummary + ScreenerSnapshot (GERÇEK verdiktler)\n`);

  // ── 1. DB'den verdikt geçmişini çek ──
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  // DailySummary'den portföy hisselerinin verdiktleri
  const dailyVerdicts = await prisma.dailySummary.findMany({
    where: {
      stockCode: { in: stocks },
      date: { gte: cutoff },
      verdictAction: { not: null },
      status: "COMPLETED",
      timeframe: "daily",
    },
    select: {
      stockCode: true,
      date: true,
      closePrice: true,
      verdictAction: true,
      verdictConfidence: true,
      compositeScore: true,
    },
    orderBy: { date: "asc" },
  });

  // ScreenerSnapshot'tan ek verdiktler (DailySummary'de olmayanlar)
  const screenerVerdicts = await prisma.screenerSnapshot.findMany({
    where: {
      stockCode: { in: stocks },
      date: { gte: cutoff },
      verdictAction: { not: null },
    },
    select: {
      stockCode: true,
      date: true,
      price: true,
      verdictAction: true,
      verdictConfidence: true,
      compositeScore: true,
    },
    orderBy: { date: "asc" },
  });

  // Birleştir — DailySummary öncelikli, yoksa ScreenerSnapshot
  type VerdictEntry = { stockCode: string; date: Date; price: number | null; action: string; confidence: number | null; score: number | null };
  const verdictMap = new Map<string, VerdictEntry>(); // key: stockCode|date

  for (const v of screenerVerdicts) {
    const key = `${v.stockCode}|${v.date.toISOString().split("T")[0]}`;
    verdictMap.set(key, { stockCode: v.stockCode, date: v.date, price: v.price, action: v.verdictAction!, confidence: v.verdictConfidence, score: v.compositeScore });
  }
  for (const v of dailyVerdicts) {
    const key = `${v.stockCode}|${v.date.toISOString().split("T")[0]}`;
    verdictMap.set(key, { stockCode: v.stockCode, date: v.date, price: v.closePrice, action: v.verdictAction!, confidence: v.verdictConfidence, score: v.compositeScore });
  }

  // Benzersiz tarihler
  const allDates = [...new Set([...verdictMap.values()].map(v => v.date.toISOString().split("T")[0]))].sort();

  console.log(`Verdikt sayısı: ${verdictMap.size} (${allDates.length} gün, ${stocks.length} hisse)`);
  if (allDates.length === 0) {
    console.log("Verdikt verisi yok! Önce analyze cron çalıştırılmalı.");
    await prisma.$disconnect();
    return;
  }

  // Bar verisi yükle (SL/TP kontrolü için)
  const allBars: Record<string, HistoricalBar[]> = {};
  for (const code of stocks) {
    const file = join(barsDir, `${code}.json`);
    if (existsSync(file)) allBars[code] = JSON.parse(readFileSync(file, "utf-8"));
  }

  // ── 2. Simülasyon ──
  let cash = capital;
  let peakValue = capital;
  const positions: Position[] = [];
  const closedTrades: ClosedTrade[] = [];

  console.log(`\nTarih       Portföy     Nakit      Açık  İşlem`);
  console.log("─".repeat(80));

  for (const date of allDates) {
    const dayActions: string[] = [];

    // Check existing positions
    for (let pi = positions.length - 1; pi >= 0; pi--) {
      const pos = positions[pi];
      const bars = allBars[pos.stockCode];
      const todayBar = bars?.find(b => b.date === date);
      if (!todayBar) continue;

      pos.dayCount++;
      const price = todayBar.close;
      const high = todayBar.high;
      const low = todayBar.low;

      // Trailing stop
      if (price > pos.entryPrice * 1.03 && pos.trailingStop === null) {
        pos.trailingStop = price - (pos.entryPrice - pos.stopLoss) * 0.8;
      }
      if (pos.trailingStop) {
        const newTrail = price - (pos.entryPrice - pos.stopLoss) * 0.8;
        if (newTrail > pos.trailingStop) pos.trailingStop = newTrail;
      }

      const activeStop = pos.trailingStop ?? pos.stopLoss;
      let exitReason: string | null = null;
      let exitPrice = price;

      if (low <= activeStop) { exitReason = "SL"; exitPrice = activeStop; }
      else if (high >= pos.takeProfit) { exitReason = "TP"; exitPrice = pos.takeProfit; }
      else if (pos.dayCount >= pos.maxDays) { exitReason = "TIME"; exitPrice = price; }

      // Verdikt değişimi kontrolü
      if (!exitReason) {
        const todayVerdict = verdictMap.get(`${pos.stockCode}|${date}`);
        if (todayVerdict && (todayVerdict.action === "SAT" || todayVerdict.action === "GUCLU_SAT")) {
          exitReason = "VERDICT";
          exitPrice = price;
        }
      }

      if (exitReason) {
        const grossValue = pos.lots * exitPrice;
        const entryValue = pos.lots * pos.entryPrice;
        const commission = calculateCommission(grossValue) + calculateCommission(entryValue);
        const pnl = (exitPrice - pos.entryPrice) * pos.lots - commission;
        const pnlPct = (pnl / entryValue) * 100;

        closedTrades.push({
          stockCode: pos.stockCode, entryDate: pos.entryDate, exitDate: date,
          entryPrice: pos.entryPrice, exitPrice, lots: pos.lots,
          pnl: Math.round(pnl), pnlPct: Math.round(pnlPct * 10) / 10,
          exitReason, verdictAction: pos.verdictAction, holdingDays: pos.dayCount,
        });

        cash += grossValue - calculateCommission(grossValue);
        positions.splice(pi, 1);
        const c = pnl >= 0 ? "\x1b[32m" : "\x1b[31m";
        dayActions.push(`${pos.stockCode} ${exitReason} ${c}${pnl >= 0 ? "+" : ""}₺${Math.round(pnl)}\x1b[0m`);
      }
    }

    // Open new positions
    if (positions.length < MAX_POSITIONS) {
      const candidates: VerdictEntry[] = [];
      for (const code of stocks) {
        if (positions.some(p => p.stockCode === code)) continue;
        const v = verdictMap.get(`${code}|${date}`);
        if (!v || !v.price) continue;
        if (v.action !== "GUCLU_AL" && v.action !== "AL") continue;
        if ((v.confidence ?? 0) < MIN_CONFIDENCE) continue;
        candidates.push(v);
      }

      candidates.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));

      for (const c of candidates) {
        if (positions.length >= MAX_POSITIONS) break;
        const price = c.price!;

        // ATR bilgisi yoksa fiyatın %5'ini kullan
        const exitRules = generateExitRules(c.action as VerdictAction, price, price * 0.05, c.confidence ?? 50);

        const posValue = capital * 0.10; // Sermayenin %10'u per pozisyon
        const lots = Math.floor(posValue / price);
        if (lots < 1) continue;
        const totalCost = lots * price * 1.002;
        if (totalCost > cash * 0.90) continue;

        positions.push({
          stockCode: c.stockCode, lots, entryPrice: price, entryDate: date,
          stopLoss: exitRules.stopLoss, takeProfit: exitRules.takeProfit,
          trailingStop: null, verdictAction: c.action,
          confidence: c.confidence ?? 50, maxDays: exitRules.maxHoldingDays, dayCount: 0,
        });

        cash -= totalCost;
        dayActions.push(`\x1b[36m+${c.stockCode} ${c.action}(${c.confidence ?? "?"})\x1b[0m`);
      }
    }

    // Snapshot
    let posValue = 0;
    for (const pos of positions) {
      const bars = allBars[pos.stockCode];
      const bar = bars?.find(b => b.date === date);
      posValue += pos.lots * (bar?.close ?? pos.entryPrice);
    }
    const total = cash + posValue;
    if (total > peakValue) peakValue = total;

    if (dayActions.length > 0) {
      console.log(`${date}  ₺${Math.round(total).toLocaleString().padStart(9)}  ₺${Math.round(cash).toLocaleString().padStart(9)}  ${String(positions.length).padStart(4)}  ${dayActions.join(" | ")}`);
    }
  }

  // Summary
  const lastDate = allDates[allDates.length - 1];
  let finalPosValue = 0;
  for (const pos of positions) {
    const bars = allBars[pos.stockCode];
    const bar = bars?.find(b => b.date === lastDate);
    finalPosValue += pos.lots * (bar?.close ?? pos.entryPrice);
  }
  const finalValue = cash + finalPosValue;
  const totalReturn = ((finalValue - capital) / capital) * 100;
  const wins = closedTrades.filter(t => t.pnl > 0);
  const losses = closedTrades.filter(t => t.pnl <= 0);
  const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length * 100) : 0;
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnlPct, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + t.pnlPct, 0) / losses.length : 0;
  const maxDD = ((Math.min(finalValue, ...closedTrades.map(() => cash)) - peakValue) / peakValue) * 100;

  console.log("\n═══ SONUÇLAR (GERÇEK VERDİKTLER) ═══\n");
  console.log(`Dönem: ${allDates[0]} → ${lastDate} (${allDates.length} iş günü)`);
  console.log(`Portföy: ₺${capital.toLocaleString()} → ₺${Math.round(finalValue).toLocaleString()} (${totalReturn >= 0 ? "+" : ""}%${totalReturn.toFixed(1)})`);
  console.log(`Trade: ${closedTrades.length} | Win: ${wins.length} | Loss: ${losses.length} | WR: %${winRate.toFixed(0)}`);
  console.log(`Ort. kazanç: +%${avgWin.toFixed(1)} | Ort. kayıp: %${avgLoss.toFixed(1)}`);
  console.log(`Açık pozisyon: ${positions.length}`);

  if (closedTrades.length > 0) {
    console.log("\n═══ TRADE LOG ═══\n");
    for (const t of closedTrades) {
      const c = t.pnl >= 0 ? "\x1b[32m" : "\x1b[31m";
      console.log(`${t.entryDate} → ${t.exitDate} | ${t.stockCode.padEnd(7)} ${t.verdictAction.padEnd(10)} | ${c}${t.pnl >= 0 ? "+" : ""}₺${t.pnl} (${t.pnl >= 0 ? "+" : ""}${t.pnlPct}%)\x1b[0m | ${t.exitReason} ${t.holdingDays}g`);
    }
  }

  if (positions.length > 0) {
    console.log("\n═══ AÇIK POZİSYONLAR ═══\n");
    for (const p of positions) {
      const bars = allBars[p.stockCode];
      const last = bars?.[bars.length - 1];
      const cur = last?.close ?? p.entryPrice;
      const pnl = ((cur - p.entryPrice) / p.entryPrice * 100).toFixed(1);
      console.log(`${p.stockCode.padEnd(7)} ${p.verdictAction.padEnd(10)} | ₺${p.entryPrice.toFixed(2)} → ₺${cur.toFixed(2)} | ${Number(pnl) >= 0 ? "+" : ""}%${pnl} | ${p.dayCount}/${p.maxDays}g`);
    }
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
