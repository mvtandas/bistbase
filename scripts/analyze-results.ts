/**
 * Backtest Results Analyzer
 * Sonuçları okunabilir tablolar halinde gösterir.
 * Kullanım:
 *   npx tsx scripts/analyze-results.ts data/results/backtest-v1.json
 *   npx tsx scripts/analyze-results.ts --compare data/results/v1.json data/results/v2.json
 */

import { readFileSync } from "fs";
import { ROUND_TRIP_COST } from "../src/lib/stock/bist-constants";

// ═══ Types ═══

interface HorizonStats {
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  grossExpectancy: number;
  netExpectancy: number;
  count: number;
}

interface BacktestResult {
  meta: {
    scope: string;
    name: string;
    stocks: number;
    skipped: number;
    totalSignals: number;
    totalVerdicts: number;
    date: string;
    durationSeconds: number;
  };
  signalPerformance: Record<string, Record<string, HorizonStats>>;
  verdictPerformance: Record<string, Record<string, { winRate: number; avgReturn: number; count: number }>>;
  byIndex: Record<string, { avgWinRate: number; signalCount: number }>;
  overall: { avgWinRate: number; signalTypesAnalyzed: number; signalTypesWithData: number };
}

// ═══ Helpers ═══

function pad(s: string, n: number, align: "left" | "right" = "left"): string {
  if (align === "right") return s.padStart(n);
  return s.padEnd(n);
}

function colorize(val: number, goodThreshold: number, badThreshold: number): string {
  // ANSI colors for terminal
  if (val >= goodThreshold) return `\x1b[32m${val.toFixed(1)}\x1b[0m`; // green
  if (val <= badThreshold) return `\x1b[31m${val.toFixed(1)}\x1b[0m`; // red
  return `\x1b[33m${val.toFixed(1)}\x1b[0m`; // yellow
}

function getBestHorizon(horizons: Record<string, HorizonStats>): { horizon: string; stats: HorizonStats } | null {
  let best: { horizon: string; stats: HorizonStats } | null = null;
  for (const [h, s] of Object.entries(horizons)) {
    if (s.count < 20) continue;
    if (!best || s.netExpectancy > best.stats.netExpectancy) {
      best = { horizon: h, stats: s };
    }
  }
  return best;
}

// ═══ Display ═══

