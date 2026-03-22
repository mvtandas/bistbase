"use client";

import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, Plus, Check, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAddStock, useRemoveStock } from "@/hooks/use-portfolio-mutations";
import { QUERY_KEYS } from "@/lib/constants";
import type { StockDetail, Period } from "./types";
import { PERIOD_LABELS } from "./types";

interface StockHeroProps {
  data: StockDetail;
  activeData: StockDetail | undefined;
  period: Period;
  setPeriod: (p: Period) => void;
  pdLoading: boolean;
  stockCode: string;
  onStockAdded?: (code: string) => void;
}

export function StockHero({ data, activeData, period, setPeriod, pdLoading, stockCode, onStockAdded }: StockHeroProps) {
  const d = activeData;
  const isPositive = (data.changePercent ?? 0) >= 0;
  const activeScore = period === "today" ? data.score : d?.score;
  const absoluteChange = data.price != null && data.changePercent != null
    ? (data.price * data.changePercent / (100 + data.changePercent))
    : null;

  // Portfolio membership check
  const { data: portfolioData } = useQuery<{ holdings?: { stockCode: string }[] }>({
    queryKey: QUERY_KEYS.PORTFOLIO_INTELLIGENCE,
    queryFn: () => fetch("/api/portfolio-intelligence").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });
  const inPortfolio = portfolioData?.holdings?.some((h) => h.stockCode === stockCode) ?? false;
  const addStock = useAddStock();
  const removeStock = useRemoveStock();
  const isMutating = addStock.isPending || removeStock.isPending;

  return (
    <div className="sticky top-0 z-20 bg-background -mx-4 md:-mx-6 px-4 md:px-6 -mt-6 md:-mt-8 pt-4 pb-3 mb-4 border-b border-border/30">
      {/* Row 1: Code + Price + Score */}
      <div className="flex items-center justify-between gap-3">
        {/* Left: Code + Price */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ai-primary/10 text-ai-primary text-xs font-bold shrink-0">
            {stockCode.slice(0, 3)}
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h1 className="text-base font-bold text-foreground leading-none">{stockCode}</h1>
              <span className="text-xs text-muted-foreground/60 truncate hidden sm:inline">{data.name}</span>
            </div>
            {data.price != null && (
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl font-extrabold text-foreground tabular-nums">₺{data.price.toFixed(2)}</span>
                {data.changePercent != null && (
                  <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", isPositive ? "text-gain" : "text-loss")}>
                    {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {absoluteChange != null && <span>{isPositive ? "+" : ""}₺{Math.abs(absoluteChange).toFixed(2)}</span>}
                    <span>({isPositive ? "+" : ""}{data.changePercent.toFixed(2)}%)</span>
                  </span>
                )}
                {period !== "today" && d?.changePercent != null && (
                  <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", d.changePercent >= 0 ? "bg-gain/10 text-gain" : "bg-loss/10 text-loss")}>
                    {period === "week" ? "H" : "A"}: {d.changePercent >= 0 ? "+" : ""}{d.changePercent.toFixed(2)}%
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Portfolio button + Score */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              if (inPortfolio) {
                removeStock.mutate(stockCode);
              } else {
                addStock.mutate(stockCode, { onSuccess: () => onStockAdded?.(stockCode) });
              }
            }}
            disabled={isMutating}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50",
              inPortfolio
                ? "bg-gain/10 text-gain border border-gain/20 hover:bg-loss/10 hover:text-loss hover:border-loss/20"
                : "bg-ai-primary/10 text-ai-primary border border-ai-primary/20 hover:bg-ai-primary/20"
            )}
            title={inPortfolio ? "Portföyden çıkar" : "Portföye ekle"}
          >
            {isMutating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : inPortfolio ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">{inPortfolio ? "Portföyde" : "Portföye Ekle"}</span>
          </button>

          {activeScore && (
            <div className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border",
              activeScore.composite >= 70 ? "bg-gain/5 border-gain/15" :
              activeScore.composite >= 45 ? "bg-amber-400/5 border-amber-400/15" :
              "bg-loss/5 border-loss/15"
            )}>
              <span className={cn(
                "text-lg font-extrabold tabular-nums leading-none",
                activeScore.composite >= 70 ? "text-gain" :
                activeScore.composite >= 45 ? "text-amber-400" : "text-loss"
              )}>
                {activeScore.composite}
              </span>
              <span className="text-[9px] font-medium text-muted-foreground/60 leading-tight">{activeScore.labelTr}</span>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Period tabs */}
      <div className="flex items-center gap-3 mt-2">
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-card/40 border border-border/20">
          {(["today", "week", "month"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-3 py-1 text-[11px] font-medium rounded-md transition-all",
                period === p
                  ? "bg-ai-primary text-white shadow-sm"
                  : "text-muted-foreground/70 hover:text-foreground hover:bg-card/60"
              )}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        {period !== "today" && pdLoading && (
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-ai-primary animate-pulse" />
            <span className="text-[10px] text-muted-foreground/60">Yükleniyor</span>
          </div>
        )}
      </div>
    </div>
  );
}
