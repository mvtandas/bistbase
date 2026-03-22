"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { SpkDisclaimer } from "@/components/shared/spk-disclaimer";
import {
  Sparkles, ArrowUpRight, ArrowDownRight,
  TrendingUp, TrendingDown, Minus, Clock, Eye,
} from "lucide-react";
import { AiInsightCard } from "@/components/stock-detail/AiInsightCard";
import type { AkilliOzetOutput } from "@/lib/ai/types";

type Period = "today" | "week" | "month";

interface StockCardProps {
  stockCode: string;
  period: Period;
}

type VerdictAction = "GUCLU_AL" | "AL" | "TUT" | "SAT" | "GUCLU_SAT";

const VERDICT_CONFIG: Record<VerdictAction, { label: string; color: string; bg: string; icon: typeof TrendingUp }> = {
  GUCLU_AL: { label: "Guclu Al", color: "text-gain", bg: "bg-gain/10", icon: TrendingUp },
  AL: { label: "Al", color: "text-gain", bg: "bg-gain/10", icon: TrendingUp },
  TUT: { label: "Tut", color: "text-amber-400", bg: "bg-amber-400/10", icon: Minus },
  SAT: { label: "Sat", color: "text-loss", bg: "bg-loss/10", icon: TrendingDown },
  GUCLU_SAT: { label: "Guclu Sat", color: "text-loss", bg: "bg-loss/10", icon: TrendingDown },
};

function getVerdictFromScore(composite: number): VerdictAction {
  if (composite >= 65) return "GUCLU_AL";
  if (composite >= 55) return "AL";
  if (composite >= 45) return "TUT";
  if (composite >= 35) return "SAT";
  return "GUCLU_SAT";
}

