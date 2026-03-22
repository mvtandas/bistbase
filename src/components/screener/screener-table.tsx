"use client";

import { Fragment, useState } from "react";
import { cn } from "@/lib/utils";
import { ArrowUpDown, TrendingUp, TrendingDown, Minus, ChevronDown, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ScreenerStockResult } from "@/lib/stock/batch-analysis";

type SortKey = "composite" | "changePercent" | "rsi14" | "fundamentalScore" | "price" | "code";

const VERDICT_BADGE: Record<string, { label: string; color: string; icon: typeof TrendingUp }> = {
  GUCLU_AL: { label: "Güçlü Al", color: "bg-gain/15 text-gain", icon: TrendingUp },
  AL: { label: "Al", color: "bg-gain/10 text-gain", icon: TrendingUp },
  TUT: { label: "Tut", color: "bg-amber-400/10 text-amber-400", icon: Minus },
  SAT: { label: "Sat", color: "bg-loss/10 text-loss", icon: TrendingDown },
  GUCLU_SAT: { label: "Güçlü Sat", color: "bg-loss/15 text-loss", icon: TrendingDown },
};

const RISK_COLORS: Record<string, string> = {
  LOW: "text-gain",
  MODERATE: "text-amber-400",
  HIGH: "text-orange-400",
  VERY_HIGH: "text-loss",
};

const RISK_LABELS: Record<string, string> = {
  LOW: "Düşük",
  MODERATE: "Orta",
  HIGH: "Yüksek",
  VERY_HIGH: "Çok Yüksek",
};

function SortHeader({ label, sortKey, currentSort, onSort }: {
  label: string;
  sortKey: SortKey;
  currentSort: { key: SortKey; desc: boolean };
  onSort: (key: SortKey) => void;
}) {
  const active = currentSort.key === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={cn(
        "flex items-center gap-1 text-[11px] uppercase tracking-wider font-medium whitespace-nowrap",
        active ? "text-foreground" : "text-muted-foreground/60 hover:text-muted-foreground/80"
      )}
    >
      {label}
      <ArrowUpDown className={cn("h-3 w-3", active && "text-ai-primary")} />
    </button>
  );
}

interface ScreenerTableProps {
  stocks: ScreenerStockResult[];
}

