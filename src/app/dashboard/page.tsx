import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Briefcase, Compass, Globe } from "lucide-react";
import { DailyFeed } from "@/components/dashboard/daily-feed";
import { MarketOverview } from "@/components/dashboard/market-overview";
import { PortfolioVerdict } from "@/components/dashboard/portfolio-verdict";
import { PortfolioAlerts } from "@/components/dashboard/portfolio-alerts";
import { PortfolioEquityChart } from "@/components/dashboard/portfolio-equity-chart";
import { PortfolioHealthGauge } from "@/components/dashboard/portfolio-health-gauge";
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs";
import { MacroIndicators } from "@/components/dashboard/macro-indicators";
import { MarketSentiment } from "@/components/dashboard/market-sentiment";
import { MarketBreadth } from "@/components/dashboard/market-breadth";
import { NewsFeed } from "@/components/dashboard/news-feed";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const portfolios = await prisma.portfolio.findMany({
    where: { userId: session.user.id },
    select: { stockCode: true },
    orderBy: { addedAt: "asc" },
  });

  const stockCodes = portfolios.map((p) => p.stockCode);
  const hasPortfolio = stockCodes.length > 0;

  return (
    <div className="max-w-[1400px] mx-auto space-y-8">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Portföyüm</h1>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Yapay zeka destekli portföy analizi
        </p>
      </div>

      {/* ══════ Empty State ══════ */}
      {!hasPortfolio && (
        <div className="bento-card animate-slide-up">
          <div className="bento-card-body text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-ai-primary/10 mb-4">
              <Briefcase className="h-8 w-8 text-ai-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">Portföyünüz Henüz Boş</h2>
            <p className="text-sm text-muted-foreground/70 max-w-md mx-auto mb-6">
              Hisse ekleyerek yapay zeka destekli portföy analizini başlatın. Teknik analiz, sinyal tespiti, risk metrikleri ve daha fazlası sizi bekliyor.
            </p>
            <a
              href="/dashboard/explore"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-ai-primary text-white text-sm font-medium hover:bg-ai-primary/90 transition-colors"
            >
              <Compass className="h-4 w-4" />
              Hisse Keşfet
            </a>
          </div>
        </div>
      )}

      {/* ══════ ZONE A: Özet & Portföy ══════ */}
      {hasPortfolio && (
        <div className="space-y-6">
          <PortfolioVerdict />
          <PortfolioAlerts />

          {/* ── Portföy ── */}
          <div className="flex items-center gap-3 pt-2">
            <Briefcase className="h-5 w-5 text-ai-primary/70" />
            <h2 className="text-lg font-semibold text-foreground">Portföy</h2>
            <div className="flex-1 h-px bg-border/20" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
            <PortfolioHealthGauge />
            <PortfolioEquityChart />
          </div>

          <DashboardClient />

          {/* ══════ ZONE B: Sekmeli Analiz Paneli ══════ */}
          <DashboardTabs />

          {/* ══════ ZONE C: Piyasa & Haberler ══════ */}
          <div className="flex items-center gap-3 pt-2">
            <Globe className="h-5 w-5 text-ai-primary/70" />
            <h2 className="text-lg font-semibold text-foreground">Piyasa & Haberler</h2>
            <div className="flex-1 h-px bg-border/20" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <MacroIndicators />
            <MarketSentiment />
            <MarketBreadth />
          </div>

          <MarketOverview />
          <NewsFeed />
        </div>
      )}

      <DailyFeed stockCodes={stockCodes} initialSummaries={{}} />
    </div>
  );
}
