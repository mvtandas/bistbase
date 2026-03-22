"use client";

import { cn } from "@/lib/utils";
import type { SectorSummary } from "@/lib/stock/batch-analysis";

interface SectorHeatmapProps {
  sectorSummary: Record<string, SectorSummary>;
}

export function SectorHeatmap({ sectorSummary }: SectorHeatmapProps) {
  const sectors = Object.entries(sectorSummary).sort((a, b) => b[1].avgScore - a[1].avgScore);

  if (sectors.length === 0) return null;

  return (
    <div>
      <h2 className="text-sm font-semibold text-foreground mb-3">Sektör Haritası</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {sectors.map(([code, data]) => {
          const isPositive = data.avgChange >= 0;

          return (
            <div
              key={code}
              className={cn(
                "rounded-xl border px-4 py-3 transition-colors",
                isPositive
                  ? "border-gain/15 bg-gain/[0.03]"
                  : "border-loss/15 bg-loss/[0.03]"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-foreground">{data.sectorName}</span>
                <span className="text-[10px] text-muted-foreground/50">{data.stockCount} hisse</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className={cn("text-sm font-bold", isPositive ? "text-gain" : "text-loss")}>
                  {isPositive ? "+" : ""}{data.avgChange.toFixed(2)}%
                </span>
                <span className="text-xs text-muted-foreground/60">
                  Skor: {Math.round(data.avgScore)}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground/40 mt-1">
                En iyi: {data.topStock}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
