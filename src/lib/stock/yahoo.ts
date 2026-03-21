import yahooFinance from "yahoo-finance2";
import type { StockQuote, StockSearchResult } from "@/types";

function toISSymbol(code: string): string {
  const clean = code.replace(".IS", "").toUpperCase();
  return `${clean}.IS`;
}

export async function getStockQuote(code: string): Promise<StockQuote | null> {
  const symbol = toISSymbol(code);
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quote = await (yahooFinance as any).quote(symbol) as Record<string, unknown>;
    return {
      code: code.replace(".IS", "").toUpperCase(),
      name: (quote.shortName as string) ?? (quote.longName as string) ?? code,
      price: (quote.regularMarketPrice as number) ?? null,
      changePercent: (quote.regularMarketChangePercent as number) ?? null,
      volume: (quote.regularMarketVolume as number) ?? null,
    };
  } catch (error) {
    console.error(`Yahoo Finance error for ${symbol}:`, error);
    return null;
  }
}

export async function searchStocks(
  query: string
): Promise<StockSearchResult[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = await (yahooFinance as any).search(query, { newsCount: 0 });
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
