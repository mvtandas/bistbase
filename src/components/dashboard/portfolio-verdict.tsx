"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, ShieldAlert, ChevronRight, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { QUERY_KEYS } from "@/lib/constants";
import type { PortfolioIntelligence } from "@/lib/stock/portfolio-intelligence";

type VerdictAction = PortfolioIntelligence["portfolioVerdict"]["action"];
type Timeframe = "daily" | "weekly" | "monthly";

const TIMEFRAME_LABELS: Record<Timeframe, string> = { daily: "Günlük", weekly: "Haftalık", monthly: "Aylık" };

const ACTION_CONFIG: Record<VerdictAction, { gradient: string; border: string; text: string; accent: string; icon: typeof TrendingUp }> = {
  GUCLU_AL: { gradient: "from-gain/12 via-gain/4 to-transparent", border: "border-gain/25", text: "text-gain", accent: "bg-gain", icon: TrendingUp },
  AL: { gradient: "from-gain/8 via-gain/3 to-transparent", border: "border-gain/20", text: "text-gain", accent: "bg-gain", icon: TrendingUp },
  TUT: { gradient: "from-amber-400/8 via-amber-400/3 to-transparent", border: "border-amber-400/20", text: "text-amber-400", accent: "bg-amber-400", icon: Minus },
  SAT: { gradient: "from-loss/8 via-loss/3 to-transparent", border: "border-loss/20", text: "text-loss", accent: "bg-loss", icon: TrendingDown },
  GUCLU_SAT: { gradient: "from-loss/12 via-loss/4 to-transparent", border: "border-loss/25", text: "text-loss", accent: "bg-loss", icon: TrendingDown },
};

