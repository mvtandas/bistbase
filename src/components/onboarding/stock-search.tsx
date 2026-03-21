"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StockChip } from "./stock-chip";
import { PremiumUpsellModal } from "./premium-upsell-modal";
import { useStockSearch } from "@/hooks/use-stock-search";
import { Search, ArrowRight } from "lucide-react";
import type { StockSearchResult } from "@/types";

interface SelectedStock {
  code: string;
  name: string;
}

export function StockSearch() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SelectedStock[]>([]);
  const [showUpsell, setShowUpsell] = useState(false);
  const [saving, setSaving] = useState(false);
  const { results, loading } = useStockSearch(query);
  const router = useRouter();

  async function addStock(stock: StockSearchResult) {
    if (selected.some((s) => s.code === stock.code)) return;

    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockCode: stock.code }),
      });

      if (res.status === 403) {
        const data = await res.json();
        if (data.error === "PREMIUM_REQUIRED") {
          setShowUpsell(true);
          return;
        }
      }

      if (res.ok) {
        setSelected((prev) => [...prev, { code: stock.code, name: stock.name }]);
        setQuery("");
      }
    } catch {
      // handle error
    }
  }

  async function removeStock(code: string) {
    try {
      await fetch("/api/portfolio", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockCode: code }),
      });
      setSelected((prev) => prev.filter((s) => s.code !== code));
    } catch {
      // handle error
    }
  }

  async function handleContinue() {
    setSaving(true);
    router.push("/dashboard");
  }

  return (
    <div className="w-full max-w-lg mx-auto space-y-6">
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
      {(loading || results.length > 0) && query.length >= 2 && (
        <Card className="border-border/50 bg-card/50 divide-y divide-border/50 overflow-hidden">
          {loading ? (
            <div className="p-3 space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-3/4" />
            </div>
          ) : (
            results.map((stock) => (
              <button
                key={stock.code}
                type="button"
                onClick={() => addStock(stock)}
                disabled={selected.some((s) => s.code === stock.code)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-accent transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-foreground">
                    {stock.code}
                  </span>
                  <span className="text-muted-foreground">{stock.name}</span>
                </div>
                {selected.some((s) => s.code === stock.code) && (
                  <span className="text-xs text-ai-primary">Eklendi</span>
                )}
              </button>
            ))
          )}
        </Card>
      )}

      {/* Continue button */}
      {selected.length > 0 && (
        <Button
          onClick={handleContinue}
          disabled={saving}
          className="w-full h-12 bg-ai-primary hover:bg-ai-primary/90 text-white"
        >
          {saving ? "Yönlendiriliyor..." : "Devam Et"}
          {!saving && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>
      )}

      {/* Premium upsell modal */}
      <PremiumUpsellModal
        open={showUpsell}
        onClose={() => setShowUpsell(false)}
      />
    </div>
  );
}
