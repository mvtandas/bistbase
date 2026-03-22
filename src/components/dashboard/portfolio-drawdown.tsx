"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { QUERY_KEYS } from "@/lib/constants";

interface DrawdownData {
  currentDrawdown: number;
  maxDrawdown: number;
  maxDrawdownPeak: string;
  maxDrawdownTrough: string;
  recoveryDate: string | null;
  peakToTrough: number;
  troughToRecovery: number | null;
  drawdownSeries: { date: string; drawdown: number }[];
}

function DrawdownChart({ series }: { series: DrawdownData["drawdownSeries"] }) {
  if (series.length < 2) return null;

  const width = 300;
  const height = 60;
  const maxDD = Math.min(...series.map(s => s.drawdown), -1);
  const minDD = 0;

  const points = series.map((s, i) => {
    const x = (i / (series.length - 1)) * width;
    const y = height - ((s.drawdown - maxDD) / (minDD - maxDD)) * height;
    return `${x},${y}`;
  });

  const areaPoints = [`0,${height}`, ...points, `${width},${height}`].join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16" preserveAspectRatio="none">
      {/* Zero line */}
      <line x1="0" y1={height} x2={width} y2={height} stroke="currentColor" strokeWidth="0.5" className="text-border/30" />
      {/* Drawdown area */}
      <polygon points={areaPoints} className="fill-loss/15" />
      {/* Drawdown line */}
      <polyline points={points.join(" ")} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-loss/60" />
    </svg>
  );
}

export function PortfolioDrawdown() {
  const { data, isLoading } = useQuery<{ drawdown: DrawdownData | null }>({
    queryKey: QUERY_KEYS.PORTFOLIO_INTELLIGENCE,
    queryFn: () => fetch("/api/portfolio-intelligence").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <div className="rounded-xl border border-border/40 bg-card/30 p-4"><Skeleton className="h-24 w-full" /></div>;

  const dd = data?.drawdown;
  if (!dd || dd.drawdownSeries.length < 5) return null;

  return (
    <div className="rounded-xl border border-border/40 bg-card/30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-4 w-4 text-loss" />
        <h3 className="text-[12px] font-semibold text-foreground">Portföy Drawdown</h3>
      </div>

      {/* Chart */}
      <DrawdownChart series={dd.drawdownSeries} />

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <div className="text-center p-2 rounded-lg bg-card/40 border border-border/15">
          <div className="text-[9px] text-muted-foreground/40">Mevcut</div>
          <div className={cn("text-[13px] font-bold tabular-nums", dd.currentDrawdown < -5 ? "text-loss" : dd.currentDrawdown < -1 ? "text-amber-400" : "text-gain")}>
            {dd.currentDrawdown}%
          </div>
        </div>
        <div className="text-center p-2 rounded-lg bg-card/40 border border-border/15">
          <div className="text-[9px] text-muted-foreground/40">Maks Düşüş</div>
          <div className="text-[13px] font-bold tabular-nums text-loss">{dd.maxDrawdown}%</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-card/40 border border-border/15">
          <div className="text-[9px] text-muted-foreground/40">Toparlanma</div>
          <div className="text-[13px] font-bold tabular-nums text-foreground">
            {dd.troughToRecovery != null ? `${dd.troughToRecovery} gün` : "Devam"}
          </div>
        </div>
      </div>

      {/* Detail */}
      <p className="text-[9px] text-muted-foreground/40 mt-2 pt-2 border-t border-border/10">
        En derin düşüş: {dd.maxDrawdownPeak} → {dd.maxDrawdownTrough} ({dd.peakToTrough} gün)
        {dd.recoveryDate ? ` · ${dd.recoveryDate} tarihinde toparlandı` : " · Henüz toparlanmadı"}
      </p>
    </div>
  );
}
