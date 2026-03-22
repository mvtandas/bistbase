"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { QUERY_KEYS } from "@/lib/constants";
import { AlertCircle, RefreshCw } from "lucide-react";

interface BenchmarkData {
  period: string;
  portfolioReturn: number;
  bist100Return: number;
  alpha: number;
  beta: number;
  trackingError: number;
  informationRatio: number;
}

export function PortfolioBenchmark() {
  const { data, isLoading, error, refetch } = useQuery<{ benchmarkComparison: BenchmarkData[] }>({
    queryKey: QUERY_KEYS.PORTFOLIO_INTELLIGENCE,
    queryFn: () => fetch("/api/portfolio-intelligence").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <div className="rounded-xl border border-border/40 bg-card/30 p-4"><Skeleton className="h-32 w-full" /></div>;

  if (error) return (
    <div className="rounded-xl border border-loss/20 bg-loss/5 p-4 flex items-center justify-between">
      <div className="flex items-center gap-2 text-[11px] text-loss"><AlertCircle className="h-4 w-4" /> Benchmark verisi yüklenemedi</div>
      <button onClick={() => refetch()} className="text-[10px] text-loss hover:underline flex items-center gap-1"><RefreshCw className="h-3 w-3" /> Tekrar dene</button>
    </div>
  );

  const benchmarks = data?.benchmarkComparison;
  if (!benchmarks?.length) return null;

  return (
    <div className="rounded-xl border border-border/40 bg-card/30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="h-4 w-4 text-ai-primary" />
        <h3 className="text-[12px] font-semibold text-foreground">BİST100 Benchmark Karşılaştırma</h3>
      </div>

      {/* Period cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {benchmarks.map(b => {
          const outperforming = b.alpha > 0;
          return (
            <div key={b.period} className="rounded-lg border border-border/20 bg-card/20 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-muted-foreground/60">{b.period}</span>
                <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-full", outperforming ? "bg-gain/10 text-gain" : "bg-loss/10 text-loss")}>
                  {outperforming ? "Üstün" : "Altında"}
                </span>
              </div>

              {/* Returns comparison */}
              <div className="flex items-center justify-between">
                <div className="text-center flex-1">
                  <div className="text-[9px] text-muted-foreground/40">Portföy</div>
                  <div className={cn("text-[13px] font-bold tabular-nums", b.portfolioReturn >= 0 ? "text-gain" : "text-loss")}>
                    {b.portfolioReturn > 0 ? "+" : ""}{b.portfolioReturn}%
                  </div>
                </div>
                <div className="text-[9px] text-muted-foreground/20 mx-1">vs</div>
                <div className="text-center flex-1">
                  <div className="text-[9px] text-muted-foreground/40">BİST100</div>
                  <div className={cn("text-[13px] font-bold tabular-nums", b.bist100Return >= 0 ? "text-gain" : "text-loss")}>
                    {b.bist100Return > 0 ? "+" : ""}{b.bist100Return}%
                  </div>
                </div>
              </div>

              {/* Alpha */}
              <div className="flex items-center justify-center gap-1 pt-1 border-t border-border/10">
                {outperforming ? <TrendingUp className="h-3 w-3 text-gain" /> : <TrendingDown className="h-3 w-3 text-loss" />}
                <span className={cn("text-[11px] font-bold tabular-nums", outperforming ? "text-gain" : "text-loss")}>
                  Alpha: {b.alpha > 0 ? "+" : ""}{b.alpha}%
                </span>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-1 text-[9px]">
                <div className="text-center">
                  <span className="text-muted-foreground/40">Beta</span>
                  <div className="font-medium tabular-nums text-foreground">{b.beta}</div>
                </div>
                <div className="text-center">
                  <span className="text-muted-foreground/40">TE</span>
                  <div className="font-medium tabular-nums text-foreground">{b.trackingError}%</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