export function StockCard({ stockCode, period }: StockCardProps) {
  const isToday = period === "today";

  // Main stock data - different endpoint based on period
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, isLoading, isError } = useQuery<any>({
    queryKey: isToday ? ["stock-detail", stockCode] : ["stock-period", stockCode, period],
    queryFn: async () => {
      const url = isToday
        ? `/api/stock-detail/${stockCode}`
        : `/api/stock-detail/${stockCode}/period?range=${period}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Veri alinamadi (${r.status})`);
      const json = await r.json();
      if (json.error) throw new Error(json.error);
      return json;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // AI insight (lazy-loaded after main data, only for today)
  const { data: aiOzet, isLoading: aiLoading, isError: aiError } = useQuery<AkilliOzetOutput>({
    queryKey: ["ai-akilli-ozet", stockCode],
    queryFn: async () => {
      const r = await fetch(`/api/stock-detail/${stockCode}/ai/akilli-ozet`);
      if (!r.ok) throw new Error("AI analizi yuklenemedi");
      const json = await r.json();
      return json.data;
    },
    enabled: isToday && !!data,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/40 bg-card/30 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-muted/30 animate-pulse" />
          <div className="space-y-2 flex-1">
            <div className="h-4 w-20 bg-muted/30 rounded animate-pulse" />
            <div className="h-3 w-32 bg-muted/20 rounded animate-pulse" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full bg-muted/20 rounded animate-pulse" />
          <div className="h-3 w-5/6 bg-muted/20 rounded animate-pulse" />
          <div className="h-3 w-4/6 bg-muted/20 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-xl border border-border/40 bg-card/30 p-5">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-loss/10 text-loss text-xs font-bold">
            {stockCode.slice(0, 2)}
          </div>
          <div>
            <span className="text-base font-bold text-foreground">{stockCode}</span>
            <p className="text-xs text-muted-foreground">Veri yuklenemedi</p>
          </div>
        </div>
      </div>
    );
  }

  const price = data.price;
  const changePercent = data.changePercent;
  const isPositive = (changePercent ?? 0) >= 0;
  const score = data.score as { composite: number; technical: number; momentum: number; volume: number; labelTr: string } | null;
  const signals = (data.signals ?? []) as { type: string; direction: string; strength: number; description: string }[];
  const bullSignals = signals.filter(s => s.direction === "BULLISH").length;
  const bearSignals = signals.filter(s => s.direction === "BEARISH").length;

  const verdictAction: VerdictAction | null = score ? getVerdictFromScore(score.composite) : null;
  const verdictCfg = verdictAction ? VERDICT_CONFIG[verdictAction] : null;

  // Period AI analysis (from period endpoint, not separate AI endpoint)
  const periodAi = !isToday ? data.aiAnalysis as { summaryText: string; bullCase: string; bearCase: string; confidence: string } | null : null;

  return (
    <div className="group rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm p-5 transition-all hover:border-border/70 hover:bg-card/50">
      {/* Header: Code + Verdict + Price */}
      <div className="flex items-start justify-between mb-4">
        <Link href={`/dashboard/stock/${stockCode}`} className="group/link flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ai-primary/10 text-ai-primary text-xs font-bold">
            {stockCode.slice(0, 2)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-foreground group-hover/link:text-ai-primary transition-colors">
                {stockCode}
              </span>
              {score && (
                <span className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded tabular-nums",
                  score.composite >= 60 ? "bg-gain/10 text-gain" : score.composite >= 40 ? "bg-amber-400/10 text-amber-400" : "bg-loss/10 text-loss"
                )}>
                  {score.composite}
                </span>
              )}
              {verdictCfg && verdictAction && (
                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5", verdictCfg.bg, verdictCfg.color)}>
                  <verdictCfg.icon className="h-3 w-3" />
                  {verdictCfg.label}
                </span>
              )}
            </div>
            {(bullSignals > 0 || bearSignals > 0) && (
              <div className="flex items-center gap-2 mt-0.5">
                {bullSignals > 0 && <span className="text-[10px] text-gain">{bullSignals} boga</span>}
                {bearSignals > 0 && <span className="text-[10px] text-loss">{bearSignals} ayi</span>}
              </div>
            )}
          </div>
        </Link>

        <div className="text-right">
          {price != null ? (
            <>
              <p className="text-lg font-semibold text-foreground tabular-nums">₺{price.toFixed(2)}</p>
              {changePercent != null && (
                <div className={cn("flex items-center justify-end gap-0.5 text-xs font-medium", isPositive ? "text-gain" : "text-loss")}>
                  {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {isPositive ? "+" : ""}{changePercent.toFixed(2)}%
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
        </div>
      </div>

      <div className="h-px bg-border/30 mb-4" />

      {/* Today: AI Akilli Ozet */}
      {isToday && (
        <AiInsightCard title="Akilli Ozet" icon={Sparkles} loading={aiLoading} error={aiError}>
          {aiOzet && (
            <div className="space-y-2">
              <p className="text-[12px] font-medium text-foreground leading-relaxed">{aiOzet.tldr}</p>

              <div className="space-y-0.5">
                {aiOzet.bullets.slice(0, 4).map((b, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[11px]">
                    <span className="shrink-0">{b.icon}</span>
                    <span className="text-muted-foreground leading-relaxed">{b.text}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                {([
                  { key: "shortTerm", label: "Kisa Vade", icon: Clock },
                  { key: "mediumTerm", label: "Orta Vade", icon: Eye },
                  { key: "longTerm", label: "Uzun Vade", icon: TrendingUp },
                ] as const).map(({ key, label, icon: Icon }) => (
                  <div key={key} className="rounded-md bg-card/30 border border-border/10 p-1.5">
                    <div className="flex items-center gap-1 mb-0.5">
                      <Icon className="h-2.5 w-2.5 text-muted-foreground/40" />
                      <span className="text-[8px] text-muted-foreground/50 font-medium">{label}</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground/70 leading-relaxed">{aiOzet.timeHorizon[key]}</p>
                  </div>
                ))}
              </div>

              {aiOzet.watchlist.length > 0 && (
                <div className="pt-1 border-t border-border/10">
                  <div className="flex flex-wrap gap-1">
                    {aiOzet.watchlist.map((w, i) => (
                      <span key={i} className="text-[9px] text-muted-foreground/60 bg-card/40 px-1.5 py-0.5 rounded">{w}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </AiInsightCard>
      )}

      {/* Week/Month: Period AI Analysis */}
      {!isToday && periodAi?.summaryText && (
        <div className="space-y-3">
          <div className="rounded-xl border-l-2 border-l-ai-primary border border-ai-primary/15 bg-gradient-to-r from-ai-primary/5 to-transparent p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-ai-primary" />
              <span className="text-xs font-semibold text-foreground">
                {period === "week" ? "Haftalik" : "Aylik"} Analiz
              </span>
              {periodAi.confidence && (
                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-ai-primary/10 text-ai-primary ml-auto">{periodAi.confidence}</span>
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">{periodAi.summaryText}</p>
          </div>

          {(periodAi.bullCase || periodAi.bearCase) && (
            <div className="grid grid-cols-2 gap-2">
              {periodAi.bullCase && (
                <div className="rounded-lg bg-gain/5 border border-gain/10 p-2.5">
                  <div className="flex items-center gap-1 mb-1">
                    <TrendingUp className="h-3 w-3 text-gain" />
                    <span className="text-[9px] font-medium text-gain uppercase">Boga</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{periodAi.bullCase}</p>
                </div>
              )}
              {periodAi.bearCase && (
                <div className="rounded-lg bg-loss/5 border border-loss/10 p-2.5">
                  <div className="flex items-center gap-1 mb-1">
                    <TrendingDown className="h-3 w-3 text-loss" />
                    <span className="text-[9px] font-medium text-loss uppercase">Ayi</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{periodAi.bearCase}</p>
                </div>
              )}
            </div>
          )}

          <p className="text-[9px] text-muted-foreground/40 pt-1 border-t border-border/10">
            Yatirim tavsiyesi degildir. Kararlarinizi kendi arastirmaniza dayandirin.
          </p>
        </div>
      )}

      {/* Week/Month: No AI fallback - show score summary */}
      {!isToday && !periodAi?.summaryText && score && (
        <div className="rounded-lg border border-border/20 bg-card/20 p-3">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {stockCode} {period === "week" ? "haftalik" : "aylik"} bazda {score.composite}/100 puan.
            Teknik: {score.technical}, Momentum: {score.momentum}, Hacim: {score.volume}.
          </p>
        </div>
      )}

      <SpkDisclaimer />
    </div>
  );
}
