"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Shield, AlertTriangle } from "lucide-react";

interface PortfolioRiskData {
  highCorrelationWarnings: string[];
  sectorDistribution: { sectorName: string; percentage: number; stocks: string[] }[];
  concentrationWarning: string | null;
  diversificationScore: number;
  diversificationLabel: string;
  portfolioVaR95: number | null;
}

export function PortfolioRiskCard() {
  const { data, isLoading } = useQuery<PortfolioRiskData>({
    queryKey: ["portfolio-risk"],
    queryFn: async () => {
      const r = await fetch("/api/portfolio-risk");
      if (!r.ok) return null;
      return r.json();
    },
    refetchInterval: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="bento-card animate-pulse">
        <div className="bento-card-body">
          <div className="h-4 w-24 bg-muted rounded mb-3" />
          <div className="h-4 w-full bg-muted rounded-full mb-3" />
          <div className="h-3 w-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!data) return (
    <div className="bento-card">
      <div className="bento-card-header">
        <Shield className="h-4 w-4 text-ai-primary" />
        <span className="bento-card-title">Portföy Risk</span>
      </div>
      <div className="bento-card-body flex items-center justify-center py-8">
        <p className="text-xs text-muted-foreground/50">Portföy risk verisi yüklenemedi.</p>
      </div>
    </div>
  );

  const colors = ["bg-ai-primary", "bg-gain", "bg-amber-400", "bg-loss", "bg-violet-500", "bg-cyan-500"];

  return (
    <div className="bento-card animate-slide-up">
      <div className="bento-card-header">
        <Shield className="h-4 w-4 text-ai-primary" />
        <span className="bento-card-title">Portföy Risk</span>
        <span className={cn("text-xs font-bold px-2.5 py-1 rounded-lg ml-auto",
          data.diversificationScore >= 60 ? "bg-gain/10 text-gain" :
          data.diversificationScore >= 35 ? "bg-amber-400/10 text-amber-400" :
          "bg-loss/10 text-loss"
        )}>
          {data.diversificationLabel} ({data.diversificationScore})
        </span>
      </div>
      <div className="bento-card-body">
        {/* Sector distribution */}
        <div className="flex gap-1 h-3.5 rounded-full overflow-hidden mb-3">
          {data.sectorDistribution.map((s, i) => (
            <div
              key={s.sectorName}
              className={cn("h-full transition-all duration-700", colors[i % colors.length])}
              style={{ width: `${s.percentage}%` }}
              title={`${s.sectorName}: %${s.percentage}`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2.5 mb-3">
          {data.sectorDistribution.map((s, i) => {
            const textColors = ["text-ai-primary", "text-gain", "text-amber-400", "text-loss", "text-violet-500", "text-cyan-500"];
            return (
              <span key={s.sectorName} className={cn("text-xs font-medium", textColors[i % textColors.length])}>
                {s.sectorName} %{s.percentage}
              </span>
            );
          })}
        </div>

        {/* Warnings */}
        {data.concentrationWarning && (
          <div className="flex items-center gap-2 text-xs text-amber-400 mt-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {data.concentrationWarning}
          </div>
        )}
        {data.highCorrelationWarnings.length > 0 && (
          <div className="mt-1.5 space-y-1">
            {data.highCorrelationWarnings.slice(0, 2).map((w, i) => (
              <p key={i} className="text-xs text-loss">{w}</p>
            ))}
          </div>
        )}
        {data.portfolioVaR95 != null && (
          <p className="text-xs text-muted-foreground/60 mt-2.5">Portföy VaR (95%): %{data.portfolioVaR95} günlük risk</p>
        )}
      </div>
    </div>
  );
}
