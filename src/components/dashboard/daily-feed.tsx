"use client";

import { useQuery } from "@tanstack/react-query";
import { StockCard } from "./stock-card";
import { StockCardSkeleton } from "./stock-card-skeleton";
import type { DailySummaryData } from "@/types";

interface DailyFeedProps {
  stockCodes: string[];
  initialSummaries: Record<string, DailySummaryData>;
}

async function fetchSummary(code: string): Promise<DailySummaryData | null> {
  try {
    const res = await fetch(`/api/summary/${code}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function DailyFeed({ stockCodes, initialSummaries }: DailyFeedProps) {
  const { data: summaries } = useQuery({
    queryKey: ["daily-summaries", stockCodes],
    queryFn: async () => {
      const results: Record<string, DailySummaryData> = {};
      await Promise.all(
        stockCodes.map(async (code) => {
          const summary = await fetchSummary(code);
          if (summary) {
            results[code] = summary;
          }
        })
      );
      return results;
    },
    initialData: initialSummaries,
    refetchInterval: 60 * 1000, // Refetch every minute
  });

  if (stockCodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg text-muted-foreground">
          Henüz portföyünüzde hisse bulunmuyor.
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Keşfet sayfasından hisse ekleyerek başlayın.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stockCodes.map((code) => {
        const summary = summaries?.[code];

        if (!summary) {
          return <StockCardSkeleton key={code} />;
        }

        return (
          <StockCard
            key={code}
            stockCode={summary.stockCode}
            closePrice={summary.closePrice}
            changePercent={summary.changePercent}
            aiSummaryText={summary.aiSummaryText}
            sentimentScore={summary.sentimentScore}
            status={summary.status}
          />
        );
      })}
    </div>
  );
}
