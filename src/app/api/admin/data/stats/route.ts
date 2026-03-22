import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const [
    users,
    portfolios,
    dailySummaries,
    signals,
    technicalSnapshots,
    screenerSnapshots,
    aiInsights,
    portfolioSnapshots,
    sectorSnapshots,
    cronLogs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.portfolio.count(),
    prisma.dailySummary.count(),
    prisma.signal.count(),
    prisma.technicalSnapshot.count(),
    prisma.screenerSnapshot.count(),
    prisma.aiInsight.count(),
    prisma.portfolioSnapshot.count(),
    prisma.sectorSnapshot.count(),
    prisma.cronLog.count(),
  ]);

  return NextResponse.json({
    tables: [
      { name: "User", count: users },
      { name: "Portfolio", count: portfolios },
      { name: "DailySummary", count: dailySummaries },
      { name: "Signal", count: signals },
      { name: "TechnicalSnapshot", count: technicalSnapshots },
      { name: "ScreenerSnapshot", count: screenerSnapshots },
      { name: "AiInsight", count: aiInsights },
      { name: "PortfolioSnapshot", count: portfolioSnapshots },
      { name: "SectorSnapshot", count: sectorSnapshots },
      { name: "CronLog", count: cronLogs },
    ],
  });
}
