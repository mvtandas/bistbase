"use client";

import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { AiInsightCard } from "@/components/stock-detail/AiInsightCard";
import type { PortfoyPerformansOutput } from "@/lib/ai/types";

interface Props {
  enabled: boolean;
}

export function PortfolioPerformansCard({ enabled }: Props) {
  const { data, isLoading, isError } = useQuery<PortfoyPerformansOutput>({
    queryKey: ["portfolio-ai", "portfoy-performans"],
    queryFn: async () => {
      const r = await fetch("/api/portfolio-intelligence/ai/portfoy-performans");
      if (!r.ok) throw new Error("AI analizi yuklenemedi");
      const json = await r.json();
      return json.data;
    },
    enabled,
    retry: 1,
    staleTime: 10 * 60 * 1000,
  });

  return (
    <AiInsightCard title="Performans Yorumu" icon={BarChart3} loading={isLoading && enabled} error={isError}>
      {data && (
        <div className="space-y-2.5">
          <p className="text-[11px] text-foreground leading-relaxed">{data.performanceSummary}</p>

          {/* Drivers */}
          <div className="space-y-1.5">
            <p className="text-[9px] text-muted-foreground/50 font-medium uppercase">Performans Suruculeri</p>
            {data.drivers.map((d, i) => {
              const isPositive = d.contribution.startsWith("+");
              return (
                <div key={i} className="flex items-start gap-2 text-[11px]">
                  {isPositive
                    ? <TrendingUp className="h-3.5 w-3.5 text-gain shrink-0 mt-0.5" />
                    : <TrendingDown className="h-3.5 w-3.5 text-loss shrink-0 mt-0.5" />
                  }
                  <div>
                    <span className="font-semibold text-foreground">{d.stockCode}</span>
                    <span className={`ml-1.5 font-medium ${isPositive ? "text-gain" : "text-loss"}`}>{d.contribution}</span>
                    <p className="text-[10px] text-muted-foreground/70 leading-relaxed">{d.explanation}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Benchmark */}
          <div className="rounded-lg border border-border/15 bg-card/20 p-2.5">
            <p className="text-[9px] text-muted-foreground/50 font-medium uppercase mb-0.5">Benchmark Karsilastirma</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed">{data.benchmarkComparison}</p>
          </div>

          {/* Outlook */}
          <div className="rounded-lg border border-ai-primary/15 bg-ai-primary/5 p-2.5">
            <p className="text-[9px] text-ai-primary font-medium uppercase mb-0.5">Ileri Bakis</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed">{data.outlook}</p>
          </div>
        </div>
      )}
    </AiInsightCard>
  );
}
