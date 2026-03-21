import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SpkDisclaimer } from "@/components/shared/spk-disclaimer";
import { Sparkles } from "lucide-react";

export function SampleAiCard() {
  return (
    <div className="w-full max-w-2xl mx-auto mt-16 px-4">
      <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 text-ai-primary" />
        <span>Örnek AI Analizi</span>
      </div>

      <Card className="border-ai-primary/20 bg-card/50 backdrop-blur">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-foreground">THYAO</span>
              <span className="text-sm text-muted-foreground">
                Türk Hava Yolları
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-foreground">
                ₺312.50
              </span>
              <Badge className="bg-gain/10 text-gain border-gain/20 hover:bg-gain/10">
                +2.34%
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            THYAO, güçlü yolcu trafiği verileri ve artan kargo gelirlerinin
            etkisiyle günü pozitif kapattı. Hisse, sektör ortalamasının üzerinde
            bir performans sergileyerek yatırımcı ilgisini yüksek tutmaya devam
            ediyor.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            KAP&apos;ta paylaşılan üç aylık trafik istatistikleri, yolcu
            sayısında yıllık bazda %18 artışa işaret ediyor. Avrupa
            destinasyonlarındaki kapasite artışı da gelir beklentilerini olumlu
            etkiliyor.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Genel piyasa duyarlılığı pozitif yönde seyrediyor. BİST 100
            endeksindeki yükseliş eğilimi havacılık sektörüne de yansımakta,
            hacim ortalamanın üzerinde gerçekleşti.
          </p>

          <div className="flex items-center gap-2 pt-2">
            <div className="h-1.5 w-1.5 rounded-full bg-gain" />
            <span className="text-xs text-gain font-medium">
              Pozitif Duyarlılık
            </span>
          </div>

          <SpkDisclaimer />
        </CardContent>
      </Card>
    </div>
  );
}
