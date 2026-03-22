"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, RefreshCw } from "lucide-react";

interface SectorRotationData {
  sector: string;
  sectorName: string;
  change1W: number | null;
  change1M: number | null;
  momentum: "INFLOW" | "OUTFLOW" | "NEUTRAL";
  rank1W: number;
}

export function SectorRotationCard() {
  const { data, isLoading } = useQuery<SectorRotationData[]>({
    queryKey: ["sector-rotation"],
    queryFn: async () => {
      const r = await fetch("/api/sector-rotation");
      if (!r.ok) return [];
      return r.json();
    },
    refetchInterval: 10 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/40 bg-card/30 p-4 mb-5 animate-pulse">
        <div className="h-3 w-32 bg-muted rounded mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-4 w-full bg-muted rounded" />)}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) return null;

  const withData = data.filter(s => s.change1W != null);
  if (withData.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/40 bg-card/30 p-4 mb-5">
      <div className="flex items-center gap-2 mb-3">
        <RefreshCw className="h-3.5 w-3.5 text-ai-primary" />
        <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">Sektör Rotasyonu</span>
      </div>
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
  );
}
