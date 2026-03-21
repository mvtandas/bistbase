import { prisma } from "@/lib/prisma";
import { getStockQuote } from "@/lib/stock/yahoo";
import { getKapNews } from "@/lib/news/kap-rss";
import { generateStockAnalysis } from "@/lib/ai/provider";

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function getToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
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

  // 1. Get all unique stock codes from portfolios
  const stocks = await prisma.portfolio.findMany({
    distinct: ["stockCode"],
    select: { stockCode: true },
  });

  if (stocks.length === 0) {
    return { processed: 0, skipped: 0, failed: 0 };
  }

  const stockCodes = stocks.map((s) => s.stockCode);

  // 2. Filter out stocks that already have today's summary
  const existing = await prisma.dailySummary.findMany({
    where: {
      date: today,
      stockCode: { in: stockCodes },
      status: { in: ["COMPLETED", "PENDING"] },
    },
    select: { stockCode: true },
  });

  const existingSet = new Set(existing.map((s) => s.stockCode));
  const toAnalyze = stockCodes.filter((code) => !existingSet.has(code));
  skipped = existingSet.size;

  if (toAnalyze.length === 0) {
    return { processed: 0, skipped, failed: 0 };
  }

  // 3. Process in chunks of 5 (rate limiting)
  const chunks = chunkArray(toAnalyze, 5);

  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (stockCode) => {
        try {
          // Create PENDING record
          await prisma.dailySummary.upsert({
            where: { stockCode_date: { stockCode, date: today } },
            create: { stockCode, date: today, status: "PENDING" },
            update: { status: "PENDING" },
          });

          // Fetch data
          const [quote, headlines] = await Promise.all([
            getStockQuote(stockCode),
            getKapNews(stockCode),
          ]);

          // Generate AI summary
          const analysis = await generateStockAnalysis({
            stockCode,
            price: quote?.price ?? null,
            changePercent: quote?.changePercent ?? null,
            volume: quote?.volume ?? null,
            newsHeadlines: headlines,
            date: today.toISOString().split("T")[0],
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
        } catch (error) {
          console.error(`Analysis failed for ${stockCode}:`, error);
          failed++;
        }
      })
    );

    // Pause between chunks to respect rate limits
    if (chunks.indexOf(chunk) < chunks.length - 1) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  return { processed, skipped, failed };
}
