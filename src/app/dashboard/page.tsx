import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DailyFeed } from "@/components/dashboard/daily-feed";
import type { DailySummaryData } from "@/types";

export default async function DashboardPage() {
  const session = await auth();

  const portfolios = await prisma.portfolio.findMany({
    where: { userId: session!.user.id },
    select: { stockCode: true },
    orderBy: { addedAt: "asc" },
  });

  const stockCodes = portfolios.map((p) => p.stockCode);

  // Fetch today's summaries
  const today = new Date();
  const todayDate = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  );

  const summaries = await prisma.dailySummary.findMany({
    where: {
      stockCode: { in: stockCodes },
      date: todayDate,
    },
  });

  const initialSummaries: Record<string, DailySummaryData> = {};
  for (const s of summaries) {
    initialSummaries[s.stockCode] = {
      id: s.id,
      stockCode: s.stockCode,
      date: s.date.toISOString(),
      closePrice: s.closePrice,
      changePercent: s.changePercent,
      aiSummaryText: s.aiSummaryText,
      sentimentScore: s.sentimentScore,
      status: s.status,
    };
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Portföyüm</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Günlük yapay zeka destekli hisse analizleri
        </p>
      </div>

      <DailyFeed stockCodes={stockCodes} initialSummaries={initialSummaries} />
    </div>
  );
}
