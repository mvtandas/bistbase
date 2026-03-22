import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import YahooFinance from "yahoo-finance2";
import { getHistoricalBars } from "@/lib/stock/yahoo";
import { calculateFullTechnicals } from "@/lib/stock/technicals";
import { calculateCompositeScore } from "@/lib/stock/scoring";
import { calculateRiskMetrics } from "@/lib/stock/risk";
import { getFundamentalData, scoreFundamentals } from "@/lib/stock/fundamentals";
import { calculateWhatIf } from "@/lib/stock/portfolio-advanced";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = new (YahooFinance as any)({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action, stockCode } = await req.json();
  if (!action || !stockCode) return NextResponse.json({ error: "action ve stockCode gerekli" }, { status: 400 });

  // Mevcut portföy
  const portfolios = await prisma.portfolio.findMany({
    where: { userId: session.user.id },
    select: { stockCode: true, quantity: true, avgCost: true },
  });

  // Her hisse için basit metrikler
  const currentHoldings = await Promise.all(
    portfolios.map(async (p) => {
      try {
        const [quote, bars, fd] = await Promise.all([
          yf.quote(`${p.stockCode}.IS`).catch(() => null),
          getHistoricalBars(p.stockCode, 90).catch(() => []),
          getFundamentalData(p.stockCode).catch(() => null),
        ]);
        const price = quote?.regularMarketPrice ?? 0;
        const technicals = bars.length > 30 ? calculateFullTechnicals(bars, price, quote?.regularMarketVolume ?? null) : null;
        const fundScore = fd ? scoreFundamentals(fd) : null;
        const score = technicals ? calculateCompositeScore(technicals, price, 0, fundScore) : null;
        const risk = bars.length >= 30 ? calculateRiskMetrics(bars, fd?.beta ?? null) : null;
        return {
          stockCode: p.stockCode,
          weight: 100 / portfolios.length,
          compositeScore: score?.composite ?? 50,
          beta: fd?.beta ?? 1,
          volatility: (risk?.annualVolatility ?? 30) / 100,
        };
      } catch {
        return { stockCode: p.stockCode, weight: 100 / portfolios.length, compositeScore: 50, beta: 1, volatility: 0.3 };
      }
    })
  );

  // Target stock data
  let targetData = null;
  if (action === "ADD") {
    try {
      const [quote, bars, fd] = await Promise.all([
        yf.quote(`${stockCode}.IS`).catch(() => null),
        getHistoricalBars(stockCode, 90).catch(() => []),
        getFundamentalData(stockCode).catch(() => null),
      ]);
      const price = quote?.regularMarketPrice ?? 0;
      const technicals = bars.length > 30 ? calculateFullTechnicals(bars, price, quote?.regularMarketVolume ?? null) : null;
      const fundScore = fd ? scoreFundamentals(fd) : null;
      const score = technicals ? calculateCompositeScore(technicals, price, 0, fundScore) : null;
      const risk = bars.length >= 30 ? calculateRiskMetrics(bars, fd?.beta ?? null) : null;
      targetData = {
        compositeScore: score?.composite ?? 50,
        beta: fd?.beta ?? 1,
        volatility: (risk?.annualVolatility ?? 30) / 100,
      };
    } catch { /* fallback */ }
  }

  const result = calculateWhatIf(currentHoldings, action, stockCode, targetData);
  return NextResponse.json(result);
}
