import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, Minus, Activity } from "lucide-react";

interface PortfolioSummaryProps {
  stocks: {
    code: string;
    closePrice: number | null;
    changePercent: number | null;
  }[];
}

export function PortfolioSummary({ stocks }: PortfolioSummaryProps) {
  const validStocks = stocks.filter((s) => s.closePrice != null);
  const avgChange =
    validStocks.length > 0
      ? validStocks.reduce((sum, s) => sum + (s.changePercent ?? 0), 0) /
        validStocks.length
      : 0;

  const bestStock = validStocks.reduce(
    (best, s) =>
      (s.changePercent ?? -Infinity) > (best?.changePercent ?? -Infinity)
        ? s
        : best,
    validStocks[0] ?? null
  );

  const worstStock = validStocks.reduce(
    (worst, s) =>
      (s.changePercent ?? Infinity) < (worst?.changePercent ?? Infinity)
        ? s
        : worst,
    validStocks[0] ?? null
  );

  const isPositive = avgChange > 0;
  const isNeutral = avgChange === 0;

  return (
    <div className="rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm p-5 mb-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-4 w-4 text-ai-primary" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Portföy Özeti
        </span>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Ortalama */}
        <div>
          <p className="text-[11px] text-muted-foreground/60 mb-1">
            Ortalama Değişim
          </p>
          <div className="flex items-center gap-1">
            {isNeutral ? (
              <Minus className="h-4 w-4 text-muted-foreground" />
            ) : isPositive ? (
              <ArrowUpRight className="h-4 w-4 text-gain" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-loss" />
            )}
            <span
              className={cn(
                "text-xl font-bold tabular-nums",
                isNeutral
                  ? "text-muted-foreground"
                  : isPositive
                    ? "text-gain"
                    : "text-loss"
              )}
            >
              {isPositive ? "+" : ""}
              {avgChange.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* En İyi */}
        <div>
          <p className="text-[11px] text-muted-foreground/60 mb-1">
            En Yükselen
          </p>
          {bestStock ? (
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-bold text-foreground">
                {bestStock.code}
              </span>
              <span className="text-xs font-medium text-gain">
                +{(bestStock.changePercent ?? 0).toFixed(2)}%
              </span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>

        {/* En Kötü */}
        <div>
          <p className="text-[11px] text-muted-foreground/60 mb-1">
            En Düşen
          </p>
          {worstStock ? (
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-bold text-foreground">
                {worstStock.code}
              </span>
              <span className="text-xs font-medium text-loss">
                {(worstStock.changePercent ?? 0).toFixed(2)}%
              </span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>
      </div>
    </div>
  );
}
