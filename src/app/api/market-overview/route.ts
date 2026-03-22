import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { rateLimit } from "@/lib/rate-limit";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = new (YahooFinance as any)({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

const INDICES = [
  // Ana endeksler
  { symbol: "XU100.IS", name: "BİST 100" },
  { symbol: "XU030.IS", name: "BİST 30" },
  { symbol: "XU050.IS", name: "BİST 50" },
  // Sektör endeksleri
  { symbol: "XBANK.IS", name: "Bankacılık" },
  { symbol: "XHOLD.IS", name: "Holding" },
  { symbol: "XUSIN.IS", name: "Sınai" },
  { symbol: "XELKT.IS", name: "Elektrik" },
  { symbol: "XULAS.IS", name: "Ulaştırma" },
  { symbol: "XGIDA.IS", name: "Gıda" },
  { symbol: "XILTM.IS", name: "İletişim" },
  { symbol: "XMANA.IS", name: "Metal & Madencilik" },
  { symbol: "XTRZM.IS", name: "Turizm" },
  // Global referanslar
  { symbol: "USDTRY=X", name: "USD/TRY" },
  { symbol: "EURTRY=X", name: "EUR/TRY" },
  { symbol: "GC=F", name: "Altın (USD)" },
];

// En çok işlem gören BİST hisseleri (top movers'ı buradan çekeceğiz)
const TOP_STOCKS = [
  "THYAO.IS", "ASELS.IS", "SISE.IS", "KCHOL.IS", "BIMAS.IS",
  "TUPRS.IS", "SAHOL.IS", "EREGL.IS", "GARAN.IS", "AKBNK.IS",
  "YKBNK.IS", "FROTO.IS", "TOASO.IS", "PGSUS.IS", "EKGYO.IS",
  "SASA.IS", "PETKM.IS", "TCELL.IS", "HEKTS.IS", "KOZAL.IS",
];

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "anonymous";
  const { success } = rateLimit(`market-overview:${ip}`, 20, 60_000);
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

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

    // Breadth data
    const advancing = validStocks.filter((s) => (s.changePercent ?? 0) > 0).length;
    const declining = validStocks.filter((s) => (s.changePercent ?? 0) < 0).length;
    const unchanged = validStocks.length - advancing - declining;

    const advancingVolume = validStocks
      .filter((s) => (s.changePercent ?? 0) > 0)
      .reduce((sum, s) => sum + (s.volume ?? 0), 0);
    const decliningVolume = validStocks
      .filter((s) => (s.changePercent ?? 0) < 0)
      .reduce((sum, s) => sum + (s.volume ?? 0), 0);

    return NextResponse.json({
      indices,
      gainers,
      losers,
      breadth: {
        advancing,
        declining,
        unchanged,
        total: validStocks.length,
        advancingVolume,
        decliningVolume,
      },
    });
  } catch {
    return NextResponse.json({ indices: [], gainers: [], losers: [] });
  }
}
