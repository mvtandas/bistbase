"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PremiumUpsellModal } from "@/components/onboarding/premium-upsell-modal";
import { useStockSearch } from "@/hooks/use-stock-search";
import { Search, Plus, Check, TrendingUp } from "lucide-react";
import { toast } from "sonner";

const POPULAR_STOCKS = [
  { code: "THYAO", name: "Türk Hava Yolları" },
  { code: "SISE", name: "Şişecam" },
  { code: "ASELS", name: "Aselsan" },
  { code: "KCHOL", name: "Koç Holding" },
  { code: "BIMAS", name: "BİM Mağazalar" },
  { code: "TUPRS", name: "Tüpraş" },
  { code: "SAHOL", name: "Sabancı Holding" },
  { code: "EREGL", name: "Ereğli Demir Çelik" },
  { code: "GARAN", name: "Garanti BBVA" },
  { code: "AKBNK", name: "Akbank" },
  { code: "YKBNK", name: "Yapı Kredi" },
  { code: "FROTO", name: "Ford Otosan" },
  { code: "TOASO", name: "Tofaş Oto" },
  { code: "PGSUS", name: "Pegasus" },
  { code: "EKGYO", name: "Emlak Konut GYO" },
];

export default function ExplorePage() {
  const [query, setQuery] = useState("");
  const [addedCodes, setAddedCodes] = useState<Set<string>>(new Set());
  const [showUpsell, setShowUpsell] = useState(false);
  const { results, loading } = useStockSearch(query);
  const router = useRouter();

  const showSearchResults = query.length >= 2;

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

  function StockItem({ code, name }: { code: string; name: string }) {
    const isAdded = addedCodes.has(code);
    return (
      <button
        type="button"
        onClick={() => !isAdded && addStock(code)}
        disabled={isAdded}
        className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-accent transition-colors disabled:opacity-60"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-foreground">{code}</span>
          <span className="text-muted-foreground">{name}</span>
        </div>
        {isAdded ? (
          <Check className="h-4 w-4 text-gain" />
        ) : (
          <Plus className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
    );
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

      {/* Search results */}
      {showSearchResults && loading && (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-3/4" />
        </div>
      )}

      {showSearchResults && !loading && results.length > 0 && (
        <Card className="border-border/50 bg-card/50 divide-y divide-border/50 overflow-hidden">
          {results.map((stock) => (
            <StockItem key={stock.code} code={stock.code} name={stock.name} />
          ))}
        </Card>
      )}

      {showSearchResults && !loading && results.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Sonuç bulunamadı.
        </p>
      )}

      {/* Popular stocks */}
      {!showSearchResults && (
        <div>
          <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span>Popüler Hisseler</span>
          </div>
          <Card className="border-border/50 bg-card/50 divide-y divide-border/50 overflow-hidden">
            {POPULAR_STOCKS.map((stock) => (
              <StockItem key={stock.code} code={stock.code} name={stock.name} />
            ))}
          </Card>
        </div>
      )}

      <PremiumUpsellModal
        open={showUpsell}
        onClose={() => setShowUpsell(false)}
      />
    </div>
  );
}
