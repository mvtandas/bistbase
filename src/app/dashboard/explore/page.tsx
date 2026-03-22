"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useStockSearch } from "@/hooks/use-stock-search";
import { cn } from "@/lib/utils";
import {
  Search,
  Plus,
  Check,
  TrendingUp,
  Compass,
  ArrowRight,
} from "lucide-react";
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
  const { results, loading } = useStockSearch(query);
  const router = useRouter();

  const showSearchResults = query.length >= 2;

  async function addToPortfolio(code: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (addedCodes.has(code)) return;
    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockCode: code }),
      });
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
      <div className="flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors">
        <Link
          href={`/dashboard/stock/${code}`}
          className="flex items-center gap-3 min-w-0 flex-1 group"
        >
          <span className="font-semibold text-sm text-foreground">{code}</span>
          <span className="text-muted-foreground text-sm truncate">{name}</span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors ml-auto mr-2 flex-shrink-0" />
        </Link>
        <button
          type="button"
          onClick={(e) => addToPortfolio(code, e)}
          disabled={isAdded}
          className={cn(
            "flex items-center justify-center h-8 w-8 rounded-md transition-colors flex-shrink-0",
            isAdded
              ? "bg-gain/10 text-gain cursor-default"
              : "bg-secondary hover:bg-ai-primary/10 hover:text-ai-primary text-muted-foreground"
          )}
          title={isAdded ? "Portföyde" : "Portföye ekle"}
        >
          {isAdded ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Compass className="h-5 w-5 text-ai-primary" />
          <h1 className="text-2xl font-bold text-foreground">Keşfet</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          BİST hisselerini arayın, detaylarını inceleyin ve portföyünüze ekleyin.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Hisse kodu veya şirket adı ara... (örn: THYAO)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-12 pl-10 bg-secondary border-border/50"
        />
      </div>

      {/* Search Results */}
      {showSearchResults && loading && (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-3/4" />
        </div>
      )}

      {showSearchResults && !loading && results.length > 0 && (
        <Card className="border-border/50 bg-card/50 divide-y divide-border/30 overflow-hidden">
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

      {/* Popular Stocks */}
      {!showSearchResults && (
        <div>
          <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span>Popüler Hisseler</span>
          </div>
          <Card className="border-border/50 bg-card/50 divide-y divide-border/30 overflow-hidden">
            {POPULAR_STOCKS.map((stock) => (
              <StockItem key={stock.code} code={stock.code} name={stock.name} />
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}
