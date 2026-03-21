"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { SpkDisclaimer } from "@/components/shared/spk-disclaimer";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  TrendingUp,
  BarChart3,
  Calendar,
  Activity,
  AlertTriangle,
  Zap,
  Target,
  DollarSign,
} from "lucide-react";
import Link from "next/link";

interface StockDetail {
  code: string;
  name: string;
  price: number | null;
  changePercent: number | null;
  volume: number | null;
  financials: {
    marketCap: number | null;
    peRatio: number | null;
    pbRatio: number | null;
    dividendYield: number | null;
    fiftyTwoWeekHigh: number | null;
    fiftyTwoWeekLow: number | null;
    avgVolume: number | null;
  };
  technicals: {
    rsi14: number | null;
    rsiSignal: string | null;
    ma20: number | null;
    ma50: number | null;
    ma200: number | null;
    crossSignal: string | null;
    support: number | null;
    resistance: number | null;
    breakoutSignal: string | null;
    volumeRatio: number | null;
    volumeAnomaly: boolean;
  } | null;
  priceHistory: { date: string; close: number }[];
}

interface Summary {
  id: string;
  date: string;
  closePrice: number | null;
  changePercent: number | null;
  aiSummaryText: string | null;
  sentimentScore: string | null;
}

function formatCap(val: number | null): string {
  if (val == null) return "—";
  if (val >= 1e12) return `₺${(val / 1e12).toFixed(1)}T`;
  if (val >= 1e9) return `₺${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `₺${(val / 1e6).toFixed(0)}M`;
  return `₺${val.toLocaleString("tr-TR")}`;
}

function formatVol(val: number | null): string {
  if (val == null) return "—";
  if (val >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `${(val / 1e3).toFixed(0)}K`;
  return val.toLocaleString("tr-TR");
}

function MiniSparkline({
  data,
}: {
  data: { date: string; close: number }[];
}) {
  if (data.length < 2) return null;

  const prices = data.map((d) => d.close);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const w = 200;
  const h = 48;

  const points = prices
    .map((p, i) => {
      const x = (i / (prices.length - 1)) * w;
      const y = h - ((p - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");

  const isUp = prices[prices.length - 1] >= prices[0];

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full h-12"
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke={isUp ? "oklch(0.765 0.177 163.223)" : "oklch(0.712 0.194 13.428)"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatBox({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/30 p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="h-3 w-3 text-muted-foreground/50" />
        <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p
        className={cn(
          "text-sm font-bold tabular-nums",
          color ?? "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function StockDetailClient({
  stockCode,
  summaries,
}: {
  stockCode: string;
  summaries: Summary[];
}) {
  const { data, isLoading } = useQuery<StockDetail>({
    queryKey: ["stock-detail", stockCode],
    queryFn: async () => {
      const res = await fetch(`/api/stock-detail/${stockCode}`);
      return res.json();
    },
  });

  const isPositive = (data?.changePercent ?? 0) >= 0;

  return (
    <div className="max-w-2xl">
      {/* Back */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-3 w-3" />
        Geri
      </Link>

      {/* Hero */}
      {isLoading ? (
        <div className="mb-8">
          <Skeleton className="h-14 w-14 rounded-2xl mb-4" />
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-10 w-40" />
        </div>
      ) : data ? (
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ai-primary/10 text-ai-primary text-sm font-bold">
              {stockCode.slice(0, 3)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                {stockCode}
              </h1>
              <p className="text-sm text-muted-foreground">{data.name}</p>
            </div>
          </div>

          {data.price != null && (
            <div className="mb-4">
              <p className="text-4xl font-bold text-foreground tabular-nums">
                ₺{data.price.toFixed(2)}
              </p>
              {data.changePercent != null && (
                <div
                  className={cn(
                    "flex items-center gap-1 mt-1 text-sm font-medium",
                    isPositive ? "text-gain" : "text-loss"
                  )}
                >
                  {isPositive ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )}
                  {isPositive ? "+" : ""}
                  {data.changePercent.toFixed(2)}% bugün
                </div>
              )}
            </div>
          )}

          {/* Sparkline */}
          {data.priceHistory.length > 1 && (
            <div className="rounded-xl border border-border/40 bg-card/30 p-4 mb-6">
              <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-2">
                Son 30 Gün
              </p>
              <MiniSparkline data={data.priceHistory} />
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-6">
            <StatBox icon={DollarSign} label="Piyasa Değeri" value={formatCap(data.financials.marketCap)} />
            <StatBox icon={Target} label="F/K" value={data.financials.peRatio?.toFixed(1) ?? "—"} />
            <StatBox icon={BarChart3} label="PD/DD" value={data.financials.pbRatio?.toFixed(2) ?? "—"} />
            <StatBox icon={Activity} label="Hacim" value={formatVol(data.volume)} />
            <StatBox icon={TrendingUp} label="52H Yüksek" value={data.financials.fiftyTwoWeekHigh ? `₺${data.financials.fiftyTwoWeekHigh.toFixed(2)}` : "—"} />
            <StatBox icon={ArrowDownRight} label="52H Düşük" value={data.financials.fiftyTwoWeekLow ? `₺${data.financials.fiftyTwoWeekLow.toFixed(2)}` : "—"} />
            <StatBox icon={BarChart3} label="Ort. Hacim" value={formatVol(data.financials.avgVolume)} />
            {data.financials.dividendYield != null && (
              <StatBox icon={DollarSign} label="Temettü" value={`%${data.financials.dividendYield.toFixed(2)}`} />
            )}
          </div>

          {/* Technical Indicators */}
          {data.technicals && (
            <div className="rounded-xl border border-border/40 bg-card/30 p-4 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-3.5 w-3.5 text-ai-primary" />
                <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                  Teknik Göstergeler
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* RSI */}
                {data.technicals.rsi14 != null && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground/50">
                      RSI (14)
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold tabular-nums text-foreground">
                        {data.technicals.rsi14.toFixed(1)}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-medium px-1.5 py-0.5 rounded",
                          data.technicals.rsiSignal === "OVERBOUGHT"
                            ? "bg-loss/10 text-loss"
                            : data.technicals.rsiSignal === "OVERSOLD"
                              ? "bg-gain/10 text-gain"
                              : "bg-secondary text-muted-foreground"
                        )}
                      >
                        {data.technicals.rsiSignal === "OVERBOUGHT"
                          ? "Aşırı Alım"
                          : data.technicals.rsiSignal === "OVERSOLD"
                            ? "Aşırı Satım"
                            : "Normal"}
                      </span>
                    </div>
                  </div>
                )}

                {/* MA'lar */}
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground/50">
                    Hareketli Ortalamalar
                  </p>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {data.technicals.ma20 && (
                      <p>
                        MA20:{" "}
                        <span className="font-medium text-foreground">
                          ₺{data.technicals.ma20.toFixed(2)}
                        </span>
                      </p>
                    )}
                    {data.technicals.ma50 && (
                      <p>
                        MA50:{" "}
                        <span className="font-medium text-foreground">
                          ₺{data.technicals.ma50.toFixed(2)}
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Destek / Direnç */}
                {(data.technicals.support || data.technicals.resistance) && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground/50">
                      Destek / Direnç
                    </p>
                    <div className="text-xs space-y-0.5">
                      <p>
                        <span className="text-gain">
                          ₺{data.technicals.support?.toFixed(2)}
                        </span>
                        {" / "}
                        <span className="text-loss">
                          ₺{data.technicals.resistance?.toFixed(2)}
                        </span>
                      </p>
                    </div>
                  </div>
                )}

                {/* Hacim */}
                {data.technicals.volumeRatio != null && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground/50">
                      Hacim Oranı
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold tabular-nums text-foreground">
                        {data.technicals.volumeRatio.toFixed(1)}x
                      </span>
                      {data.technicals.volumeAnomaly && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500">
                          Anomali!
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Sinyaller */}
              {(data.technicals.crossSignal ||
                data.technicals.breakoutSignal) && (
                <div className="mt-3 pt-3 border-t border-border/30 space-y-2">
                  {data.technicals.crossSignal === "GOLDEN_CROSS" && (
                    <div className="flex items-center gap-2 text-xs text-gain">
                      <TrendingUp className="h-3.5 w-3.5" />
                      <span className="font-medium">
                        Altın Kesişim — Güçlü yükseliş sinyali
                      </span>
                    </div>
                  )}
                  {data.technicals.crossSignal === "DEATH_CROSS" && (
                    <div className="flex items-center gap-2 text-xs text-loss">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span className="font-medium">
                        Ölüm Kesişimi — Düşüş sinyali
                      </span>
                    </div>
                  )}
                  {data.technicals.breakoutSignal === "RESISTANCE_BREAK" && (
                    <div className="flex items-center gap-2 text-xs text-gain">
                      <Zap className="h-3.5 w-3.5" />
                      <span className="font-medium">
                        Direnç kırılımı — Fiyat direnci aştı!
                      </span>
                    </div>
                  )}
                  {data.technicals.breakoutSignal === "SUPPORT_BREAK" && (
                    <div className="flex items-center gap-2 text-xs text-loss">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span className="font-medium">
                        Destek kırılımı — Fiyat desteğin altına indi
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}

      {/* AI Analysis History */}
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-4 w-4 text-ai-primary" />
        <h2 className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
          AI Analiz Geçmişi
        </h2>
      </div>

      {summaries.length === 0 ? (
        <div className="rounded-xl border border-border/40 bg-card/30 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Henüz analiz bulunamadı.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {summaries.map((s) => {
            const dayUp = (s.changePercent ?? 0) >= 0;
            return (
              <div
                key={s.id}
                className="rounded-xl border border-border/40 bg-card/30 p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3 text-muted-foreground/50" />
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(s.date).toLocaleDateString("tr-TR", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {s.closePrice != null && (
                      <span className="text-xs font-semibold text-foreground tabular-nums">
                        ₺{s.closePrice.toFixed(2)}
                      </span>
                    )}
                    {s.changePercent != null && (
                      <span
                        className={cn(
                          "text-[10px] font-medium tabular-nums",
                          dayUp ? "text-gain" : "text-loss"
                        )}
                      >
                        {dayUp ? "+" : ""}
                        {s.changePercent.toFixed(2)}%
                      </span>
                    )}
                  </div>
                </div>
                {s.aiSummaryText ? (
                  <div className="space-y-2">
                    {s.aiSummaryText
                      .split("\n\n")
                      .filter((p) => p.trim())
                      .map((p, i) => (
                        <p
                          key={i}
                          className="text-[13px] leading-relaxed text-muted-foreground"
                        >
                          {p.trim()}
                        </p>
                      ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <SpkDisclaimer />
    </div>
  );
}
