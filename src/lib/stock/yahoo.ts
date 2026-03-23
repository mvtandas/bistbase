import YahooFinance from "yahoo-finance2";
import type { StockQuote, StockSearchResult } from "@/types";
import { cacheGet, cacheSet } from "@/lib/redis";
import { getQuoteTTL, getBarsTTL, getIntervalBarsTTL } from "./market-hours";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = new (YahooFinance as any)({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

// ── Circuit Breaker ──
// Yahoo 429/5xx aldığında cache TTL'lerini geçici olarak yükseltir.
let _circuitOpen = false;
let _circuitOpenUntil = 0;

function tripCircuitBreaker() {
  _circuitOpen = true;
  _circuitOpenUntil = Date.now() + 5 * 60 * 1000; // 5 dk boyunca yavaşla
  console.warn("[yahoo] Circuit breaker tripped — falling back to longer cache TTLs for 5 min");
}

function isCircuitOpen(): boolean {
  if (!_circuitOpen) return false;
  if (Date.now() > _circuitOpenUntil) {
    _circuitOpen = false;
    return false;
  }
  return true;
}

/** Circuit breaker aktifken cache TTL'lerini 10x artır */
function effectiveQuoteTTL(): number {
  return isCircuitOpen() ? 300 : getQuoteTTL(); // circuit açıkken 5dk
}

function effectiveBarsTTL(): number {
  return isCircuitOpen() ? 3600 : getBarsTTL(); // circuit açıkken 1 saat
}

/** Return a safe end date that excludes any incomplete (today's) bar.
 *  Yahoo Finance uses UTC dates but BIST operates in UTC+3.
 *  We subtract 1 day to guarantee no partial bar is included. */
function safeEndDate(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function toISSymbol(code: string): string {
  const clean = code.replace(".IS", "").toUpperCase();
  return `${clean}.IS`;
}

function isRateLimitError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes("429") || msg.includes("too many") || msg.includes("rate limit");
  }
  return false;
}

// Stale-while-revalidate: arka planda quote'u güncelle
const _refreshingQuotes = new Set<string>();
function refreshQuoteInBackground(code: string, symbol: string, cacheKey: string) {
  if (_refreshingQuotes.has(cacheKey)) return; // zaten yenileniyor
  _refreshingQuotes.add(cacheKey);
  yf.quote(symbol)
    .then(async (quote: Record<string, unknown>) => {
      if (quote?.regularMarketPrice) {
        const result: StockQuote = {
          code: code.replace(".IS", "").toUpperCase(),
          name: (quote.shortName ?? quote.longName ?? code) as string,
          price: (quote.regularMarketPrice as number) ?? null,
          changePercent: (quote.regularMarketChangePercent as number) ?? null,
          volume: (quote.regularMarketVolume as number) ?? null,
        };
        await cacheSet(cacheKey, result, effectiveQuoteTTL());
      }
    })
    .catch((err: unknown) => {
      if (isRateLimitError(err)) tripCircuitBreaker();
    })
    .finally(() => _refreshingQuotes.delete(cacheKey));
}

export async function getStockQuote(code: string): Promise<StockQuote | null> {
  const symbol = toISSymbol(code);
  const cacheKey = `quote:${code.replace(".IS", "").toUpperCase()}`;

  const cached = await cacheGet<StockQuote>(cacheKey);
  if (cached) {
    // Stale-while-revalidate: cache varsa hemen dön, arka planda yenile
    if (!isCircuitOpen()) {
      refreshQuoteInBackground(code, symbol, cacheKey);
    }
    return cached;
  }

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
      await cacheSet(cacheKey, result, effectiveQuoteTTL());
      return result;
    }
  } catch (err) {
    if (isRateLimitError(err)) tripCircuitBreaker();
    // quote failed, try historical fallback
  }

  try {
    // Fallback: last 7 days historical
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const chartResult = await yf.chart(symbol, {
      period1: startDate,
      period2: new Date(),
    });
    const history = (chartResult?.quotes ?? []).filter(
      (b: Record<string, unknown>) => b.close != null
    );

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
      await cacheSet(cacheKey, result, effectiveQuoteTTL());
      return result;
    }
  } catch (error) {
    if (isRateLimitError(error)) tripCircuitBreaker();
    console.error(`Yahoo Finance error for ${symbol}:`, error);
  }

  return null;
}

