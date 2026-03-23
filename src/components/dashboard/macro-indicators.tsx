"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Globe, TrendingUp, TrendingDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarketPollingInterval } from "@/hooks/use-market-polling";

interface MacroData {
  usdTry: number | null;
  usdTryChange: number | null;
  eurTry: number | null;
  eurTryChange: number | null;
  dxy: number | null;
  dxyChange: number | null;
  bist100: number | null;
  bist100Change: number | null;
  goldUsd: number | null;
  goldUsdChange: number | null;
  turkey10Y: number | null;
  turkey10YChange: number | null;
  vix: number | null;
  vixChange: number | null;
  macroScore: number;
  macroLabel: string;
}

const INDICATORS = [
  { key: "usdTry", changeKey: "usdTryChange", label: "USD/TRY", format: "fx", invertColor: true },
  { key: "eurTry", changeKey: "eurTryChange", label: "EUR/TRY", format: "fx", invertColor: true },
  { key: "goldUsd", changeKey: "goldUsdChange", label: "Altın", format: "usd", invertColor: false },
  { key: "bist100", changeKey: "bist100Change", label: "BİST 100", format: "number", invertColor: false },
  { key: "vix", changeKey: "vixChange", label: "VIX", format: "number", invertColor: true },
  { key: "dxy", changeKey: "dxyChange", label: "DXY", format: "number", invertColor: true },
] as const;

function formatValue(value: number | null, format: string): string {
  if (value == null) return "—";
  if (format === "fx") return value.toFixed(4);
  if (format === "usd") return `$${value.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}`;
  return value.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

export function MacroIndicators() {
  const pollingInterval = useMarketPollingInterval();
  const { data, isLoading, isError } = useQuery<MacroData>({
    queryKey: ["macro"],
    queryFn: () => fetch("/api/macro").then((r) => r.json()),
    staleTime: pollingInterval * 2,
    refetchInterval: pollingInterval * 2,
  });

  if (isLoading) {
    return (
      <div className="bento-card">
        <div className="bento-card-header"><Skeleton className="h-4 w-36" /></div>
        <div className="bento-card-body grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) return null;

  const scoreColor =
    data.macroScore >= 65 ? "bg-gain/10 text-gain" :
    data.macroScore >= 45 ? "bg-amber-400/10 text-amber-400" :
    "bg-loss/10 text-loss";

  return (
    <div className="bento-card animate-slide-up">
      <div className="bento-card-header">
        <Globe className="h-4 w-4 text-ai-primary" />
        <span className="bento-card-title">Makro Göstergeler</span>
        <span className={cn("text-xs font-bold px-2.5 py-1 rounded-lg ml-auto", scoreColor)}>
          {data.macroLabel}
        </span>
      </div>
      <div className="bento-card-body">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {INDICATORS.map((ind) => {
            const value = data[ind.key as keyof MacroData] as number | null;
            const change = data[ind.changeKey as keyof MacroData] as number | null;
            const isPositive = change != null && change > 0;
            const isNegative = change != null && change < 0;
            // For USD/TRY, VIX, DXY — rising is bad for market
            const isGood = ind.invertColor ? isNegative : isPositive;
            const isBad = ind.invertColor ? isPositive : isNegative;

            return (
              <div
                key={ind.key}
                className="rounded-xl bg-card/40 border border-border/20 p-2.5 text-center"
              >
                <div className="text-[10px] text-muted-foreground/50 mb-0.5">{ind.label}</div>
                <div className="text-sm font-bold tabular-nums text-foreground">
                  {formatValue(value, ind.format)}
                </div>
                {change != null && (
                  <div className={cn(
                    "flex items-center justify-center gap-0.5 text-[10px] font-semibold tabular-nums mt-0.5",
                    isGood ? "text-gain" : isBad ? "text-loss" : "text-muted-foreground"
                  )}>
                    {isPositive ? <TrendingUp className="h-2.5 w-2.5" /> : isNegative ? <TrendingDown className="h-2.5 w-2.5" /> : null}
                    {change > 0 ? "+" : ""}{change.toFixed(2)}%
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
