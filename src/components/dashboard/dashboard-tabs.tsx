"use client";

import { useState } from "react";
import { PieChart, ShieldAlert, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { AllocationChart } from "./allocation-chart";
import { PortfolioBenchmark } from "./portfolio-benchmark";
import { PerformanceCalendar } from "./performance-calendar";
import { RiskMetricsSummary } from "./risk-metrics-summary";
import { RiskContribution } from "./risk-contribution";
import { PortfolioAttribution } from "./portfolio-attribution";
import { PortfolioDrawdown } from "./portfolio-drawdown";
import { MonteCarloChart } from "./monte-carlo-chart";
import { StressTestCard } from "./stress-test-card";
import { CorrelationHeatmap } from "./correlation-heatmap";
import { WhatIfPanel } from "./what-if-panel";
import { PortfolioRiskCard } from "./portfolio-risk-card";
import { SectorRotationCard } from "./sector-rotation-card";
import { RebalanceSuggestions } from "./rebalance-suggestions";
import { PortfolioOzetCard } from "./ai/portfolio-ozet-card";
import { PortfolioPerformansCard } from "./ai/portfolio-performans-card";
import { PortfolioRiskAiCard } from "./ai/portfolio-risk-ai-card";
import { PortfolioRebalansCard } from "./ai/portfolio-rebalans-card";

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