export async function getHistoricalBars(
  code: string,
  days = 220
): Promise<{ date: string; open: number; close: number; high: number; low: number; volume: number }[]> {
  const symbol = toISSymbol(code);
  const normalizedCode = code.replace(".IS", "").toUpperCase();
  const cacheKey = `bars:${normalizedCode}:${days}`;

  // Check Redis cache (15 min TTL for historical bars)
  const cached = await cacheGet<{ date: string; open: number; close: number; high: number; low: number; volume: number }[]>(cacheKey);
  if (cached) return cached;

  // Smart derivation: if requesting fewer days than 220, try to slice from the 220-day cache
  if (days < 220) {
    const longerCached = await cacheGet<{ date: string; open: number; close: number; high: number; low: number; volume: number }[]>(`bars:${normalizedCode}:220`);
    if (longerCached && longerCached.length >= days) {
      const derived = longerCached.slice(-days);
      await cacheSet(cacheKey, derived, effectiveBarsTTL());
      return derived;
    }
  }

  try {
    const start = new Date();
    start.setDate(start.getDate() - days);
    // Use chart() directly — historical() has a hardcoded throw for partial null bars
    // that cannot be disabled, breaking queries during market hours (BIST UTC+3).
    const chartResult = await yf.chart(symbol, {
      period1: start,
      period2: new Date(),
    });
    const quotes = chartResult?.quotes;
    if (!quotes || !Array.isArray(quotes)) return [];
    const bars = quotes
      .filter((bar: Record<string, unknown>) => bar.close != null && bar.open != null)
      .map((bar: Record<string, unknown>) => ({
        date: bar.date ? new Date(bar.date as string).toISOString().split("T")[0] : "",
        open: (bar.open as number) ?? 0,
        close: (bar.close as number) ?? 0,
        high: (bar.high as number) ?? 0,
        low: (bar.low as number) ?? 0,
        volume: (bar.volume as number) ?? 0,
      }));
    // Only cache non-empty results to avoid propagating temporary Yahoo failures
    if (bars.length > 0) {
      await cacheSet(cacheKey, bars, effectiveBarsTTL());
    }
    return bars;
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
  const cacheKey = `bars:${code.replace(".IS", "").toUpperCase()}:${interval}:${days}`;

  // Check Redis cache (30 min TTL for weekly/monthly bars)
  const cached = await cacheGet<{ date: string; open: number; close: number; high: number; low: number; volume: number }[]>(cacheKey);
  if (cached) return cached;

  try {
    const start = new Date();
    start.setDate(start.getDate() - days);
    // Use chart() directly — historical() has a hardcoded throw for partial null bars
    // that cannot be disabled via options, breaking weekly/monthly queries during market hours.
    const chartResult = await yf.chart(symbol, {
      period1: start,
      period2: new Date(),
      interval,
    });
    const quotes = chartResult?.quotes;
    if (!quotes || !Array.isArray(quotes)) return [];
    const bars = quotes
      .filter((bar: Record<string, unknown>) => bar.close != null && bar.open != null)
      .map((bar: Record<string, unknown>) => ({
        date: bar.date ? new Date(bar.date as string).toISOString().split("T")[0] : "",
        open: (bar.open as number) ?? 0,
        close: (bar.close as number) ?? 0,
        high: (bar.high as number) ?? 0,
        low: (bar.low as number) ?? 0,
        volume: (bar.volume as number) ?? 0,
      }));
    // Only cache non-empty results to avoid propagating temporary Yahoo failures
    if (bars.length > 0) {
      await cacheSet(cacheKey, bars, getIntervalBarsTTL());
    }
    return bars;
  } catch (error) {
    console.error(`Historical interval data error for ${symbol}:`, error);
    return [];
  }
}

/**
 * Toplu fiyat çekimi — tek Yahoo isteğiyle birden fazla hisse.
 * Her hisseyi ayrı cache'ler, eksik olanları batch ile çeker.
 */
export async function getBatchQuotes(codes: string[]): Promise<Map<string, StockQuote>> {
  const result = new Map<string, StockQuote>();
  const missingCodes: string[] = [];

  // 1. Cache'ten oku
  for (const code of codes) {
    const clean = code.replace(".IS", "").toUpperCase();
    const cached = await cacheGet<StockQuote>(`quote:${clean}`);
    if (cached) {
      result.set(clean, cached);
    } else {
      missingCodes.push(clean);
    }
  }

  if (missingCodes.length === 0) return result;

  // 2. Cache miss olanları tek seferde Yahoo'dan çek
  try {
    const symbols = missingCodes.map((c) => `${c}.IS`);
    const quotes = await yf.quote(symbols);
    const quoteArr = Array.isArray(quotes) ? quotes : [quotes];
    const ttl = effectiveQuoteTTL();

    for (const q of quoteArr) {
      if (!q?.regularMarketPrice || !q?.symbol) continue;
      const clean = (q.symbol as string).replace(".IS", "").toUpperCase();
      const stockQuote: StockQuote = {
        code: clean,
        name: q.shortName ?? q.longName ?? clean,
        price: q.regularMarketPrice ?? null,
        changePercent: q.regularMarketChangePercent ?? null,
        volume: q.regularMarketVolume ?? null,
      };
      result.set(clean, stockQuote);
      await cacheSet(`quote:${clean}`, stockQuote, ttl);
    }
  } catch (error) {
    if (isRateLimitError(error)) tripCircuitBreaker();
    console.error("Batch quote error:", error);
    // Fallback: tek tek çek
    for (const code of missingCodes) {
      const q = await getStockQuote(code);
      if (q) result.set(code, q);
    }
  }

  return result;
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
