"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { ArrowUpDown, TrendingUp, TrendingDown, Minus, Pencil } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { QUERY_KEYS } from "@/lib/constants";
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
    <button onClick={() => onSort(sortKey)} className={cn("flex items-center gap-0.5 text-[9px] uppercase tracking-wider font-medium", active ? "text-foreground" : "text-muted-foreground/50 hover:text-muted-foreground/70")}>
      {label}
      <ArrowUpDown className={cn("h-2.5 w-2.5", active && "text-ai-primary")} />
    </button>
  );
}

interface HoldingsTableProps {
  onEdit?: (stockCode: string) => void;
}

export function HoldingsTable({ onEdit }: HoldingsTableProps) {
  const { data, isLoading } = useQuery<PortfolioIntelligence>({
    queryKey: QUERY_KEYS.PORTFOLIO_INTELLIGENCE,
    queryFn: () => fetch("/api/portfolio-intelligence").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "compositeScore", desc: true });

  const onSort = (key: SortKey) => {
    setSort(prev => prev.key === key ? { key, desc: !prev.desc } : { key, desc: true });
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/40 bg-card/30 p-4 space-y-2">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  }

  if (!data?.holdings?.length) return null;

  const hasPosition = data.hasPositionData;
  const sorted = [...data.holdings].sort((a, b) => {
    const va = (a as Record<string, unknown>)[sort.key] as number ?? 0;
    const vb = (b as Record<string, unknown>)[sort.key] as number ?? 0;
    return sort.desc ? vb - va : va - vb;
  });

  return (
    <div className="rounded-xl border border-border/40 bg-card/30 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-border/20 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-foreground">Portföy Holdingleri</span>
        <span className="text-[9px] text-muted-foreground/40">{data.holdings.length} hisse</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-border/15">
              <th className="text-left px-4 py-2 text-[9px] text-muted-foreground/50 font-medium uppercase tracking-wider">Hisse</th>
              <th className="text-right px-2 py-2"><SortHeader label="Değişim" sortKey="changePercent" currentSort={sort} onSort={onSort} /></th>
              <th className="text-right px-2 py-2"><SortHeader label="Skor" sortKey="compositeScore" currentSort={sort} onSort={onSort} /></th>
              <th className="text-center px-2 py-2"><SortHeader label="Karar" sortKey="verdictScore" currentSort={sort} onSort={onSort} /></th>
              <th className="text-right px-2 py-2"><SortHeader label="Ağırlık" sortKey="weight" currentSort={sort} onSort={onSort} /></th>
              {hasPosition && <th className="text-right px-2 py-2"><SortHeader label="K/Z" sortKey="pnlPercent" currentSort={sort} onSort={onSort} /></th>}
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(h => {
              const vb = h.verdictAction ? VERDICT_BADGE[h.verdictAction] : null;
              const VIcon = vb?.icon ?? Minus;
              return (
                <tr key={h.stockCode} className="border-b border-border/10 hover:bg-card/40 transition-colors">
                  <td className="px-4 py-2.5">
                    <Link href={`/dashboard/stock/${h.stockCode}`} className="hover:text-ai-primary transition-colors">
                      <span className="font-bold text-foreground">{h.stockCode}</span>
                      {h.price != null && <span className="text-muted-foreground/50 ml-1.5 tabular-nums">₺{h.price.toFixed(2)}</span>}
                    </Link>
                  </td>
                  <td className="text-right px-2 py-2.5 tabular-nums">
                    {h.changePercent != null && (
                      <span className={cn("font-medium", h.changePercent >= 0 ? "text-gain" : "text-loss")}>
                        {h.changePercent >= 0 ? "+" : ""}{h.changePercent.toFixed(2)}%
                      </span>
                    )}
                  </td>
                  <td className="text-right px-2 py-2.5">
                    {h.compositeScore != null && (
                      <span className={cn("font-bold tabular-nums", h.compositeScore >= 60 ? "text-gain" : h.compositeScore >= 45 ? "text-amber-400" : "text-loss")}>
                        {h.compositeScore}
                      </span>
                    )}
                  </td>
                  <td className="text-center px-2 py-2.5">
                    {vb && (
                      <span className={cn("inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full", vb.color)}>
                        <VIcon className="h-2.5 w-2.5" />
                        {vb.label}
                      </span>
                    )}
                  </td>
                  <td className="text-right px-2 py-2.5 tabular-nums text-muted-foreground">
                    %{h.weight}
                  </td>
                  {hasPosition && (
                    <td className="text-right px-2 py-2.5 tabular-nums">
                      {h.pnl != null ? (
                        <div>
                          <span className={cn("font-medium", h.pnl >= 0 ? "text-gain" : "text-loss")}>
                            {h.pnl >= 0 ? "+" : ""}₺{h.pnl.toLocaleString("tr-TR")}
                          </span>
                          {h.pnlPercent != null && (
                            <span className="text-muted-foreground/40 ml-1 text-[9px]">
                              ({h.pnlPercent > 0 ? "+" : ""}{h.pnlPercent}%)
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>
                  )}
                  <td className="px-2 py-2.5">
                    {onEdit && (
                      <button onClick={() => onEdit(h.stockCode)} className="p-1 rounded hover:bg-card/50 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors">
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
