"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { ShieldAlert, AlertCircle, RefreshCw, Link2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { QUERY_KEYS } from "@/lib/constants";

interface RiskContrib {
  stockCode: string;
  weight: number;
  riskPercent: number;
  isOverweight: boolean;
}

interface Correlation {
  pair: [string, string];
  correlation: number;
}

export function RiskContribution() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, isLoading, error, refetch } = useQuery<any>({
    queryKey: QUERY_KEYS.PORTFOLIO_INTELLIGENCE,
    queryFn: () => fetch("/api/portfolio-intelligence").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <div className="bento-card"><div className="bento-card-body"><Skeleton className="h-32 w-full" /></div></div>;

  if (error) return (
    <div className="bento-card bg-loss/5 border-loss/20">
      <div className="bento-card-body flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-loss"><AlertCircle className="h-4 w-4" /> Risk verisi yüklenemedi</div>
        <button onClick={() => refetch()} className="text-xs text-loss hover:underline flex items-center gap-1"><RefreshCw className="h-3 w-3" /> Tekrar dene</button>
      </div>
    </div>
  );

  const contributions: RiskContrib[] = data?.riskContributions ?? [];
  const correlations: Correlation[] = (data?.correlations ?? []).filter((c: Correlation) => Math.abs(c.correlation) > 0.7);

  if (contributions.length === 0) return (
    <div className="bento-card">
      <div className="bento-card-header">
        <ShieldAlert className="h-4 w-4 text-amber-400" />
        <span className="bento-card-title">Risk Katkısı</span>
      </div>
      <div className="bento-card-body flex items-center justify-center py-8">
        <p className="text-xs text-muted-foreground/50">Risk katkısı hesaplamak için en az 2 hisse gerekli.</p>
      </div>
    </div>
  );

  return (
    <div className="bento-card animate-slide-up">
      <div className="bento-card-header">
        <ShieldAlert className="h-4 w-4 text-amber-400" />
        <span className="bento-card-title">Risk Katkısı</span>
      </div>
      <div className="bento-card-body">
        {/* Risk bars */}
        <div className="space-y-2.5">
          {contributions.map(c => (
            <div key={c.stockCode} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">{c.stockCode}</span>
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground/60 tabular-nums">Ağırlık: %{c.weight}</span>
                  <span className={cn("font-bold tabular-nums", c.isOverweight ? "text-loss" : "text-gain")}>
                    Risk: %{c.riskPercent}
                  </span>
                </div>
              </div>
              <div className="flex gap-1.5 h-2.5">
                <div className="flex-1 rounded-full bg-border/15 overflow-hidden">
                  <div className="h-full rounded-full bg-ai-primary/40 transition-all duration-700" style={{ width: `${Math.min(100, c.weight)}%` }} />
                </div>
                <div className="flex-1 rounded-full bg-border/15 overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all duration-700", c.isOverweight ? "bg-loss/60" : "bg-gain/60")} style={{ width: `${Math.min(100, c.riskPercent)}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Correlation warnings */}
        {correlations.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border/15 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 mb-2">
              <Link2 className="h-3.5 w-3.5" />
              <span>Yüksek Korelasyon Uyarıları</span>
            </div>
            {correlations.slice(0, 3).map((c, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground/70">{c.pair[0]} — {c.pair[1]}</span>
                <span className={cn("font-semibold tabular-nums", Math.abs(c.correlation) > 0.8 ? "text-loss" : "text-amber-400")}>
                  {c.correlation.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/15 text-[10px] text-muted-foreground/50">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gain/60" /> Risk &lt; Ağırlık</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-loss/60" /> Risk &gt; Ağırlık</span>
        </div>
      </div>
    </div>
  );
}
