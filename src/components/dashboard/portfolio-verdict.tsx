"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, ShieldAlert, Sparkles, Activity, Shield } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { QUERY_KEYS } from "@/lib/constants";
import type { PortfolioIntelligence } from "@/lib/stock/portfolio-intelligence";

type VerdictAction = PortfolioIntelligence["portfolioVerdict"]["action"];
type Timeframe = "daily" | "weekly" | "monthly";

const TIMEFRAME_LABELS: Record<Timeframe, string> = { daily: "Günlük", weekly: "Haftalık", monthly: "Aylık" };

const ACTION_CONFIG: Record<VerdictAction, { gradient: string; border: string; text: string; accent: string; accentBg: string; icon: typeof TrendingUp; label: string }> = {
  GUCLU_AL: { gradient: "from-gain/12 via-gain/4 to-transparent", border: "border-gain/30", text: "text-gain", accent: "bg-gain", accentBg: "bg-gain/10", icon: TrendingUp, label: "Güçlü Al" },
  AL: { gradient: "from-gain/8 via-gain/3 to-transparent", border: "border-gain/25", text: "text-gain", accent: "bg-gain", accentBg: "bg-gain/8", icon: TrendingUp, label: "Al" },
  TUT: { gradient: "from-amber-400/8 via-amber-400/3 to-transparent", border: "border-amber-400/25", text: "text-amber-400", accent: "bg-amber-400", accentBg: "bg-amber-400/8", icon: Minus, label: "Tut" },
  SAT: { gradient: "from-loss/8 via-loss/3 to-transparent", border: "border-loss/25", text: "text-loss", accent: "bg-loss", accentBg: "bg-loss/8", icon: TrendingDown, label: "Sat" },
  GUCLU_SAT: { gradient: "from-loss/12 via-loss/4 to-transparent", border: "border-loss/30", text: "text-loss", accent: "bg-loss", accentBg: "bg-loss/10", icon: TrendingDown, label: "Güçlü Sat" },
};

