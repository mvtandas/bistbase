import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollReveal } from "./scroll-reveal";

export function LiveDemo() {
  return (
    <section className="py-24 max-w-7xl mx-auto px-6">
      <ScrollReveal className="text-center mb-12">
        <p className="text-ai-primary text-sm font-medium tracking-wide uppercase mb-3">
          Canlı Demo
        </p>
        <h2 className="text-3xl lg:text-4xl font-bold text-foreground">
          Gerçek AI analizi örneği
        </h2>
      </ScrollReveal>

      <ScrollReveal className="max-w-3xl mx-auto">
        <div className="relative">
          {/* Glow */}
          <div className="absolute inset-0 rounded-2xl bg-ai-primary/5 blur-3xl -z-10" />

          <Card className="border-ai-primary/20 bg-card/50 backdrop-blur shadow-[0_0_60px_-20px_oklch(0.673_0.182_276.935/0.15)]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-foreground">THYAO</span>
                  <span className="text-sm text-muted-foreground">Türk Hava Yolları</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-semibold text-foreground font-mono">₺312.50</span>
                  <Badge className="bg-gain/10 text-gain border-gain/20 hover:bg-gain/10">
                    +2.34%
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Sparkline */}
              <svg viewBox="0 0 400 80" className="w-full h-20">
                <defs>
                  <linearGradient id="demoGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.765 0.177 163.223)" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="oklch(0.765 0.177 163.223)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polygon
                  points="0,65 30,60 60,58 90,55 120,50 150,52 180,45 210,40 240,42 270,35 300,30 330,25 360,20 390,15 400,12 400,80 0,80"
                  fill="url(#demoGrad)"
                />
                <polyline
                  points="0,65 30,60 60,58 90,55 120,50 150,52 180,45 210,40 240,42 270,35 300,30 330,25 360,20 390,15 400,12"
                  fill="none"
                  stroke="oklch(0.765 0.177 163.223)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              {/* Analysis text */}
              <div className="border-l-2 border-ai-primary/20 pl-4 space-y-2">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  THYAO, güçlü yolcu trafiği verileri ve artan kargo gelirlerinin etkisiyle
                  günü pozitif kapattı. Hisse, sektör ortalamasının üzerinde bir performans
                  sergileyerek yatırımcı ilgisini yüksek tutmaya devam ediyor.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  KAP&apos;ta paylaşılan üç aylık trafik istatistikleri, yolcu sayısında
                  yıllık bazda %18 artışa işaret ediyor. Avrupa destinasyonlarındaki kapasite
                  artışı da gelir beklentilerini olumlu etkiliyor.
                </p>
              </div>

              {/* Metrics row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-secondary/50 rounded-lg px-3 py-2 text-center">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Duyarlılık</div>
                  <div className="text-sm font-semibold text-gain mt-0.5">Pozitif</div>
                </div>
                <div className="bg-secondary/50 rounded-lg px-3 py-2 text-center">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Güven</div>
                  <div className="text-sm font-semibold text-foreground font-mono mt-0.5">%78</div>
                </div>
                <div className="bg-secondary/50 rounded-lg px-3 py-2 text-center">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Skor</div>
                  <div className="text-sm font-semibold text-ai-primary font-mono mt-0.5">73/100</div>
                </div>
              </div>

              {/* Signal */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-ai-primary" />
                  <span className="text-xs text-muted-foreground">AI Analiz — 22 Mar 2026</span>
                </div>
                <Badge className="bg-gain/10 text-gain border-gain/20 hover:bg-gain/10 text-xs font-semibold">
                  AL
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollReveal>
    </section>
  );
}
