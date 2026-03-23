/**
 * Paper Trading Simülasyonu
 * Geçmiş verilerle tam pozisyon yönetimi: entry/exit, SL/TP, trailing, equity curve
 * Kullanım: npx tsx scripts/paper-sim.ts --scope bist30 --days 90 --capital 100000
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { calculateFullTechnicals, type HistoricalBar } from "../src/lib/stock/technicals";
import { detectSignals } from "../src/lib/stock/signals";
import { calculateCompositeScore } from "../src/lib/stock/scoring";
import { calculateVerdict, type VerdictInput } from "../src/lib/stock/verdict";
import { calculateExtraIndicators } from "../src/lib/stock/extra-indicators";
import { generateExitRules } from "../src/lib/stock/exit-rules";
import { calculatePositionSize } from "../src/lib/stock/position-sizing";
import { calculateCommission, ROUND_TRIP_COST } from "../src/lib/stock/bist-constants";
import { BLACKLISTED_SIGNALS } from "../src/lib/stock/signal-filter";
import { BIST30, BIST50, BIST100 } from "../src/lib/constants";
import type { VerdictAction } from "../src/lib/stock/verdict";

// ═══ Types ═══

interface Position {
  stockCode: string;
  action: "BUY" | "SELL";
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

interface DaySnapshot {
  date: string;
  portfolioValue: number;
  cash: number;
  openPositions: number;
  dailyPnl: number;
  drawdown: number;
}

// ═══ Config ═══

const MAX_POSITIONS = 10;
const MIN_CONFIDENCE = 5; // Confidence düşük çıkıyor (fundamental/sentiment yok) — eşiği kaldır

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
    days: parseInt(getArg("days", "90")),
    capital: parseInt(getArg("capital", "100000")),
  };
}

function getStocks(scope: string): string[] {
  switch (scope) {
    case "bist30": return [...new Set(BIST30)];
    case "bist50": return [...new Set(BIST50)];
    case "bist100": return [...new Set(BIST100)];
    default: return [...new Set(BIST30)];
  }
}

// ═══ Main ═══

async function main() {
  const { scope, days, capital } = parseArgs();
  const stocks = getStocks(scope);
  const barsDir = join(process.cwd(), "data", "bars");
  const macroFile = join(process.cwd(), "data", "macro.json");

  console.log(`\n═══ PAPER TRADING SİMÜLASYONU ═══`);
  console.log(`Scope: ${scope.toUpperCase()} (${stocks.length} hisse) | Süre: ${days} gün | Sermaye: ₺${capital.toLocaleString()}\n`);

  // Load all bars
  const allBars: Record<string, HistoricalBar[]> = {};
  for (const code of stocks) {
    const file = join(barsDir, `${code}.json`);
    if (existsSync(file)) allBars[code] = JSON.parse(readFileSync(file, "utf-8"));
  }

  // Load macro
  const macro = existsSync(macroFile) ? JSON.parse(readFileSync(macroFile, "utf-8")) : null;
  const bistBars: HistoricalBar[] = macro?.bist100 ?? [];
  const bistMap = new Map(bistBars.map((b: HistoricalBar) => [b.date, b.close]));

  // Find common trading dates (last N days)
  const refBars = allBars[stocks[0]] ?? [];
  const allDates = refBars.map(b => b.date);
  const simDates = allDates.slice(-days - 1); // +1 for initial day

  if (simDates.length < 2) {
    console.log("Yeterli veri yok.");
    return;
  }

  // State
  let cash = capital;
  let peakValue = capital;
  const positions: Position[] = [];
  const closedTrades: ClosedTrade[] = [];
  const equity: DaySnapshot[] = [];

  console.log(`Başlangıç: ${simDates[0]} | Bitiş: ${simDates[simDates.length - 1]}\n`);
  console.log("Tarih       Portföy     Nakit      Açık  Gün P&L    İşlem");
  console.log("─".repeat(85));

  for (let di = 0; di < simDates.length; di++) {
    const date = simDates[di];
    const dayActions: string[] = [];

    // ── 1. Check existing positions (SL/TP/Time/Trailing) ──
    for (let pi = positions.length - 1; pi >= 0; pi--) {
      const pos = positions[pi];
      const bars = allBars[pos.stockCode];
      if (!bars) continue;

      const todayBar = bars.find(b => b.date === date);
      if (!todayBar) continue;

      pos.dayCount++;
      const price = todayBar.close;
      const high = todayBar.high;
      const low = todayBar.low;
      const isLong = pos.action === "BUY";

      // Trailing stop update
      if (isLong && price > pos.entryPrice * 1.03 && pos.trailingStop === null) {
        pos.trailingStop = price - (pos.entryPrice - pos.stopLoss) * 0.8;
      }
      if (pos.trailingStop && isLong) {
        const newTrail = price - (pos.entryPrice - pos.stopLoss) * 0.8;
        if (newTrail > pos.trailingStop) pos.trailingStop = newTrail;
      }

      const activeStop = pos.trailingStop ?? pos.stopLoss;
      let exitReason: string | null = null;
      let exitPrice = price;

      // Check SL/TP with intraday high/low
      if (isLong) {
        if (low <= activeStop) { exitReason = "SL"; exitPrice = activeStop; }
        else if (high >= pos.takeProfit) { exitReason = "TP"; exitPrice = pos.takeProfit; }
      } else {
        if (high >= activeStop) { exitReason = "SL"; exitPrice = activeStop; }
        else if (low <= pos.takeProfit) { exitReason = "TP"; exitPrice = pos.takeProfit; }
      }

      // Time expiry
      if (!exitReason && pos.dayCount >= pos.maxDays) {
        exitReason = "TIME";
        exitPrice = price;
      }

      if (exitReason) {
        const grossValue = pos.lots * exitPrice;
        const entryValue = pos.lots * pos.entryPrice;
        const commission = calculateCommission(grossValue) + calculateCommission(entryValue);
        const pnl = isLong
          ? (exitPrice - pos.entryPrice) * pos.lots - commission
          : (pos.entryPrice - exitPrice) * pos.lots - commission;
        const pnlPct = (pnl / entryValue) * 100;

        closedTrades.push({
          stockCode: pos.stockCode,
          entryDate: pos.entryDate,
          exitDate: date,
          entryPrice: pos.entryPrice,
          exitPrice,
          lots: pos.lots,
          pnl: Math.round(pnl * 100) / 100,
          pnlPct: Math.round(pnlPct * 100) / 100,
          exitReason,
          verdictAction: pos.verdictAction,
          holdingDays: pos.dayCount,
        });

        cash += grossValue - calculateCommission(grossValue);
        positions.splice(pi, 1);
        const pnlStr = pnl >= 0 ? `\x1b[32m+₺${pnl.toFixed(0)}\x1b[0m` : `\x1b[31m-₺${Math.abs(pnl).toFixed(0)}\x1b[0m`;
        dayActions.push(`${pos.stockCode} ${exitReason} ${pnlStr}`);
      }
    }

    // ── 2. Open new positions ──
    if (positions.length < MAX_POSITIONS) {
      const candidates: { code: string; verdict: string; confidence: number; price: number; atr: number | null }[] = [];

      for (const code of stocks) {
        if (positions.some(p => p.stockCode === code)) continue;
        const bars = allBars[code];
        if (!bars) continue;

        const barIdx = bars.findIndex(b => b.date === date);
        if (barIdx < 200) continue;

        const window = bars.slice(0, barIdx + 1);
        const price = bars[barIdx].close;

        try {
          const tech = calculateFullTechnicals(window, price, bars[barIdx].volume);
          const sigs = detectSignals(tech, price)
            .filter(s => !BLACKLISTED_SIGNALS.has(`${s.type}|${s.direction}`));
          const extra = calculateExtraIndicators(window, tech?.bbUpper, tech?.bbLower);
          const score = calculateCompositeScore(tech, price, 0, null, null);
          const v = calculateVerdict({
            price,
            technicals: tech as unknown as Record<string, unknown>,
            extraIndicators: extra as unknown as VerdictInput["extraIndicators"],
            score, fundamentalScore: null, signals: sigs, signalCombination: null,
            signalAccuracy: {}, multiTimeframe: null, macroData: null,
            riskMetrics: null, sentimentValue: 0,
          });

          if ((v.action === "GUCLU_AL" || v.action === "AL") && v.confidence >= MIN_CONFIDENCE) {
            candidates.push({ code, verdict: v.action, confidence: v.confidence, price, atr: tech.atr14 });
          }
        } catch { /* skip */ }
      }

      // Top candidates by confidence
      candidates.sort((a, b) => b.confidence - a.confidence);

      for (const c of candidates) {
        if (positions.length >= MAX_POSITIONS) break;

        const exitRules = generateExitRules(c.verdict as VerdictAction, c.price, c.atr, c.confidence);
        const sizing = calculatePositionSize(cash, c.price, exitRules.stopLoss, c.verdict as VerdictAction, c.confidence);

        if (sizing.lots < 1 || sizing.totalCost > cash * 0.90) continue;

        // Minimum pozisyon: sermayenin %8'i (çok küçük pozisyon açma)
        if (sizing.positionValue < capital * 0.08) {
          const minLots = Math.ceil((capital * 0.08) / c.price);
          if (minLots * c.price * 1.002 <= cash * 0.90) sizing.lots = minLots;
        }

        positions.push({
          stockCode: c.code,
          action: "BUY",
          lots: sizing.lots,
          entryPrice: c.price,
          entryDate: date,
          stopLoss: exitRules.stopLoss,
          takeProfit: exitRules.takeProfit,
          trailingStop: null,
          verdictAction: c.verdict,
          confidence: c.confidence,
          maxDays: exitRules.maxHoldingDays,
          dayCount: 0,
        });

        cash -= sizing.totalCost;
        dayActions.push(`\x1b[36m+${c.code} ${c.verdict}(${c.confidence})\x1b[0m`);
      }
    }

    // ── 3. Daily snapshot ──
    let positionsValue = 0;
    for (const pos of positions) {
      const bars = allBars[pos.stockCode];
      const todayBar = bars?.find(b => b.date === date);
      positionsValue += pos.lots * (todayBar?.close ?? pos.entryPrice);
    }

    const portfolioValue = cash + positionsValue;
    if (portfolioValue > peakValue) peakValue = portfolioValue;
    const drawdown = ((portfolioValue - peakValue) / peakValue) * 100;
    const prevValue = equity.length > 0 ? equity[equity.length - 1].portfolioValue : capital;
    const dailyPnl = portfolioValue - prevValue;

    equity.push({
      date,
      portfolioValue: Math.round(portfolioValue),
      cash: Math.round(cash),
      openPositions: positions.length,
      dailyPnl: Math.round(dailyPnl),
      drawdown: Math.round(drawdown * 10) / 10,
    });

    // Print daily line
    const pnlColor = dailyPnl >= 0 ? "\x1b[32m" : "\x1b[31m";
    const actions = dayActions.length > 0 ? dayActions.join(" | ") : "";
    if (dayActions.length > 0 || di === 0 || di === simDates.length - 1 || di % 5 === 0) {
      console.log(
        `${date}  ₺${portfolioValue.toLocaleString().padStart(9)}  ₺${Math.round(cash).toLocaleString().padStart(9)}  ${String(positions.length).padStart(4)}  ${pnlColor}${(dailyPnl >= 0 ? "+" : "") + dailyPnl.toLocaleString()}${"\x1b[0m".padEnd(10)}  ${actions}`
      );
    }
  }

  // ── Summary ──
  const finalValue = equity[equity.length - 1]?.portfolioValue ?? capital;
  const totalReturn = ((finalValue - capital) / capital) * 100;
  const wins = closedTrades.filter(t => t.pnl > 0);
  const losses = closedTrades.filter(t => t.pnl <= 0);
  const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnlPct, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + t.pnlPct, 0) / losses.length : 0;
  const maxDD = Math.min(...equity.map(e => e.drawdown));

  // BIST100 benchmark
  const bistStart = bistMap.get(simDates[0]);
  const bistEnd = bistMap.get(simDates[simDates.length - 1]);
  const bistReturn = bistStart && bistEnd ? ((bistEnd - bistStart) / bistStart * 100) : 0;

  console.log("\n═══ SONUÇLAR ═══\n");
  console.log(`Dönem: ${simDates[0]} → ${simDates[simDates.length - 1]} (${days} gün)`);
  console.log(`Portföy: ₺${capital.toLocaleString()} → ₺${finalValue.toLocaleString()} (${totalReturn >= 0 ? "+" : ""}%${totalReturn.toFixed(1)})`);
  console.log(`BIST100: ${bistReturn >= 0 ? "+" : ""}%${bistReturn.toFixed(1)}`);
  console.log(`Alpha: ${totalReturn - bistReturn >= 0 ? "+" : ""}%${(totalReturn - bistReturn).toFixed(1)}`);
  console.log(`\nToplam işlem: ${closedTrades.length} | Win: ${wins.length} | Loss: ${losses.length} | WR: %${winRate.toFixed(0)}`);
  console.log(`Ort. kazanç: +%${avgWin.toFixed(1)} | Ort. kayıp: %${avgLoss.toFixed(1)}`);
  console.log(`Max drawdown: %${maxDD.toFixed(1)}`);
  console.log(`Açık pozisyon: ${positions.length}`);

  // Trade details
  if (closedTrades.length > 0) {
    console.log("\n═══ TRADE LOG ═══\n");
    for (const t of closedTrades) {
      const pnlColor = t.pnl >= 0 ? "\x1b[32m" : "\x1b[31m";
      console.log(
        `${t.entryDate} → ${t.exitDate} | ${t.stockCode.padEnd(7)} ${t.verdictAction.padEnd(10)} | ₺${t.entryPrice.toFixed(2)} → ₺${t.exitPrice.toFixed(2)} | ${pnlColor}${t.pnl >= 0 ? "+" : ""}₺${t.pnl.toFixed(0)} (${t.pnl >= 0 ? "+" : ""}${t.pnlPct.toFixed(1)}%)\x1b[0m | ${t.exitReason} ${t.holdingDays}g`
      );
    }
  }

  // Open positions
  if (positions.length > 0) {
    console.log("\n═══ AÇIK POZİSYONLAR ═══\n");
    for (const p of positions) {
      const bars = allBars[p.stockCode];
      const lastBar = bars?.[bars.length - 1];
      const currentPrice = lastBar?.close ?? p.entryPrice;
      const unrealized = ((currentPrice - p.entryPrice) / p.entryPrice * 100);
      console.log(
        `${p.stockCode.padEnd(7)} ${p.verdictAction.padEnd(10)} | ₺${p.entryPrice.toFixed(2)} → ₺${currentPrice.toFixed(2)} | ${unrealized >= 0 ? "+" : ""}%${unrealized.toFixed(1)} | ${p.dayCount}/${p.maxDays}g`
      );
    }
  }
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
