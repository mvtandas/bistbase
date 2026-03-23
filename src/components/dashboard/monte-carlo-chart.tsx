"use client";

import { cn } from "@/lib/utils";
import { Activity, TrendingDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortfolioSimulations } from "@/hooks/use-portfolio-data";

function FanChart({ projections }: { projections: { date: string; p5: number; p25: number; p50: number; p75: number; p95: number }[] }) {
  if (projections.length < 3) return null;

  const allValues = projections.flatMap(p => [p.p5, p.p95]);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;

  const w = 400, h = 180;
  const padY = 10;

  const getX = (i: number) => (i / (projections.length - 1)) * w;
  const getY = (v: number) => padY + (h - 2 * padY) - ((v - min) / range) * (h - 2 * padY);

  // Band areas
  const makeBand = (upper: number[], lower: number[]) => {
    const up = upper.map((v, i) => `${getX(i)},${getY(v)}`).join(" ");
    const down = [...lower].reverse().map((v, i) => `${getX(lower.length - 1 - i)},${getY(v)}`).join(" ");
    return `${up} ${down}`;
  };

  const p5 = projections.map(p => p.p5);
  const p25 = projections.map(p => p.p25);
  const p50 = projections.map(p => p.p50);
  const p75 = projections.map(p => p.p75);
  const p95 = projections.map(p => p.p95);

  const medianLine = p50.map((v, i) => `${getX(i)},${getY(v)}`).join(" ");

  // 100 reference line
  const refY = getY(100);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[180px]" preserveAspectRatio="none">
      {/* Reference line at 100 */}
      <line x1="0" y1={refY} x2={w} y2={refY} stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4,4" />

      {/* 5-95 band (lightest) */}
      <polygon points={makeBand(p95, p5)} fill="rgba(129,140,248,0.08)" />
      {/* 25-75 band */}
      <polygon points={makeBand(p75, p25)} fill="rgba(129,140,248,0.15)" />

      {/* Median line */}
      <polyline points={medianLine} fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" />

      {/* Start dot */}
      <circle cx={getX(0)} cy={getY(100)} r="3" fill="#818cf8" />
    </svg>
  );
}

export function MonteCarloChart() {
  // Only fetches when this component is mounted (risk tab active)
  const { data, isLoading, isError } = usePortfolioSimulations(true);

  if (isLoading) {
    return (
      <div className="bento-card">
        <div className="bento-card-header"><Skeleton className="h-4 w-40" /></div>
        <div className="bento-card-body"><Skeleton className="h-[250px] w-full" /></div>
      </div>
    );
  }

  if (isError || !data) return (
    <div className="bento-card">
      <div className="bento-card-header">
        <Activity className="h-4 w-4 text-ai-primary" />
        <span className="bento-card-title">Monte Carlo Projeksiyonu</span>
      </div>
      <div className="bento-card-body flex items-center justify-center py-8">
        <p className="text-xs text-muted-foreground/50">Monte Carlo verileri yüklenemedi.</p>
      </div>
    </div>
  );

  const mc = data?.monteCarlo;
  if (!mc || !mc.projections || mc.projections.length < 3) return (
    <div className="bento-card">
      <div className="bento-card-header">
        <Activity className="h-4 w-4 text-ai-primary" />
        <span className="bento-card-title">Monte Carlo Projeksiyonu</span>
      </div>
      <div className="bento-card-body flex items-center justify-center py-8">
        <p className="text-xs text-muted-foreground/50">Simülasyon için yeterli veri yok (min. 20 günlük getiri gerekli).</p>
      </div>
    </div>
  );

  return (
    <div className="bento-card animate-slide-up">
      <div className="bento-card-header">
        <Activity className="h-4 w-4 text-ai-primary" />
        <span className="bento-card-title">Monte Carlo Projeksiyonu</span>
        <span className="bento-card-subtitle">6 aylık · 1000 simülasyon</span>
      </div>
      <div className="bento-card-body">
        <FanChart projections={mc.projections} />

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
          <div className="text-center p-2.5 rounded-xl bg-card/30 border border-border/15">
            <div className="text-[11px] text-muted-foreground/50">Kayıp Olasılığı</div>
            <div className={cn("text-base font-bold tabular-nums mt-0.5",
              mc.probabilityOfLoss > 50 ? "text-loss" : mc.probabilityOfLoss > 30 ? "text-amber-400" : "text-gain"
            )}>
              <TrendingDown className="inline h-3.5 w-3.5 mr-0.5" />
              %{mc.probabilityOfLoss}
            </div>
          </div>
          <div className="text-center p-2.5 rounded-xl bg-card/30 border border-border/15">
            <div className="text-[11px] text-muted-foreground/50">Beklenen Getiri</div>
            <div className={cn("text-base font-bold tabular-nums mt-0.5",
              mc.expectedReturn >= 0 ? "text-gain" : "text-loss"
            )}>
              {mc.expectedReturn > 0 ? "+" : ""}{mc.expectedReturn}%
            </div>
          </div>
          <div className="text-center p-2.5 rounded-xl bg-card/30 border border-border/15">
            <div className="text-[11px] text-muted-foreground/50">%90 Aralık</div>
            <div className="text-sm font-bold tabular-nums text-foreground mt-0.5">
              <span className="text-loss">{mc.expectedReturnRange?.[0] ?? "?"}%</span>
              <span className="text-muted-foreground/40 mx-1">→</span>
              <span className="text-gain">{mc.expectedReturnRange?.[1] ?? "?"}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
