"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/lib/constants";
import { ScreenerTable } from "@/components/screener/screener-table";
import { BestOpportunities } from "@/components/screener/best-opportunities";
import { SectorHeatmap } from "@/components/screener/sector-heatmap";
import { MarketSummaryCards } from "@/components/screener/market-summary";
import { ScreenerFilters } from "@/components/screener/screener-filters";
import { ScreenerSkeleton } from "@/components/screener/screener-skeleton";
import { RefreshCw, Radio, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScreenerResult, ScreenerStockResult } from "@/lib/stock/batch-analysis";
import type { VerdictAction } from "@/lib/stock/verdict";
import type { ScreenerIndex } from "@/lib/constants";

const REGIME_LABELS: Record<string, { label: string; color: string }> = {
  LOW: { label: "Düşük Volatilite", color: "bg-gain/15 text-gain" },
  NORMAL: { label: "Normal", color: "bg-amber-400/15 text-amber-400" },
  HIGH: { label: "Yüksek Volatilite", color: "bg-orange-400/15 text-orange-400" },
  CRISIS: { label: "Kriz Modu", color: "bg-loss/15 text-loss" },
};

const INDEX_TABS: { value: ScreenerIndex; label: string; group: "index" | "thematic" }[] = [
  { value: "bist30", label: "BİST 30", group: "index" },
  { value: "bist50", label: "BİST 50", group: "index" },
  { value: "bist100", label: "BİST 100", group: "index" },
  { value: "bistall", label: "Tüm BİST", group: "index" },
  { value: "xtm25", label: "Temettü 25", group: "thematic" },
  { value: "xkury", label: "Kurumsal Yönetim", group: "thematic" },
  { value: "xusrd", label: "Sürdürülebilirlik", group: "thematic" },
];

export function ScreenerClient() {
  const [index, setIndex] = useState<ScreenerIndex>("bist30");
  const [verdictFilter, setVerdictFilter] = useState<VerdictAction | "ALL">("ALL");
  const [sectorFilter, setSectorFilter] = useState<string>("ALL");
  const [scoreRange, setScoreRange] = useState<[number, number]>([0, 100]);

  const { data, isLoading, isRefetching, refetch } = useQuery<ScreenerResult & { stale?: boolean; message?: string }>({
    queryKey: [...QUERY_KEYS.SCREENER, index],
    queryFn: () => fetch(`/api/screener?index=${index}`).then(r => r.json()),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Filter stocks (guard against error responses)
  const stocks = Array.isArray(data?.stocks) ? data.stocks : [];
  let filteredStocks: ScreenerStockResult[] = stocks;

  if (verdictFilter !== "ALL") {
    filteredStocks = filteredStocks.filter(s => s.verdict?.action === verdictFilter);
  }
  if (sectorFilter !== "ALL") {
    filteredStocks = filteredStocks.filter(s => s.sectorCode === sectorFilter);
  }
  filteredStocks = filteredStocks.filter(s => {
    const score = s.composite?.composite ?? 0;
    return score >= scoreRange[0] && score <= scoreRange[1];
  });

  const regime = data?.regime ? REGIME_LABELS[data.regime] : null;
  const generatedAt = data?.generatedAt ? new Date(data.generatedAt) : null;
  const currentIndex = INDEX_TABS.find(t => t.value === index);
  const isStale = data?.stale === true;

  if (isLoading) return <ScreenerSkeleton />;

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Piyasa Taraması</h1>
          <p className="text-sm text-muted-foreground/70 mt-1">
            {currentIndex?.label ?? "BİST"} hisselerinin yapay zeka destekli analizi
          </p>
        </div>
        <div className="flex items-center gap-3">
          {regime && (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${regime.color}`}>
              <Radio className="h-3 w-3" />
              {regime.label}
            </span>
          )}
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground bg-card border border-border/50 hover:border-border transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin" : ""}`} />
            {isRefetching ? "Yükleniyor..." : "Yenile"}
          </button>
        </div>
      </div>

      {/* Stale Warning */}
      {isStale && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-400/10 border border-amber-400/20">
          <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
          <p className="text-xs text-amber-400">
            Veriler dün güncellendi. Güncel analiz için cron job'ın çalışmasını bekleyin.
          </p>
        </div>
      )}

      {/* No Data Warning */}
      {data?.message && stocks.length === 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-card border border-border/30">
          <AlertTriangle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <p className="text-xs text-muted-foreground">{data.message}</p>
        </div>
      )}

      {/* Index Tabs + Last Update */}
      <div className="space-y-3">
        {/* Tek satır scrollable tab bar */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
          <div className="flex items-center gap-1 rounded-lg bg-card/50 border border-border/30 p-1 shrink-0">
            {INDEX_TABS.filter(t => t.group === "index").map(tab => (
              <button
                key={tab.value}
                onClick={() => setIndex(tab.value)}
                className={cn(
                  "px-2.5 sm:px-3 py-1.5 rounded-md text-[11px] sm:text-xs font-medium transition-all whitespace-nowrap",
                  index === tab.value
                    ? "bg-ai-primary/15 text-ai-primary shadow-sm"
                    : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-card"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-border/20 shrink-0 hidden sm:block" />

          <div className="flex items-center gap-1 rounded-lg bg-card/50 border border-border/30 p-1 shrink-0">
            {INDEX_TABS.filter(t => t.group === "thematic").map(tab => (
              <button
                key={tab.value}
                onClick={() => setIndex(tab.value)}
                className={cn(
                  "px-2.5 sm:px-3 py-1.5 rounded-md text-[11px] sm:text-xs font-medium transition-all whitespace-nowrap",
                  index === tab.value
                    ? "bg-ai-premium/15 text-ai-premium shadow-sm"
                    : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-card"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {generatedAt && (
          <p className="text-[11px] text-muted-foreground/40">
            Son güncelleme: {generatedAt.toLocaleDateString("tr-TR")} {generatedAt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
            {isRefetching && " · Yükleniyor..."}
          </p>
        )}
      </div>

      {/* Best Opportunities */}
      {data && stocks.length > 0 && <BestOpportunities stocks={stocks} />}

      {/* Market Summary */}
      {data && stocks.length > 0 && <MarketSummaryCards summary={data.marketSummary} regime={data.regime} macroData={data.macroData} index={index} />}

      {/* Sector Heatmap */}
      {data && stocks.length > 0 && <SectorHeatmap sectorSummary={data.sectorSummary} />}

      {/* Filters */}
      {data && stocks.length > 0 && (
        <ScreenerFilters
          verdictFilter={verdictFilter}
          sectorFilter={sectorFilter}
          scoreRange={scoreRange}
          onVerdictChange={setVerdictFilter}
          onSectorChange={setSectorFilter}
          onScoreRangeChange={setScoreRange}
          totalCount={stocks.length}
          filteredCount={filteredStocks.length}
        />
      )}

      {/* Main Table */}
      <ScreenerTable stocks={filteredStocks} />
    </div>
  );
}
