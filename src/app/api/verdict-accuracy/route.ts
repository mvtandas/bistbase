import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cacheGet, cacheSet } from "@/lib/redis";

export interface VerdictAccuracyResult {
  stockCode: string | null;
  totalVerdicts: number;
  accurateCount: number;
  winRate: number;
  byAction: Record<string, { total: number; accurate: number; winRate: number }>;
  byHorizon: {
    "1D": { winRate: number; avgReturn: number; sampleSize: number } | null;
    "5D": { winRate: number; avgReturn: number; sampleSize: number } | null;
    "10D": { winRate: number; avgReturn: number; sampleSize: number } | null;
    "20D": { winRate: number; avgReturn: number; sampleSize: number } | null;
  };
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stockCode = request.nextUrl.searchParams.get("stockCode") || null;
  const cacheKey = `verdict-accuracy:${stockCode ?? "all"}`;

  // Redis cache (1 hour)
  const cached = await cacheGet<VerdictAccuracyResult>(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 180);

    const where: Record<string, unknown> = {
      verdictAction: { not: null },
      date: { gte: cutoff },
      timeframe: "daily",
      status: "COMPLETED",
    };
    if (stockCode) where.stockCode = stockCode;

    const summaries = await prisma.dailySummary.findMany({
      where,
      select: {
        verdictAction: true,
        verdictAccurate: true,
        outcomePercent1D: true,
        outcomePercent5D: true,
        outcomePercent10D: true,
        outcomePercent20D: true,
      },
    });

    // Overall accuracy
    const withOutcome = summaries.filter(s => s.verdictAccurate != null);
    const accurateCount = withOutcome.filter(s => s.verdictAccurate === true).length;
    const winRate = withOutcome.length > 0 ? (accurateCount / withOutcome.length) * 100 : 0;

    // By action
    const byAction: Record<string, { total: number; accurate: number; winRate: number }> = {};
    for (const s of summaries) {
      const action = s.verdictAction!;
      if (!byAction[action]) byAction[action] = { total: 0, accurate: 0, winRate: 0 };
      byAction[action].total++;
      if (s.verdictAccurate === true) byAction[action].accurate++;
    }
    for (const action of Object.keys(byAction)) {
      const a = byAction[action];
      a.winRate = a.total > 0 ? round2((a.accurate / a.total) * 100) : 0;
    }

    // By horizon
    function horizonStats(field: "outcomePercent1D" | "outcomePercent5D" | "outcomePercent10D" | "outcomePercent20D") {
      const vals = summaries
        .filter(s => s[field] != null)
        .map(s => ({ action: s.verdictAction!, ret: s[field] as number }));

      if (vals.length < 3) return null;

      const isWin = (action: string, ret: number) => {
        if (action === "SAT" || action === "GUCLU_SAT") return ret < 0;
        if (action === "TUT") return Math.abs(ret) < 3;
        return ret > 0;
      };

      const wins = vals.filter(v => isWin(v.action, v.ret));
      const avgReturn = vals.reduce((s, v) => s + v.ret, 0) / vals.length;

      return {
        winRate: round2((wins.length / vals.length) * 100),
        avgReturn: round2(avgReturn),
        sampleSize: vals.length,
      };
    }

    const result: VerdictAccuracyResult = {
      stockCode,
      totalVerdicts: summaries.length,
      accurateCount,
      winRate: round2(winRate),
      byAction,
      byHorizon: {
        "1D": horizonStats("outcomePercent1D"),
        "5D": horizonStats("outcomePercent5D"),
        "10D": horizonStats("outcomePercent10D"),
        "20D": horizonStats("outcomePercent20D"),
      },
    };

    await cacheSet(cacheKey, result, 3600); // 1 hour
    return NextResponse.json(result);
  } catch (error) {
    console.error("Verdict accuracy failed:", error);
    return NextResponse.json({ error: "Accuracy hesaplanamadı" }, { status: 500 });
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
