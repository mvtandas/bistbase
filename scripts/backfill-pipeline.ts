/**
 * Pipeline Backfill Script
 * Bar dosyalarından geçmiş günleri yeni (düzeltilmiş) pipeline ile analiz edip DB'ye yazar.
 * Kullanım: npx tsx scripts/backfill-pipeline.ts [--days 20] [--scope bist100] [--dry-run]
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { calculateFullTechnicals, type HistoricalBar } from "../src/lib/stock/technicals";
import { detectSignals } from "../src/lib/stock/signals";
import { detectCandlestickPatterns } from "../src/lib/stock/candlesticks";
import { detectChartPatterns } from "../src/lib/stock/chart-patterns";
import { calculateCompositeScore } from "../src/lib/stock/scoring";
import { calculateVerdict, type VerdictInput } from "../src/lib/stock/verdict";
import { calculateExtraIndicators } from "../src/lib/stock/extra-indicators";
import { BLACKLISTED_SIGNALS } from "../src/lib/stock/signal-filter";
import { scoreFundamentals, type FundamentalData } from "../src/lib/stock/fundamentals";
import { BIST100, BIST50, BIST30 } from "../src/lib/constants";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DATA_DIR = join(process.cwd(), "data");
const BARS_DIR = join(DATA_DIR, "bars");
const MIN_BARS = 200;

function getArg(args: string[], key: string, fallback: string | null = null): string | null {
  const eq = args.find(a => a.startsWith(`--${key}=`));
  if (eq) return eq.split("=")[1];
  const idx = args.indexOf(`--${key}`);
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1];
  return fallback;
}

function loadBars(code: string): HistoricalBar[] | null {
  const p = join(BARS_DIR, `${code}.json`);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, "utf-8")); } catch { return null; }
}

function loadFundamentals(): Record<string, FundamentalData> | null {
  const p = join(DATA_DIR, "fundamentals.json");
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, "utf-8")); } catch { return null; }
}

function loadMacro(): Record<string, HistoricalBar[]> | null {
  const p = join(DATA_DIR, "macro.json");
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, "utf-8")); } catch { return null; }
}

async function main() {
  const args = process.argv.slice(2);
  const days = parseInt(getArg(args, "days", "20")!, 10);
  const scope = getArg(args, "scope", "bist100")!;
  const dryRun = args.includes("--dry-run");

  const stockLists: Record<string, readonly string[]> = { bist30: BIST30, bist50: BIST50, bist100: BIST100 };
  const stocks = [...new Set(stockLists[scope] ?? BIST100)];

  // Fundamental skorları yükle
  const fundamentalsRaw = loadFundamentals();
  const fundScores: Record<string, ReturnType<typeof scoreFundamentals>> = {};
  if (fundamentalsRaw) {
    for (const [code, data] of Object.entries(fundamentalsRaw)) {
      fundScores[code] = scoreFundamentals(data as FundamentalData);
    }
  }

  // Macro verisi
  const macro = loadMacro();
  const bist100Bars = macro?.bist100 ?? [];
  const bist100Map = new Map(bist100Bars.filter(b => b.close > 0).map(b => [b.date, b]));

  console.log(`\n═══ PIPELINE BACKFILL: ${scope.toUpperCase()} — Son ${days} iş günü ═══`);
  console.log(`Hisse: ${stocks.length} | Fundamental: ${Object.keys(fundScores).length} | ${dryRun ? "DRY RUN" : "DB'YE YAZILACAK"}\n`);

  let totalSignals = 0;
  let totalVerdicts = 0;
  let totalSkipped = 0;
  const startTime = Date.now();

  for (let si = 0; si < stocks.length; si++) {
    const code = stocks[si];
    const bars = loadBars(code);
    if (!bars || bars.length < MIN_BARS + days + 1) { totalSkipped++; continue; }

    const fundScore = fundScores[code] ?? null;

    // Son N iş gününü analiz et
    const startIdx = Math.max(MIN_BARS, bars.length - days);
    const endIdx = bars.length;

    for (let i = startIdx; i < endIdx; i++) {
      const window = bars.slice(0, i + 1);
      const currentBar = bars[i];
      const price = currentBar.close;
      const volume = currentBar.volume;
      const date = new Date(currentBar.date + "T00:00:00Z");

      let technicals;
      try { technicals = calculateFullTechnicals(window, price, volume); } catch { continue; }

      // Signals + filter
      const signals = detectSignals(technicals, price);
      for (const cp of detectCandlestickPatterns(window)) signals.push({ type: `CANDLE_${cp.name}`, direction: cp.direction, strength: cp.strength, description: cp.description });
      for (const cp of detectChartPatterns(window)) signals.push({ type: `CHART_${cp.name}`, direction: cp.direction, strength: cp.strength, description: cp.description });
      const filteredSignals = signals.filter(s => !BLACKLISTED_SIGNALS.has(`${s.type}|${s.direction}`));

      // Macro
      const bistBar = bist100Map.get(currentBar.date);
      const macroData = bistBar ? {
        vix: null as number | null,
        bist100Change: bistBar.open > 0 ? ((bistBar.close - bistBar.open) / bistBar.open) * 100 : null,
        usdTryChange: null as number | null,
        macroScore: 50,
      } : null;

      // Score + Verdict
      const score = calculateCompositeScore(technicals, price, 0, fundScore ?? null, macroData);
      let verdict: ReturnType<typeof calculateVerdict> | null = null;
      try {
        const extra = calculateExtraIndicators(window, technicals?.bbUpper, technicals?.bbLower);
        verdict = calculateVerdict({
          price,
          technicals: technicals as unknown as Record<string, unknown>,
          extraIndicators: extra as unknown as VerdictInput["extraIndicators"],
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

      if (dryRun) {
        totalSignals += filteredSignals.length;
        if (verdict) totalVerdicts++;
        continue;
      }

      // ── DB: DailySummary ──
      if (verdict) {
        await prisma.dailySummary.upsert({
          where: { stockCode_date_timeframe: { stockCode: code, date, timeframe: "daily" } },
          create: {
            stockCode: code, date, timeframe: "daily",
            closePrice: price,
            changePercent: currentBar.open > 0 ? ((price - currentBar.open) / currentBar.open) * 100 : null,
            volume: volume ? BigInt(Math.round(volume)) : null,
            compositeScore: score?.composite ?? null,
            verdictAction: verdict.action,
            verdictScore: verdict.score,
            verdictConfidence: verdict.confidence,
            sentimentValue: 0,
            status: "COMPLETED",
            analyzedAt: new Date(),
          },
          update: {
            closePrice: price,
            compositeScore: score?.composite ?? null,
            verdictAction: verdict.action,
            verdictScore: verdict.score,
            verdictConfidence: verdict.confidence,
            analyzedAt: new Date(),
          },
        });
        totalVerdicts++;
      }

      // ── DB: Signals ──
      for (const signal of filteredSignals) {
        await prisma.signal.upsert({
          where: {
            stockCode_date_signalType_signalDirection: {
              stockCode: code, date, signalType: signal.type, signalDirection: signal.direction,
            },
          },
          create: {
            stockCode: code, date, signalType: signal.type, signalDirection: signal.direction,
            strength: signal.strength, description: signal.description, priceAtSignal: price,
          },
          update: { strength: signal.strength, description: signal.description, priceAtSignal: price },
        });
        totalSignals++;
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const eta = (si + 1) > 0 ? Math.round((elapsed / (si + 1)) * (stocks.length - si - 1)) : 0;
    process.stdout.write(`[${si + 1}/${stocks.length}] ${code} | ${totalSignals} sinyal, ${totalVerdicts} verdict | ETA: ${Math.floor(eta / 60)}dk ${eta % 60}sn    \r`);
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n\n═══ TAMAMLANDI ═══`);
  console.log(`Sinyal: ${totalSignals} | Verdict: ${totalVerdicts} | Atlanan: ${totalSkipped}`);
  console.log(`Süre: ${Math.floor(elapsed / 60)}dk ${elapsed % 60}sn`);
  console.log(dryRun ? "(DRY RUN — DB'ye yazılmadı)" : "DB'ye yazıldı ✓");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("\nFatal:", err);
  process.exit(1);
});
