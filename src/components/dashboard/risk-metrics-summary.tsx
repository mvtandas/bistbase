"use client";

import { cn } from "@/lib/utils";
import { ShieldAlert, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortfolioAnalytics } from "@/hooks/use-portfolio-data";

interface MetricDef {
  key: string;
  label: string;
  suffix: string;
  tooltip: string;
  goodAbove?: number;
  goodBelow?: number;
}

const METRICS: MetricDef[] = [
  { key: "sharpeRatio", label: "Sharpe", suffix: "", tooltip: "Risk-ayarlı getiri. >1 iyi, >2 mükemmel", goodAbove: 0.5 },
  { key: "sortinoRatio", label: "Sortino", suffix: "", tooltip: "Aşağı yönlü risk-ayarlı getiri. >1 iyi", goodAbove: 0.5 },
  { key: "calmarRatio", label: "Calmar", suffix: "", tooltip: "Yıllık getiri / max drawdown. >1 iyi", goodAbove: 0.5 },
  { key: "var95", label: "VaR (%95)", suffix: "%", tooltip: "Günlük max kayıp (%95 güvenle)", goodAbove: -1 },
  { key: "cvar95", label: "CVaR", suffix: "%", tooltip: "VaR aşılırsa beklenen ortalama kayıp", goodAbove: -1.5 },
  { key: "annualizedVolatility", label: "Volatilite", suffix: "%", tooltip: "Yıllıklaştırılmış fiyat dalgalanması", goodBelow: 30 },
  { key: "winRate", label: "Kazanma", suffix: "%", tooltip: "Pozitif getirili gün oranı", goodAbove: 50 },
  { key: "profitFactor", label: "K/Z Faktörü", suffix: "x", tooltip: "Toplam kazanç / toplam kayıp", goodAbove: 1.2 },
];

export function RiskMetricsSummary() {
  const { data, isLoading } = usePortfolioAnalytics();

  if (isLoading) {
    return (
      <div className="bento-card">
        <div className="bento-card-header"><Skeleton className="h-4 w-32" /></div>
        <div className="bento-card-body"><Skeleton className="h-[200px] w-full" /></div>
      </div>
    );
  }

  const metrics = data?.extendedRiskMetrics;
  if (!metrics) return (
    <div className="bento-card">
      <div className="bento-card-header">
        <ShieldAlert className="h-4 w-4 text-amber-400" />
        <span className="bento-card-title">Risk Metrikleri</span>
      </div>
      <div className="bento-card-body flex items-center justify-center py-8">
        <p className="text-xs text-muted-foreground/50">Henüz yeterli veri yok. Risk metrikleri en az 20 günlük veri gerektirir.</p>
      </div>
    </div>
  );

  return (
    <div className="bento-card animate-slide-up">
      <div className="bento-card-header">
        <ShieldAlert className="h-4 w-4 text-amber-400" />
        <span className="bento-card-title">Risk Metrikleri</span>
      </div>
      <div className="bento-card-body">
        <div className="grid grid-cols-2 gap-3.5">
          {METRICS.map(m => {
            const value = metrics[m.key];
            if (value == null) return null;

            let isGood = false;
            if (m.goodAbove != null) isGood = value >= m.goodAbove;
            else if (m.goodBelow != null) isGood = value <= m.goodBelow;

            return (
              <div key={m.key} className="p-3 rounded-xl bg-card/30 border border-border/15">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground/60">{m.label}</span>
                  <div className="group relative">
                    <Info className="h-3 w-3 text-muted-foreground/30 cursor-help" />
                    <div className="absolute bottom-full right-0 mb-1 px-2 py-1 rounded-md bg-card border border-border text-[10px] text-muted-foreground/80 w-40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      {m.tooltip}
                    </div>
                  </div>
                </div>
                <div className={cn("text-base font-bold tabular-nums",
                  isGood ? "text-gain" : "text-loss"
                )}>
                  {value}{m.suffix}
                </div>
              </div>
            );
          })}
        </div>

        {/* Streaks */}
        <div className="mt-3 pt-3 border-t border-border/15 flex items-center justify-between text-xs">
          <span className="text-muted-foreground/60">Max Ardışık Kayıp</span>
          <span className="font-bold text-loss">{metrics.maxConsecutiveLoss} gün</span>
        </div>
        <div className="flex items-center justify-between text-xs mt-1">
          <span className="text-muted-foreground/60">Max Ardışık Kazanç</span>
          <span className="font-bold text-gain">{metrics.maxConsecutiveGain} gün</span>
        </div>
      </div>
    </div>
  );
}
