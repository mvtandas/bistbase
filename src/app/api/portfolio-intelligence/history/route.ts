import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const timeframe = req.nextUrl.searchParams.get("timeframe") ?? "daily";
  const days = Math.min(365, Number(req.nextUrl.searchParams.get("days") ?? "90"));

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const snapshots = await prisma.portfolioSnapshot.findMany({
    where: {
      userId: session.user.id,
      timeframe,
      date: { gte: cutoff },
    },
    orderBy: { date: "asc" },
    select: {
      date: true,
      verdictAction: true,
      verdictScore: true,
      compositeScore: true,
      totalValue: true,
      totalPnL: true,
      totalPnLPercent: true,
      dailyChange: true,
      portfolioBeta: true,
      portfolioVaR95: true,
      bist100Return: true,
      alpha: true,
      allocation: true,
      riskContributions: true,
    },
  });

  return NextResponse.json({
    timeframe,
    count: snapshots.length,
    snapshots: snapshots.map(s => ({
      ...s,
      date: s.date.toISOString().split("T")[0],
    })),
  });
}
