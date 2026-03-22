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
  const { data, isLoading, error, refetch } = useQuery<{ riskContributions: RiskContrib[]; correlations: Correlation[] }>({
    queryKey: QUERY_KEYS.PORTFOLIO_INTELLIGENCE,
    queryFn: () => fetch("/api/portfolio-intelligence").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <div className="rounded-xl border border-border/40 bg-card/30 p-4"><Skeleton className="h-24 w-full" /></div>;

  if (error) return (
    <div className="rounded-xl border border-loss/20 bg-loss/5 p-4 flex items-center justify-between">
      <div className="flex items-center gap-2 text-[11px] text-loss"><AlertCircle className="h-4 w-4" /> Risk verisi yüklenemedi</div>
      <button onClick={() => refetch()} className="text-[10px] text-loss hover:underline flex items-center gap-1"><RefreshCw className="h-3 w-3" /> Tekrar dene</button>
    </div>
  );

  const contributions = data?.riskContributions;
  const correlations = data?.correlations?.filter(c => Math.abs(c.correlation) > 0.7) ?? [];

  if (!contributions?.length) return null;

  return (
    <div className="rounded-xl border border-border/40 bg-card/30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <ShieldAlert className="h-4 w-4 text-amber-400" />
        <h3 className="text-[12px] font-semibold text-foreground">Risk Katkısı</h3>
      </div>

      {/* Risk bars */}
      <div className="space-y-2">
        {contributions.map(c => (
          <div key={c.stockCode} className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-medium text-foreground">{c.stockCode}</span>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground/50 tabular-nums">Ağırlık: %{c.weight}</span>
                <span className={cn("font-bold tabular-nums", c.isOverweight ? "text-loss" : "text-gain")}>
                  Risk: %{c.riskPercent}
                </span>
              </div>
            </div>
            <div className="flex gap-1 h-2">
              <div className="flex-1 rounded-full bg-border/15 overflow-hidden">
                <div className="h-full rounded-full bg-ai-primary/40" style={{ width: `${Math.min(100, c.weight)}%`, transition: "width 0.8s" }} />
              </div>
              <div className="flex-1 rounded-full bg-border/15 overflow-hidden">
                <div className={cn("h-full rounded-full", c.isOverweight ? "bg-loss/60" : "bg-gain/60")} style={{ width: `${Math.min(100, c.riskPercent)}%`, transition: "width 0.8s" }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Correlation warnings */}
      {correlations.length > 0 && (
        <div className="mt-3 pt-2 border-t border-border/15 space-y-1">
          <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground/50 mb-1">
            <Link2 className="h-3 w-3" />
            <span>Yüksek Korelasyon Uyarıları</span>
          </div>
          {correlations.slice(0, 3).map((c, i) => (
            <div key={i} className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">{c.pair[0]} — {c.pair[1]}</span>
              <span className={cn("font-medium tabular-nums", Math.abs(c.correlation) > 0.8 ? "text-loss" : "text-amber-400")}>
                {c.correlation.toFixed(2)}
              </span>
            </div>
          ))}
          <p className="text-[9px] text-muted-foreground/40">Yüksek korelasyon = birlikte hareket ediyor, çeşitlendirme etkisi düşük.</p>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 pt-2 border-t border-border/10 text-[8px] text-muted-foreground/40">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gain/60" /> Risk &lt; Ağırlık</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-loss/60" /> Risk &gt; Ağırlık</span>
      </div>
    </div>
  );
}
