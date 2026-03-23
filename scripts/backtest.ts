/**
 * Local Backtest Engine
 * Bar dosyalarını okur, bellekte sinyal/verdikt hesaplar, sonuçları JSON'a yazar.
 * Kullanım: npx tsx scripts/backtest.ts [--scope bist100|bist-all] [--name v1]
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "fs";
import { join, basename } from "path";
import { calculateFullTechnicals, type HistoricalBar } from "../src/lib/stock/technicals";
import { detectSignals } from "../src/lib/stock/signals";
import { detectCandlestickPatterns } from "../src/lib/stock/candlesticks";
import { detectChartPatterns } from "../src/lib/stock/chart-patterns";
import { calculateCompositeScore } from "../src/lib/stock/scoring";
import { calculateVerdict, type VerdictInput } from "../src/lib/stock/verdict";
import { calculateExtraIndicators } from "../src/lib/stock/extra-indicators";
import { ROUND_TRIP_COST } from "../src/lib/stock/bist-constants";
import { BLACKLISTED_SIGNALS } from "../src/lib/stock/signal-filter";
import { BIST_ALL, BIST100, BIST50, BIST30 } from "../src/lib/constants";

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

interface SignalAgg {
  wins: number;
  losses: number;
  winReturns: number[];
  lossReturns: number[];
}

interface VerdictAgg {
  count: number;
  wins: number;
  returns: number[];
}

// ═══ Config ═══

const DATA_DIR = join(process.cwd(), "data");
const BARS_DIR = join(DATA_DIR, "bars");
const RESULTS_DIR = join(DATA_DIR, "results");
const MIN_BARS_FOR_ANALYSIS = 200; // MA200 warmup
const MIN_AVG_VOLUME = 500_000; // Minimum 20-gün ort. günlük hacim (lot) — canlı sistemle aynı
const MIN_SIGNAL_STRENGTH = 45; // Hafif yükseltilmiş eşik

// ═══ Helpers ═══

function parseArgs() {
  const args = process.argv.slice(2);
  const scope = args.find(a => a.startsWith("--scope="))?.split("=")[1]
    ?? args[args.indexOf("--scope") + 1]
    ?? "bist100";
  const name = args.find(a => a.startsWith("--name="))?.split("=")[1]
    ?? args[args.indexOf("--name") + 1]
    ?? `backtest-${scope}`;
  const noBlacklist = args.includes("--no-blacklist");
  return { scope, name, noBlacklist };
}

function getStockList(scope: string): string[] {
  const setForScope: Record<string, readonly string[]> = {
    "bist30": BIST30,
    "bist50": BIST50,
    "bist100": BIST100,
    "bist-all": BIST_ALL,
  };
  return [...new Set(setForScope[scope] ?? BIST100)];
}

function getIndexMembership(code: string): string[] {
  const indices: string[] = [];
  if ((BIST30 as readonly string[]).includes(code)) indices.push("bist30");
  if ((BIST50 as readonly string[]).includes(code)) indices.push("bist50");
  if ((BIST100 as readonly string[]).includes(code)) indices.push("bist100");
  return indices;
}

function loadBars(code: string): HistoricalBar[] | null {
  const filePath = join(BARS_DIR, `${code}.json`);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function loadMacro(): Record<string, HistoricalBar[]> | null {
  const filePath = join(DATA_DIR, "macro.json");
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function buildMacroMap(macro: Record<string, HistoricalBar[]>): Map<string, { vix: number | null; bist100Change: number | null; usdTryChange: number | null; macroScore: number }> {
  const map = new Map<string, ReturnType<typeof buildMacroMap> extends Map<string, infer V> ? V : never>();

  const vixBars = macro.vix ?? [];
  const bist100Bars = macro.bist100 ?? [];
  const usdTryBars = macro.usdTry ?? [];

  // Index by date
  const vixMap = new Map(vixBars.map(b => [b.date, b.close]));
  const bistMap = new Map(bist100Bars.map(b => [b.date, b]));
  const usdMap = new Map(usdTryBars.map(b => [b.date, b]));

  // Get all unique dates
  const allDates = new Set([
    ...vixBars.map(b => b.date),
    ...bist100Bars.map(b => b.date),
    ...usdTryBars.map(b => b.date),
  ]);

  for (const date of allDates) {
    const vix = vixMap.get(date) ?? null;
    const bistBar = bistMap.get(date);
    const usdBar = usdMap.get(date);

    // Simple daily change calculation
    const bist100Change = bistBar && bistBar.open > 0
      ? ((bistBar.close - bistBar.open) / bistBar.open) * 100
      : null;
    const usdTryChange = usdBar && usdBar.open > 0
      ? ((usdBar.close - usdBar.open) / usdBar.open) * 100
      : null;

    // Simple macro score
    let macroScore = 50;
    if (vix != null) {
      if (vix > 30) macroScore -= 15;
      else if (vix > 20) macroScore -= 5;
      else macroScore += 5;
    }
    if (bist100Change != null) {
      macroScore += Math.min(10, Math.max(-10, bist100Change * 3));
    }
    if (usdTryChange != null) {
      macroScore -= Math.min(10, Math.max(-10, usdTryChange * 5));
    }
    macroScore = Math.max(0, Math.min(100, macroScore));

    map.set(date, { vix, bist100Change, usdTryChange, macroScore });
  }

  return map;
}

function calcHorizonStats(agg: SignalAgg): HorizonStats {
  const total = agg.wins + agg.losses;
  if (total === 0) return { winRate: 0, avgWin: 0, avgLoss: 0, profitFactor: 0, grossExpectancy: 0, netExpectancy: 0, count: 0 };

  const winRate = (agg.wins / total) * 100;
  const avgWin = agg.winReturns.length > 0 ? agg.winReturns.reduce((a, b) => a + b, 0) / agg.winReturns.length : 0;
  const avgLoss = agg.lossReturns.length > 0 ? agg.lossReturns.reduce((a, b) => a + b, 0) / agg.lossReturns.length : 0;

  const grossWins = agg.winReturns.reduce((a, b) => a + b, 0);
  const grossLosses = Math.abs(agg.lossReturns.reduce((a, b) => a + b, 0));
  const profitFactor = grossLosses > 0 ? Math.min(99, grossWins / grossLosses) : (grossWins > 0 ? 99 : 0);

  const grossExp = (winRate / 100) * avgWin - ((100 - winRate) / 100) * Math.abs(avgLoss);
  const netExp = grossExp - ROUND_TRIP_COST * 100;

  return {
    winRate: Math.round(winRate * 10) / 10,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    grossExpectancy: Math.round(grossExp * 100) / 100,
    netExpectancy: Math.round(netExp * 100) / 100,
    count: total,
  };
}

// ═══ Main Backtest ═══

async function main() {
  const { scope, name, noBlacklist } = parseArgs();
  const stocks = getStockList(scope);
  const macro = loadMacro();
  const macroMap = macro ? buildMacroMap(macro) : null;

  // BIST100 close price map for relative performance calculation
  const bist100Map: Map<string, number> | null = macro?.bist100
    ? new Map(macro.bist100.filter((b: HistoricalBar) => b.close > 0).map((b: HistoricalBar) => [b.date, b.close]))
    : null;

  console.log(`\n═══ BACKTEST: ${scope.toUpperCase()} ═══`);
  console.log(`Hisse sayısı: ${stocks.length}`);
  console.log(`Adım: ${name}\n`);

  // Aggregators
  // signalKey = "SIGNAL_TYPE|DIRECTION"
  const signalAggs: Record<string, Record<string, SignalAgg>> = {}; // signalKey → { "1D": agg, "5D": agg, ... }
  const verdictAggs: Record<string, Record<string, VerdictAgg>> = {}; // verdictAction → { "1D": agg, ... }
  const indexSignalAggs: Record<string, Record<string, Record<string, SignalAgg>>> = {}; // indexName → signalKey → horizon → agg

  let totalSignals = 0;
  let totalVerdicts = 0;
  let processedStocks = 0;
  let skippedStocks = 0;
  const startTime = Date.now();

  for (let si = 0; si < stocks.length; si++) {
    const code = stocks[si];
    const bars = loadBars(code);

    if (!bars || bars.length < MIN_BARS_FOR_ANALYSIS + 20) {
      skippedStocks++;
      continue;
    }

    // Hacim filtresi — son 60 günün ort. hacmi düşükse atla
    const recentBars = bars.slice(-60);
    const avgVolume = recentBars.reduce((s, b) => s + b.volume, 0) / recentBars.length;
    if (avgVolume < MIN_AVG_VOLUME) {
      skippedStocks++;
      continue;
    }

    const indices = getIndexMembership(code);
    processedStocks++;

    // Sliding window: start from MIN_BARS_FOR_ANALYSIS, go to end - 20 (need 20D outcome)
    const endIdx = bars.length - 20; // leave room for 20D outcome
    const startIdx = MIN_BARS_FOR_ANALYSIS;

    for (let i = startIdx; i < endIdx; i++) {
      const window = bars.slice(0, i + 1);
      const currentBar = bars[i];
      const price = currentBar.close;
      const volume = currentBar.volume;

      // Calculate technicals
      let technicals;
      try {
        technicals = calculateFullTechnicals(window, price, volume);
      } catch {
        continue;
      }

      // Detect signals
      const signals = detectSignals(technicals, price);
      const candlesticks = detectCandlestickPatterns(window);
      const chartPatterns = detectChartPatterns(window);

      for (const cp of candlesticks) {
        signals.push({ type: `CANDLE_${cp.name}`, direction: cp.direction, strength: cp.strength, description: cp.description });
      }
      for (const cp of chartPatterns) {
        signals.push({ type: `CHART_${cp.name}`, direction: cp.direction, strength: cp.strength, description: cp.description });
      }

      // Blacklist filtresi — zararlı sinyalleri çıkar (--no-blacklist ile devre dışı)
      const filteredSignals = noBlacklist
        ? signals
        : signals.filter(s => {
            const key = `${s.type}|${s.direction}`;
            return !BLACKLISTED_SIGNALS.has(key);
          });

      // Get macro for this date
      const dateMacro = macroMap?.get(currentBar.date) ?? null;
      const macroData = dateMacro ? {
        vix: dateMacro.vix,
        bist100Change: dateMacro.bist100Change,
        usdTryChange: dateMacro.usdTryChange,
        macroScore: dateMacro.macroScore,
      } : null;

      // Composite score (no fundamental, no sentiment)
      const score = calculateCompositeScore(technicals, price, 0, null, macroData);

      // Verdict
      let verdictAction: string | null = null;
      try {
        const extraIndicators = calculateExtraIndicators(window, technicals?.bbUpper, technicals?.bbLower);
        const verdict = calculateVerdict({
          price,
          technicals: technicals as unknown as Record<string, unknown>,
          extraIndicators: extraIndicators as unknown as VerdictInput["extraIndicators"],
          score,
          fundamentalScore: null,
          signals: filteredSignals,
          signalCombination: null,
          signalAccuracy: {},
          multiTimeframe: null,
          macroData,
          riskMetrics: null,
          sentimentValue: 0,
        });
        verdictAction = verdict.action;
      } catch {
        // verdict failed, skip
      }

      // ── Outcome calculation ──
      const outcomes: Record<string, number | null> = {};
      for (const [horizon, offset] of [["1D", 1], ["5D", 5], ["10D", 10], ["20D", 20]] as const) {
        if (i + offset < bars.length) {
          outcomes[horizon] = ((bars[i + offset].close - price) / price) * 100;
        } else {
          outcomes[horizon] = null;
        }
      }

      // BIST100 benchmark returns (for relative SAT/verdict accuracy)
      const bistReturns: Record<string, number | null> = {};
      if (bist100Map) {
        const entryBist = bist100Map.get(currentBar.date);
        for (const [horizon, offset] of [["1D", 1], ["5D", 5], ["10D", 10], ["20D", 20]] as const) {
          if (i + offset < bars.length && entryBist) {
            const exitBist = bist100Map.get(bars[i + offset].date);
            bistReturns[horizon] = exitBist && entryBist
              ? ((exitBist - entryBist) / entryBist) * 100
              : null;
          } else {
            bistReturns[horizon] = null;
          }
        }
      }

      // ── Aggregate signals (filtered) ──
      for (const signal of filteredSignals) {
        if (signal.direction === "NEUTRAL") continue;
        if (signal.strength < MIN_SIGNAL_STRENGTH) continue;

        const key = `${signal.type}|${signal.direction}`;
        totalSignals++;

        for (const horizon of ["1D", "5D", "10D", "20D"]) {
          const outcomeRaw = outcomes[horizon];
          if (outcomeRaw == null) continue;

          // BULLISH win = price went up
          // BEARISH win = stock underperformed BIST100 (relative, not absolute)
          const bistRet = bistReturns[horizon] ?? 0;
          const isWin = signal.direction === "BEARISH"
            ? outcomeRaw < bistRet  // underperformed benchmark
            : outcomeRaw > 0;       // absolute positive
          const returnPct = signal.direction === "BEARISH"
            ? bistRet - outcomeRaw  // alpha (positive = good for bearish)
            : outcomeRaw;

          // Global aggregate
          if (!signalAggs[key]) signalAggs[key] = {};
          if (!signalAggs[key][horizon]) signalAggs[key][horizon] = { wins: 0, losses: 0, winReturns: [], lossReturns: [] };

          if (isWin) {
            signalAggs[key][horizon].wins++;
            signalAggs[key][horizon].winReturns.push(Math.abs(returnPct));
          } else {
            signalAggs[key][horizon].losses++;
            signalAggs[key][horizon].lossReturns.push(-Math.abs(returnPct));
          }

          // Index-level aggregate
          for (const idx of ["all", ...indices]) {
            if (!indexSignalAggs[idx]) indexSignalAggs[idx] = {};
            if (!indexSignalAggs[idx][key]) indexSignalAggs[idx][key] = {};
            if (!indexSignalAggs[idx][key][horizon]) indexSignalAggs[idx][key][horizon] = { wins: 0, losses: 0, winReturns: [], lossReturns: [] };

            if (isWin) {
              indexSignalAggs[idx][key][horizon].wins++;
              indexSignalAggs[idx][key][horizon].winReturns.push(Math.abs(returnPct));
            } else {
              indexSignalAggs[idx][key][horizon].losses++;
              indexSignalAggs[idx][key][horizon].lossReturns.push(-Math.abs(returnPct));
            }
          }
        }
      }

      // ── Aggregate verdicts ──
      // Confluence: GUCLU_AL için en az 2 güçlü bullish sinyal gerek (kalite filtresi)
      // AL→TUT downgrade kaldırıldı — TUT'u gereksiz şişiriyordu
      const strongBullish = filteredSignals.filter(s => s.direction === "BULLISH" && s.strength >= 60).length;
      if (verdictAction === "GUCLU_AL" && strongBullish < 2) {
        verdictAction = "AL";
      }

      if (verdictAction) {
        totalVerdicts++;
        for (const horizon of ["1D", "5D", "10D", "20D"]) {
          const outcomeRaw = outcomes[horizon];
          if (outcomeRaw == null) continue;

          if (!verdictAggs[verdictAction]) verdictAggs[verdictAction] = {};
          if (!verdictAggs[verdictAction][horizon]) verdictAggs[verdictAction][horizon] = { count: 0, wins: 0, returns: [] };

          const va = verdictAggs[verdictAction][horizon];
          va.count++;
          va.returns.push(outcomeRaw);

          const isShort = verdictAction === "SAT" || verdictAction === "GUCLU_SAT";
          const isTut = verdictAction === "TUT";
          const bistRet2 = bistReturns[horizon] ?? 0;
          // AL/GUCLU_AL: fiyat yükseldi mi (absolute)
          // SAT/GUCLU_SAT: BIST100'ün altında kaldı mı (relative)
          // TUT: fazla hareket etmedi mi
          const isWin = isTut
            ? Math.abs(outcomeRaw) < 5
            : isShort
              ? outcomeRaw < bistRet2  // underperformed benchmark
              : outcomeRaw > 0;        // absolute positive
          if (isWin) va.wins++;
        }
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const eta = processedStocks > 0 ? Math.round((elapsed / processedStocks) * (stocks.length - si - 1)) : 0;
    process.stdout.write(`[${si + 1}/${stocks.length}] ${code} | ${totalSignals.toLocaleString()} sinyal | ETA: ${Math.floor(eta / 60)}dk ${eta % 60}sn    \r`);
  }

  // ── Build result ──
  console.log(`\n\nSonuçlar hesaplanıyor...`);

  // Signal performance
  const signalPerformance: Record<string, Record<string, HorizonStats>> = {};
  for (const [key, horizons] of Object.entries(signalAggs)) {
    signalPerformance[key] = {};
    for (const [h, agg] of Object.entries(horizons)) {
      signalPerformance[key][h] = calcHorizonStats(agg);
    }
  }

  // Verdict performance
  const verdictPerformance: Record<string, Record<string, { winRate: number; avgReturn: number; count: number }>> = {};
  for (const [action, horizons] of Object.entries(verdictAggs)) {
    verdictPerformance[action] = {};
    for (const [h, agg] of Object.entries(horizons)) {
      verdictPerformance[action][h] = {
        winRate: agg.count > 0 ? Math.round((agg.wins / agg.count) * 1000) / 10 : 0,
        avgReturn: agg.returns.length > 0 ? Math.round((agg.returns.reduce((a, b) => a + b, 0) / agg.returns.length) * 100) / 100 : 0,
        count: agg.count,
      };
    }
  }

  // Index comparison (best horizon per signal)
  const byIndex: Record<string, { avgWinRate: number; signalCount: number }> = {};
  for (const [idx, signals] of Object.entries(indexSignalAggs)) {
    let totalWR = 0;
    let signalTypesWithData = 0;
    let signalCount = 0;
    for (const horizons of Object.values(signals)) {
      // Use 10D as default comparison horizon
      const h = horizons["10D"];
      if (h && h.wins + h.losses >= 20) {
        totalWR += (h.wins / (h.wins + h.losses)) * 100;
        signalTypesWithData++;
        signalCount += h.wins + h.losses;
      }
    }
    byIndex[idx] = {
      avgWinRate: signalTypesWithData > 0 ? Math.round((totalWR / signalTypesWithData) * 10) / 10 : 0,
      signalCount,
    };
  }

  // Overall
  let totalWR = 0;
  let typesWithData = 0;
  for (const horizons of Object.values(signalPerformance)) {
    const h = horizons["10D"];
    if (h && h.count >= 20) {
      totalWR += h.winRate;
      typesWithData++;
    }
  }

  const result = {
    meta: {
      scope,
      name,
      stocks: processedStocks,
      skipped: skippedStocks,
      totalSignals,
      totalVerdicts,
      date: new Date().toISOString().split("T")[0],
      durationSeconds: Math.round((Date.now() - startTime) / 1000),
    },
    signalPerformance,
    verdictPerformance,
    byIndex,
    overall: {
      avgWinRate: typesWithData > 0 ? Math.round((totalWR / typesWithData) * 10) / 10 : 0,
      signalTypesAnalyzed: Object.keys(signalPerformance).length,
      signalTypesWithData: typesWithData,
    },
  };

  // Save
  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });
  const outPath = join(RESULTS_DIR, `${name}-${result.meta.date}.json`);
  writeFileSync(outPath, JSON.stringify(result, null, 2));

  // Quick summary
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n═══ BACKTEST TAMAMLANDI ═══`);
  console.log(`Hisse: ${processedStocks} (${skippedStocks} atlandı) | Sinyal: ${totalSignals.toLocaleString()} | Verdikt: ${totalVerdicts.toLocaleString()}`);
  console.log(`Ort. Win Rate (10D): %${result.overall.avgWinRate}`);
  console.log(`Süre: ${Math.floor(elapsed / 60)}dk ${elapsed % 60}sn`);
  console.log(`Sonuç: ${outPath}\n`);
}

main().catch((err) => {
  console.error("\nFatal:", err);
  process.exit(1);
});
