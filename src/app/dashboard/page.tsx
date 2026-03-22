import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DailyFeed } from "@/components/dashboard/daily-feed";
import { MarketOverview } from "@/components/dashboard/market-overview";
import { PortfolioRiskCard } from "@/components/dashboard/portfolio-risk-card";
import { SectorRotationCard } from "@/components/dashboard/sector-rotation-card";
import { PortfolioVerdict } from "@/components/dashboard/portfolio-verdict";
import { PortfolioBenchmark } from "@/components/dashboard/portfolio-benchmark";
import { RiskContribution } from "@/components/dashboard/risk-contribution";
import { WhatIfPanel } from "@/components/dashboard/what-if-panel";
import { PortfolioAttribution } from "@/components/dashboard/portfolio-attribution";
import { PortfolioDrawdown } from "@/components/dashboard/portfolio-drawdown";
import { DashboardClient } from "./dashboard-client";
import { DashboardSections } from "./dashboard-sections";
import type { DailySummaryData } from "@/types";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const portfolios = await prisma.portfolio.findMany({
    where: { userId: session.user.id },
    select: { stockCode: true },
    orderBy: { addedAt: "asc" },
  });

  const stockCodes = portfolios.map((p) => p.stockCode);

  const today = new Date();
  const todayDate = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  );

  let summaries = await prisma.dailySummary.findMany({
    where: { stockCode: { in: stockCodes }, date: todayDate },
  });

  if (summaries.length === 0 && stockCodes.length > 0) {
    const sevenDaysAgo = new Date(todayDate);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentSummaries = await prisma.dailySummary.findMany({
      where: { stockCode: { in: stockCodes }, date: { gte: sevenDaysAgo }, status: "COMPLETED" },
      orderBy: { date: "desc" },
    });
    const seen = new Set<string>();
    for (const s of recentSummaries) {
      if (!seen.has(s.stockCode)) { summaries.push(s); seen.add(s.stockCode); }
    }
  }

  const initialSummaries: Record<string, DailySummaryData> = {};
  for (const s of summaries) {
    initialSummaries[s.stockCode] = {
      id: s.id, stockCode: s.stockCode, date: s.date.toISOString(),
      closePrice: s.closePrice, changePercent: s.changePercent,
      aiSummaryText: s.aiSummaryText, sentimentScore: s.sentimentScore,
      status: s.status, compositeScore: s.compositeScore,
      bullCase: s.bullCase, bearCase: s.bearCase, confidence: s.confidence,
    };
  }

  const hasPortfolio = stockCodes.length > 0;

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Portföyüm</h1>
        <p className="text-xs text-muted-foreground/60 mt-0.5">
          Yapay zeka destekli portföy analizi
        </p>
      </div>

      {/* ── Piyasa Özeti (kompakt) ── */}
      <MarketOverview />

      {/* ══════ ANA İÇERİK ══════ */}
      {hasPortfolio && (
        <div className="space-y-4">
          {/* Portföy Kararı — her zaman görünür */}
          <PortfolioVerdict />

          {/* Holdings Tablosu — her zaman görünür */}
          <DashboardClient />

          {/* Collapsible Analitik Panelleri */}
          <DashboardSections>
            {/* Risk & Benchmark */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PortfolioBenchmark />
              <RiskContribution />
            </div>

            {/* Performans */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PortfolioAttribution />
              <PortfolioDrawdown />
            </div>

            {/* Simülasyon */}
            <WhatIfPanel />

            {/* Risk & Sektör */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PortfolioRiskCard />
              <SectorRotationCard />
            </div>
          </DashboardSections>
        </div>
      )}

      {/* ══════ AI ANALİZLERİ ══════ */}
      <DailyFeed stockCodes={stockCodes} initialSummaries={initialSummaries} />
    </div>
  );
}
