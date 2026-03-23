"use client";

import { cn } from "@/lib/utils";
import { Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortfolioAnalytics } from "@/hooks/use-portfolio-data";
import { LightweightChart } from "./charts/lightweight-chart-wrapper";

export function PortfolioDrawdown() {
  const { data, isLoading } = usePortfolioAnalytics();

  if (isLoading) {
    return (
      <div className="bento-card">
        <div className="bento-card-header"><Skeleton className="h-4 w-32" /></div>
        <div className="bento-card-body"><Skeleton className="h-[200px] w-full" /></div>
      </div>
    );
  }

  const dd = data?.drawdown;
  if (!dd || !dd.drawdownSeries || dd.drawdownSeries.length < 5) return (
    <div className="bento-card min-w-0">
      <div className="bento-card-header">
        <Activity className="h-4 w-4 text-loss" />
        <span className="bento-card-title">Drawdown Analizi</span>
      </div>
      <div className="bento-card-body flex items-center justify-center py-8">
        <p className="text-xs text-muted-foreground/50">Drawdown analizi için yeterli geçmiş veri yok.</p>
      </div>
    </div>
  );

  const chartData = dd.drawdownSeries.map((p: { date: string; drawdown: number }) => ({
    time: p.date,
    value: p.drawdown,
  }));

  return (
    <div className="bento-card animate-slide-up min-w-0">
      <div className="bento-card-header">
        <Activity className="h-4 w-4 text-loss" />
        <span className="bento-card-title">Drawdown Analizi</span>
      </div>
      <div className="bento-card-body">
        {/* Interactive Chart */}
        <LightweightChart
          height={180}
          series={[{
            data: chartData,
            type: "area",
            color: "#fb7185",
            lineWidth: 2,
          }]}
          showGrid={false}
        />

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="text-center p-2.5 rounded-xl bg-card/30 border border-border/15">
            <div className="text-[11px] text-muted-foreground/50">Mevcut</div>
            <div className={cn("text-base font-bold tabular-nums mt-0.5",
              dd.currentDrawdown < -5 ? "text-loss" : dd.currentDrawdown < -1 ? "text-amber-400" : "text-gain"
            )}>
              {dd.currentDrawdown}%
            </div>
          </div>
          <div className="text-center p-2.5 rounded-xl bg-card/30 border border-border/15">
            <div className="text-[11px] text-muted-foreground/50">Maks Düşüş</div>
            <div className="text-base font-bold tabular-nums text-loss mt-0.5">{dd.maxDrawdown}%</div>
          </div>
          <div className="text-center p-2.5 rounded-xl bg-card/30 border border-border/15">
            <div className="text-[11px] text-muted-foreground/50">Toparlanma</div>
            <div className="text-base font-bold tabular-nums text-foreground mt-0.5">
              {dd.troughToRecovery != null ? `${dd.troughToRecovery} gün` : "Devam"}
            </div>
          </div>
        </div>

        {/* Detail */}
        <p className="text-xs text-muted-foreground/50 mt-3 pt-3 border-t border-border/15">
          En derin düşüş: {dd.maxDrawdownPeak} → {dd.maxDrawdownTrough} ({dd.peakToTrough} gün)
          {dd.recoveryDate ? ` · ${dd.recoveryDate} tarihinde toparlandı` : " · Henüz toparlanmadı"}
        </p>
      </div>
    </div>
  );
}
