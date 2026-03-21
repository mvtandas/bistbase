"use client";

import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ArrowUpRight,
  ArrowDownRight,
  Globe,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import Link from "next/link";

interface IndexData {
  name: string;
  price: number | null;
  changePercent: number | null;
}

interface StockMover {
  code: string;
  name: string;
  price: number | null;
  changePercent: number | null;
}

interface MarketData {
  indices: IndexData[];
  gainers: StockMover[];
  losers: StockMover[];
}

async function fetchMarket(): Promise<MarketData> {
  const res = await fetch("/api/market-overview");
  if (!res.ok) return { indices: [], gainers: [], losers: [] };
  return res.json();
}

function ChangeIndicator({
  value,
  size = "sm",
}: {
  value: number | null;
  size?: "sm" | "xs";
}) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const isPositive = value >= 0;
  const textSize = size === "sm" ? "text-xs" : "text-[10px]";
  return (
    <span
      className={cn(
        "flex items-center gap-0.5 font-medium tabular-nums",
        textSize,
        isPositive ? "text-gain" : "text-loss"
      )}
    >
      {isPositive ? (
        <ArrowUpRight className="h-3 w-3" />
      ) : (
        <ArrowDownRight className="h-3 w-3" />
      )}
      {isPositive ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  );
}

export function MarketOverview() {
  const { data, isLoading } = useQuery({
    queryKey: ["market-overview"],
    queryFn: fetchMarket,
    refetchInterval: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4 mb-6">
        <div className="flex gap-3 overflow-x-auto pb-1">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton
              key={i}
              className="h-20 min-w-[150px] flex-shrink-0 rounded-xl"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-5 mb-6">
      {/* Endeksler */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Globe className="h-3.5 w-3.5 text-ai-primary" />
          <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
            Endeksler
          </span>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {data.indices.map((index) => {
            const isPositive = (index.changePercent ?? 0) >= 0;
            return (
              <div
                key={index.name}
                className={cn(
                  "flex-shrink-0 rounded-xl border bg-card/30 p-4 min-w-[150px]",
                  isPositive ? "border-gain/10" : "border-loss/10"
                )}
              >
                <p className="text-[11px] text-muted-foreground/60 mb-1">
                  {index.name}
                </p>
                <p className="text-base font-bold text-foreground tabular-nums">
                  {index.price != null
                    ? index.price.toLocaleString("tr-TR", {
                        maximumFractionDigits: 0,
                      })
                    : "—"}
                </p>
                <ChangeIndicator value={index.changePercent} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Yükselenler / Düşenler */}
      {(data.gainers.length > 0 || data.losers.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* En Çok Yükselenler */}
          {data.gainers.length > 0 && (
            <div className="rounded-xl border border-gain/10 bg-card/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-3.5 w-3.5 text-gain" />
                <span className="text-[11px] font-medium text-gain uppercase tracking-wider">
                  En Çok Yükselenler
                </span>
              </div>
              <div className="space-y-2">
                {data.gainers.map((stock, i) => (
                  <Link
                    key={stock.code}
                    href={`/dashboard/stock/${stock.code}`}
                    className="flex items-center justify-between py-1 hover:opacity-80 transition-opacity"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground/40 w-3">
                        {i + 1}
                      </span>
                      <span className="text-xs font-semibold text-foreground">
                        {stock.code}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        ₺
                        {stock.price?.toLocaleString("tr-TR", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                      <ChangeIndicator value={stock.changePercent} size="xs" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* En Çok Düşenler */}
          {data.losers.length > 0 && (
            <div className="rounded-xl border border-loss/10 bg-card/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="h-3.5 w-3.5 text-loss" />
                <span className="text-[11px] font-medium text-loss uppercase tracking-wider">
                  En Çok Düşenler
                </span>
              </div>
              <div className="space-y-2">
                {data.losers.map((stock, i) => (
                  <Link
                    key={stock.code}
                    href={`/dashboard/stock/${stock.code}`}
                    className="flex items-center justify-between py-1 hover:opacity-80 transition-opacity"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground/40 w-3">
                        {i + 1}
                      </span>
                      <span className="text-xs font-semibold text-foreground">
                        {stock.code}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        ₺
                        {stock.price?.toLocaleString("tr-TR", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                      <ChangeIndicator value={stock.changePercent} size="xs" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
