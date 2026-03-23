"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, BarChart3, AlertCircle, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { QUERY_KEYS } from "@/lib/constants";

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, isLoading, error, refetch } = useQuery<any>({
    queryKey: QUERY_KEYS.PORTFOLIO_INTELLIGENCE,
    queryFn: () => fetch("/api/portfolio-intelligence").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <div className="bento-card"><div className="bento-card-body"><Skeleton className="h-40 w-full" /></div></div>;

  if (error) return (
    <div className="bento-card bg-loss/5 border-loss/20">
      <div className="bento-card-body flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-loss"><AlertCircle className="h-4 w-4" /> Benchmark verisi yüklenemedi</div>
        <button onClick={() => refetch()} className="text-xs text-loss hover:underline flex items-center gap-1"><RefreshCw className="h-3 w-3" /> Tekrar dene</button>
      </div>
    </div>
  );

  const benchmarks: BenchmarkData[] = data?.benchmarkComparison ?? [];
  if (benchmarks.length === 0) return (
    <div className="bento-card">
      <div className="bento-card-header">
        <BarChart3 className="h-4 w-4 text-ai-primary" />
        <span className="bento-card-title">BİST100 Karşılaştırma</span>
      </div>
      <div className="bento-card-body flex items-center justify-center py-8">
        <p className="text-xs text-muted-foreground/50">Benchmark karşılaştırma verisi henüz mevcut değil.</p>
      </div>
    </div>
  );

  return (
    <div className="bento-card animate-slide-up">
      <div className="bento-card-header">
        <BarChart3 className="h-4 w-4 text-ai-primary" />
        <span className="bento-card-title">BİST100 Karşılaştırma</span>
      </div>
      <div className="bento-card-body space-y-3">
        {benchmarks.map(b => {
          const outperforming = b.alpha > 0;
          return (
            <div key={b.period} className="rounded-xl border border-border/20 bg-card/20 p-4">
              {/* Period header */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-foreground">{b.period}</span>
                <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", outperforming ? "bg-gain/10 text-gain" : "bg-loss/10 text-loss")}>
                  {outperforming ? <TrendingUp className="inline h-3 w-3 mr-1" /> : <TrendingDown className="inline h-3 w-3 mr-1" />}
                  Alpha: {b.alpha > 0 ? "+" : ""}{b.alpha}%
                </span>
              </div>

              {/* Returns row */}
              <div className="flex items-center gap-4">
                <div className="flex-1 text-center p-2.5 rounded-lg bg-card/30">
                  <div className="text-xs text-muted-foreground/60 mb-0.5">Portföy</div>
                  <div className={cn("text-lg font-bold tabular-nums", b.portfolioReturn >= 0 ? "text-gain" : "text-loss")}>
                    {b.portfolioReturn > 0 ? "+" : ""}{b.portfolioReturn}%
                  </div>
                </div>
                <div className="text-sm text-muted-foreground/30">vs</div>
                <div className="flex-1 text-center p-2.5 rounded-lg bg-card/30">
                  <div className="text-xs text-muted-foreground/60 mb-0.5">BİST100</div>
                  <div className={cn("text-lg font-bold tabular-nums", b.bist100Return >= 0 ? "text-gain" : "text-loss")}>
                    {b.bist100Return > 0 ? "+" : ""}{b.bist100Return}%
                  </div>
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground/60">
                  <div className="text-center">
                    <div>Beta</div>
                    <div className="font-semibold text-foreground tabular-nums">{b.beta}</div>
                  </div>
                  <div className="text-center">
                    <div>TE</div>
                    <div className="font-semibold text-foreground tabular-nums">{b.trackingError}%</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
