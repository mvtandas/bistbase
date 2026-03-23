"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { ArrowUpDown, TrendingUp, TrendingDown, Minus, Pencil, Trash2, Plus, Search, ChevronDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortfolioCore } from "@/hooks/use-portfolio-data";
import { Sparkline } from "./sparkline";
import { HoldingsEmptyState } from "./holdings-empty-state";
import Link from "next/link";
import type { PortfolioIntelligence } from "@/lib/stock/portfolio-intelligence";

type Holding = PortfolioIntelligence["holdings"][number];
type SortKey = "compositeScore" | "changePercent" | "weight" | "pnlPercent" | "verdictScore";

const VERDICT_BADGE: Record<string, { label: string; color: string; icon: typeof TrendingUp }> = {
  GUCLU_AL: { label: "Güçlü Al", color: "bg-gain/15 text-gain", icon: TrendingUp },
  AL: { label: "Al", color: "bg-gain/10 text-gain", icon: TrendingUp },
  TUT: { label: "Tut", color: "bg-amber-400/10 text-amber-400", icon: Minus },
  SAT: { label: "Sat", color: "bg-loss/10 text-loss", icon: TrendingDown },
  GUCLU_SAT: { label: "Güçlü Sat", color: "bg-loss/15 text-loss", icon: TrendingDown },
};

function SortHeader({ label, sortKey, currentSort, onSort }: { label: string; sortKey: SortKey; currentSort: { key: SortKey; desc: boolean }; onSort: (key: SortKey) => void }) {
  const active = currentSort.key === sortKey;
  return (
    <button onClick={() => onSort(sortKey)} className={cn("flex items-center gap-1 text-[11px] uppercase tracking-wider font-medium whitespace-nowrap", active ? "text-foreground" : "text-muted-foreground/60 hover:text-muted-foreground/80")}>
      {label}
      <ArrowUpDown className={cn("h-3 w-3", active && "text-ai-primary")} />
    </button>
  );
}

interface HoldingsTableProps {
  onEdit?: (stockCode: string) => void;
  onAdd?: () => void;
  onRemove?: (stockCode: string) => void;
}

