"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, RefreshCw } from "lucide-react";
import { useMarketPollingInterval } from "@/hooks/use-market-polling";

interface SectorRotationData {
  sector: string;
  sectorName: string;
  change1W: number | null;
  change1M: number | null;
  momentum: "INFLOW" | "OUTFLOW" | "NEUTRAL";
  rank1W: number;
}

export function SectorRotationCard() {
  const pollingInterval = useMarketPollingInterval();
  const { data, isLoading } = useQuery<SectorRotationData[]>({
    queryKey: ["sector-rotation"],
    queryFn: async () => {
      const r = await fetch("/api/sector-rotation");
      if (!r.ok) return [];
      return r.json();
    },
    refetchInterval: pollingInterval * 2,
  });

  if (isLoading) {
    return (
      <div className="bento-card animate-pulse">
        <div className="bento-card-header"><div className="h-4 w-32 bg-muted rounded" /></div>
        <div className="bento-card-body">
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-4 w-full bg-muted rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) return (
    <div className="bento-card">
      <div className="bento-card-header">
        <RefreshCw className="h-4 w-4 text-ai-primary" />
        <span className="bento-card-title">Sektör Rotasyonu</span>
      </div>
      <div className="bento-card-body flex items-center justify-center py-8">
        <p className="text-xs text-muted-foreground/50">Sektör rotasyon verisi mevcut değil.</p>
      </div>
    </div>
  );

  const withData = data.filter(s => s.change1W != null);
  if (withData.length === 0) return (
    <div className="bento-card">
      <div className="bento-card-header">
        <RefreshCw className="h-4 w-4 text-ai-primary" />
        <span className="bento-card-title">Sektör Rotasyonu</span>
      </div>
      <div className="bento-card-body flex items-center justify-center py-8">
        <p className="text-xs text-muted-foreground/50">Sektör performans verisi henüz hesaplanmadı.</p>
      </div>
    </div>
  );

  return (
    <div className="bento-card animate-slide-up">
      <div className="bento-card-header">
        <RefreshCw className="h-4 w-4 text-ai-primary" />
        <span className="bento-card-title">Sektör Rotasyonu</span>
      </div>
      <div className="bento-card-body">
      <div className="space-y-1.5">
        {withData.map((s) => {
          const isPositive = (s.change1W ?? 0) >= 0;
          return (
            <div key={s.sector} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <span className={cn("w-2 h-2 rounded-full",
                  s.momentum === "INFLOW" ? "bg-gain" : s.momentum === "OUTFLOW" ? "bg-loss" : "bg-muted-foreground"
                )} />
                <span className="text-[11px] text-foreground">{s.sectorName}</span>
              </div>
              <div className="flex items-center gap-3">
                {s.change1W != null && (
                  <span className={cn("text-[10px] font-medium tabular-nums", isPositive ? "text-gain" : "text-loss")}>
                    {isPositive ? <ArrowUpRight className="h-2.5 w-2.5 inline" /> : <ArrowDownRight className="h-2.5 w-2.5 inline" />}
                    {isPositive ? "+" : ""}{s.change1W}%
                  </span>
                )}
                <span className={cn("text-[9px] px-1.5 py-0.5 rounded",
                  s.momentum === "INFLOW" ? "bg-gain/10 text-gain" : s.momentum === "OUTFLOW" ? "bg-loss/10 text-loss" : "bg-secondary text-muted-foreground"
                )}>
                  {s.momentum === "INFLOW" ? "Giriş" : s.momentum === "OUTFLOW" ? "Çıkış" : "Nötr"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