function AllocationBar({ allocation }: { allocation: PortfolioIntelligence["allocation"] }) {
  const colors = ["bg-ai-primary", "bg-gain", "bg-amber-400", "bg-loss", "bg-violet-500", "bg-cyan-500", "bg-orange-400", "bg-pink-400"];
  return (
    <div className="space-y-1.5">
      <div className="flex gap-0.5 h-2.5 rounded-full overflow-hidden">
        {allocation.map((a, i) => (
          <div key={a.stockCode} className={cn("rounded-sm", colors[i % colors.length])} style={{ width: `${a.weight}%`, transition: "width 0.5s" }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {allocation.map((a, i) => (
          <span key={a.stockCode} className="flex items-center gap-1 text-[9px] text-muted-foreground/60">
            <span className={cn("w-1.5 h-1.5 rounded-full", colors[i % colors.length])} />
            {a.stockCode} %{a.weight}
          </span>
        ))}
      </div>
    </div>
  );
}

export function PortfolioVerdict() {
  const [timeframe, setTimeframe] = useState<Timeframe>("daily");

  const { data, isLoading, error } = useQuery<PortfolioIntelligence>({
    queryKey: [...QUERY_KEYS.PORTFOLIO_INTELLIGENCE, timeframe],
    queryFn: () => fetch(`/api/portfolio-intelligence?timeframe=${timeframe}`).then(r => r.json()),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card/30 p-5 space-y-3">
        <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 animate-pulse text-ai-primary" /><span className="text-sm text-muted-foreground">Portföy analiz ediliyor...</span></div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    );
  }

  if (error || !data || !data.portfolioVerdict) return null;

  const v = data.portfolioVerdict;
  const c = ACTION_CONFIG[v.action];
  const Icon = c.icon;
  const m = data.metrics;

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border backdrop-blur-sm", c.border, "bg-gradient-to-br", c.gradient)}>
      <div className={cn("absolute -top-10 -left-10 w-40 h-40 rounded-full blur-3xl opacity-15 pointer-events-none", c.accent)} />

      <div className="relative z-10 p-4 sm:p-5">
        {/* Timeframe Tabs */}
        <div className="flex items-center gap-1 mb-3 p-0.5 rounded-lg bg-card/40 border border-border/20 w-fit">
          {(["daily", "weekly", "monthly"] as Timeframe[]).map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={cn(
                "px-3 py-1 rounded-md text-[10px] font-medium transition-all",
                timeframe === tf
                  ? "bg-ai-primary text-white shadow-sm"
                  : "text-muted-foreground/60 hover:text-muted-foreground",
              )}
            >
              {TIMEFRAME_LABELS[tf]}
            </button>
          ))}
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("flex items-center justify-center w-11 h-11 rounded-xl ring-1 ring-border/20", c.accent + "/10")}>
              <Icon className={cn("h-5 w-5", c.text)} strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-medium mb-0.5">Portföy Kararı</div>
              <h3 className={cn("text-xl font-black tracking-tight leading-none", c.text)}>{v.actionLabel}</h3>
            </div>
          </div>
          <div className="text-right">
            <div className={cn("text-2xl font-extrabold tabular-nums", c.text)}>{data.portfolioCompositeScore}</div>
            <div className="text-[9px] text-muted-foreground/40">Bileşik Skor</div>
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-full",
            v.confidence >= 70 ? "bg-gain/15 text-gain" : v.confidence >= 45 ? "bg-amber-400/15 text-amber-400" : "bg-loss/15 text-loss",
          )}>%{v.confidence} Güven</span>
          {m.dailyChange !== 0 && (
            <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-full", m.dailyChange > 0 ? "bg-gain/10 text-gain" : "bg-loss/10 text-loss")}>
              Bugün {m.dailyChange > 0 ? "+" : ""}{m.dailyChange}%
            </span>
          )}
          {m.totalPnL != null && (
            <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-full", m.totalPnL >= 0 ? "bg-gain/10 text-gain" : "bg-loss/10 text-loss")}>
              {m.totalPnL >= 0 ? "+" : ""}₺{m.totalPnL.toLocaleString("tr-TR")} ({m.totalPnLPercent != null ? `${m.totalPnLPercent > 0 ? "+" : ""}%${m.totalPnLPercent}` : ""})
            </span>
          )}
        </div>

        {/* Metrics row */}
        {(m.totalValue != null || m.portfolioBeta != null) && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {m.totalValue != null && (
              <div className="text-center p-2 rounded-lg bg-card/30 border border-border/10">
                <div className="text-[9px] text-muted-foreground/40">Toplam Değer</div>
                <div className="text-[13px] font-bold tabular-nums text-foreground">₺{m.totalValue.toLocaleString("tr-TR")}</div>
              </div>
            )}
            {m.portfolioBeta != null && (
              <div className="text-center p-2 rounded-lg bg-card/30 border border-border/10">
                <div className="text-[9px] text-muted-foreground/40">Beta</div>
                <div className="text-[13px] font-bold tabular-nums text-foreground">{m.portfolioBeta}</div>
              </div>
            )}
            <div className="text-center p-2 rounded-lg bg-card/30 border border-border/10">
              <div className="text-[9px] text-muted-foreground/40">Holding</div>
              <div className="text-[13px] font-bold tabular-nums text-foreground">{data.holdings.length}</div>
            </div>
          </div>
        )}

        {/* Allocation bar */}
        {data.allocation.length > 0 && (
          <div className="mt-3">
            <AllocationBar allocation={data.allocation} />
          </div>
        )}

        {/* Strongest / Weakest */}
        {(data.strongestHolding || data.weakestHolding) && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {data.strongestHolding && (
              <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-gain/5 border border-gain/10 text-[10px]">
                <TrendingUp className="h-3 w-3 text-gain/60 shrink-0" />
                <span className="text-gain/80"><span className="font-bold">{data.strongestHolding.code}</span> — {data.strongestHolding.reason}</span>
              </div>
            )}
            {data.weakestHolding && (
              <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-loss/5 border border-loss/10 text-[10px]">
                <TrendingDown className="h-3 w-3 text-loss/60 shrink-0" />
                <span className="text-loss/80"><span className="font-bold">{data.weakestHolding.code}</span> — {data.weakestHolding.reason}</span>
              </div>
            )}
          </div>
        )}

        {/* Rebalancing suggestions */}
        {data.suggestions.length > 0 && (
          <div className="mt-3 space-y-1">
            {data.suggestions.slice(0, 3).map((s, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[10px] text-muted-foreground/60">
                <ShieldAlert className={cn("h-3 w-3 shrink-0 mt-0.5", s.severity === "HIGH" ? "text-loss/60" : "text-amber-400/60")} />
                <span>{s.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
