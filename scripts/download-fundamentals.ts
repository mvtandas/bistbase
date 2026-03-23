/**
 * Fundamental Data Download Script
 * Yahoo Finance'ten tüm BIST hisselerinin temel analiz verilerini indirir.
 * Kullanım: npx tsx scripts/download-fundamentals.ts [--scope bist100|bist-all]
 */

import YahooFinance from "yahoo-finance2";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { BIST_ALL, BIST100, BIST50, BIST30 } from "../src/lib/constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = new (YahooFinance as any)({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

const DATA_DIR = join(process.cwd(), "data");
const DELAY_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs() {
  const args = process.argv.slice(2);
  const scope = args.find(a => a.startsWith("--scope="))?.split("=")[1]
    ?? args[args.indexOf("--scope") + 1]
    ?? "bist100";
  return { scope };
}

function getStockList(scope: string): string[] {
  const s: Record<string, readonly string[]> = { "bist30": BIST30, "bist50": BIST50, "bist100": BIST100, "bist-all": BIST_ALL };
  return [...new Set(s[scope] ?? BIST100)];
}

interface FundamentalRaw {
  peRatio: number | null;
  forwardPE: number | null;
  pegRatio: number | null;
  pbRatio: number | null;
  evToEbitda: number | null;
  marketCap: number | null;
  roe: number | null;
  roa: number | null;
  profitMargin: number | null;
  operatingMargin: number | null;
  grossMargin: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  freeCashFlowYield: number | null;
  operatingCashFlow: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  interestCoverage: number | null;
  dividendYield: number | null;
  beta: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  fromFiftyTwoHigh: number | null;
  fromFiftyTwoLow: number | null;
}

async function fetchFundamentals(code: string): Promise<FundamentalRaw | null> {
  const symbol = `${code.toUpperCase()}.IS`;

  try {
    let summary: Record<string, unknown> | null = null;
    try {
      summary = await yf.quoteSummary(symbol, {
        modules: ["financialData", "defaultKeyStatistics", "summaryDetail", "cashflowStatementHistory"],
      });
    } catch { /* fallback */ }

    const quote = await yf.quote(symbol).catch(() => null);
    if (!quote && !summary) return null;

    const fd = (summary as Record<string, Record<string, unknown>>)?.financialData ?? {};
    const ks = (summary as Record<string, Record<string, unknown>>)?.defaultKeyStatistics ?? {};
    const sd = (summary as Record<string, Record<string, unknown>>)?.summaryDetail ?? {};
    const cf = (summary as Record<string, Record<string, unknown>>)?.cashflowStatementHistory ?? {};

    const price = (quote?.regularMarketPrice as number) ?? null;
    const high52 = (quote?.fiftyTwoWeekHigh as number) ?? (sd.fiftyTwoWeekHigh as number) ?? null;
    const low52 = (quote?.fiftyTwoWeekLow as number) ?? (sd.fiftyTwoWeekLow as number) ?? null;
    const mktCap = (quote?.marketCap as number) ?? null;

    let freeCashFlowYield: number | null = null;
    let operatingCashFlow: number | null = null;
    try {
      const statements = (cf.cashflowStatements as Array<Record<string, unknown>>) ?? [];
      if (statements.length > 0) {
        const latest = statements[0];
        const ocf = (latest.totalCashFromOperatingActivities as number) ?? null;
        const capex = Math.abs((latest.capitalExpenditures as number) ?? 0);
        operatingCashFlow = ocf;
        if (ocf != null && mktCap && mktCap > 0) {
          freeCashFlowYield = ((ocf - capex) / mktCap) * 100;
        }
      }
    } catch { /* */ }

    return {
      peRatio: (quote?.trailingPE as number) ?? (sd.trailingPE as number) ?? null,
      forwardPE: (quote?.forwardPE as number) ?? (ks.forwardPE as number) ?? null,
      pegRatio: (ks.pegRatio as number) ?? null,
      pbRatio: (quote?.priceToBook as number) ?? (ks.priceToBook as number) ?? null,
      evToEbitda: (ks.enterpriseToEbitda as number) ?? null,
      marketCap: mktCap,
      roe: (fd.returnOnEquity as number) != null ? (fd.returnOnEquity as number) * 100 : null,
      roa: (fd.returnOnAssets as number) != null ? (fd.returnOnAssets as number) * 100 : null,
      profitMargin: (fd.profitMargins as number) != null ? (fd.profitMargins as number) * 100 : null,
      operatingMargin: (fd.operatingMargins as number) != null ? (fd.operatingMargins as number) * 100 : null,
      grossMargin: (fd.grossMargins as number) != null ? (fd.grossMargins as number) * 100 : null,
      revenueGrowth: (fd.revenueGrowth as number) != null ? (fd.revenueGrowth as number) * 100 : null,
      earningsGrowth: (fd.earningsGrowth as number) != null ? (fd.earningsGrowth as number) * 100 : null,
      freeCashFlowYield,
      operatingCashFlow,
      debtToEquity: (fd.debtToEquity as number) ?? null,
      currentRatio: (fd.currentRatio as number) ?? null,
      interestCoverage: null,
      dividendYield: (sd.dividendYield as number) != null ? (sd.dividendYield as number) * 100 : null,
      beta: (ks.beta as number) ?? (quote?.beta as number) ?? null,
      fiftyTwoWeekHigh: high52,
      fiftyTwoWeekLow: low52,
      fromFiftyTwoHigh: price && high52 ? ((price - high52) / high52) * 100 : null,
      fromFiftyTwoLow: price && low52 ? ((price - low52) / low52) * 100 : null,
    };
  } catch (err) {
    console.error(`  ✗ ${code}: ${(err as Error).message}`);
    return null;
  }
}

async function main() {
  const { scope } = parseArgs();
  const stocks = getStockList(scope);

  console.log(`\n═══ FUNDAMENTAL VERİ İNDİRME: ${scope.toUpperCase()} ═══`);
  console.log(`Hisse: ${stocks.length}\n`);

  const result: Record<string, FundamentalRaw> = {};
  let success = 0, failed = 0;

  for (let i = 0; i < stocks.length; i++) {
    const code = stocks[i];
    process.stdout.write(`[${i + 1}/${stocks.length}] ${code}...`);

    const data = await fetchFundamentals(code);
    if (data) {
      result[code] = data;
      success++;
      console.log(` ✓ PE:${data.peRatio?.toFixed(1) ?? '-'} ROE:${data.roe?.toFixed(1) ?? '-'}%`);
    } else {
      failed++;
      console.log(` ✗`);
    }

    if (i < stocks.length - 1) await sleep(DELAY_MS);
  }

  // Save
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const outPath = join(DATA_DIR, "fundamentals.json");
  writeFileSync(outPath, JSON.stringify(result, null, 2));

  console.log(`\n═══ TAMAMLANDI ═══`);
  console.log(`Başarılı: ${success} | Başarısız: ${failed}`);
  console.log(`Dosya: ${outPath}\n`);
}

main().catch((err) => {
  console.error("\nFatal:", err);
  process.exit(1);
});
