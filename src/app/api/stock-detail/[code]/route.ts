import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { getHistoricalBars } from "@/lib/stock/yahoo";
import { calculateTechnicals } from "@/lib/stock/technicals";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = new (YahooFinance as any)({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const symbol = `${code.toUpperCase()}.IS`;

  try {
    const [quote, bars] = await Promise.all([
      yf.quote(symbol).catch(() => null),
      getHistoricalBars(code, 220),
    ]);

    // Financials
    const financials = {
      marketCap: quote?.marketCap ?? null,
      peRatio: quote?.trailingPE ?? null,
      pbRatio: quote?.priceToBook ?? null,
      dividendYield: quote?.dividendYield
        ? quote.dividendYield * 100
        : null,
      fiftyTwoWeekHigh: quote?.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: quote?.fiftyTwoWeekLow ?? null,
      avgVolume: quote?.averageDailyVolume3Month ?? null,
    };

    // Technicals
    const technicals =
      bars.length > 0
        ? calculateTechnicals(
            bars,
            quote?.regularMarketPrice ?? null,
            quote?.regularMarketVolume ?? null
          )
        : null;

    // Price history (last 30 days for sparkline)
    const priceHistory = bars.slice(-30).map((b) => ({
      date: b.date,
      close: b.close,
    }));

    return NextResponse.json({
      code: code.toUpperCase(),
      name: quote?.shortName ?? quote?.longName ?? code,
      price: quote?.regularMarketPrice ?? null,
      changePercent: quote?.regularMarketChangePercent ?? null,
      volume: quote?.regularMarketVolume ?? null,
      financials,
      technicals,
      priceHistory,
    });
  } catch (error) {
    console.error(`Stock detail error for ${code}:`, error);
    return NextResponse.json(
      { error: "Veri alınamadı" },
      { status: 500 }
    );
  }
}
