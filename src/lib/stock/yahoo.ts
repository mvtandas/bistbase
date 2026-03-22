import YahooFinance from "yahoo-finance2";
import type { StockQuote, StockSearchResult } from "@/types";
import { cacheGet, cacheSet } from "@/lib/redis";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = new (YahooFinance as any)({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

function toISSymbol(code: string): string {
  const clean = code.replace(".IS", "").toUpperCase();
  return `${clean}.IS`;
}

export async function getStockQuote(code: string): Promise<StockQuote | null> {
  const symbol = toISSymbol(code);
  const cacheKey = `quote:${code.replace(".IS", "").toUpperCase()}`;

  // Check Redis cache (5 min TTL)
  const cached = await cacheGet<StockQuote>(cacheKey);
  if (cached) return cached;

  try {
    const quote = await yf.quote(symbol);
    if (quote && quote.regularMarketPrice) {
      const result: StockQuote = {
        code: code.replace(".IS", "").toUpperCase(),
        name: quote.shortName ?? quote.longName ?? code,
        price: quote.regularMarketPrice ?? null,
        changePercent: quote.regularMarketChangePercent ?? null,
        volume: quote.regularMarketVolume ?? null,
      };
      await cacheSet(cacheKey, result, 300); // 5 min
      return result;
    }
  } catch {
    // quote failed, try historical fallback
  }

  try {
    // Fallback: last 7 days historical
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const history = await yf.historical(symbol, {
      period1: startDate,
      period2: endDate,
    });

    if (history && history.length > 0) {
      const latest = history[history.length - 1];
      const previous = history.length > 1 ? history[history.length - 2] : null;

      const closePrice = latest.close as number;
      const prevClose = previous ? (previous.close as number) : null;
      const changePercent =
        prevClose && closePrice
          ? ((closePrice - prevClose) / prevClose) * 100
          : null;

      let name = code;
      try {
        const q = await yf.quote(symbol);
        name = q?.shortName ?? q?.longName ?? code;
      } catch {
        // use code as name
      }

      const result: StockQuote = {
        code: code.replace(".IS", "").toUpperCase(),
        name,
        price: closePrice ?? null,
        changePercent,
        volume: (latest.volume as number) ?? null,
      };
      await cacheSet(cacheKey, result, 300); // 5 min
      return result;
    }
  } catch (error) {
    console.error(`Yahoo Finance error for ${symbol}:`, error);
  }

  return null;
}

export async function getHistoricalBars(
  code: string,
  days = 220
): Promise<{ date: string; open: number; close: number; high: number; low: number; volume: number }[]> {
  const symbol = toISSymbol(code);
  try {
    const start = new Date();
    start.setDate(start.getDate() - days);
    const history = await yf.historical(symbol, {
      period1: start,
      period2: new Date(),
    });
    if (!history || !Array.isArray(history)) return [];
    return history.map((bar: Record<string, unknown>) => ({
      date: bar.date ? new Date(bar.date as string).toISOString().split("T")[0] : "",
      open: (bar.open as number) ?? 0,
      close: (bar.close as number) ?? 0,
      high: (bar.high as number) ?? 0,
      low: (bar.low as number) ?? 0,
      volume: (bar.volume as number) ?? 0,
    }));
  } catch (error) {
    console.error(`Historical data error for ${symbol}:`, error);
    return [];
  }
}

export async function getHistoricalBarsInterval(
  code: string,
  interval: "1wk" | "1mo",
  days = 730
): Promise<{ date: string; open: number; close: number; high: number; low: number; volume: number }[]> {
  const symbol = toISSymbol(code);
  try {
    const start = new Date();
    start.setDate(start.getDate() - days);
    const history = await yf.historical(symbol, {
      period1: start,
      period2: new Date(),
      interval,
    });
    if (!history || !Array.isArray(history)) return [];
    return history.map((bar: Record<string, unknown>) => ({
      date: bar.date ? new Date(bar.date as string).toISOString().split("T")[0] : "",
      open: (bar.open as number) ?? 0,
      close: (bar.close as number) ?? 0,
      high: (bar.high as number) ?? 0,
      low: (bar.low as number) ?? 0,
      volume: (bar.volume as number) ?? 0,
    }));
  } catch (error) {
    console.error(`Historical interval data error for ${symbol}:`, error);
    return [];
  }
}

export async function searchStocks(
  query: string
): Promise<StockSearchResult[]> {
  try {
    const results = await yf.search(query, { newsCount: 0 });
    const quotes = (results.quotes ?? []) as Record<string, unknown>[];
    return quotes
      .filter(
        (q) =>
          q.exchange === "IST" ||
          (typeof q.symbol === "string" && q.symbol.endsWith(".IS"))
      )
      .slice(0, 20)
      .map((q) => ({
        code: (typeof q.symbol === "string" ? q.symbol : "").replace(
          ".IS",
          ""
        ),
        name:
          (typeof q.shortname === "string" ? q.shortname : null) ??
          (typeof q.longname === "string" ? q.longname : "") ??
          "",
      }));
  } catch (error) {
    console.error("Stock search error:", error);
    return [];
  }
}
