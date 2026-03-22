"use client";

import { useState } from "react";
import { StockCard } from "./stock-card";
import { cn } from "@/lib/utils";

type Period = "today" | "week" | "month";

interface DailyFeedProps {
  stockCodes: string[];
  initialSummaries: Record<string, unknown>;
}

const PERIOD_LABELS: Record<Period, string> = {
  today: "Bugün",
  week: "Bu Hafta",
  month: "Bu Ay",
};

export function DailyFeed({ stockCodes }: DailyFeedProps) {
  const [period, setPeriod] = useState<Period>("today");

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

      {/* Stock Cards - each fetches its own data from stock-detail API */}
      <div className="space-y-4">
        {stockCodes.map((code) => (
          <StockCard key={`${code}-${period}`} stockCode={code} period={period} />
        ))}
      </div>
    </div>
  );
}
