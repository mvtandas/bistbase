"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface BreadthData {
  breadth: {
    advancing: number;
    declining: number;
    unchanged: number;
    total: number;
    advancingVolume: number;
    decliningVolume: number;
  };
}

function formatVolume(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(v);
}

export function MarketBreadth() {
  const { data, isLoading } = useQuery<BreadthData>({
    queryKey: ["market-overview"],
    queryFn: () => fetch("/api/market-overview").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="bento-card">
        <div className="bento-card-header"><Skeleton className="h-4 w-36" /></div>
        <div className="bento-card-body space-y-3">
          <Skeleton className="h-6 w-full rounded-full" />
          <Skeleton className="h-6 w-full rounded-full" />
        </div>
      </div>
    );
  }

  const b = data?.breadth;
  if (!b || b.total === 0) return null;

  const advPct = Math.round((b.advancing / b.total) * 100);
  const decPct = Math.round((b.declining / b.total) * 100);
  const unchPct = 100 - advPct - decPct;

  const totalVol = b.advancingVolume + b.decliningVolume;
  const advVolPct = totalVol > 0 ? Math.round((b.advancingVolume / totalVol) * 100) : 50;
  const decVolPct = 100 - advVolPct;

  return (
    <div className="bento-card animate-slide-up">
      <div className="bento-card-header">
        <BarChart3 className="h-4 w-4 text-ai-primary" />
        <span className="bento-card-title">Piyasa Genişliği</span>
        <span className="bento-card-subtitle">{b.total} hisse</span>
      </div>
      <div className="bento-card-body space-y-4">
        {/* Advance / Decline Bar */}
        <div>
          <div className="flex items-center justify-between text-[10px] mb-1.5">
            <span className="text-gain font-semibold">{b.advancing} Yükselen</span>
            {b.unchanged > 0 && (
              <span className="text-muted-foreground">{b.unchanged} Sabit</span>
            )}
            <span className="text-loss font-semibold">{b.declining} Düşen</span>
          </div>
          <div className="flex h-3.5 rounded-full overflow-hidden gap-0.5">
            <div
              className="bg-gain h-full rounded-l-full transition-all duration-700"
              style={{ width: `${advPct}%` }}
            />
            {unchPct > 0 && (
              <div
                className="bg-muted-foreground/30 h-full transition-all duration-700"
                style={{ width: `${unchPct}%` }}
              />
            )}
            <div
              className="bg-loss h-full rounded-r-full transition-all duration-700"
              style={{ width: `${decPct}%` }}
            />
          </div>
        </div>

        {/* Volume Distribution */}
        <div>
          <div className="flex items-center justify-between text-[10px] mb-1.5">
            <span className="text-gain font-semibold">
              Alış Hacmi: {formatVolume(b.advancingVolume)}
            </span>
            <span className="text-loss font-semibold">
              Satış Hacmi: {formatVolume(b.decliningVolume)}
            </span>
          </div>
          <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
            <div
              className={cn("h-full rounded-l-full transition-all duration-700 bg-gain/60")}
              style={{ width: `${advVolPct}%` }}
            />
            <div
              className={cn("h-full rounded-r-full transition-all duration-700 bg-loss/60")}
              style={{ width: `${decVolPct}%` }}
            />
          </div>
        </div>

        {/* Summary */}
        <div className="text-center">
          <span className={cn(
            "text-xs font-bold px-3 py-1 rounded-lg",
            advPct > 60 ? "bg-gain/10 text-gain" :
            decPct > 60 ? "bg-loss/10 text-loss" :
            "bg-amber-400/10 text-amber-400"
          )}>
            {advPct > 60 ? "Boğa Piyasası" : decPct > 60 ? "Ayı Piyasası" : "Kararsız Piyasa"}
          </span>
        </div>
      </div>
    </div>
  );
}
