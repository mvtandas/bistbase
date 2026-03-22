import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toIstanbulDateUTC } from "@/lib/date-utils";

const toUTCDate = toIstanbulDateUTC;

function serialize(s: {
  id: string; stockCode: string; date: Date;
  closePrice: number | null; changePercent: number | null;
  aiSummaryText: string | null; sentimentScore: string | null;
  status: string; compositeScore: number | null; sentimentValue: number | null;
  bullCase: string | null; bearCase: string | null; confidence: string | null;
  sectorCode: string | null; relativeStrength: number | null;
}) {
  return {
    id: s.id, stockCode: s.stockCode, date: s.date.toISOString(),
    closePrice: s.closePrice, changePercent: s.changePercent,
    aiSummaryText: s.aiSummaryText, sentimentScore: s.sentimentScore,
    status: s.status, compositeScore: s.compositeScore, sentimentValue: s.sentimentValue,
    bullCase: s.bullCase, bearCase: s.bearCase, confidence: s.confidence,
    sectorCode: s.sectorCode, relativeStrength: s.relativeStrength,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const stockCode = code.replace(".IS", "").toUpperCase();
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period"); // "week" | "month" | null (today)

  const now = new Date();
  const today = toUTCDate(now);

  // Single day (default — backward compatible)
  if (!period) {
    // Önce bugünü dene
    let summary = await prisma.dailySummary.findUnique({
      where: { stockCode_date_timeframe: { stockCode, date: today, timeframe: "daily" } },
    });

    // Bugün yoksa en son COMPLETED analizi getir (hafta sonu / tatil durumu)
    if (!summary) {
      summary = await prisma.dailySummary.findFirst({
        where: { stockCode, status: "COMPLETED" },
        orderBy: { date: "desc" },
      });
    }

    if (!summary) {
      return NextResponse.json({ error: "Analiz bulunamadı" }, { status: 404 });
    }

    return NextResponse.json(serialize(summary));
  }

  // Period-based query
  const startDate = new Date(today);
  if (period === "week") startDate.setDate(startDate.getDate() - 7);
  else if (period === "month") startDate.setDate(startDate.getDate() - 30);
  else return NextResponse.json({ error: "Geçersiz period: week veya month" }, { status: 400 });

  const summaries = await prisma.dailySummary.findMany({
    where: { stockCode, date: { gte: startDate, lte: today }, status: "COMPLETED" },
    orderBy: { date: "desc" },
  });

  if (summaries.length === 0) {
    return NextResponse.json({ summaries: [], stats: null });
  }

  // Dönemsel istatistikler
  const scores = summaries.filter(s => s.compositeScore != null).map(s => s.compositeScore!);
  const changes = summaries.filter(s => s.changePercent != null).map(s => s.changePercent!);

  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const firstScore = scores.length > 0 ? scores[scores.length - 1] : null;
  const lastScore = scores.length > 0 ? scores[0] : null;
  const totalChange = changes.length > 0
    ? (changes.reduce((p, c) => p * (1 + c / 100), 1) - 1) * 100
    : null;

  const bestDay = summaries.reduce((best, s) =>
    (s.changePercent ?? -Infinity) > (best.changePercent ?? -Infinity) ? s : best, summaries[0]);
  const worstDay = summaries.reduce((worst, s) =>
    (s.changePercent ?? Infinity) < (worst.changePercent ?? Infinity) ? s : worst, summaries[0]);

  return NextResponse.json({
    summaries: summaries.map(serialize),
    stats: {
      period,
      totalDays: summaries.length,
      avgScore,
      firstScore,
      lastScore,
      scoreDirection: firstScore != null && lastScore != null
        ? lastScore > firstScore ? "RISING" : lastScore < firstScore ? "FALLING" : "FLAT"
        : null,
      totalChange: totalChange != null ? Math.round(totalChange * 100) / 100 : null,
      bestDay: { date: bestDay.date.toISOString(), change: bestDay.changePercent },
      worstDay: { date: worstDay.date.toISOString(), change: worstDay.changePercent },
    },
  });
}
