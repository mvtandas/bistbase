import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = new (YahooFinance as any)({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

const INDICES = [
  { symbol: "XU100.IS", name: "BİST 100" },
  { symbol: "XU030.IS", name: "BİST 30" },
  { symbol: "XBANK.IS", name: "Bankacılık" },
  { symbol: "XHOLD.IS", name: "Holding" },
  { symbol: "XUSIN.IS", name: "Sınai" },
  { symbol: "XELKT.IS", name: "Elektrik" },
];

// En çok işlem gören BİST hisseleri (top movers'ı buradan çekeceğiz)
const TOP_STOCKS = [
  "THYAO.IS", "ASELS.IS", "SISE.IS", "KCHOL.IS", "BIMAS.IS",
  "TUPRS.IS", "SAHOL.IS", "EREGL.IS", "GARAN.IS", "AKBNK.IS",
  "YKBNK.IS", "FROTO.IS", "TOASO.IS", "PGSUS.IS", "EKGYO.IS",
  "SASA.IS", "PETKM.IS", "TCELL.IS", "HEKTS.IS", "KOZAL.IS",
];

export async function GET() {
  try {
    // Fetch indices
    const indices = await Promise.all(
      INDICES.map(async ({ symbol, name }) => {
        try {
          const quote = await yf.quote(symbol);
          return {
            name,
            price: quote?.regularMarketPrice ?? null,
            changePercent: quote?.regularMarketChangePercent ?? null,
          };
        } catch {
          return { name, price: null, changePercent: null };
        }
      })
    );

    // Fetch top movers
    const stockQuotes = await Promise.all(
      TOP_STOCKS.map(async (symbol) => {
        try {
          const quote = await yf.quote(symbol);
          return {
            code: symbol.replace(".IS", ""),
            name: quote?.shortName ?? symbol.replace(".IS", ""),
            price: quote?.regularMarketPrice ?? null,
            changePercent: quote?.regularMarketChangePercent ?? null,
            volume: quote?.regularMarketVolume ?? null,
            marketCap: quote?.marketCap ?? null,
          };
        } catch {
          return null;
        }
      })
    );

    const validStocks = stockQuotes.filter(
      (s): s is NonNullable<typeof s> => s !== null && s.changePercent !== null
    );

    const sorted = [...validStocks].sort(
      (a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0)
    );

    const gainers = sorted.slice(0, 5);
    const losers = sorted.slice(-5).reverse();

    return NextResponse.json({
      indices,
      gainers,
      losers,
    });
  } catch {
    return NextResponse.json({ indices: [], gainers: [], losers: [] });
  }
}
