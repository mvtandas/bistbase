/**
 * BIST Bar Download Script
 * Yahoo Finance'ten tüm BIST hisselerinin 5 yıllık OHLCV barlarını indirir.
 * Kullanım: npx tsx scripts/download-bars.ts [--scope bist100|bist-all]
 */

import YahooFinance from "yahoo-finance2";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { BIST_ALL, BIST100, BIST50, BIST30 } from "../src/lib/constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = new (YahooFinance as any)({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

const DATA_DIR = join(process.cwd(), "data");
const BARS_DIR = join(DATA_DIR, "bars");

// ═══ Config ═══

const LOOKBACK_DAYS = 1460 + 200; // 5 yıl + 200 gün warmup
const DELAY_MS = 1500; // Yahoo rate limit koruması
const MACRO_SYMBOLS = [
  { symbol: "^VIX", key: "vix" },
  { symbol: "USDTRY=X", key: "usdTry" },
  { symbol: "EURTRY=X", key: "eurTry" },
  { symbol: "XU100.IS", key: "bist100" },
  { symbol: "GC=F", key: "goldUsd" },
  { symbol: "DX-Y.NYB", key: "dxy" },
];

interface Bar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ═══ Helpers ═══

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function toISSymbol(code: string): string {
  return `${code.replace(".IS", "").toUpperCase()}.IS`;
}

async function fetchBars(symbol: string): Promise<Bar[]> {
  const start = new Date();
  start.setDate(start.getDate() - LOOKBACK_DAYS);

  const history = await yf.historical(symbol, {
    period1: start,
    period2: new Date(),
  });

  if (!history || !Array.isArray(history)) return [];

  return history
    .filter((bar: Record<string, unknown>) => bar.close != null && bar.open != null)
    .map((bar: Record<string, unknown>) => ({
      date: bar.date ? new Date(bar.date as string).toISOString().split("T")[0] : "",
      open: bar.open as number,
      high: bar.high as number,
      low: bar.low as number,
      close: bar.close as number,
      volume: (bar.volume as number) ?? 0,
    }));
}

// ═══ Main ═══

async function main() {
  // Parse args
  const args = process.argv.slice(2);
  const scopeArg = args.find((a) => a.startsWith("--scope="))?.split("=")[1]
    ?? args[args.indexOf("--scope") + 1]
    ?? "bist-all";

  let stockList: readonly string[];
  let scopeLabel: string;

  switch (scopeArg) {
    case "bist30":
      stockList = BIST30;
      scopeLabel = "BIST30";
      break;
    case "bist50":
      stockList = BIST50;
      scopeLabel = "BIST50";
      break;
    case "bist100":
      stockList = BIST100;
      scopeLabel = "BIST100";
      break;
    default:
      stockList = BIST_ALL;
      scopeLabel = "BIST_ALL";
  }

  // Deduplicate
  const stocks = [...new Set(stockList)];

  console.log(`\n═══ BAR DOWNLOAD: ${scopeLabel} (${stocks.length} hisse) ═══`);
  console.log(`Lookback: ${LOOKBACK_DAYS} gün (~5 yıl + warmup)`);
  console.log(`Delay: ${DELAY_MS}ms per request`);
  console.log(`Tahmini süre: ~${Math.round((stocks.length * DELAY_MS) / 60000)} dakika\n`);

  // Ensure directories
  if (!existsSync(BARS_DIR)) mkdirSync(BARS_DIR, { recursive: true });

  let success = 0;
  let failed = 0;
  let skipped = 0;
  let totalBars = 0;
  const failedStocks: string[] = [];
  const startTime = Date.now();

  for (let i = 0; i < stocks.length; i++) {
    const code = stocks[i];
    const filePath = join(BARS_DIR, `${code}.json`);

    // Skip if already downloaded (resume support)
    if (existsSync(filePath)) {
      skipped++;
      process.stdout.write(`[${i + 1}/${stocks.length}] ${code} ⏭ (zaten var)\r`);
      continue;
    }

    try {
      const symbol = toISSymbol(code);
      const bars = await fetchBars(symbol);

      if (bars.length > 0) {
        writeFileSync(filePath, JSON.stringify(bars));
        totalBars += bars.length;
        success++;
        process.stdout.write(`[${i + 1}/${stocks.length}] ${code} ✓ (${bars.length} bar)          \r`);
      } else {
        failed++;
        failedStocks.push(code);
        process.stdout.write(`[${i + 1}/${stocks.length}] ${code} ✗ (veri yok)          \r`);
      }
    } catch (err) {
      failed++;
      failedStocks.push(code);
      process.stdout.write(`[${i + 1}/${stocks.length}] ${code} ✗ (${(err as Error).message?.slice(0, 40)})  \r`);
    }

    await sleep(DELAY_MS);
  }

  // ── Macro verileri ──
  console.log(`\n\nMakro verileri indiriliyor...`);
  const macroData: Record<string, Bar[]> = {};

  for (const { symbol, key } of MACRO_SYMBOLS) {
    try {
      const bars = await fetchBars(symbol);
      macroData[key] = bars;
      console.log(`  ${key} (${symbol}): ${bars.length} bar ✓`);
    } catch (err) {
      console.log(`  ${key} (${symbol}): ✗ ${(err as Error).message?.slice(0, 50)}`);
    }
    await sleep(1000);
  }

  const macroPath = join(DATA_DIR, "macro.json");
  writeFileSync(macroPath, JSON.stringify(macroData));

  // ── Summary ──
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n═══ TAMAMLANDI ═══`);
  console.log(`Başarılı: ${success}  |  Başarısız: ${failed}  |  Atlandı: ${skipped}`);
  console.log(`Toplam bar: ${totalBars.toLocaleString()}`);
  console.log(`Süre: ${Math.floor(elapsed / 60)}dk ${elapsed % 60}sn`);

  if (failedStocks.length > 0) {
    console.log(`\nBaşarısız hisseler (${failedStocks.length}):`);
    console.log(failedStocks.join(", "));
  }

  console.log(`\nVeriler: ${BARS_DIR}`);
  console.log(`Makro: ${macroPath}`);
}

main().catch((err) => {
  console.error("\nFatal:", err);
  process.exit(1);
});
