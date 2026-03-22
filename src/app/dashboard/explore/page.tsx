"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useStockSearch } from "@/hooks/use-stock-search";
import { useAddStock, useRemoveStock } from "@/hooks/use-portfolio-mutations";
import { QUERY_KEYS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  Search,
  Plus,
  Check,
  TrendingUp,
  Compass,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { PortfolioEditModal } from "@/components/dashboard/portfolio-edit-modal";

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
  const [editStock, setEditStock] = useState<string | null>(null);
  const { results, loading } = useStockSearch(query);
  const addStock = useAddStock();
  const removeStock = useRemoveStock();

  // Fetch current portfolio to know which stocks are already added
  const { data: portfolioData } = useQuery<{ holdings?: { stockCode: string }[] }>({
    queryKey: QUERY_KEYS.PORTFOLIO_INTELLIGENCE,
    queryFn: () => fetch("/api/portfolio-intelligence").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const portfolioCodes = useMemo(() => {
    const codes = new Set<string>();
    if (portfolioData?.holdings) {
      for (const h of portfolioData.holdings) {
        codes.add(h.stockCode);
      }
    }
    return codes;
  }, [portfolioData]);

  const showSearchResults = query.length >= 2;

  // Track per-stock loading state
  const [mutatingCodes, setMutatingCodes] = useState<Set<string>>(new Set());

  async function togglePortfolio(code: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (mutatingCodes.has(code)) return;

    setMutatingCodes((prev) => new Set(prev).add(code));

    const inPortfolio = portfolioCodes.has(code);

    try {
      if (inPortfolio) {
        await removeStock.mutateAsync(code);
      } else {
        await addStock.mutateAsync(code);
        setEditStock(code);
      }
    } finally {
      setMutatingCodes((prev) => {
        const next = new Set(prev);
        next.delete(code);
        return next;
      });
    }
  }

  function StockItem({ code, name }: { code: string; name: string }) {
    const inPortfolio = portfolioCodes.has(code);
    const isMutating = mutatingCodes.has(code);

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
          onClick={(e) => togglePortfolio(code, e)}
          disabled={isMutating}
          className={cn(
            "flex items-center justify-center h-8 w-8 rounded-md transition-colors flex-shrink-0 disabled:opacity-50",
            inPortfolio
              ? "bg-gain/10 text-gain hover:bg-loss/10 hover:text-loss"
              : "bg-secondary hover:bg-ai-primary/10 hover:text-ai-primary text-muted-foreground"
          )}
          title={inPortfolio ? "Portföyden çıkar" : "Portföye ekle"}
        >
          {isMutating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : inPortfolio ? (
            <Check className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
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

      {editStock && (
        <PortfolioEditModal
          stockCode={editStock}
          mode="add"
          onClose={() => setEditStock(null)}
        />
      )}
    </div>
  );
}