function displayResult(result: BacktestResult) {
  const { meta, signalPerformance, verdictPerformance, byIndex, overall } = result;

  console.log(`\n\x1b[1m═══ ${meta.scope.toUpperCase()} BACKTEST: ${meta.name} ═══\x1b[0m`);
  console.log(`Tarih: ${meta.date} | Hisse: ${meta.stocks} | Sinyal: ${meta.totalSignals.toLocaleString()} | Verdikt: ${meta.totalVerdicts.toLocaleString()}`);
  console.log(`Süre: ${Math.floor(meta.durationSeconds / 60)}dk ${meta.durationSeconds % 60}sn | Komisyon: %${(ROUND_TRIP_COST * 100).toFixed(2)} round-trip`);
  console.log(`Ort. Win Rate (10D): \x1b[1m${colorize(overall.avgWinRate, 55, 45)}%\x1b[0m\n`);

  // ── Signal Performance Table ──
  type SignalRow = { key: string; horizon: string; stats: HorizonStats };
  const rows: SignalRow[] = [];

  for (const [key, horizons] of Object.entries(signalPerformance)) {
    const best = getBestHorizon(horizons);
    if (best) rows.push({ key, horizon: best.horizon, stats: best.stats });
  }

  // Sort by net expectancy
  rows.sort((a, b) => b.stats.netExpectancy - a.stats.netExpectancy);

  const profitable = rows.filter(r => r.stats.netExpectancy > 0);
  const unprofitable = rows.filter(r => r.stats.netExpectancy <= 0);

  console.log(`\x1b[32m\x1b[1m▲ KARLI SİNYALLER (${profitable.length})\x1b[0m`);
  console.log("┌" + "─".repeat(35) + "┬" + "──────┬────────┬───────┬──────────┬──────────┐");
  console.log("│" + pad(" Sinyal", 35) + "│ Adet │ WR %   │ PF    │ Brüt Exp │ Net Exp  │");
  console.log("├" + "─".repeat(35) + "┼" + "──────┼────────┼───────┼──────────┼──────────┤");

  for (const row of profitable) {
    const [type, dir] = row.key.split("|");
    const label = `${type} ${dir === "BEARISH" ? "↓" : "↑"} (${row.horizon})`;
    console.log(
      "│" + pad(` ${label}`, 35) +
      "│" + pad(`${row.stats.count}`, 6, "right") +
      "│" + pad(` ${colorize(row.stats.winRate, 55, 45)}%`, 16, "right") +
      "│" + pad(` ${row.stats.profitFactor.toFixed(2)}`, 7, "right") +
      "│" + pad(` ${row.stats.grossExpectancy >= 0 ? "+" : ""}${row.stats.grossExpectancy.toFixed(2)}%`, 10, "right") +
      "│" + pad(` \x1b[32m${row.stats.netExpectancy >= 0 ? "+" : ""}${row.stats.netExpectancy.toFixed(2)}%\x1b[0m`, 18, "right") +
      "│"
    );
  }
  console.log("└" + "─".repeat(35) + "┴" + "──────┴────────┴───────┴──────────┴──────────┘");

  console.log(`\n\x1b[31m\x1b[1m▼ ZARALI SİNYALLER (${unprofitable.length})\x1b[0m`);
  console.log("┌" + "─".repeat(35) + "┬" + "──────┬────────┬───────┬──────────┬──────────┐");
  console.log("│" + pad(" Sinyal", 35) + "│ Adet │ WR %   │ PF    │ Brüt Exp │ Net Exp  │");
  console.log("├" + "─".repeat(35) + "┼" + "──────┼────────┼───────┼──────────┼──────────┤");

  for (const row of unprofitable.slice(0, 20)) {
    const [type, dir] = row.key.split("|");
    const label = `${type} ${dir === "BEARISH" ? "↓" : "↑"} (${row.horizon})`;
    console.log(
      "│" + pad(` ${label}`, 35) +
      "│" + pad(`${row.stats.count}`, 6, "right") +
      "│" + pad(` ${colorize(row.stats.winRate, 55, 45)}%`, 16, "right") +
      "│" + pad(` ${row.stats.profitFactor.toFixed(2)}`, 7, "right") +
      "│" + pad(` ${row.stats.grossExpectancy >= 0 ? "+" : ""}${row.stats.grossExpectancy.toFixed(2)}%`, 10, "right") +
      "│" + pad(` \x1b[31m${row.stats.netExpectancy >= 0 ? "+" : ""}${row.stats.netExpectancy.toFixed(2)}%\x1b[0m`, 18, "right") +
      "│"
    );
  }
  console.log("└" + "─".repeat(35) + "┴" + "──────┴────────┴───────┴──────────┴──────────┘");

  // ── Verdict Performance ──
  console.log(`\n\x1b[1m═══ VERDİKT PERFORMANSI ═══\x1b[0m`);
  const verdictOrder = ["GUCLU_AL", "AL", "TUT", "SAT", "GUCLU_SAT"];
  for (const action of verdictOrder) {
    const horizons = verdictPerformance[action];
    if (!horizons) continue;
    const h20 = horizons["20D"] ?? horizons["10D"] ?? horizons["5D"];
    if (!h20) continue;
    const hLabel = horizons["20D"] ? "20D" : horizons["10D"] ? "10D" : "5D";
    console.log(
      `  ${pad(action, 12)} │ ${hLabel}: WR ${colorize(h20.winRate, 55, 45)}% │ Ort. Getiri: ${h20.avgReturn >= 0 ? "+" : ""}${h20.avgReturn.toFixed(2)}% │ ${h20.count} karar`
    );
  }

  // ── Index Comparison ──
  if (Object.keys(byIndex).length > 1) {
    console.log(`\n\x1b[1m═══ INDEX KARŞILAŞTIRMA (10D) ═══\x1b[0m`);
    for (const [idx, data] of Object.entries(byIndex).sort((a, b) => b[1].avgWinRate - a[1].avgWinRate)) {
      console.log(`  ${pad(idx.toUpperCase(), 10)} │ WR: ${colorize(data.avgWinRate, 55, 45)}% │ ${data.signalCount.toLocaleString()} sinyal`);
    }
  }

  console.log();
}

