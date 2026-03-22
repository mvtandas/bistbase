import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getIstanbulToday } from "@/lib/date-utils";

export async function GET() {
  try {
    const todayDate = getIstanbulToday();

    // Try today first, fallback to last 3 days
    let summaries = await prisma.dailySummary.findMany({
      where: { date: todayDate, status: "COMPLETED", timeframe: "daily" },
      select: {
        compositeScore: true,
        verdictAction: true,
        sentimentScore: true,
      },
    });

    if (summaries.length < 5) {
      const threeDaysAgo = new Date(todayDate);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      summaries = await prisma.dailySummary.findMany({
        where: {
          date: { gte: threeDaysAgo },
          status: "COMPLETED",
          timeframe: "daily",
        },
        orderBy: { date: "desc" },
        select: {
          compositeScore: true,
          verdictAction: true,
          sentimentScore: true,
          stockCode: true,
        },
      });
      // Deduplicate by stockCode (latest per stock)
      const seen = new Set<string>();
      summaries = summaries.filter((s) => {
        const code = (s as { stockCode?: string }).stockCode;
        if (!code || seen.has(code)) return false;
        seen.add(code);
        return true;
      });
    }

    // Aggregate compositeScore
    const scores = summaries
      .map((s) => s.compositeScore)
      .filter((s): s is number => s != null);
    const avgScore =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 50;

    // Verdict distribution
    const verdictCounts: Record<string, number> = {
      GUCLU_AL: 0,
      AL: 0,
      TUT: 0,
      SAT: 0,
      GUCLU_SAT: 0,
    };
    for (const s of summaries) {
      if (s.verdictAction && s.verdictAction in verdictCounts) {
        verdictCounts[s.verdictAction]++;
      }
    }
    const total = summaries.length || 1;

    // Sentiment distribution
    const sentimentCounts = { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0 };
    for (const s of summaries) {
      if (
        s.sentimentScore &&
        s.sentimentScore in sentimentCounts
      ) {
        sentimentCounts[s.sentimentScore as keyof typeof sentimentCounts]++;
      }
    }

    // Signal counts from today
    const signals = await prisma.signal.groupBy({
      by: ["signalDirection"],
      where: { date: { gte: todayDate } },
      _count: true,
    });

    const signalCounts = { BULLISH: 0, BEARISH: 0, NEUTRAL: 0 };
    for (const s of signals) {
      if (s.signalDirection in signalCounts) {
        signalCounts[s.signalDirection as keyof typeof signalCounts] =
          s._count;
      }
    }

    return NextResponse.json({
      avgScore,
      totalAnalyzed: summaries.length,
      verdictDistribution: {
        GUCLU_AL: Math.round((verdictCounts.GUCLU_AL / total) * 100),
        AL: Math.round((verdictCounts.AL / total) * 100),
        TUT: Math.round((verdictCounts.TUT / total) * 100),
        SAT: Math.round((verdictCounts.SAT / total) * 100),
        GUCLU_SAT: Math.round((verdictCounts.GUCLU_SAT / total) * 100),
      },
      sentimentCounts,
      signalCounts,
    });
  } catch {
    return NextResponse.json({
      avgScore: 50,
      totalAnalyzed: 0,
      verdictDistribution: { GUCLU_AL: 0, AL: 0, TUT: 0, SAT: 0, GUCLU_SAT: 0 },
      sentimentCounts: { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0 },
      signalCounts: { BULLISH: 0, BEARISH: 0, NEUTRAL: 0 },
    });
  }
}
