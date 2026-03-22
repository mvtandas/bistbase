"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { SpkDisclaimer } from "@/components/shared/spk-disclaimer";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, AlertTriangle, BarChart3, Sparkles, Activity, DollarSign, Shield } from "lucide-react";
import Link from "next/link";

import type { StockDetail, Summary, Period, ContentTab } from "@/components/stock-detail/types";
import { PERIOD_LABELS, TAB_LABELS } from "@/components/stock-detail/types";
import { StockHero } from "@/components/stock-detail/StockHero";
import { SummaryTab } from "@/components/stock-detail/SummaryTab";
import { TechnicalTab } from "@/components/stock-detail/TechnicalTab";
import { FundamentalTab } from "@/components/stock-detail/FundamentalTab";
import { RiskTab } from "@/components/stock-detail/RiskTab";
import { StockDetailSkeleton } from "@/components/stock-detail/StockDetailSkeleton";
import { PriceChart } from "@/components/stock-detail/PriceChart";

export function StockDetailClient({ stockCode, summaries }: { stockCode: string; summaries: Summary[] }) {
  const [period, setPeriod] = useState<Period>("today");
  const [tab, setTab] = useState<ContentTab>("summary");

  // Main stock data
  const { data, isLoading, isError, error, refetch } = useQuery<StockDetail>({
    queryKey: ["stock-detail", stockCode],
    queryFn: async () => {
      const r = await fetch(`/api/stock-detail/${stockCode}`);
      if (!r.ok) throw new Error(`Veri alınamadı (${r.status})`);
      const json = await r.json();
      if (json.error) throw new Error(json.error);
      return json;
    },
    retry: 2,
  });

  // Period data (week/month)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pd, isLoading: pdLoading, isError: pdError } = useQuery<any>({
    queryKey: ["stock-period-v2", stockCode, period],
    queryFn: async () => {
      const r = await fetch(`/api/stock-detail/${stockCode}/period?range=${period}`);
      if (!r.ok) throw new Error("Dönem verisi alınamadı");
      const json = await r.json();
      if (json.error) throw new Error(json.error);
      return json;
    },
    enabled: period !== "today",
    retry: 1,
  });

  // Active data source
  const d = period === "today" ? data : pd;
  const timeLabel: "realtime" | "daily" | "weekly" | "monthly" =
    period === "today" ? "realtime" : period === "week" ? "weekly" : "monthly";

  return (
    <div>
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 group">
        <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" /> Geri
      </Link>

      {isLoading ? (
        <StockDetailSkeleton />
      ) : isError ? (
        <div className="rounded-2xl border border-loss/15 bg-loss/5 p-10 text-center max-w-sm mx-auto">
          <div className="h-12 w-12 rounded-full bg-loss/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-6 w-6 text-loss" />
          </div>
          <p className="text-base font-semibold text-foreground">Veri yüklenemedi</p>
          <p className="text-sm text-muted-foreground/70 mt-1.5">{(error as Error)?.message ?? "Lütfen daha sonra tekrar deneyin."}</p>
          <button onClick={() => refetch()} className="mt-4 px-4 py-2 text-sm font-medium text-white bg-ai-primary rounded-lg hover:bg-ai-primary/90 transition-colors shadow-sm">
            Tekrar dene
          </button>
        </div>
      ) : data ? (
        <>
          {/* Hero — always uses realtime data */}
          <StockHero
            data={data}
            activeData={d}
            period={period}
            setPeriod={setPeriod}
            pdLoading={pdLoading}
            stockCode={stockCode}
          />

          {/* Price Chart */}
          {d?.chartBars && d.chartBars.length > 0 && (
            <PriceChart key={period} bars={d.chartBars} overlays={d.chartOverlays} period={period} />
          )}

          {/* Period loading / error */}
          {period !== "today" && pdLoading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <BarChart3 className="h-4 w-4 animate-pulse mr-2" />
              <span className="text-sm">{PERIOD_LABELS[period]} verileri yükleniyor...</span>
            </div>
          )}
          {period !== "today" && pdError && (
            <div className="rounded-xl border border-loss/20 bg-loss/5 p-6 text-center mb-4">
              <p className="text-sm text-muted-foreground">Dönem verileri yüklenemedi. Lütfen tekrar deneyin.</p>
            </div>
          )}

          {/* Content Tab Bar */}
          {(() => {
            const tabs: { key: ContentTab; label: string; icon: typeof Sparkles }[] = [
              { key: "summary", label: "Özet", icon: Sparkles },
              { key: "technical", label: "Teknik", icon: Activity },
              { key: "fundamental", label: "Temel", icon: DollarSign },
              { key: "risk", label: "Risk", icon: Shield },
            ];
            return (
              <div className="grid grid-cols-4 gap-1 mb-5 p-1 rounded-xl bg-card/40 border border-border/30">
                {tabs.map((t) => {
                  const Icon = t.icon;
                  const isActive = tab === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={cn(
                        "flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-all",
                        isActive
                          ? "bg-ai-primary text-white shadow-md shadow-ai-primary/20"
                          : "text-muted-foreground hover:text-foreground hover:bg-card/60"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{t.label}</span>
                      <span className="sm:hidden">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {/* Tab Content */}
          {d && (
            <>
              {tab === "summary" && (
                <SummaryTab
                  d={d}
                  data={data}
                  period={period}
                  summaries={summaries}
                  pdLoading={pdLoading}
                  pd={pd}
                  stockCode={stockCode}
                  timeLabel={timeLabel}
                  onTabChange={(t) => setTab(t as ContentTab)}
                />
              )}
              {tab === "technical" && (
                <TechnicalTab d={d} stockCode={stockCode} timeLabel={timeLabel} />
              )}
              {tab === "fundamental" && (
                <FundamentalTab d={d} stockCode={stockCode} timeLabel={timeLabel} />
              )}
              {tab === "risk" && (
                <RiskTab d={d} timeLabel={timeLabel} />
              )}
            </>
          )}
        </>
      ) : null}

      <SpkDisclaimer />
    </div>
  );
}
