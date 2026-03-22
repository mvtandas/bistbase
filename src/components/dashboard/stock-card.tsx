import Link from "next/link";
import { cn } from "@/lib/utils";
import { SpkDisclaimer } from "@/components/shared/spk-disclaimer";
import { Loader2, Sparkles, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface StockCardProps {
  stockCode: string;
  closePrice: number | null;
  changePercent: number | null;
  aiSummaryText: string | null;
  sentimentScore: string | null;
  status: string;
  compositeScore?: number | null;
  bullCase?: string | null;
  bearCase?: string | null;
  confidence?: string | null;
}

export function StockCard({
  stockCode,
  closePrice,
  changePercent,
  aiSummaryText,
  sentimentScore,
  status,
  compositeScore,
  bullCase,
  bearCase,
  confidence,
}: StockCardProps) {
  const isPositive = (changePercent ?? 0) >= 0;
  const sentimentLabel =
    sentimentScore === "POSITIVE"
      ? "Pozitif"
      : sentimentScore === "NEGATIVE"
        ? "Negatif"
        : "Nötr";
  const sentimentColor =
    sentimentScore === "POSITIVE"
      ? "text-gain"
      : sentimentScore === "NEGATIVE"
        ? "text-loss"
        : "text-muted-foreground";

  return (
    <div className="group rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm p-5 transition-all hover:border-border/70 hover:bg-card/50">
      {/* Top Row: Code + Price */}
      <div className="flex items-start justify-between mb-4">
        <Link
          href={`/dashboard/stock/${stockCode}`}
          className="group/link flex items-center gap-2"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ai-primary/10 text-ai-primary text-xs font-bold">
            {stockCode.slice(0, 2)}
          </div>
          <div>
            <span className="text-base font-bold text-foreground group-hover/link:text-ai-primary transition-colors">
              {stockCode}
            </span>
            {compositeScore != null && (
              <span className={cn(
                "ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded tabular-nums",
                compositeScore >= 60 ? "bg-gain/10 text-gain" : compositeScore >= 40 ? "bg-amber-400/10 text-amber-400" : "bg-loss/10 text-loss"
              )}>
                {compositeScore}
              </span>
            )}
          </div>
        </Link>

        <div className="text-right">
          {closePrice != null ? (
            <>
              <p className="text-lg font-semibold text-foreground tabular-nums">
                ₺{closePrice.toFixed(2)}
              </p>
              {changePercent != null && (
                <div
                  className={cn(
                    "flex items-center justify-end gap-0.5 text-xs font-medium",
                    isPositive ? "text-gain" : "text-loss"
                  )}
                >
                  {isPositive ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {isPositive ? "+" : ""}
                  {changePercent.toFixed(2)}%
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border/30 mb-4" />

      {/* AI Summary */}
      {status === "COMPLETED" && aiSummaryText ? (
        <div className="space-y-3">
          {aiSummaryText
            .split("\n\n")
            .filter((p) => p.trim())
            .map((paragraph, i) => (
              <p
                key={i}
                className="text-[13px] leading-relaxed text-muted-foreground"
              >
                {paragraph.trim()}
              </p>
            ))}

          {/* Bull / Bear mini */}
          {(bullCase || bearCase) && (
            <div className="grid grid-cols-2 gap-2 pt-2">
              {bullCase && (
                <div className="rounded-lg bg-gain/5 border border-gain/10 p-2">
                  <p className="text-[9px] font-medium text-gain uppercase mb-1">Boğa</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed ">{bullCase}</p>
                </div>
              )}
              {bearCase && (
                <div className="rounded-lg bg-loss/5 border border-loss/10 p-2">
                  <p className="text-[9px] font-medium text-loss uppercase mb-1">Ayı</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed ">{bearCase}</p>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-ai-primary" />
              <span className="text-[11px] text-muted-foreground/60">
                AI Analiz{confidence ? ` · ${confidence}` : ""}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  sentimentScore === "POSITIVE"
                    ? "bg-gain"
                    : sentimentScore === "NEGATIVE"
                      ? "bg-loss"
                      : "bg-muted-foreground"
                )}
              />
              <span className={cn("text-[11px] font-medium", sentimentColor)}>
                {sentimentLabel}
              </span>
            </div>
          </div>
        </div>
      ) : status === "PENDING" ? (
        <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Analiz hazırlanıyor...</span>
        </div>
      ) : status === "FAILED" ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Veriler güncelleniyor, lütfen daha sonra tekrar deneyin.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Bugün için henüz analiz oluşturulmadı.
        </p>
      )}

      <SpkDisclaimer />
    </div>
  );
}
