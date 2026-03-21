import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Sparkles, Check } from "lucide-react";

const features = [
  "Sınırsız hisse takibi",
  "Öncelikli AI analiz",
  "Detaylı teknik göstergeler",
  "Geçmiş analiz arşivi",
  "Özel haber filtreleme",
  "E-posta ile günlük özet",
];

export default function UpgradePage() {
  return (
    <div>
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-ai-premium/10">
          <Crown className="h-8 w-8 text-ai-premium" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          Premium&apos;a Yükselt
        </h1>
        <p className="text-muted-foreground mt-2">
          Borsadaki sinyalleri kaçırmayın. Tüm özelliklerin kilidini açın.
        </p>
      </div>

      <Card className="max-w-md mx-auto border-ai-premium/20 bg-card/50">
        <CardHeader className="text-center pb-4">
          <CardTitle className="flex items-center justify-center gap-2">
            <Sparkles className="h-5 w-5 text-ai-premium" />
            Premium Plan
          </CardTitle>
          <div className="mt-4">
            <span className="text-4xl font-bold text-foreground">₺99</span>
            <span className="text-muted-foreground">/ay</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-3">
            {features.map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-sm">
                <Check className="h-4 w-4 text-ai-premium shrink-0" />
                <span className="text-muted-foreground">{feature}</span>
              </li>
            ))}
          </ul>

          <Button className="w-full h-12 bg-ai-premium hover:bg-ai-premium/90 text-white mt-6">
            Yakında
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Ödeme sistemi yakında aktif olacaktır.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
