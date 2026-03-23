"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { PieChart, ShieldAlert, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// Allocation tab — default, loaded eagerly
import { AllocationChart } from "./allocation-chart";
import { PortfolioOzetCard } from "./ai/portfolio-ozet-card";
import { PortfolioPerformansCard } from "./ai/portfolio-performans-card";

// Risk tab — loaded lazily
const PortfolioBenchmark = dynamic(() => import("./portfolio-benchmark").then(m => ({ default: m.PortfolioBenchmark })), {
  loading: () => <Skeleton className="h-[300px] w-full rounded-2xl" />,
});
const PerformanceCalendar = dynamic(() => import("./performance-calendar").then(m => ({ default: m.PerformanceCalendar })), {
  loading: () => <Skeleton className="h-[300px] w-full rounded-2xl" />,
});
const RiskMetricsSummary = dynamic(() => import("./risk-metrics-summary").then(m => ({ default: m.RiskMetricsSummary })), {
  loading: () => <Skeleton className="h-[200px] w-full rounded-2xl" />,
});
const RiskContribution = dynamic(() => import("./risk-contribution").then(m => ({ default: m.RiskContribution })), {
  loading: () => <Skeleton className="h-[200px] w-full rounded-2xl" />,
});
const PortfolioAttribution = dynamic(() => import("./portfolio-attribution").then(m => ({ default: m.PortfolioAttribution })), {
  loading: () => <Skeleton className="h-[200px] w-full rounded-2xl" />,
});
const PortfolioDrawdown = dynamic(() => import("./portfolio-drawdown").then(m => ({ default: m.PortfolioDrawdown })), {
  loading: () => <Skeleton className="h-[200px] w-full rounded-2xl" />,
});
const MonteCarloChart = dynamic(() => import("./monte-carlo-chart").then(m => ({ default: m.MonteCarloChart })), {
  loading: () => <Skeleton className="h-[300px] w-full rounded-2xl" />,
});
const StressTestCard = dynamic(() => import("./stress-test-card").then(m => ({ default: m.StressTestCard })), {
  loading: () => <Skeleton className="h-[200px] w-full rounded-2xl" />,
});
const CorrelationHeatmap = dynamic(() => import("./correlation-heatmap").then(m => ({ default: m.CorrelationHeatmap })), {
  loading: () => <Skeleton className="h-[300px] w-full rounded-2xl" />,
});
const PortfolioRiskAiCard = dynamic(() => import("./ai/portfolio-risk-ai-card").then(m => ({ default: m.PortfolioRiskAiCard })), {
  loading: () => <Skeleton className="h-[200px] w-full rounded-2xl" />,
});

// Tools tab — loaded lazily
const WhatIfPanel = dynamic(() => import("./what-if-panel").then(m => ({ default: m.WhatIfPanel })), {
  loading: () => <Skeleton className="h-[300px] w-full rounded-2xl" />,
});
const PortfolioRiskCard = dynamic(() => import("./portfolio-risk-card").then(m => ({ default: m.PortfolioRiskCard })), {
  loading: () => <Skeleton className="h-[200px] w-full rounded-2xl" />,
});
const SectorRotationCard = dynamic(() => import("./sector-rotation-card").then(m => ({ default: m.SectorRotationCard })), {
  loading: () => <Skeleton className="h-[200px] w-full rounded-2xl" />,
});
const RebalanceSuggestions = dynamic(() => import("./rebalance-suggestions").then(m => ({ default: m.RebalanceSuggestions })), {
  loading: () => <Skeleton className="h-[200px] w-full rounded-2xl" />,
});
const PortfolioRebalansCard = dynamic(() => import("./ai/portfolio-rebalans-card").then(m => ({ default: m.PortfolioRebalansCard })), {
  loading: () => <Skeleton className="h-[200px] w-full rounded-2xl" />,
});

type Tab = "allocation" | "risk" | "tools";

const TABS = [
  { id: "allocation" as Tab, label: "Dağılım & Performans", icon: PieChart },
  { id: "risk" as Tab, label: "Risk Analizi", icon: ShieldAlert },
  { id: "tools" as Tab, label: "Araçlar & AI", icon: Wrench },
];

export function DashboardTabs() {
  const [active, setActive] = useState<Tab>("allocation");

  return (
    <div className="space-y-6">
      {/* Tab Bar */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-card/50 border border-border/30 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              active === tab.id
                ? "bg-ai-primary text-white shadow-sm"
                : "text-muted-foreground/70 hover:text-muted-foreground hover:bg-card/40"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {active === "allocation" && (
        <div className="space-y-6 animate-fade-in">
          <PortfolioOzetCard enabled={active === "allocation"} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AllocationChart />
            <PortfolioBenchmark />
          </div>
          <PortfolioPerformansCard enabled={active === "allocation"} />
          <PerformanceCalendar />
        </div>
      )}

      {active === "risk" && (
        <div className="space-y-6 animate-fade-in">
          <PortfolioRiskAiCard enabled={active === "risk"} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RiskMetricsSummary />
            <RiskContribution />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PortfolioAttribution />
            <PortfolioDrawdown />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MonteCarloChart />
            <StressTestCard />
          </div>
          <CorrelationHeatmap />
        </div>
      )}

      {active === "tools" && (
        <div className="space-y-6 animate-fade-in">
          <PortfolioRebalansCard enabled={active === "tools"} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <WhatIfPanel />
            <RebalanceSuggestions />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PortfolioRiskCard />
            <SectorRotationCard />
          </div>
        </div>
      )}
    </div>
  );
}
