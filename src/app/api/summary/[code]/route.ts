import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const stockCode = code.replace(".IS", "").toUpperCase();

  const today = new Date();
  const todayDate = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  );

  const summary = await prisma.dailySummary.findUnique({
    where: {
      stockCode_date: {
        stockCode,
        date: todayDate,
      },
    },
  });

  if (!summary) {
    return NextResponse.json(
      { error: "Bugün için analiz bulunamadı" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    id: summary.id,
    stockCode: summary.stockCode,
    date: summary.date.toISOString(),
    closePrice: summary.closePrice,
    changePercent: summary.changePercent,
    aiSummaryText: summary.aiSummaryText,
    sentimentScore: summary.sentimentScore,
    status: summary.status,
  });
}
