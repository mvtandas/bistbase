import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export default function UpgradePage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md mx-auto border-ai-primary/20 bg-card/50">
        <CardContent className="text-center py-12 px-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-ai-primary/10">
            <Sparkles className="h-8 w-8 text-ai-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">
            Beta Erişim
          </h1>
          <p className="text-muted-foreground">
            Tüm özellikler beta süresince ücretsiz olarak açıktır.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
