/**
 * System Accuracy Backtest
 * Verdict, composite score ve sinyal doğruluğunu bütünsel olarak test eder.
 * Kullanım: npx tsx scripts/backtest-system.ts [--scope bist100|bist-all] [--name system-v1]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { calculateFullTechnicals, type HistoricalBar } from "../src/lib/stock/technicals";
import { detectSignals } from "../src/lib/stock/signals";
import { detectCandlestickPatterns } from "../src/lib/stock/candlesticks";
import { detectChartPatterns } from "../src/lib/stock/chart-patterns";
import { calculateCompositeScore } from "../src/lib/stock/scoring";
import { calculateVerdict, type VerdictInput, type Verdict } from "../src/lib/stock/verdict";
import { calculateExtraIndicators } from "../src/lib/stock/extra-indicators";
import { ROUND_TRIP_COST } from "../src/lib/stock/bist-constants";
import { BLACKLISTED_SIGNALS } from "../src/lib/stock/signal-filter";
import { scoreFundamentals, type FundamentalData, type FundamentalScore } from "../src/lib/stock/fundamentals";
import { BIST_ALL, BIST100, BIST50, BIST30 } from "../src/lib/constants";

// ═══ Types ═══

interface HorizonAgg {
  wins: number;
  total: number;
  returns: number[];
}

interface ScoreRangeAgg {
  [horizon: string]: HorizonAgg;
}

interface ConfidenceVerdictAgg {
  [action: string]: { [horizon: string]: HorizonAgg };
}

interface IndexVerdictAgg {
  verdictWins: number;
  verdictTotal: number;
  scores: number[];
  returns: number[]; // 10D returns
}

// ═══ Config ═══

const DATA_DIR = join(process.cwd(), "data");
const BARS_DIR = join(DATA_DIR, "bars");
const RESULTS_DIR = join(DATA_DIR, "results");
const MIN_BARS = 200;
const MIN_AVG_VOLUME = 500_000;
const MIN_SIGNAL_STRENGTH = 45;
const HORIZONS = ["1D", "5D", "10D", "20D"] as const;
const HORIZON_OFFSETS: Record<string, number> = { "1D": 1, "5D": 5, "10D": 10, "20D": 20 };
const SCORE_RANGES = ["0-40", "40-48", "48-55", "55-100"] as const;

// ═══ Helpers (backtest.ts ile aynı) ═══

function parseArgs() {
  const args = process.argv.slice(2);
  const scope = args.find(a => a.startsWith("--scope="))?.split("=")[1]
    ?? args[args.indexOf("--scope") + 1]
    ?? "bist100";
  const name = args.find(a => a.startsWith("--name="))?.split("=")[1]
    ?? args[args.indexOf("--name") + 1]
    ?? `system-${scope}`;
  return { scope, name };
}

function getStockList(scope: string): string[] {
  const s: Record<string, readonly string[]> = { "bist30": BIST30, "bist50": BIST50, "bist100": BIST100, "bist-all": BIST_ALL };
  return [...new Set(s[scope] ?? BIST100)];
}

function getIndexMembership(code: string): string[] {
  const idx: string[] = [];
  if ((BIST30 as readonly string[]).includes(code)) idx.push("bist30");
  if ((BIST50 as readonly string[]).includes(code)) idx.push("bist50");
  if ((BIST100 as readonly string[]).includes(code)) idx.push("bist100");
  return idx;
}

function loadBars(code: string): HistoricalBar[] | null {
  const p = join(BARS_DIR, `${code}.json`);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, "utf-8")); } catch { return null; }
}

function loadMacro(): Record<string, HistoricalBar[]> | null {
  const p = join(DATA_DIR, "macro.json");
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, "utf-8")); } catch { return null; }
}

function buildMacroMap(macro: Record<string, HistoricalBar[]>) {
  const map = new Map<string, { vix: number | null; bist100Change: number | null; usdTryChange: number | null; macroScore: number }>();
  const vixBars = macro.vix ?? [];
  const bist100Bars = macro.bist100 ?? [];
  const usdTryBars = macro.usdTry ?? [];
  const vixMap = new Map(vixBars.map(b => [b.date, b.close]));
  const bistMap = new Map(bist100Bars.map(b => [b.date, b]));
  const usdMap = new Map(usdTryBars.map(b => [b.date, b]));
  const allDates = new Set([...vixBars.map(b => b.date), ...bist100Bars.map(b => b.date), ...usdTryBars.map(b => b.date)]);

  for (const date of allDates) {
    const vix = vixMap.get(date) ?? null;
    const bistBar = bistMap.get(date);
    const usdBar = usdMap.get(date);
    const bist100Change = bistBar && bistBar.open > 0 ? ((bistBar.close - bistBar.open) / bistBar.open) * 100 : null;
    const usdTryChange = usdBar && usdBar.open > 0 ? ((usdBar.close - usdBar.open) / usdBar.open) * 100 : null;
    let macroScore = 50;
    if (vix != null) { if (vix > 30) macroScore -= 15; else if (vix > 20) macroScore -= 5; else macroScore += 5; }
    if (bist100Change != null) macroScore += Math.min(10, Math.max(-10, bist100Change * 3));
    if (usdTryChange != null) macroScore -= Math.min(10, Math.max(-10, usdTryChange * 5));
    macroScore = Math.max(0, Math.min(100, macroScore));
    map.set(date, { vix, bist100Change, usdTryChange, macroScore });
  }
  return map;
}

function loadFundamentals(): Record<string, FundamentalData> | null {
  const p = join(DATA_DIR, "fundamentals.json");
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, "utf-8")); } catch { return null; }
}

function getScoreRange(composite: number): typeof SCORE_RANGES[number] {
  if (composite < 40) return "0-40";
  if (composite < 48) return "40-48";
  if (composite < 55) return "48-55";
  return "55-100";
}

function ensureHorizonAgg(obj: Record<string, HorizonAgg>, h: string): HorizonAgg {
  if (!obj[h]) obj[h] = { wins: 0, total: 0, returns: [] };
  return obj[h];
}

function isVerdictWin(action: string, outcome: number, bistRet: number): boolean {
  if (action === "TUT") return Math.abs(outcome) < 5;
  if (action === "SAT" || action === "GUCLU_SAT") return outcome < bistRet;
  return outcome > 0; // AL, GUCLU_AL
}

function round1(n: number): number { return Math.round(n * 10) / 10; }
function round2(n: number): number { return Math.round(n * 100) / 100; }

// ANSI colors
const G = "\x1b[32m"; // green
const R = "\x1b[31m"; // red
const Y = "\x1b[33m"; // yellow
const C = "\x1b[36m"; // cyan
const B = "\x1b[1m";  // bold
const D = "\x1b[2m";  // dim
const X = "\x1b[0m";  // reset

function colorVal(v: number, good: number, bad: number): string {
  if (v >= good) return `${G}${v.toFixed(1)}${X}`;
  if (v <= bad) return `${R}${v.toFixed(1)}${X}`;
  return `${Y}${v.toFixed(1)}${X}`;
}

// ═══ Main ═══

async function main() {
  const { scope, name } = parseArgs();
  const stocks = getStockList(scope);
  const macro = loadMacro();
  const macroMap = macro ? buildMacroMap(macro) : null;
  const bist100Map: Map<string, number> | null = macro?.bist100
    ? new Map(macro.bist100.filter((b: HistoricalBar) => b.close > 0).map((b: HistoricalBar) => [b.date, b.close]))
    : null;

  // Fundamental veri yükle (statik — tüm barlar için aynı skor kullanılır)
  const fundamentalsRaw = loadFundamentals();
  const fundamentalScores: Record<string, FundamentalScore> = {};
  if (fundamentalsRaw) {
    for (const [code, data] of Object.entries(fundamentalsRaw)) {
      fundamentalScores[code] = scoreFundamentals(data as FundamentalData);
    }
  }
  const hasFundamentals = Object.keys(fundamentalScores).length > 0;

  console.log(`\n${B}═══ SİSTEM DOĞRULUK TESTİ: ${scope.toUpperCase()} ═══${X}`);
  console.log(`Hisse: ${stocks.length} | Adım: ${name} | Fundamental: ${hasFundamentals ? `${Object.keys(fundamentalScores).length} hisse` : "YOK"}\n`);

  // ── Aggregators ──

  // 1. Score correlation: range → horizon → agg
  const scoreAggs: Record<string, ScoreRangeAgg> = {};
  for (const r of SCORE_RANGES) scoreAggs[r] = {};

  // 2. Verdict by confidence: level → action → horizon → agg
  const confAggs: Record<string, ConfidenceVerdictAgg> = { HIGH: {}, MEDIUM: {}, LOW: {} };

  // 3. Signal vs Verdict comparison: horizon → { signalWins, signalTotal, verdictWins, verdictTotal }
  const svAggs: Record<string, { signalWins: number; signalTotal: number; verdictWins: number; verdictTotal: number }> = {};

  // 4. Index verdict aggs
  const indexAggs: Record<string, IndexVerdictAgg> = {};

  // 5. Verdict performance (same as backtest.ts)
  const verdictAggs: Record<string, Record<string, HorizonAgg>> = {};

  let totalDataPoints = 0;
  let totalVerdicts = 0;
  let processedStocks = 0;
  let skippedStocks = 0;
  const startTime = Date.now();

  for (let si = 0; si < stocks.length; si++) {
    const code = stocks[si];
    const bars = loadBars(code);
    if (!bars || bars.length < MIN_BARS + 20) { skippedStocks++; continue; }

    const recentBars = bars.slice(-60);
    const avgVolume = recentBars.reduce((s, b) => s + b.volume, 0) / recentBars.length;
    if (avgVolume < MIN_AVG_VOLUME) { skippedStocks++; continue; }

    const indices = getIndexMembership(code);
    processedStocks++;

    const endIdx = bars.length - 20;
    const startIdx = MIN_BARS;

    for (let i = startIdx; i < endIdx; i++) {
      const window = bars.slice(0, i + 1);
      const currentBar = bars[i];
      const price = currentBar.close;
      const volume = currentBar.volume;

      let technicals;
      try { technicals = calculateFullTechnicals(window, price, volume); } catch { continue; }

      // Signals
      const signals = detectSignals(technicals, price);
      const candlesticks = detectCandlestickPatterns(window);
      const chartPatterns = detectChartPatterns(window);
      for (const cp of candlesticks) signals.push({ type: `CANDLE_${cp.name}`, direction: cp.direction, strength: cp.strength, description: cp.description });
      for (const cp of chartPatterns) signals.push({ type: `CHART_${cp.name}`, direction: cp.direction, strength: cp.strength, description: cp.description });
      const filteredSignals = signals.filter(s => !BLACKLISTED_SIGNALS.has(`${s.type}|${s.direction}`));

      // Macro
      const dateMacro = macroMap?.get(currentBar.date) ?? null;
      const macroData = dateMacro ? { vix: dateMacro.vix, bist100Change: dateMacro.bist100Change, usdTryChange: dateMacro.usdTryChange, macroScore: dateMacro.macroScore } : null;

      // Fundamental score (statik — hisse bazında, tarihten bağımsız)
      const fundScore = fundamentalScores[code] ?? null;

      // Composite score (fundamental dahil)
      const score = calculateCompositeScore(technicals, price, 0, fundScore ?? null, macroData);
      const composite = score?.composite ?? 50;

      // Verdict (full object)
      let verdict: Verdict | null = null;
      try {
        const extraIndicators = calculateExtraIndicators(window, technicals?.bbUpper, technicals?.bbLower);
        verdict = calculateVerdict({
          price,
          technicals: technicals as unknown as Record<string, unknown>,
          extraIndicators: extraIndicators as unknown as VerdictInput["extraIndicators"],
          score,
          fundamentalScore: fundScore,
          signals: filteredSignals,
          signalCombination: null,
          signalAccuracy: {},
          multiTimeframe: null,
          macroData,
          riskMetrics: null,
          sentimentValue: 0,
        });
      } catch { /* skip */ }

      // Confluence: GUCLU_AL için en az 2 güçlü bullish sinyal gerek
      // AL→TUT downgrade kaldırıldı — TUT'u gereksiz şişiriyordu
      let verdictAction = verdict?.action ?? null;
      const strongBullish = filteredSignals.filter(s => s.direction === "BULLISH" && s.strength >= 60).length;
      if (verdictAction === "GUCLU_AL" && strongBullish < 2) verdictAction = "AL";

      // Outcomes
      const outcomes: Record<string, number | null> = {};
      const bistReturns: Record<string, number | null> = {};
      for (const h of HORIZONS) {
        const off = HORIZON_OFFSETS[h];
        outcomes[h] = i + off < bars.length ? ((bars[i + off].close - price) / price) * 100 : null;
        if (bist100Map) {
          const entryBist = bist100Map.get(currentBar.date);
          const exitBist = i + off < bars.length && entryBist ? bist100Map.get(bars[i + off].date) : null;
          bistReturns[h] = exitBist && entryBist ? ((exitBist - entryBist) / entryBist) * 100 : null;
        }
      }

      totalDataPoints++;

      // ── 1. Score Correlation ──
      const range = getScoreRange(composite);
      for (const h of HORIZONS) {
        const o = outcomes[h];
        if (o == null) continue;
        const agg = ensureHorizonAgg(scoreAggs[range], h);
        agg.total++;
        agg.returns.push(o);
        if (o > 0) agg.wins++;
      }

      // ── 2. Verdict by Confidence ──
      if (verdict && verdictAction) {
        totalVerdicts++;
        const confLevel = verdict.confidenceLevel; // HIGH, MEDIUM, LOW

        for (const h of HORIZONS) {
          const o = outcomes[h];
          if (o == null) continue;
          const bRet = bistReturns[h] ?? 0;
          const win = isVerdictWin(verdictAction, o, bRet);

          // Confidence × Action
          if (!confAggs[confLevel][verdictAction]) confAggs[confLevel][verdictAction] = {};
          const ca = ensureHorizonAgg(confAggs[confLevel][verdictAction], h);
          ca.total++;
          ca.returns.push(o);
          if (win) ca.wins++;

          // Verdict performance (flat)
          if (!verdictAggs[verdictAction]) verdictAggs[verdictAction] = {};
          const va = ensureHorizonAgg(verdictAggs[verdictAction], h);
          va.total++;
          va.returns.push(o);
          if (win) va.wins++;
        }

        // Index verdict agg (10D)
        for (const idx of ["all", ...indices]) {
          if (!indexAggs[idx]) indexAggs[idx] = { verdictWins: 0, verdictTotal: 0, scores: [], returns: [] };
          const ia = indexAggs[idx];
          ia.scores.push(composite);
          const o10 = outcomes["10D"];
          const bRet10 = bistReturns["10D"] ?? 0;
          if (o10 != null) {
            ia.verdictTotal++;
            ia.returns.push(o10);
            if (isVerdictWin(verdictAction, o10, bRet10)) ia.verdictWins++;
          }
        }
      }

      // ── 3. Signal vs Verdict (aynı bar'da) ──
      const activeBullish = filteredSignals.filter(s => s.direction === "BULLISH" && s.strength >= MIN_SIGNAL_STRENGTH);
      if (activeBullish.length > 0 || (verdictAction && (verdictAction === "AL" || verdictAction === "GUCLU_AL"))) {
        for (const h of HORIZONS) {
          const o = outcomes[h];
          if (o == null) continue;
          if (!svAggs[h]) svAggs[h] = { signalWins: 0, signalTotal: 0, verdictWins: 0, verdictTotal: 0 };

          // Signal-only: en az 1 bullish sinyal varsa "AL" say
          if (activeBullish.length > 0) {
            svAggs[h].signalTotal++;
            if (o > 0) svAggs[h].signalWins++;
          }

          // Verdict-based: sadece AL/GUCLU_AL verdiktleri
          if (verdictAction === "AL" || verdictAction === "GUCLU_AL") {
            svAggs[h].verdictTotal++;
            if (o > 0) svAggs[h].verdictWins++;
          }
        }
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const eta = processedStocks > 0 ? Math.round((elapsed / processedStocks) * (stocks.length - si - 1)) : 0;
    process.stdout.write(`[${si + 1}/${stocks.length}] ${code} | ${totalDataPoints.toLocaleString()} veri noktası | ETA: ${Math.floor(eta / 60)}dk ${eta % 60}sn    \r`);
  }

  // ═══ Build Results ═══
  console.log(`\n\n${B}Sonuçlar hesaplanıyor...${X}\n`);

  // Score correlation
  const scoreCorrelation: Record<string, Record<string, { winRate: number; avgReturn: number; count: number }>> & { isMonotonic?: boolean } = {};
  for (const range of SCORE_RANGES) {
    scoreCorrelation[range] = {};
    for (const h of HORIZONS) {
      const a = scoreAggs[range][h];
      if (!a || a.total === 0) { scoreCorrelation[range][h] = { winRate: 0, avgReturn: 0, count: 0 }; continue; }
      scoreCorrelation[range][h] = {
        winRate: round1((a.wins / a.total) * 100),
        avgReturn: round2(a.returns.reduce((s, r) => s + r, 0) / a.returns.length),
        count: a.total,
      };
    }
  }
  // Monotonic check (10D avgReturn should increase with score range)
  const rangeReturns = SCORE_RANGES.map(r => scoreCorrelation[r]["10D"]?.avgReturn ?? 0);
  scoreCorrelation.isMonotonic = rangeReturns.every((v, i) => i === 0 || v >= rangeReturns[i - 1]);

  // Verdict by confidence
  const verdictByConfidence: Record<string, Record<string, Record<string, { winRate: number; avgReturn: number; count: number }>>> = {};
  for (const level of ["HIGH", "MEDIUM", "LOW"]) {
    verdictByConfidence[level] = {};
    for (const [action, horizons] of Object.entries(confAggs[level])) {
      verdictByConfidence[level][action] = {};
      for (const h of HORIZONS) {
        const a = horizons[h];
        if (!a || a.total === 0) { verdictByConfidence[level][action][h] = { winRate: 0, avgReturn: 0, count: 0 }; continue; }
        verdictByConfidence[level][action][h] = {
          winRate: round1((a.wins / a.total) * 100),
          avgReturn: round2(a.returns.reduce((s, r) => s + r, 0) / a.returns.length),
          count: a.total,
        };
      }
    }
  }

  // Signal vs Verdict
  const signalVsVerdict: Record<string, { signalWinRate: number; verdictWinRate: number; signalAvgReturn: number; verdictAvgReturn: number; verdictEdge: number; signalCount: number; verdictCount: number }> = {};
  for (const h of HORIZONS) {
    const sv = svAggs[h];
    if (!sv) continue;
    const sWR = sv.signalTotal > 0 ? round1((sv.signalWins / sv.signalTotal) * 100) : 0;
    const vWR = sv.verdictTotal > 0 ? round1((sv.verdictWins / sv.verdictTotal) * 100) : 0;
    signalVsVerdict[h] = {
      signalWinRate: sWR,
      verdictWinRate: vWR,
      signalAvgReturn: 0, // simplified — we track wins/total not returns here
      verdictAvgReturn: 0,
      verdictEdge: round1(vWR - sWR),
      signalCount: sv.signalTotal,
      verdictCount: sv.verdictTotal,
    };
  }

  // Verdict performance
  const verdictPerformance: Record<string, Record<string, { winRate: number; avgReturn: number; count: number }>> = {};
  for (const [action, horizons] of Object.entries(verdictAggs)) {
    verdictPerformance[action] = {};
    for (const [h, a] of Object.entries(horizons)) {
      verdictPerformance[action][h] = {
        winRate: a.total > 0 ? round1((a.wins / a.total) * 100) : 0,
        avgReturn: a.returns.length > 0 ? round2(a.returns.reduce((s, r) => s + r, 0) / a.returns.length) : 0,
        count: a.total,
      };
    }
  }

  // Index breakdown
  const byIndex: Record<string, { verdictWinRate: number; avgScore: number; avgReturn10D: number; count: number }> = {};
  for (const [idx, ia] of Object.entries(indexAggs)) {
    byIndex[idx] = {
      verdictWinRate: ia.verdictTotal > 0 ? round1((ia.verdictWins / ia.verdictTotal) * 100) : 0,
      avgScore: ia.scores.length > 0 ? round1(ia.scores.reduce((s, r) => s + r, 0) / ia.scores.length) : 0,
      avgReturn10D: ia.returns.length > 0 ? round2(ia.returns.reduce((s, r) => s + r, 0) / ia.returns.length) : 0,
      count: ia.verdictTotal,
    };
  }

  // Overall
  const allVerdictWR = verdictPerformance["AL"]?.["10D"]?.winRate ?? 0;
  const allGucluAlWR = verdictPerformance["GUCLU_AL"]?.["10D"]?.winRate ?? 0;
  const bestConfLevel = (["HIGH", "MEDIUM", "LOW"] as const).reduce((best, lvl) => {
    const alData = verdictByConfidence[lvl]?.["AL"]?.["10D"];
    const bestData = verdictByConfidence[best]?.["AL"]?.["10D"];
    return (alData?.winRate ?? 0) > (bestData?.winRate ?? 0) ? lvl : best;
  }, "HIGH" as string);
  const bestRange = SCORE_RANGES.reduce((best, r) => {
    return (scoreCorrelation[r]?.["10D"]?.avgReturn ?? -999) > (scoreCorrelation[best]?.["10D"]?.avgReturn ?? -999) ? r : best;
  }, SCORE_RANGES[0] as string);

  const result = {
    meta: {
      scope,
      name,
      stocks: processedStocks,
      skipped: skippedStocks,
      totalDataPoints,
      totalVerdicts,
      date: new Date().toISOString().split("T")[0],
      durationSeconds: Math.round((Date.now() - startTime) / 1000),
    },
    scoreCorrelation,
    verdictByConfidence,
    signalVsVerdict,
    verdictPerformance,
    byIndex,
    overall: {
      systemAccuracy: round1((allVerdictWR + allGucluAlWR) / 2),
      bestConfidenceLevel: bestConfLevel,
      bestScoreRange: bestRange,
      scoreIsMonotonic: scoreCorrelation.isMonotonic,
    },
  };

  // ═══ Save JSON ═══
  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });
  const outPath = join(RESULTS_DIR, `${name}-${result.meta.date}.json`);
  writeFileSync(outPath, JSON.stringify(result, null, 2));

  // ═══ Terminal Çıktısı ═══

  // 1. Score Korelasyonu
  console.log(`${B}╔═══════════════════════════════════════════════════════════╗${X}`);
  console.log(`${B}║          COMPOSITE SCORE KORELASYONU                      ║${X}`);
  console.log(`${B}╚═══════════════════════════════════════════════════════════╝${X}`);
  console.log(`${D}Skor Aralığı     │   1D WR   │   5D WR   │  10D WR   │  20D WR   │ 10D Ort.Ret │  Adet${X}`);
  console.log(`─────────────────┼───────────┼───────────┼───────────┼───────────┼─────────────┼────────`);
  for (const range of SCORE_RANGES) {
    const d = scoreCorrelation[range];
    const wr1 = colorVal(d["1D"]?.winRate ?? 0, 55, 45);
    const wr5 = colorVal(d["5D"]?.winRate ?? 0, 55, 45);
    const wr10 = colorVal(d["10D"]?.winRate ?? 0, 55, 45);
    const wr20 = colorVal(d["20D"]?.winRate ?? 0, 55, 45);
    const ret10 = colorVal(d["10D"]?.avgReturn ?? 0, 1, -1);
    const cnt = d["10D"]?.count ?? 0;
    console.log(`  ${range.padEnd(15)} │  ${wr1.padEnd(18)} │  ${wr5.padEnd(18)} │  ${wr10.padEnd(18)} │  ${wr20.padEnd(18)} │   ${ret10.padEnd(20)} │ ${cnt.toLocaleString()}`);
  }
  console.log(`\n${scoreCorrelation.isMonotonic ? `${G}✓ Monotonic — skor arttıkça return artıyor${X}` : `${R}✗ Non-monotonic — skor-return ilişkisi tutarsız${X}`}\n`);

  // 2. Verdict Performance
  console.log(`${B}╔═══════════════════════════════════════════════════════════╗${X}`);
  console.log(`${B}║          VERDİKT PERFORMANSI                              ║${X}`);
  console.log(`${B}╚═══════════════════════════════════════════════════════════╝${X}`);
  console.log(`${D}Verdikt        │   1D WR   │   5D WR   │  10D WR   │  20D WR   │ 10D Ort.Ret │  Adet${X}`);
  console.log(`───────────────┼───────────┼───────────┼───────────┼───────────┼─────────────┼────────`);
  for (const action of ["GUCLU_AL", "AL", "TUT", "SAT", "GUCLU_SAT"]) {
    const d = verdictPerformance[action];
    if (!d) continue;
    const wr1 = colorVal(d["1D"]?.winRate ?? 0, 55, 45);
    const wr5 = colorVal(d["5D"]?.winRate ?? 0, 55, 45);
    const wr10 = colorVal(d["10D"]?.winRate ?? 0, 55, 45);
    const wr20 = colorVal(d["20D"]?.winRate ?? 0, 55, 45);
    const ret10 = colorVal(d["10D"]?.avgReturn ?? 0, 1, -1);
    const cnt = d["10D"]?.count ?? 0;
    console.log(`  ${action.padEnd(13)} │  ${wr1.padEnd(18)} │  ${wr5.padEnd(18)} │  ${wr10.padEnd(18)} │  ${wr20.padEnd(18)} │   ${ret10.padEnd(20)} │ ${cnt.toLocaleString()}`);
  }

  // 3. Confidence Kırılımı
  console.log(`\n${B}╔═══════════════════════════════════════════════════════════╗${X}`);
  console.log(`${B}║          CONFIDENCE SEVİYESİ × VERDİKT (10D)              ║${X}`);
  console.log(`${B}╚═══════════════════════════════════════════════════════════╝${X}`);
  console.log(`${D}Confidence │ Verdikt       │  Win Rate  │ Ort. Return │  Adet${X}`);
  console.log(`───────────┼───────────────┼────────────┼─────────────┼────────`);
  for (const level of ["HIGH", "MEDIUM", "LOW"]) {
    const actions = verdictByConfidence[level];
    for (const action of ["GUCLU_AL", "AL", "TUT", "SAT", "GUCLU_SAT"]) {
      const d = actions[action]?.["10D"];
      if (!d || d.count === 0) continue;
      const wr = colorVal(d.winRate, 55, 45);
      const ret = colorVal(d.avgReturn, 1, -1);
      console.log(`  ${level.padEnd(9)} │ ${action.padEnd(13)} │  ${wr.padEnd(19)} │   ${ret.padEnd(20)} │ ${d.count.toLocaleString()}`);
    }
  }

  // 4. Signal vs Verdict
  console.log(`\n${B}╔═══════════════════════════════════════════════════════════╗${X}`);
  console.log(`${B}║          SİNYAL vs VERDİKT KARŞILAŞTIRMASI                ║${X}`);
  console.log(`${B}╚═══════════════════════════════════════════════════════════╝${X}`);
  console.log(`${D}Horizon │ Sinyal WR │ Verdikt WR │ Fark (Edge)  │ Sinyal N │ Verdikt N${X}`);
  console.log(`────────┼───────────┼────────────┼──────────────┼──────────┼──────────`);
  for (const h of HORIZONS) {
    const sv = signalVsVerdict[h];
    if (!sv) continue;
    const sWR = colorVal(sv.signalWinRate, 55, 45);
    const vWR = colorVal(sv.verdictWinRate, 55, 45);
    const edge = sv.verdictEdge >= 0 ? `${G}+${sv.verdictEdge.toFixed(1)}%${X}` : `${R}${sv.verdictEdge.toFixed(1)}%${X}`;
    console.log(`  ${h.padEnd(6)} │  ${sWR.padEnd(18)} │  ${vWR.padEnd(19)} │  ${edge.padEnd(21)} │ ${sv.signalCount.toLocaleString().padStart(8)} │ ${sv.verdictCount.toLocaleString().padStart(8)}`);
  }

  // 5. Endeks Kırılımı
  console.log(`\n${B}╔═══════════════════════════════════════════════════════════╗${X}`);
  console.log(`${B}║          ENDEKS KIRILIMI (10D)                             ║${X}`);
  console.log(`${B}╚═══════════════════════════════════════════════════════════╝${X}`);
  console.log(`${D}Endeks     │ Verdikt WR │ Ort. Skor │ Ort. Return │  Adet${X}`);
  console.log(`───────────┼────────────┼───────────┼─────────────┼────────`);
  for (const idx of ["bist30", "bist50", "bist100", "all"]) {
    const d = byIndex[idx];
    if (!d) continue;
    const wr = colorVal(d.verdictWinRate, 55, 45);
    const sc = d.avgScore.toFixed(1);
    const ret = colorVal(d.avgReturn10D, 1, -1);
    console.log(`  ${idx.padEnd(9)} │  ${wr.padEnd(19)} │   ${sc.padStart(5)}   │   ${ret.padEnd(20)} │ ${d.count.toLocaleString()}`);
  }

  // Summary
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n${B}═══ ÖZET ═══${X}`);
  console.log(`Hisse: ${processedStocks} (${skippedStocks} atlandı) | Veri noktası: ${totalDataPoints.toLocaleString()} | Verdikt: ${totalVerdicts.toLocaleString()}`);
  console.log(`Sistem Accuracy (AL+GUCLU_AL ort. 10D WR): ${colorVal(result.overall.systemAccuracy, 55, 45)}%`);
  console.log(`En iyi confidence: ${C}${result.overall.bestConfidenceLevel}${X} | En iyi skor aralığı: ${C}${result.overall.bestScoreRange}${X}`);
  console.log(`Score monotonic: ${result.overall.scoreIsMonotonic ? `${G}EVET${X}` : `${R}HAYIR${X}`}`);
  console.log(`Süre: ${Math.floor(elapsed / 60)}dk ${elapsed % 60}sn`);
  console.log(`Sonuç: ${outPath}\n`);
}

main().catch((err) => {
  console.error("\nFatal:", err);
  process.exit(1);
});
