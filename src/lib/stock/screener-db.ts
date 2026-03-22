/**
 * Screener DB Read Layer
 * Cron tarafından yazılan ScreenerSnapshot verilerini okur
 */

import { prisma } from "@/lib/prisma";
import { STOCK_LISTS, type ScreenerIndex } from "@/lib/constants";
import { getIstanbulToday, dayRange } from "@/lib/date-utils";
import type { ScreenerResult, ScreenerStockResult, SectorSummary, MarketSummary } from "./batch-analysis";
import { SECTOR_INDICES } from "./sectors";

// ═══════════════════════════════════════
// DB QUERIES
// ═══════════════════════════════════════

export async function getScreenerSnapshots(
  index: ScreenerIndex,
): Promise<{ snapshots: Awaited<ReturnType<typeof prisma.screenerSnapshot.findMany>>; stale: boolean }> {
  const today = getIstanbulToday();

  // Boolean flag'li endeksler (cron tarafından set edilen)
  const booleanFilterMap: Record<string, Record<string, boolean>> = {
    bist30: { inBist30: true },
    bist50: { inBist50: true },
    bist100: { inBist100: true },
  };

  // Index'e göre filtre (tarih hariç)
  let indexFilter: Record<string, unknown> = {};
  if (index !== "bistall") {
    if (booleanFilterMap[index]) {
      indexFilter = booleanFilterMap[index];
    } else {
      const stockList = STOCK_LISTS[index];
      indexFilter = { stockCode: { in: [...stockList] } };
    }
  }

  // Bugünün range query'si
  let snapshots = await prisma.screenerSnapshot.findMany({
    where: { date: dayRange(today), ...indexFilter },
    orderBy: { compositeScore: "desc" },
  });

  // Bugün veri yoksa dünkü veriyi dön
  if (snapshots.length === 0) {
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    snapshots = await prisma.screenerSnapshot.findMany({
      where: { date: dayRange(yesterday), ...indexFilter },
      orderBy: { compositeScore: "desc" },
    });
    return { snapshots, stale: true };
  }

  return { snapshots, stale: false };
}

// ═══════════════════════════════════════
// TRANSFORM — DB rows → ScreenerResult
// ═══════════════════════════════════════

type SnapshotRow = Awaited<ReturnType<typeof prisma.screenerSnapshot.findMany>>[number];

function rowToStock(row: SnapshotRow): ScreenerStockResult {
  return {
    code: row.stockCode,
    name: row.name ?? row.stockCode,
    price: row.price,
    changePercent: row.changePercent,
    volume: row.volume,
    composite: row.compositeJson as ScreenerStockResult["composite"] ?? null,
    verdict: row.verdictJson as ScreenerStockResult["verdict"] ?? null,
    rsi14: row.rsi14,
    macdHistogram: row.macdHistogram,
    maAlignment: row.maAlignment,
    adx14: row.adx14,
    fundamentalScore: row.fundamentalJson as ScreenerStockResult["fundamentalScore"] ?? null,
    peRatio: row.peRatio,
    pbRatio: row.pbRatio,
    dividendYield: row.dividendYield,
    fiftyTwoWeekHigh: row.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: row.fiftyTwoWeekLow,
    fromFiftyTwoHigh: row.fromFiftyTwoHigh,
    riskMetrics: (row.riskJson as unknown as ScreenerStockResult["riskMetrics"]) ?? null,
    signals: (row.signalsJson as unknown as ScreenerStockResult["signals"]) ?? [],
    signalCombination: (row.signalCombinationJson as unknown as ScreenerStockResult["signalCombination"]) ?? null,
    multiTimeframe: (row.mtfJson as unknown as ScreenerStockResult["multiTimeframe"]) ?? null,
    sectorCode: row.sectorCode,
    sectorName: row.sectorName,
  };
}

function buildSectorSummaryFromRows(rows: SnapshotRow[]): Record<string, SectorSummary> {
  const map: Record<string, { scores: number[]; changes: number[]; stocks: SnapshotRow[] }> = {};

  for (const r of rows) {
    const sc = r.sectorCode;
    if (!sc) continue;
    if (!map[sc]) map[sc] = { scores: [], changes: [], stocks: [] };
    if (r.compositeScore != null) map[sc].scores.push(r.compositeScore);
    if (r.changePercent != null) map[sc].changes.push(r.changePercent);
    map[sc].stocks.push(r);
  }

  const result: Record<string, SectorSummary> = {};
  for (const [code, data] of Object.entries(map)) {
    const avgScore = data.scores.length > 0 ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length : 0;
    const avgChange = data.changes.length > 0 ? data.changes.reduce((a, b) => a + b, 0) / data.changes.length : 0;
    const topStock = data.stocks
      .filter(s => s.compositeScore != null)
      .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0))[0];

    result[code] = {
      sectorName: SECTOR_INDICES[code]?.name ?? code,
      avgScore: Math.round(avgScore * 10) / 10,
      avgChange: Math.round(avgChange * 100) / 100,
      stockCount: data.stocks.length,
      topStock: topStock?.stockCode ?? data.stocks[0]?.stockCode ?? "",
    };
  }
  return result;
}

function buildMarketSummaryFromRows(rows: SnapshotRow[]): MarketSummary {
  let totalComposite = 0, compositeCount = 0;
  let strongBuy = 0, buy = 0, hold = 0, sell = 0, strongSell = 0;
  let bullish = 0, bearish = 0;

  for (const r of rows) {
    if (r.compositeScore != null) { totalComposite += r.compositeScore; compositeCount++; }
    switch (r.verdictAction) {
      case "GUCLU_AL": strongBuy++; break;
      case "AL": buy++; break;
      case "TUT": hold++; break;
      case "SAT": sell++; break;
      case "GUCLU_SAT": strongSell++; break;
    }
    bullish += r.bullishSignalCount;
    bearish += r.bearishSignalCount;
  }

  return {
    avgComposite: compositeCount > 0 ? Math.round((totalComposite / compositeCount) * 10) / 10 : 0,
    strongBuyCount: strongBuy,
    buyCount: buy,
    holdCount: hold,
    sellCount: sell,
    strongSellCount: strongSell,
    bullishSignalCount: bullish,
    bearishSignalCount: bearish,
  };
}

export function snapshotsToScreenerResult(
  snapshots: SnapshotRow[],
  index: ScreenerIndex,
  stale: boolean,
): ScreenerResult & { stale: boolean } {
  const stocks = snapshots.map(rowToStock);
  const generatedAt = snapshots[0]?.createdAt?.toISOString() ?? new Date().toISOString();

  return {
    stocks,
    macroData: null, // Macro verisi ayrı endpoint'ten gelir
    regime: "NORMAL",
    generatedAt,
    index,
    timeframe: "daily",
    sectorSummary: buildSectorSummaryFromRows(snapshots),
    marketSummary: buildMarketSummaryFromRows(snapshots),
    stale,
  };
}
