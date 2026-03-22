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
      <div className="rounded-xl border border-border/40 bg-card/30 p-4 mb-5 animate-pulse">
        <div className="h-3 w-24 bg-muted rounded mb-3" />
        <div className="h-3 w-full bg-muted rounded-full mb-3" />
        <div className="h-2 w-32 bg-muted rounded" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="rounded-xl border border-border/40 bg-card/30 p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-ai-primary" />
          <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">Portföy Risk</span>
        </div>
        <span className={cn("text-xs font-bold px-2 py-0.5 rounded",
          data.diversificationScore >= 60 ? "bg-gain/10 text-gain" :
          data.diversificationScore >= 35 ? "bg-amber-400/10 text-amber-400" :
          "bg-loss/10 text-loss"
        )}>
          {data.diversificationLabel} ({data.diversificationScore})
        </span>
      </div>

      {/* Sektör dağılımı */}
      <div className="flex gap-1 h-3 rounded-full overflow-hidden mb-3">
        {data.sectorDistribution.map((s, i) => {
          const colors = ["bg-ai-primary", "bg-gain", "bg-amber-400", "bg-loss", "bg-violet-500", "bg-cyan-500"];
          return (
            <div
              key={s.sectorName}
              className={cn("h-full", colors[i % colors.length])}
              style={{ width: `${s.percentage}%` }}
              title={`${s.sectorName}: %${s.percentage}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 mb-2">
        {data.sectorDistribution.map((s, i) => {
          const colors = ["text-ai-primary", "text-gain", "text-amber-400", "text-loss", "text-violet-500", "text-cyan-500"];
          return (
            <span key={s.sectorName} className={cn("text-[10px]", colors[i % colors.length])}>
              {s.sectorName} %{s.percentage}
            </span>
          );
        })}
      </div>

      {/* Uyarılar */}
      {data.concentrationWarning && (
        <div className="flex items-center gap-1.5 text-[10px] text-amber-400 mt-2">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {data.concentrationWarning}
        </div>
      )}
      {data.highCorrelationWarnings.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {data.highCorrelationWarnings.slice(0, 2).map((w, i) => (
            <p key={i} className="text-[10px] text-loss">{w}</p>
          ))}
        </div>
      )}
      {data.portfolioVaR95 != null && (
        <p className="text-[10px] text-muted-foreground/50 mt-2">Portföy VaR (95%): %{data.portfolioVaR95} günlük risk</p>
      )}
    </div>
  );
}
