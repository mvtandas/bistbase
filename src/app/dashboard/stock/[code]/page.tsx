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

  let serializedSummaries: {
    id: string; date: string; closePrice: number | null; changePercent: number | null;
    aiSummaryText: string | null; sentimentScore: string | null;
    compositeScore: number | null; bullCase: string | null; bearCase: string | null; confidence: string | null;
    verdictReason: string | null;
  }[] = [];

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const summaries = await prisma.dailySummary.findMany({
      where: { stockCode, date: { gte: thirtyDaysAgo }, status: "COMPLETED" },
      orderBy: { date: "desc" },
      take: 10,
    });

    serializedSummaries = summaries.map((s) => ({
      id: s.id,
      date: s.date?.toISOString() ?? new Date().toISOString(),
      closePrice: s.closePrice,
      changePercent: s.changePercent,
      aiSummaryText: s.aiSummaryText,
      sentimentScore: s.sentimentScore,
      compositeScore: s.compositeScore,
      bullCase: s.bullCase,
      bearCase: s.bearCase,
      confidence: s.confidence,
      verdictReason: s.verdictReason,
    }));
  } catch (e) {
    console.error("Failed to fetch summaries:", e);
    // Continue with empty summaries
  }

  return (
    <StockDetailClient
      stockCode={stockCode}
      summaries={serializedSummaries}
    />
  );
}
