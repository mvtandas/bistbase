import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StockDetailClient } from "./client";

export default async function StockDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const stockCode = code.toUpperCase();
  await auth();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const summaries = await prisma.dailySummary.findMany({
    where: {
      stockCode,
      date: { gte: thirtyDaysAgo },
      status: "COMPLETED",
    },
    orderBy: { date: "desc" },
    take: 10,
  });

  const serializedSummaries = summaries.map((s) => ({
    id: s.id,
    date: s.date.toISOString(),
    closePrice: s.closePrice,
    changePercent: s.changePercent,
    aiSummaryText: s.aiSummaryText,
    sentimentScore: s.sentimentScore,
  }));

  return (
    <StockDetailClient
      stockCode={stockCode}
      summaries={serializedSummaries}
    />
  );
}
