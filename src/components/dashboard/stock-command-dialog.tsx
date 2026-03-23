"use client";

import { useState, useMemo } from "react";
import { useStockSearch } from "@/hooks/use-stock-search";
import { useAddStock } from "@/hooks/use-portfolio-mutations";
import { usePortfolioCore } from "@/hooks/use-portfolio-data";
import { Loader2, Plus, TrendingUp } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

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
];

interface StockCommandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStockAdded?: (code: string) => void;
}

export function StockCommandDialog({ open, onOpenChange, onStockAdded }: StockCommandDialogProps) {
  const [query, setQuery] = useState("");
  const { results, loading: searching } = useStockSearch(query);
  const addStock = useAddStock();

  // Fetch current portfolio to mark already-added stocks
  const { data: portfolioData } = usePortfolioCore();

  const portfolioCodes = useMemo(() => {
    const codes = new Set<string>();
    if (portfolioData?.holdings) {
      for (const h of portfolioData.holdings) {
        codes.add(h.stockCode);
      }
    }
    return codes;
  }, [portfolioData]);

  // Track which stocks are being added (loading state per item)
  const [addingCodes, setAddingCodes] = useState<Set<string>>(new Set());

  const handleSelect = async (code: string) => {
    if (portfolioCodes.has(code) || addingCodes.has(code)) return;

    setAddingCodes((prev) => new Set(prev).add(code));
    try {
      await addStock.mutateAsync(code);
      onStockAdded?.(code);
    } finally {
      setAddingCodes((prev) => {
        const next = new Set(prev);
        next.delete(code);
        return next;
      });
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setQuery("");
      setAddingCodes(new Set());
    }
    onOpenChange(open);
  };

  const showSearch = query.length >= 2;
  const items = showSearch ? results : POPULAR_STOCKS;
  const groupHeading = showSearch
    ? searching
      ? "Aranıyor..."
      : `Sonuçlar (${results.length})`
    : "Popüler Hisseler";

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Hisse Ekle"
      description="Portföyünüze hisse eklemek için arayın"
    >
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Hisse kodu veya şirket adı ara..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            <div className="flex flex-col items-center gap-2 py-4">
              <TrendingUp className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Sonuç bulunamadı</p>
              <p className="text-xs text-muted-foreground/50">Farklı bir arama terimi deneyin</p>
            </div>
          </CommandEmpty>

          {(!showSearch || items.length > 0) && (
            <CommandGroup heading={groupHeading}>
              {items.map((stock) => {
                const inPortfolio = portfolioCodes.has(stock.code);
                const isAdding = addingCodes.has(stock.code);

                return (
                  <CommandItem
                    key={stock.code}
                    value={stock.code}
                    onSelect={() => handleSelect(stock.code)}
                    disabled={inPortfolio || isAdding}
                    data-checked={inPortfolio || undefined}
                    className="flex items-center gap-3 py-2.5"
                  >
                    <span className="font-bold text-sm text-foreground min-w-[60px]">
                      {stock.code}
                    </span>
                    <span className="text-sm text-muted-foreground truncate flex-1">
                      {stock.name}
                    </span>

                    {isAdding ? (
                      <Loader2 className="h-4 w-4 animate-spin text-ai-primary ml-auto" />
                    ) : !inPortfolio ? (
                      <Plus className="h-4 w-4 text-muted-foreground/40 ml-auto group-data-selected/command-item:text-ai-primary" />
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
        </CommandList>

        {/* Footer hint */}
        <div className="border-t border-border/20 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground/50">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-muted/50 text-[10px] font-mono">↵</kbd> ekle
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-muted/50 text-[10px] font-mono">esc</kbd> kapat
            </span>
          </div>
          {portfolioCodes.size > 0 && (
            <span className="text-[11px] text-muted-foreground/40">
              {portfolioCodes.size} hisse portföyde
            </span>
          )}
        </div>
      </Command>
    </CommandDialog>
  );
}