export function ScreenerTable({ stocks }: ScreenerTableProps) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "composite", desc: true });
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const onSort = (key: SortKey) => {
    setSort(prev => prev.key === key ? { key, desc: !prev.desc } : { key, desc: true });
  };

  const sorted = [...stocks].sort((a, b) => {
    let va: number | string = 0;
    let vb: number | string = 0;
    switch (sort.key) {
      case "composite": va = a.composite?.composite ?? 0; vb = b.composite?.composite ?? 0; break;
      case "changePercent": va = a.changePercent ?? 0; vb = b.changePercent ?? 0; break;
      case "rsi14": va = a.rsi14 ?? 0; vb = b.rsi14 ?? 0; break;
      case "fundamentalScore": va = a.fundamentalScore?.fundamentalScore ?? 0; vb = b.fundamentalScore?.fundamentalScore ?? 0; break;
      case "price": va = a.price ?? 0; vb = b.price ?? 0; break;
      case "code": va = a.code; vb = b.code; break;
    }
    if (typeof va === "string") return sort.desc ? vb.toString().localeCompare(va.toString()) : va.toString().localeCompare(vb.toString());
    return sort.desc ? (vb as number) - (va as number) : (va as number) - (vb as number);
  });

  if (stocks.length === 0) {
    return (
      <div className="bento-card">
        <div className="bento-card-body text-center text-muted-foreground/60 py-12">
          Filtrelere uygun hisse bulunamadı.
        </div>
      </div>
    );
  }

  return (
    <div className="bento-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/20">
              <th className="text-left px-4 py-3"><SortHeader label="Hisse" sortKey="code" currentSort={sort} onSort={onSort} /></th>
              <th className="text-right px-4 py-3"><SortHeader label="Fiyat" sortKey="price" currentSort={sort} onSort={onSort} /></th>
              <th className="text-right px-4 py-3"><SortHeader label="Değ%" sortKey="changePercent" currentSort={sort} onSort={onSort} /></th>
              <th className="text-right px-4 py-3"><SortHeader label="Skor" sortKey="composite" currentSort={sort} onSort={onSort} /></th>
              <th className="text-center px-4 py-3"><span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground/60">Karar</span></th>
              <th className="text-right px-4 py-3"><SortHeader label="RSI" sortKey="rsi14" currentSort={sort} onSort={onSort} /></th>
              <th className="text-center px-4 py-3"><span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground/60">Sinyaller</span></th>
              <th className="text-right px-4 py-3"><SortHeader label="Temel" sortKey="fundamentalScore" currentSort={sort} onSort={onSort} /></th>
              <th className="text-center px-4 py-3"><span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground/60">Risk</span></th>
              <th className="text-left px-4 py-3"><span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground/60">Sektör</span></th>
              <th className="px-2 py-3" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((stock) => {
              const verdict = stock.verdict;
              const vBadge = verdict ? VERDICT_BADGE[verdict.action] : null;
              const isExpanded = expandedRow === stock.code;
              const bullishCount = stock.signals.filter(s => s.direction === "BULLISH").length;
              const bearishCount = stock.signals.filter(s => s.direction === "BEARISH").length;
              const riskLevel = stock.riskMetrics?.riskLevel;

              return (
                <Fragment key={stock.code}>
                  <tr
                    className={cn(
                      "border-b border-border/10 hover:bg-card/50 cursor-pointer transition-colors",
                      isExpanded && "bg-card/50"
                    )}
                    onClick={() => setExpandedRow(isExpanded ? null : stock.code)}
                  >
                    {/* Hisse */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">{stock.code}</span>
                        <span className="text-[11px] text-muted-foreground/50 truncate max-w-[100px]">{stock.name}</span>
                      </div>
                    </td>

                    {/* Fiyat */}
                    <td className="text-right px-4 py-3">
                      <span className="text-sm font-medium text-foreground">
                        {stock.price != null ? `₺${stock.price.toFixed(2)}` : "—"}
                      </span>
                    </td>

                    {/* Değişim */}
                    <td className="text-right px-4 py-3">
                      <span className={cn("text-sm font-medium", stock.changePercent != null && stock.changePercent > 0 ? "text-gain" : stock.changePercent != null && stock.changePercent < 0 ? "text-loss" : "text-muted-foreground")}>
                        {stock.changePercent != null ? `${stock.changePercent >= 0 ? "+" : ""}${stock.changePercent.toFixed(2)}%` : "—"}
                      </span>
                    </td>

                    {/* Skor */}
                    <td className="text-right px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-12 h-1.5 rounded-full bg-border/30 overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              (stock.composite?.composite ?? 0) >= 60 ? "bg-gain" : (stock.composite?.composite ?? 0) >= 40 ? "bg-amber-400" : "bg-loss"
                            )}
                            style={{ width: `${stock.composite?.composite ?? 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-foreground w-8 text-right">
                          {stock.composite ? Math.round(stock.composite.composite) : "—"}
                        </span>
                      </div>
                    </td>

                    {/* Karar */}
                    <td className="text-center px-4 py-3">
                      {vBadge ? (
                        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium", vBadge.color)}>
                          <vBadge.icon className="h-3 w-3" />
                          {vBadge.label}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </td>

                    {/* RSI */}
                    <td className="text-right px-4 py-3">
                      <span className={cn(
                        "text-sm font-medium",
                        stock.rsi14 != null && stock.rsi14 > 70 ? "text-loss" : stock.rsi14 != null && stock.rsi14 < 30 ? "text-gain" : "text-foreground"
                      )}>
                        {stock.rsi14 != null ? stock.rsi14.toFixed(1) : "—"}
                      </span>
                    </td>

                    {/* Sinyaller */}
                    <td className="text-center px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        {bullishCount > 0 && (
                          <span className="text-[11px] font-medium text-gain bg-gain/10 px-1.5 py-0.5 rounded">
                            {bullishCount}B
                          </span>
                        )}
                        {bearishCount > 0 && (
                          <span className="text-[11px] font-medium text-loss bg-loss/10 px-1.5 py-0.5 rounded">
                            {bearishCount}A
                          </span>
                        )}
                        {bullishCount === 0 && bearishCount === 0 && (
                          <span className="text-xs text-muted-foreground/40">—</span>
                        )}
                      </div>
                    </td>

                    {/* Temel */}
                    <td className="text-right px-4 py-3">
                      <span className="text-sm font-medium text-foreground">
                        {stock.fundamentalScore ? Math.round(stock.fundamentalScore.fundamentalScore) : "—"}
                      </span>
                    </td>

                    {/* Risk */}
                    <td className="text-center px-4 py-3">
                      {riskLevel ? (
                        <span className={cn("text-[11px] font-medium", RISK_COLORS[riskLevel] ?? "text-muted-foreground")}>
                          {RISK_LABELS[riskLevel] ?? riskLevel}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </td>

                    {/* Sektör */}
                    <td className="text-left px-4 py-3">
                      <span className="text-[11px] text-muted-foreground/60">{stock.sectorName ?? "—"}</span>
                    </td>

                    {/* Expand */}
                    <td className="px-2 py-3">
                      <ChevronDown className={cn("h-4 w-4 text-muted-foreground/40 transition-transform", isExpanded && "rotate-180")} />
                    </td>
                  </tr>

                  {/* Expanded Row */}
                  {isExpanded && (
                    <tr className="bg-card/30">
                      <td colSpan={11} className="px-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Top Sinyaller */}
                          <div>
                            <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground/60 mb-2">Aktif Sinyaller</p>
                            <div className="space-y-1">
                              {stock.signals.slice(0, 5).map((sig, i) => (
                                <div key={i} className="flex items-center gap-2">
                                  <span className={cn(
                                    "h-1.5 w-1.5 rounded-full",
                                    sig.direction === "BULLISH" ? "bg-gain" : sig.direction === "BEARISH" ? "bg-loss" : "bg-amber-400"
                                  )} />
                                  <span className="text-xs text-foreground/80">{sig.description}</span>
                                  <span className="text-[10px] text-muted-foreground/50 ml-auto">{sig.strength}</span>
                                </div>
                              ))}
                              {stock.signals.length === 0 && (
                                <p className="text-xs text-muted-foreground/40">Aktif sinyal yok</p>
                              )}
                            </div>
                          </div>

                          {/* Verdict Details */}
                          <div>
                            <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground/60 mb-2">Analiz Detayı</p>
                            {verdict && (
                              <div className="space-y-2">
                                <div>
                                  <p className="text-[10px] text-gain/80 mb-0.5">Güçlü Yön</p>
                                  <p className="text-xs text-foreground/80">{verdict.strongestBull || "—"}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-loss/80 mb-0.5">Zayıf Yön</p>
                                  <p className="text-xs text-foreground/80">{verdict.strongestBear || "—"}</p>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60">
                                  <span>Güven: {verdict.confidence}%</span>
                                  {stock.multiTimeframe && (
                                    <>
                                      <span>·</span>
                                      <span>MTF: {stock.multiTimeframe.alignmentTr}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Key Metrics + Link */}
                          <div>
                            <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground/60 mb-2">Temel Metrikler</p>
                            <div className="grid grid-cols-2 gap-1.5 text-xs">
                              <div className="text-muted-foreground/60">P/E</div>
                              <div className="text-foreground/80 text-right">{stock.peRatio?.toFixed(1) ?? "—"}</div>
                              <div className="text-muted-foreground/60">P/B</div>
                              <div className="text-foreground/80 text-right">{stock.pbRatio?.toFixed(2) ?? "—"}</div>
                              <div className="text-muted-foreground/60">Temettü</div>
                              <div className="text-foreground/80 text-right">{stock.dividendYield != null ? `%${stock.dividendYield.toFixed(1)}` : "—"}</div>
                              <div className="text-muted-foreground/60">Sharpe</div>
                              <div className="text-foreground/80 text-right">{stock.riskMetrics?.sharpeRatio?.toFixed(2) ?? "—"}</div>
                            </div>
                            <Link
                              href={`/dashboard/stock/${stock.code}`}
                              className="inline-flex items-center gap-1 mt-3 text-xs text-ai-primary hover:text-ai-primary/80 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="h-3 w-3" />
                              Detaylı Analiz
                            </Link>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
