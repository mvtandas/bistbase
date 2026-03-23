"use client";

import { cn } from "@/lib/utils";
import { BarChart3, TrendingUp, TrendingDown, Activity } from "lucide-react";
import type { MarketSummary } from "@/lib/stock/batch-analysis";
import type { MacroData } from "@/lib/stock/macro";
import type { VolatilityRegime } from "@/lib/stock/scoring";

const INDEX_LABELS: Record<string, string> = {
  bist30: "BİST30", bist50: "BİST50", bist100: "BİST100",
  bistall: "Tüm BİST", xtm25: "Temettü 25", xkury: "Kurumsal", xusrd: "Sürdürülebilir",
};

interface MarketSummaryCardsProps {
  summary: MarketSummary;
  regime: VolatilityRegime;
  macroData: MacroData | null;
  index?: string;
}

export function MarketSummaryCards({ summary, regime, macroData, index = "bist30" }: MarketSummaryCardsProps) {
  const totalVerdicts = summary.strongBuyCount + summary.buyCount + summary.holdCount + summary.sellCount + summary.strongSellCount;
  const buyPercent = totalVerdicts > 0 ? ((summary.strongBuyCount + summary.buyCount) / totalVerdicts) * 100 : 0;
  const sellPercent = totalVerdicts > 0 ? ((summary.sellCount + summary.strongSellCount) / totalVerdicts) * 100 : 0;
  const holdPercent = 100 - buyPercent - sellPercent;

  const totalSignals = summary.bullishSignalCount + summary.bearishSignalCount;
  const bullPercent = totalSignals > 0 ? (summary.bullishSignalCount / totalSignals) * 100 : 50;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Piyasa Skoru */}
      <div className="bento-card">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-3.5 w-3.5 text-ai-primary" />
            <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground/60">Piyasa Skoru</span>
          </div>
          <p className={cn(
            "text-2xl font-bold",
            summary.avgComposite >= 55 ? "text-gain" : summary.avgComposite >= 45 ? "text-amber-400" : "text-loss"
          )}>
            {Math.round(summary.avgComposite)}
          </p>
          <p className="text-[10px] text-muted-foreground/50 mt-1">{INDEX_LABELS[index] ?? index} ortalama</p>
        </div>
      </div>

      {/* Karar Dağılımı */}
      <div className="bento-card">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-3.5 w-3.5 text-ai-primary" />
            <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground/60">Karar Dağılımı</span>
          </div>
          <div className="flex items-center gap-0.5 h-2 rounded-full overflow-hidden mb-2">
            <div className="h-full bg-gain rounded-l-full" style={{ width: `${buyPercent}%` }} />
            <div className="h-full bg-amber-400" style={{ width: `${holdPercent}%` }} />
            <div className="h-full bg-loss rounded-r-full" style={{ width: `${sellPercent}%` }} />
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-gain">{summary.strongBuyCount + summary.buyCount} Al</span>
            <span className="text-amber-400">{summary.holdCount} Tut</span>
            <span className="text-loss">{summary.sellCount + summary.strongSellCount} Sat</span>
          </div>
        </div>
      </div>

      {/* Sinyal Dengesi */}
      <div className="bento-card">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-3.5 w-3.5 text-ai-primary" />
            <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground/60">Sinyal Dengesi</span>
          </div>
          <div className="flex items-center gap-0.5 h-2 rounded-full overflow-hidden mb-2">
            <div className="h-full bg-gain rounded-l-full" style={{ width: `${bullPercent}%` }} />
            <div className="h-full bg-loss rounded-r-full" style={{ width: `${100 - bullPercent}%` }} />
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-gain">{summary.bullishSignalCount} Yükseliş</span>
            <span className="text-loss">{summary.bearishSignalCount} Düşüş</span>
          </div>
        </div>
      </div>

      {/* Makro */}
      <div className="bento-card">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-3.5 w-3.5 text-ai-primary" />
            <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground/60">Makro Durum</span>
          </div>
          {macroData ? (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground/60">USD/TRY</span>
                <span className="text-foreground font-medium">{macroData.usdTry?.toFixed(2) ?? "—"}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground/60">BİST100</span>
                <span className={cn("font-medium", (macroData.bist100Change ?? 0) >= 0 ? "text-gain" : "text-loss")}>
                  {macroData.bist100Change != null ? `${macroData.bist100Change >= 0 ? "+" : ""}${macroData.bist100Change.toFixed(2)}%` : "—"}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground/60">VIX</span>
                <span className="text-foreground font-medium">{macroData.vix?.toFixed(1) ?? "—"}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/40">Veri yok</p>
          )}
        </div>
      </div>
    </div>
  );
}