export function HoldingsTable({ onEdit, onAdd, onRemove }: HoldingsTableProps) {
  const { data, isLoading, isError } = usePortfolioCore();

  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "compositeScore", desc: true });
  const [search, setSearch] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const onSort = (key: SortKey) => {
    setSort(prev => prev.key === key ? { key, desc: !prev.desc } : { key, desc: true });
  };

  if (isLoading) {
    return (
      <div className="bento-card p-5 space-y-3">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bento-card p-8 text-center">
        <p className="text-sm text-muted-foreground">Portföy verileri yüklenemedi.</p>
      </div>
    );
  }

  if (!data?.holdings?.length) {
    return <HoldingsEmptyState onAdd={() => onAdd?.()} />;
  }

  const hasPosition = data.hasPositionData;
  const sparklineData: Record<string, number[]> = data.sparklineData ?? {};

  let holdings = [...data.holdings];

  // Search filter
  if (search) {
    holdings = holdings.filter((h: Holding) =>
      h.stockCode.toLowerCase().includes(search.toLowerCase())
    );
  }

  // Sort
  const sorted = holdings.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
    const va = (a[sort.key] as number) ?? 0;
    const vb = (b[sort.key] as number) ?? 0;
    return sort.desc ? vb - va : va - vb;
  });

  return (
    <div className="bento-card overflow-hidden animate-slide-up">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-border/20 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-foreground">Portföy Holdingleri</span>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value.toUpperCase())}
              placeholder="Ara..."
              className="pl-8 pr-3 py-1.5 rounded-lg border border-border/30 bg-background text-xs text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-ai-primary w-32"
            />
          </div>
          <span className="text-xs text-muted-foreground/50">{data.holdings.length} hisse</span>
          {onAdd && (
            <button
              onClick={onAdd}
              className="inline-flex items-center gap-1.5 rounded-lg bg-ai-primary/10 text-ai-primary px-3 py-1.5 text-xs font-medium hover:bg-ai-primary/20 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Hisse Ekle</span>
              <kbd className="hidden sm:inline-flex ml-0.5 px-1 py-0.5 rounded bg-ai-primary/10 text-[9px] font-mono">⌘K</kbd>
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/15">
              <th className="text-left px-5 py-2.5 text-[11px] text-muted-foreground/60 font-medium uppercase tracking-wider">Hisse</th>
              <th className="px-2 py-2.5 w-16 hidden sm:table-cell">Grafik</th>
              <th className="text-right px-3 py-2.5"><SortHeader label="Değişim" sortKey="changePercent" currentSort={sort} onSort={onSort} /></th>
              <th className="text-right px-3 py-2.5"><SortHeader label="Skor" sortKey="compositeScore" currentSort={sort} onSort={onSort} /></th>
              <th className="text-center px-3 py-2.5"><SortHeader label="Karar" sortKey="verdictScore" currentSort={sort} onSort={onSort} /></th>
              <th className="text-right px-3 py-2.5 hidden sm:table-cell"><SortHeader label="Ağırlık" sortKey="weight" currentSort={sort} onSort={onSort} /></th>
              {hasPosition && <th className="text-right px-3 py-2.5 hidden sm:table-cell"><SortHeader label="K/Z" sortKey="pnlPercent" currentSort={sort} onSort={onSort} /></th>}
              <th className="w-16" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((h: Holding) => {
              const vb = h.verdictAction ? VERDICT_BADGE[h.verdictAction] : null;
              const VIcon = vb?.icon ?? Minus;
              const isExpanded = expandedRow === h.stockCode;
              const sparkData = sparklineData[h.stockCode] ?? [];

              return (
                <React.Fragment key={h.stockCode}>
                  <tr
                    className={cn("border-b border-border/10 hover:bg-card/40 transition-colors cursor-pointer", isExpanded && "bg-card/30")}
                    onClick={() => setExpandedRow(isExpanded ? null : h.stockCode)}
                  >
                    <td className="px-5 py-3">
                      <Link href={`/dashboard/stock/${h.stockCode}`} className="hover:text-ai-primary transition-colors" onClick={e => e.stopPropagation()}>
                        <span className="font-bold text-foreground text-sm">{h.stockCode}</span>
                        {h.price != null && <span className="text-muted-foreground/60 ml-2 tabular-nums">₺{h.price.toFixed(2)}</span>}
                      </Link>
                    </td>
                    <td className="px-2 py-3 hidden sm:table-cell">
                      {sparkData.length > 1 && <Sparkline data={sparkData} width={60} height={28} />}
                    </td>
                    <td className="text-right px-3 py-3 tabular-nums">
                      {h.changePercent != null && (
                        <span className={cn("font-semibold", h.changePercent >= 0 ? "text-gain" : "text-loss")}>
                          {h.changePercent >= 0 ? "+" : ""}{h.changePercent.toFixed(2)}%
                        </span>
                      )}
                    </td>
                    <td className="text-right px-3 py-3">
                      {h.compositeScore != null && (
                        <span className={cn("font-bold tabular-nums text-sm", h.compositeScore >= 60 ? "text-gain" : h.compositeScore >= 45 ? "text-amber-400" : "text-loss")}>
                          {h.compositeScore}
                        </span>
                      )}
                    </td>
                    <td className="text-center px-3 py-3">
                      {vb && (
                        <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full", vb.color)}>
                          <VIcon className="h-3 w-3" />
                          {vb.label}
                        </span>
                      )}
                    </td>
                    <td className="text-right px-3 py-3 tabular-nums text-muted-foreground/70 hidden sm:table-cell">
                      %{h.weight}
                    </td>
                    {hasPosition && (
                      <td className="text-right px-3 py-3 tabular-nums hidden sm:table-cell">
                        {h.pnl != null ? (
                          <div>
                            <span className={cn("font-semibold", h.pnl >= 0 ? "text-gain" : "text-loss")}>
                              {h.pnl >= 0 ? "+" : ""}₺{h.pnl.toLocaleString("tr-TR")}
                            </span>
                            {h.pnlPercent != null && (
                              <span className="text-muted-foreground/50 ml-1 text-[11px]">
                                ({h.pnlPercent > 0 ? "+" : ""}{h.pnlPercent}%)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-3 flex items-center gap-1">
                      {onEdit && (
                        <button onClick={(e) => { e.stopPropagation(); onEdit(h.stockCode); }} className="p-1.5 rounded-lg hover:bg-card/50 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors" title="Düzenle">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {onRemove && (
                        <button onClick={(e) => { e.stopPropagation(); onRemove(h.stockCode); }} className="p-1.5 rounded-lg hover:bg-loss/10 text-muted-foreground/30 hover:text-loss transition-colors" title="Çıkar">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground/30 transition-transform", isExpanded && "rotate-180")} />
                    </td>
                  </tr>
                  {/* Expanded row */}
                  {isExpanded && (
                    <tr key={`${h.stockCode}-expand`} className="border-b border-border/10 bg-card/20">
                      <td colSpan={hasPosition ? 8 : 7} className="px-5 py-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div>
                            <span className="text-muted-foreground/60">Sektör</span>
                            <div className="font-medium text-foreground mt-0.5">{h.sectorCode ?? "—"}</div>
                          </div>
                          {h.quantity != null && (
                            <div>
                              <span className="text-muted-foreground/60">Miktar</span>
                              <div className="font-medium text-foreground mt-0.5">{h.quantity} adet</div>
                            </div>
                          )}
                          {h.cost != null && (
                            <div>
                              <span className="text-muted-foreground/60">Maliyet</span>
                              <div className="font-medium text-foreground mt-0.5">₺{h.cost.toLocaleString("tr-TR")}</div>
                            </div>
                          )}
                          {h.value != null && (
                            <div>
                              <span className="text-muted-foreground/60">Güncel Değer</span>
                              <div className="font-medium text-foreground mt-0.5">₺{h.value.toLocaleString("tr-TR")}</div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
