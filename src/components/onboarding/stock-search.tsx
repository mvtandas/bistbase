"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StockChip } from "./stock-chip";
import { useStockSearch } from "@/hooks/use-stock-search";
import { Search, ArrowRight, TrendingUp } from "lucide-react";
import { PortfolioEditModal } from "@/components/dashboard/portfolio-edit-modal";
import { toast } from "sonner";
import type { StockSearchResult } from "@/types";

const POPULAR_STOCKS: StockSearchResult[] = [
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

interface SelectedStock {
  code: string;
  name: string;
}

export function StockSearch() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SelectedStock[]>([]);
  const [editStock, setEditStock] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { results, loading } = useStockSearch(query);
  const router = useRouter();

  const showSearchResults = query.length >= 2 && (loading || results.length > 0);
  const showPopular = query.length < 2;

  async function addStock(stock: StockSearchResult) {
    if (selected.some((s) => s.code === stock.code)) return;

    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockCode: stock.code }),
      });

      if (res.ok) {
        setSelected((prev) => [...prev, { code: stock.code, name: stock.name }]);
        setQuery("");
        setEditStock(stock.code);
      } else {
        const data = await res.json().catch(() => ({}));
        if (data.error === "PREMIUM_REQUIRED") {
          toast.error(data.message || "Ücretsiz planda maksimum 2 hisse ekleyebilirsiniz.");
        } else {
          toast.error("Hisse eklenirken bir hata oluştu.");
        }
      }
    } catch {
      toast.error("Bağlantı hatası. Lütfen tekrar deneyin.");
    }
  }

  async function removeStock(code: string) {
    try {
      const res = await fetch("/api/portfolio", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockCode: code }),
      });

      if (res.ok) {
        setSelected((prev) => prev.filter((s) => s.code !== code));
      } else {
        toast.error("Hisse çıkarılırken bir hata oluştu.");
      }
    } catch {
      toast.error("Bağlantı hatası. Lütfen tekrar deneyin.");
    }
  }

  async function handleContinue() {
    setSaving(true);
    router.push("/dashboard");
  }

  function StockListItem({ stock }: { stock: StockSearchResult }) {
    const isSelected = selected.some((s) => s.code === stock.code);
    return (
      <button
        type="button"
        onClick={() => addStock(stock)}
        disabled={isSelected}
        className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-accent transition-colors disabled:opacity-50"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-foreground">{stock.code}</span>
          <span className="text-muted-foreground">{stock.name}</span>
        </div>
        {isSelected && (
          <span className="text-xs text-ai-primary">Eklendi</span>
        )}
      </button>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto space-y-6">
      {/* Step header */}
      <div className="text-center space-y-3 mb-2">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
          Hisselerinizi
          <br />
          <span className="text-gain">Seçin</span>
        </h1>
        <p className="text-muted-foreground text-base leading-relaxed">
          Portföyünüze eklemek istediğiniz BİST hisselerini arayın ve seçin.
          <span className="text-foreground font-medium"> AI analizleri hemen başlasın.</span>
        </p>
      </div>

      {/* Selected stocks */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((stock) => (
            <StockChip
              key={stock.code}
              code={stock.code}
              name={stock.name}
              onRemove={removeStock}
            />
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Hisse kodu veya şirket adı ara... (örn: THYAO)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-12 pl-10 bg-secondary border-border/50"
        />
      </div>

      {/* Search results */}
      {showSearchResults && (
        <Card className="border-border/50 bg-card/50 divide-y divide-border/50 overflow-hidden">
          {loading ? (
            <div className="p-3 space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-3/4" />
            </div>
          ) : (
            results.map((stock) => (
              <StockListItem key={stock.code} stock={stock} />
            ))
          )}
        </Card>
      )}

      {/* Popular stocks */}
      {showPopular && (
        <div>
          <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span>Popüler Hisseler</span>
          </div>
          <Card className="border-border/50 bg-card/50 divide-y divide-border/50 overflow-hidden max-h-80 overflow-y-auto">
            {POPULAR_STOCKS.map((stock) => (
              <StockListItem key={stock.code} stock={stock} />
            ))}
          </Card>
        </div>
      )}

      {/* Continue button */}
      {selected.length > 0 && (
        <Button
          onClick={handleContinue}
          disabled={saving}
          className="w-full h-12 bg-gradient-to-r from-ai-primary to-ai-premium hover:from-ai-primary/90 hover:to-ai-premium/90 text-white shadow-lg shadow-ai-primary/20 transition-all hover:shadow-xl hover:shadow-ai-primary/30 hover:scale-[1.02] active:scale-[0.98]"
        >
          {saving ? "Yönlendiriliyor..." : "Devam Et"}
          {!saving && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>
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