function MiniEquityCurve({ data }: { data: { date: string; portfolioValue: number }[] }) {
  if (data.length < 3) return null;
  const last30 = data.slice(-30);
  const min = Math.min(...last30.map(d => d.portfolioValue));
  const max = Math.max(...last30.map(d => d.portfolioValue));
  const range = max - min || 1;
  const w = 200, h = 50;

  const points = last30.map((d, i) => {
    const x = (i / (last30.length - 1)) * w;
    const y = h - ((d.portfolioValue - min) / range) * (h - 6) - 3;
    return `${x},${y}`;
  }).join(" ");

  const isUp = last30[last30.length - 1].portfolioValue >= last30[0].portfolioValue;
  const color = isUp ? "var(--color-gain)" : "var(--color-loss)";

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[200px] h-[50px]" preserveAspectRatio="none">
      <defs>
        <linearGradient id="mini-eq-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${points} ${w},${h}`} fill="url(#mini-eq-grad)" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function PortfolioVerdict() {
  const [timeframe, setTimeframe] = useState<Timeframe>("daily");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, isLoading, error } = useQuery<any>({
    queryKey: [...QUERY_KEYS.PORTFOLIO_INTELLIGENCE, timeframe],
    queryFn: () => fetch(`/api/portfolio-intelligence?timeframe=${timeframe}`).then(r => r.json()),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="bento-card p-6 space-y-4 animate-fade-in">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 animate-pulse text-ai-primary" />
          <span className="text-sm text-muted-foreground">Portföy analiz ediliyor...</span>
        </div>
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      </div>
    );
  }

  if (error || !data || !data.portfolioVerdict) return null;

  const v = data.portfolioVerdict;
  const c = ACTION_CONFIG[v.action as VerdictAction];
  const Icon = c.icon;
  const m = data.metrics;
  const equityCurve = data.equityCurve ?? [];
  const health = data.healthScore;

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border backdrop-blur-sm animate-fade-in", c.border, "bg-gradient-to-br", c.gradient)}>
      {/* Ambient glow */}
      <div className={cn("absolute -top-16 -left-16 w-56 h-56 rounded-full blur-3xl opacity-10 pointer-events-none", c.accent)} />
      <div className={cn("absolute -bottom-16 -right-16 w-40 h-40 rounded-full blur-3xl opacity-8 pointer-events-none", c.accent)} />

      <div className="relative z-10 p-5 sm:p-6">
        {/* Timeframe Tabs */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5 p-0.5 rounded-lg bg-card/40 border border-border/20 w-fit">
            {(["daily", "weekly", "monthly"] as Timeframe[]).map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={cn(
                  "px-3.5 py-1.5 rounded-md text-xs font-medium transition-all",
                  timeframe === tf
                    ? "bg-ai-primary text-white shadow-sm"
                    : "text-muted-foreground/70 hover:text-muted-foreground",
                )}
              >
                {TIMEFRAME_LABELS[tf]}
              </button>
            ))}
          </div>
          {health && (
            <div className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-muted-foreground/50" />
              <span className={cn("text-xs font-bold px-2 py-1 rounded-lg",
                health.totalScore >= 70 ? "bg-gain/15 text-gain" :
                health.totalScore >= 50 ? "bg-amber-400/15 text-amber-400" :
                "bg-loss/15 text-loss"
              )}>
                {health.grade} · {health.totalScore}
              </span>
            </div>
          )}
        </div>

        {/* Hero Row */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Left: Verdict + Score */}
          <div className="flex items-center gap-4">
            <div className={cn("flex items-center justify-center w-14 h-14 rounded-2xl ring-1 ring-border/20 animate-scale-in", c.accentBg)}>
              <Icon className={cn("h-7 w-7", c.text)} strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground/60 uppercase tracking-wider font-medium mb-0.5">Portföy Kararı</div>
              <h2 className={cn("text-2xl sm:text-3xl font-black tracking-tight leading-none", c.text)}>{v.actionLabel}</h2>
            </div>
            <div className="ml-2 text-right">
              <div className={cn("text-3xl sm:text-4xl font-extrabold tabular-nums animate-count-up", c.text)}>{data.portfolioCompositeScore}</div>
              <div className="text-[11px] text-muted-foreground/50">Bileşik Skor</div>
            </div>
          </div>

          {/* Right: Mini Equity Curve */}
          <div className="hidden sm:block">
            <MiniEquityCurve data={equityCurve} />
          </div>
        </div>

        {/* Confidence + Badges */}
        <div className="flex items-center gap-2.5 mt-3 flex-wrap">
          <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full",
            v.confidence >= 70 ? "bg-gain/15 text-gain" : v.confidence >= 45 ? "bg-amber-400/15 text-amber-400" : "bg-loss/15 text-loss",
          )}>%{v.confidence} Güven</span>
          {m.dailyChange !== 0 && (
            <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", m.dailyChange > 0 ? "bg-gain/10 text-gain" : "bg-loss/10 text-loss")}>
              Bugün {m.dailyChange > 0 ? "+" : ""}{m.dailyChange}%
            </span>
          )}
          {m.totalPnL != null && (
            <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", m.totalPnL >= 0 ? "bg-gain/10 text-gain" : "bg-loss/10 text-loss")}>
              {m.totalPnL >= 0 ? "+" : ""}₺{m.totalPnL.toLocaleString("tr-TR")} ({m.totalPnLPercent != null ? `${m.totalPnLPercent > 0 ? "+" : ""}%${m.totalPnLPercent}` : ""})
            </span>
          )}
        </div>

        {/* Key Metrics Grid */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {m.totalValue != null && (
            <div className="text-center p-3 rounded-xl bg-card/30 border border-border/15 animate-slide-up stagger-1">
              <div className="text-[11px] text-muted-foreground/50">Toplam Değer</div>
              <div className="text-base font-bold tabular-nums text-foreground mt-0.5">₺{m.totalValue.toLocaleString("tr-TR")}</div>
            </div>
          )}
          {m.portfolioBeta != null && (
            <div className="text-center p-3 rounded-xl bg-card/30 border border-border/15 animate-slide-up stagger-2">
              <div className="text-[11px] text-muted-foreground/50">Beta</div>
              <div className="text-base font-bold tabular-nums text-foreground mt-0.5">{m.portfolioBeta}</div>
            </div>
          )}
          <div className="text-center p-3 rounded-xl bg-card/30 border border-border/15 animate-slide-up stagger-3">
            <div className="text-[11px] text-muted-foreground/50">Holding</div>
            <div className="text-base font-bold tabular-nums text-foreground mt-0.5">{data.holdings.length}</div>
          </div>
          {data.equityCurveMeta?.alpha != null && (
            <div className="text-center p-3 rounded-xl bg-card/30 border border-border/15 animate-slide-up stagger-4">
              <div className="text-[11px] text-muted-foreground/50">Alpha (6A)</div>
              <div className={cn("text-base font-bold tabular-nums mt-0.5", data.equityCurveMeta.alpha >= 0 ? "text-gain" : "text-loss")}>
                {data.equityCurveMeta.alpha > 0 ? "+" : ""}{data.equityCurveMeta.alpha}%
              </div>
            </div>
          )}
        </div>

        {/* Allocation Bar */}
        {data.allocation.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex gap-0.5 h-3 rounded-full overflow-hidden">
              {data.allocation.map((a: { stockCode: string; weight: number }, i: number) => {
                const colors = ["bg-ai-primary", "bg-gain", "bg-amber-400", "bg-loss", "bg-violet-500", "bg-cyan-500", "bg-orange-400", "bg-pink-400"];
                return (
                  <div key={a.stockCode} className={cn("rounded-sm transition-all duration-700", colors[i % colors.length])} style={{ width: `${a.weight}%` }} />
                );
              })}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {data.allocation.map((a: { stockCode: string; weight: number }, i: number) => {
                const colors = ["bg-ai-primary", "bg-gain", "bg-amber-400", "bg-loss", "bg-violet-500", "bg-cyan-500", "bg-orange-400", "bg-pink-400"];
                return (
                  <span key={a.stockCode} className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
                    <span className={cn("w-2 h-2 rounded-full", colors[i % colors.length])} />
                    {a.stockCode} %{a.weight}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Strongest / Weakest */}
        {(data.strongestHolding || data.weakestHolding) && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.strongestHolding && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gain/5 border border-gain/15 text-xs">
                <TrendingUp className="h-3.5 w-3.5 text-gain/70 shrink-0" />
                <span className="text-gain/90"><span className="font-bold">{data.strongestHolding.code}</span> — {data.strongestHolding.reason}</span>
              </div>
            )}
            {data.weakestHolding && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-loss/5 border border-loss/15 text-xs">
                <TrendingDown className="h-3.5 w-3.5 text-loss/70 shrink-0" />
                <span className="text-loss/90"><span className="font-bold">{data.weakestHolding.code}</span> — {data.weakestHolding.reason}</span>
              </div>
            )}
          </div>
        )}

        {/* Rebalancing suggestions */}
        {data.suggestions.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {data.suggestions.slice(0, 3).map((s: { severity: string; message: string }, i: number) => (
              <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground/70">
                <ShieldAlert className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", s.severity === "HIGH" ? "text-loss/70" : "text-amber-400/70")} />
                <span>{s.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
