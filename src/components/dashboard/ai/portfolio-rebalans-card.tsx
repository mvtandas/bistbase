"use client";

import { useQuery } from "@tanstack/react-query";
import { Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { AiInsightCard } from "@/components/stock-detail/AiInsightCard";
import type { PortfoyRebalansOutput } from "@/lib/ai/types";

interface Props {
  enabled: boolean;
}

const ACTION_CONFIG = {
  ARTIR: { label: "Artir", color: "bg-gain/10 text-gain" },
  AZALT: { label: "Azalt", color: "bg-loss/10 text-loss" },
  TUT: { label: "Tut", color: "bg-muted/30 text-muted-foreground" },
  CIKAR: { label: "Cikar", color: "bg-loss/15 text-loss" },
} as const;

export function PortfolioRebalansCard({ enabled }: Props) {
  const { data, isLoading, isError } = useQuery<PortfoyRebalansOutput>({
    queryKey: ["portfolio-ai", "portfoy-rebalans"],
    queryFn: async () => {
      const r = await fetch("/api/portfolio-intelligence/ai/portfoy-rebalans");
      if (!r.ok) throw new Error("AI analizi yuklenemedi");
      const json = await r.json();
      return json.data;
    },
    enabled,
    retry: 1,
    staleTime: 10 * 60 * 1000,
  });

  return (
    <AiInsightCard title="Rebalans Stratejisi" icon={Scale} loading={isLoading && enabled} error={isError} borderColor="border-amber-400/15">
      {data && (
        <div className="space-y-2.5">
          <p className="text-[11px] text-foreground leading-relaxed">{data.currentAssessment}</p>

          {/* Actions per stock */}
          <div className="space-y-1.5">
            {data.actions.map((a, i) => {
              const config = ACTION_CONFIG[a.action] ?? ACTION_CONFIG.TUT;
              return (
                <div key={i} className="rounded-lg border border-border/15 bg-card/20 p-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-semibold text-foreground">{a.stockCode}</span>
                    <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-medium", config.color)}>{config.label}</span>
                    {a.targetWeight && (
                      <span className="text-[9px] text-muted-foreground/50 ml-auto">Hedef: {a.targetWeight}</span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{a.reasoning}</p>
                </div>
              );
            })}
          </div>

          {/* Sector Advice */}
          <div className="rounded-lg border border-ai-primary/15 bg-ai-primary/5 p-2.5">
            <p className="text-[9px] text-ai-primary font-medium uppercase mb-0.5">Sektor Onerisi</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed">{data.sectorAdvice}</p>
          </div>

          {/* Diversification Advice */}
          <p className="text-[10px] text-muted-foreground/60 italic">{data.diversificationAdvice}</p>
        </div>
      )}
    </AiInsightCard>
  );
}
