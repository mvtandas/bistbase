"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { StockCard } from "./stock-card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import type { DailySummaryData } from "@/types";

type Period = "today" | "week" | "month";

interface DailyFeedProps {
  stockCodes: string[];
  initialSummaries: Record<string, DailySummaryData>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PeriodResponse = any; // period API returns full analysis

async function fetchSummary(code: string): Promise<DailySummaryData | null> {
  try {
    const res = await fetch(`/api/summary/${code}`);
    if (!res.ok) return null;
    const data = await res.json();
    // API hata objesi döndüyse null say
    if (!data || data.error || !data.stockCode) return null;
    return data;
  } catch {
    return null;
  }
}

async function fetchPeriodData(code: string, period: "week" | "month"): Promise<PeriodResponse | null> {
  try {
    const res = await fetch(`/api/stock-detail/${code}/period?range=${period}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

const PERIOD_LABELS: Record<Period, string> = {
  today: "Bugün",
  week: "Bu Hafta",
  month: "Bu Ay",
};

export function DailyFeed({ stockCodes, initialSummaries }: DailyFeedProps) {
  const [period, setPeriod] = useState<Period>("today");

  // Today's data
  const { data: todaySummaries } = useQuery({
    queryKey: ["daily-summaries", stockCodes],
    queryFn: async () => {
      const results: Record<string, DailySummaryData> = {};
      await Promise.all(
        stockCodes.map(async (code) => {
          const summary = await fetchSummary(code);
          if (summary) results[code] = summary;
        })
      );
      // Eğer hiçbir summary gelemediyse initial data'yı koru
      return Object.keys(results).length > 0 ? results : initialSummaries;
    },
    initialData: Object.keys(initialSummaries).length > 0 ? initialSummaries : undefined,
    refetchInterval: 60 * 1000,
    enabled: period === "today",
  });

  // Period data (week/month)
  const { data: periodData, isLoading: periodLoading, isError: periodError } = useQuery({
    queryKey: ["period-data-v2", stockCodes, period],
    queryFn: async () => {
      const results: Record<string, PeriodResponse> = {};
      await Promise.all(
        stockCodes.map(async (code) => {
          const data = await fetchPeriodData(code, period as "week" | "month");
          if (data) results[code] = data;
        })
      );
      return results;
    },
    enabled: period !== "today",
    retry: 1,
  });

  if (stockCodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg text-muted-foreground">Henüz portföyünüzde hisse bulunmuyor.</p>
        <p className="text-sm text-muted-foreground mt-1">Keşfet sayfasından hisse ekleyerek başlayın.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Period Tabs */}
      <div className="flex items-center gap-1 mb-4 p-1 rounded-lg bg-card/30 border border-border/30 w-fit">
        {(["today", "week", "month"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
              period === p
                ? "bg-ai-primary text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-card/50"
            )}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Today View */}
      {period === "today" && (
        <div className="space-y-4">
          {stockCodes.map((code) => {
            const summary = todaySummaries?.[code];
            return (
              <StockCard
                key={code}
                stockCode={summary?.stockCode ?? code}
                closePrice={summary?.closePrice ?? null}
                changePercent={summary?.changePercent ?? null}
                aiSummaryText={summary?.aiSummaryText ?? null}
                sentimentScore={summary?.sentimentScore ?? null}
                status={summary?.status ?? "PENDING"}
                compositeScore={summary?.compositeScore ?? null}
                bullCase={summary?.bullCase ?? null}
                bearCase={summary?.bearCase ?? null}
                confidence={summary?.confidence ?? null}
              />
            );
          })}
        </div>
      )}

      {/* Week / Month View */}
      {period !== "today" && (
        <div className="space-y-4">
          {periodLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <BarChart3 className="h-4 w-4 animate-pulse mr-2" />
              <span className="text-sm">{PERIOD_LABELS[period]} verileri yükleniyor...</span>
            </div>
          ) : periodError ? (
            <div className="rounded-xl border border-loss/20 bg-loss/5 p-6 text-center">
              <p className="text-sm text-muted-foreground">Dönem verileri yüklenemedi.</p>
            </div>
          ) : (
            stockCodes.map((code) => {
              const pd = periodData?.[code];
              if (!pd) return null;

              const ai = pd.aiAnalysis;
              const score = pd.score;
              const changePercent = pd.changePercent;
              const scoreLabel = score ? (score.composite >= 65 ? "Güçlü Al" : score.composite >= 55 ? "Al" : score.composite >= 45 ? "Nötr" : score.composite >= 35 ? "Zayıf" : "Sat") : null;

              return (
                <div key={code} className="rounded-xl border border-border/40 bg-card/30 p-4">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{code}</span>
                      {score && (
                        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", score.composite >= 58 ? "bg-gain/10 text-gain" : score.composite >= 42 ? "bg-amber-400/10 text-amber-400" : "bg-loss/10 text-loss")}>
                          {score.composite} · {scoreLabel}
                        </span>
                      )}
                    </div>
                    {changePercent != null && (
                      <span className={cn("text-xs font-medium", changePercent >= 0 ? "text-gain" : "text-loss")}>
                        {changePercent >= 0 ? "+" : ""}{changePercent.toFixed(2)}%
                      </span>
                    )}
                  </div>

                  {/* AI Analysis */}
                  {ai?.summaryText && (
                    <div className="rounded-lg border border-ai-primary/15 bg-ai-primary/5 p-3 mb-3">
                      <p className="text-[11px] leading-relaxed text-foreground">{ai.summaryText}</p>
                    </div>
                  )}

                  {/* Bull / Bear */}
                  {(ai?.bullCase || ai?.bearCase) && (
                    <div className="grid grid-cols-2 gap-2">
                      {ai.bullCase && (
                        <div className="rounded-lg border border-gain/15 bg-gain/5 p-2">
                          <div className="flex items-center gap-1 mb-1"><TrendingUp className="h-3 w-3 text-gain" /><span className="text-[9px] font-medium text-gain uppercase">Boğa</span></div>
                          <p className="text-[10px] leading-relaxed text-muted-foreground">{ai.bullCase}</p>
                        </div>
                      )}
                      {ai.bearCase && (
                        <div className="rounded-lg border border-loss/15 bg-loss/5 p-2">
                          <div className="flex items-center gap-1 mb-1"><TrendingDown className="h-3 w-3 text-loss" /><span className="text-[9px] font-medium text-loss uppercase">Ayı</span></div>
                          <p className="text-[10px] leading-relaxed text-muted-foreground">{ai.bearCase}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* No AI — fallback from score */}
                  {!ai?.summaryText && score && (
                    <p className="text-[11px] text-muted-foreground">
                      {code} {period === "week" ? "haftalık" : "aylık"} bazda {score.composite}/100 puan. Teknik: {score.technical}, Momentum: {score.momentum}, Hacim: {score.volume}.
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
