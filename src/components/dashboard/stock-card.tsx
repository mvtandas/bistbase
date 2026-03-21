import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChangeBadge } from "./change-badge";
import { SentimentIndicator } from "./sentiment-indicator";
import { SpkDisclaimer } from "@/components/shared/spk-disclaimer";
import { Loader2 } from "lucide-react";

interface StockCardProps {
  stockCode: string;
  closePrice: number | null;
  changePercent: number | null;
  aiSummaryText: string | null;
  sentimentScore: string | null;
  status: string;
}

export function StockCard({
  stockCode,
  closePrice,
  changePercent,
  aiSummaryText,
  sentimentScore,
  status,
}: StockCardProps) {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-foreground">{stockCode}</span>
          <div className="flex items-center gap-3">
            {closePrice != null && (
              <span className="text-lg font-semibold text-foreground">
                ₺{closePrice.toFixed(2)}
              </span>
            )}
            <ChangeBadge change={changePercent} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {status === "COMPLETED" && aiSummaryText ? (
          <>
            {aiSummaryText.split("\n\n").map((paragraph, i) => (
              <p
                key={i}
                className="text-sm text-muted-foreground leading-relaxed"
              >
                {paragraph}
              </p>
            ))}
            <SentimentIndicator sentiment={sentimentScore} />
          </>
        ) : status === "PENDING" ? (
          <div className="flex items-center gap-2 py-4 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Analiz hazırlanıyor...</span>
          </div>
        ) : status === "FAILED" ? (
          <p className="text-sm text-muted-foreground py-4">
            Analiz şu an kullanılamıyor. Veriler güncelleniyor.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground py-4">
            Bugün için henüz analiz oluşturulmadı.
          </p>
        )}

        <SpkDisclaimer />
      </CardContent>
    </Card>
  );
}
