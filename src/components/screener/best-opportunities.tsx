"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ScreenerStockResult } from "@/lib/stock/batch-analysis";

interface BestOpportunitiesProps {
  stocks: ScreenerStockResult[];
}

export function BestOpportunities({ stocks }: BestOpportunitiesProps) {
  const topStocks = stocks
    .filter(s => s.verdict && (s.verdict.action === "GUCLU_AL" || s.verdict.action === "AL"))
    .sort((a, b) => (b.composite?.composite ?? 0) - (a.composite?.composite ?? 0))
    .slice(0, 5);

  if (topStocks.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-ai-primary" />
        <h2 className="text-sm font-semibold text-foreground">En İyi Fırsatlar</h2>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {topStocks.map(stock => {
          const isStrongBuy = stock.verdict?.action === "GUCLU_AL";
          const topSignal = stock.signals.filter(s => s.direction === "BULLISH").sort((a, b) => b.strength - a.strength)[0];

          return (
            <Link
              key={stock.code}
              href={`/dashboard/stock/${stock.code}`}
              className={cn(
                "flex-shrink-0 w-[220px] rounded-xl border p-4 transition-all hover:scale-[1.02]",
                isStrongBuy
                  ? "border-gain/30 bg-gain/5 hover:border-gain/50"
                  : "border-gain/15 bg-gain/[0.02] hover:border-gain/30"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-foreground">{stock.code}</span>
                <span className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
                  isStrongBuy ? "bg-gain/15 text-gain" : "bg-gain/10 text-gain"
                )}>
                  <TrendingUp className="h-2.5 w-2.5" />
                  {isStrongBuy ? "Güçlü Al" : "Al"}
                </span>
              </div>

              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-lg font-semibold text-foreground">
                  {stock.price != null ? `₺${stock.price.toFixed(2)}` : "—"}
                </span>
                <span className={cn("text-xs font-medium", (stock.changePercent ?? 0) >= 0 ? "text-gain" : "text-loss")}>
                  {stock.changePercent != null ? `${stock.changePercent >= 0 ? "+" : ""}${stock.changePercent.toFixed(2)}%` : ""}
                </span>
              </div>

              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-muted-foreground/60">Skor</span>
                <span className="text-sm font-bold text-gain">
                  {stock.composite ? Math.round(stock.composite.composite) : "—"}
                </span>
              </div>

              {topSignal && (
                <p className="text-[10px] text-muted-foreground/60 leading-tight line-clamp-2">
                  {topSignal.description}
                </p>
              )}

              {stock.verdict && (
                <p className="text-[10px] text-muted-foreground/40 mt-1">
                  Güven: {stock.verdict.confidence}%
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
