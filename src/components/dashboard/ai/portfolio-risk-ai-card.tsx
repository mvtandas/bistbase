"use client";

import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { AiInsightCard } from "@/components/stock-detail/AiInsightCard";
import type { PortfoyRiskOutput } from "@/lib/ai/types";

interface Props {
  enabled: boolean;
}

export function PortfolioRiskAiCard({ enabled }: Props) {
  const { data, isLoading, isError } = useQuery<PortfoyRiskOutput>({
    queryKey: ["portfolio-ai", "portfoy-risk"],
    queryFn: async () => {
      const r = await fetch("/api/portfolio-intelligence/ai/portfoy-risk");
      if (!r.ok) throw new Error("AI analizi yuklenemedi");
      const json = await r.json();
      return json.data;
    },
    enabled,
    retry: 1,
    staleTime: 10 * 60 * 1000,
  });

  return (
    <AiInsightCard title="Risk Degerlendirmesi" icon={ShieldAlert} loading={isLoading && enabled} error={isError} borderColor="border-loss/15">
      {data && (
        <div className="space-y-2.5">
          <p className="text-[11px] text-foreground leading-relaxed">{data.riskSummary}</p>

          {/* Scenarios */}
          {data.scenarios.map((sc, i) => {
            const probColor = sc.probability === "HIGH" ? "border-loss/20 bg-loss/5" : sc.probability === "MEDIUM" ? "border-amber-400/20 bg-amber-400/5" : "border-gain/20 bg-gain/5";
            const probText = sc.probability === "HIGH" ? "Yuksek" : sc.probability === "MEDIUM" ? "Orta" : "Dusuk";
            const probBadge = sc.probability === "HIGH" ? "bg-loss/10 text-loss" : sc.probability === "MEDIUM" ? "bg-amber-400/10 text-amber-400" : "bg-gain/10 text-gain";
            return (
              <div key={i} className={cn("rounded-lg border p-2.5", probColor)}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-medium text-foreground">{sc.title}</span>
                  <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-medium ml-auto", probBadge)}>{probText}</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">{sc.impact}</p>
                <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-border/10 text-[10px]">
                  <span className="text-loss font-medium">{sc.estimatedLoss}</span>
                  <span className="text-muted-foreground/60">{sc.hedgeSuggestion}</span>
                </div>
              </div>
            );
          })}

          {/* Drawdown Analysis */}
          <div className="rounded-lg border border-border/15 bg-card/20 p-2.5">
            <p className="text-[9px] text-muted-foreground/50 font-medium uppercase mb-0.5">Drawdown Analizi</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed">{data.drawdownAnalysis}</p>
          </div>

          {/* Correlation Warning */}
          {data.correlationWarning && (
            <p className="text-[10px] text-amber-400/80">{data.correlationWarning}</p>
          )}

          {/* Risk Appetite */}
          <p className="text-[10px] text-muted-foreground/60 italic">{data.riskAppetiteAdvice}</p>
        </div>
      )}
    </AiInsightCard>
  );
}
