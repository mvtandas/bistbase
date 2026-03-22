"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { QUERY_KEYS } from "@/lib/constants";
import { LightweightChart } from "./charts/lightweight-chart-wrapper";

type Range = "1M" | "3M" | "6M" | "ALL";

export function PortfolioEquityChart() {
  const [range, setRange] = useState<Range>("6M");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, isLoading, isError } = useQuery<any>({
    queryKey: QUERY_KEYS.PORTFOLIO_INTELLIGENCE,
    queryFn: () => fetch("/api/portfolio-intelligence").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="bento-card">
        <div className="bento-card-header"><Skeleton className="h-4 w-40" /></div>
        <div className="bento-card-body"><Skeleton className="h-[280px] w-full" /></div>
      </div>
    );
  }

  if (isError || !data) return null;

  const curve = data?.equityCurve ?? [];
  if (curve.length < 5) return null;

  // Filter by range
  const daysMap: Record<Range, number> = { "1M": 22, "3M": 66, "6M": 132, "ALL": 9999 };
  const filtered = curve.slice(-daysMap[range]);

  const portfolioSeries = filtered.map((p: { date: string; portfolioValue: number }) => ({
    time: p.date,
    value: p.portfolioValue,
  }));

  const bist100Series = filtered.map((p: { date: string; bist100Value: number }) => ({
    time: p.date,
    value: p.bist100Value,
  }));

  const meta = data?.equityCurveMeta;
  const isOutperforming = meta && meta.alpha > 0;

  return (
    <div className="bento-card animate-slide-up">
      <div className="bento-card-header">
        <TrendingUp className="h-4 w-4 text-ai-primary" />
        <span className="bento-card-title">Portföy Performansı</span>
        {meta && (
          <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full ml-2",
            isOutperforming ? "bg-gain/15 text-gain" : "bg-loss/15 text-loss"
          )}>
            {isOutperforming ? <TrendingUp className="inline h-3 w-3 mr-0.5" /> : <TrendingDown className="inline h-3 w-3 mr-0.5" />}
            Alpha: {meta.alpha > 0 ? "+" : ""}{meta.alpha}%
          </span>
        )}
        <div className="flex items-center gap-1 ml-auto p-0.5 rounded-lg bg-card/40 border border-border/20">
          {(["1M", "3M", "6M", "ALL"] as Range[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all",
                range === r ? "bg-ai-primary text-white shadow-sm" : "text-muted-foreground/60 hover:text-muted-foreground",
              )}
            >
              {r === "ALL" ? "Tümü" : r.replace("M", "A")}
            </button>
          ))}
        </div>
      </div>
      <div className="bento-card-body pt-2">
        <LightweightChart
          height={280}
          series={[
            { data: portfolioSeries, type: "area", color: "#818cf8", lineWidth: 2, title: "Portföy" },
            { data: bist100Series, type: "line", color: "rgba(255,255,255,0.2)", lineWidth: 1, title: "BİST100" },
          ]}
        />
        {meta && (
          <div className="flex items-center justify-center gap-6 mt-3 pt-3 border-t border-border/15">
            <div className="text-center">
              <div className="text-[11px] text-muted-foreground/60">Portföy</div>
              <div className={cn("text-sm font-bold tabular-nums", meta.totalReturn >= 0 ? "text-gain" : "text-loss")}>
                {meta.totalReturn > 0 ? "+" : ""}{meta.totalReturn}%
              </div>
            </div>
            <div className="text-center">
              <div className="text-[11px] text-muted-foreground/60">BİST100</div>
              <div className={cn("text-sm font-bold tabular-nums", meta.bist100TotalReturn >= 0 ? "text-gain" : "text-loss")}>
                {meta.bist100TotalReturn > 0 ? "+" : ""}{meta.bist100TotalReturn}%
              </div>
            </div>
            <div className="text-center">
              <div className="text-[11px] text-muted-foreground/60">Fark</div>
              <div className={cn("text-sm font-bold tabular-nums", meta.alpha >= 0 ? "text-gain" : "text-loss")}>
                {meta.alpha > 0 ? "+" : ""}{meta.alpha}%
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
