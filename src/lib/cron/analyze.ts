import { prisma } from "@/lib/prisma";
import { getStockQuote, getHistoricalBars } from "@/lib/stock/yahoo";
import { getStockNews } from "@/lib/news/kap-rss";
import { generateStockAnalysis } from "@/lib/ai/provider";
import { calculateTechnicals } from "@/lib/stock/technicals";

function getToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runDailyAnalysis(): Promise<{
  processed: number;
  skipped: number;
  failed: number;
}> {
  const today = getToday();
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  // 1. Get all unique stock codes
  const stocks = await prisma.portfolio.findMany({
    distinct: ["stockCode"],
    select: { stockCode: true },
  });

  if (stocks.length === 0) {
    return { processed: 0, skipped: 0, failed: 0 };
  }

  const stockCodes = stocks.map((s) => s.stockCode);

  // 2. Skip already completed
  const existing = await prisma.dailySummary.findMany({
    where: {
      date: today,
      stockCode: { in: stockCodes },
      status: "COMPLETED",
    },
    select: { stockCode: true },
  });

  const existingSet = new Set(existing.map((s) => s.stockCode));
  const toAnalyze = stockCodes.filter((code) => !existingSet.has(code));
  skipped = existingSet.size;

  if (toAnalyze.length === 0) {
    return { processed: 0, skipped, failed: 0 };
  }

  // 3. Process sequentially (Groq free tier: 30 RPM)
  for (const stockCode of toAnalyze) {
    try {
      // Mark PENDING
      await prisma.dailySummary.upsert({
        where: { stockCode_date: { stockCode, date: today } },
        create: { stockCode, date: today, status: "PENDING" },
        update: { status: "PENDING" },
      });

      // Fetch data in parallel: quote + news + historical
      const [quote, headlines, bars] = await Promise.all([
        getStockQuote(stockCode),
        getStockNews(stockCode),
        getHistoricalBars(stockCode, 220), // 220 gün (MA200 için)
      ]);

      // Calculate technicals with CODE (not AI!)
      const technicals =
        bars.length > 0
          ? calculateTechnicals(bars, quote?.price ?? null, quote?.volume ?? null)
          : null;

      // Feed everything to AI for STORYTELLING only
      const analysis = await generateStockAnalysis({
        stockCode,
        price: quote?.price ?? null,
        changePercent: quote?.changePercent ?? null,
        volume: quote?.volume ?? null,
        newsHeadlines: headlines,
        date: today.toISOString().split("T")[0],
        technicals,
      });

      if (analysis) {
        await prisma.dailySummary.update({
          where: { stockCode_date: { stockCode, date: today } },
          data: {
            closePrice: quote?.price ?? null,
            changePercent: quote?.changePercent ?? null,
            volume: quote?.volume ? BigInt(quote.volume) : null,
            newsHeadlines: headlines,
            aiSummaryText: analysis.summaryText,
            sentimentScore: analysis.sentimentScore,
            status: "COMPLETED",
          },
        });
        processed++;
      } else {
        await prisma.dailySummary.update({
          where: { stockCode_date: { stockCode, date: today } },
          data: {
            closePrice: quote?.price ?? null,
            changePercent: quote?.changePercent ?? null,
            status: "FAILED",
          },
        });
        failed++;
      }

      // Rate limit pause
      await sleep(3000);
    } catch (error) {
      console.error(`Analysis failed for ${stockCode}:`, error);
      failed++;
    }
  }

  return { processed, skipped, failed };
}
