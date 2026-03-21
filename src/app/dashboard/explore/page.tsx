"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PremiumUpsellModal } from "@/components/onboarding/premium-upsell-modal";
import { useStockSearch } from "@/hooks/use-stock-search";
import { Search, Plus, Check } from "lucide-react";
import { toast } from "sonner";

export default function ExplorePage() {
  const [query, setQuery] = useState("");
  const [addedCodes, setAddedCodes] = useState<Set<string>>(new Set());
  const [showUpsell, setShowUpsell] = useState(false);
  const { results, loading } = useStockSearch(query);
  const router = useRouter();

  async function addStock(code: string) {
    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockCode: code }),
      });

      if (res.status === 403) {
        const data = await res.json();
        if (data.error === "PREMIUM_REQUIRED") {
          setShowUpsell(true);
          return;
        }
      }

      if (res.ok) {
        setAddedCodes((prev) => new Set(prev).add(code));
        toast.success(`${code} portföyünüze eklendi`);
        router.refresh();
      }
    } catch {
      toast.error("Bir hata oluştu");
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Keşfet</h1>
        <p className="text-sm text-muted-foreground mt-1">
          BİST hisselerini arayın ve portföyünüze ekleyin.
        </p>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Hisse kodu veya şirket adı ara..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-12 pl-10 bg-secondary border-border/50"
        />
      </div>

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-3/4" />
        </div>
      )}

      {!loading && results.length > 0 && (
        <Card className="border-border/50 bg-card/50 divide-y divide-border/50 overflow-hidden">
          {results.map((stock) => {
            const isAdded = addedCodes.has(stock.code);
            return (
              <button
                key={stock.code}
                type="button"
                onClick={() => !isAdded && addStock(stock.code)}
                disabled={isAdded}
                className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-accent transition-colors disabled:opacity-60"
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-foreground">
                    {stock.code}
                  </span>
                  <span className="text-muted-foreground">{stock.name}</span>
                </div>
                {isAdded ? (
                  <Check className="h-4 w-4 text-gain" />
                ) : (
                  <Plus className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            );
          })}
        </Card>
      )}

      {!loading && query.length >= 2 && results.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Sonuç bulunamadı.
        </p>
      )}

      <PremiumUpsellModal
        open={showUpsell}
        onClose={() => setShowUpsell(false)}
      />
    </div>
  );
}