function displayComparison(r1: BacktestResult, r2: BacktestResult) {
  console.log(`\n\x1b[1m═══ KARŞILAŞTIRMA: ${r1.meta.name} vs ${r2.meta.name} ═══\x1b[0m\n`);

  console.log(`Genel Win Rate: ${r1.overall.avgWinRate}% → ${r2.overall.avgWinRate}% (${r2.overall.avgWinRate >= r1.overall.avgWinRate ? "\x1b[32m↑" : "\x1b[31m↓"} ${Math.abs(r2.overall.avgWinRate - r1.overall.avgWinRate).toFixed(1)}%\x1b[0m)`);

  // Compare signal types that exist in both
  const allKeys = new Set([...Object.keys(r1.signalPerformance), ...Object.keys(r2.signalPerformance)]);
  const changes: { key: string; oldExp: number; newExp: number; diff: number }[] = [];

  for (const key of allKeys) {
    const old = getBestHorizon(r1.signalPerformance[key] ?? {});
    const nw = getBestHorizon(r2.signalPerformance[key] ?? {});
    if (old && nw) {
      changes.push({ key, oldExp: old.stats.netExpectancy, newExp: nw.stats.netExpectancy, diff: nw.stats.netExpectancy - old.stats.netExpectancy });
    }
  }

  changes.sort((a, b) => b.diff - a.diff);

  console.log(`\n\x1b[32mEn çok iyileşen:\x1b[0m`);
  for (const c of changes.slice(0, 5)) {
    console.log(`  ${pad(c.key, 35)} ${c.oldExp.toFixed(2)}% → ${c.newExp.toFixed(2)}% (\x1b[32m+${c.diff.toFixed(2)}%\x1b[0m)`);
  }

  console.log(`\n\x1b[31mEn çok kötüleşen:\x1b[0m`);
  for (const c of changes.slice(-5).reverse()) {
    console.log(`  ${pad(c.key, 35)} ${c.oldExp.toFixed(2)}% → ${c.newExp.toFixed(2)}% (\x1b[31m${c.diff.toFixed(2)}%\x1b[0m)`);
  }

  console.log();
}

// ═══ Main ═══

function main() {
  const args = process.argv.slice(2);

  if (args.includes("--compare") || args.includes("-c")) {
    const files = args.filter(a => !a.startsWith("-"));
    if (files.length < 2) {
      console.error("Kullanım: npx tsx scripts/analyze-results.ts --compare dosya1.json dosya2.json");
      process.exit(1);
    }
    const r1: BacktestResult = JSON.parse(readFileSync(files[0], "utf-8"));
    const r2: BacktestResult = JSON.parse(readFileSync(files[1], "utf-8"));
    displayResult(r1);
    displayResult(r2);
    displayComparison(r1, r2);
  } else {
    const file = args.find(a => !a.startsWith("-"));
    if (!file) {
      console.error("Kullanım: npx tsx scripts/analyze-results.ts <sonuç-dosyası.json>");
      process.exit(1);
    }
    const result: BacktestResult = JSON.parse(readFileSync(file, "utf-8"));
    displayResult(result);
  }
}

main();
