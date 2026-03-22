"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { SignalBadge } from "@/components/dashboard/signal-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles, TrendingUp, TrendingDown,
  Activity, Zap, BarChart3, DollarSign,
  Globe, Shield, Target,
} from "lucide-react";
import { SectionHeader, FactorBar } from "@/components/stock-detail/shared";
import { VerdictCard } from "@/components/stock-detail/VerdictCard";
import { PERIOD_LABELS } from "@/components/stock-detail/types";
import type { StockDetail, Summary, Period } from "@/components/stock-detail/types";

interface SummaryTabProps {
  d: StockDetail;
  data: StockDetail;
  period: Period;
  summaries: Summary[];
  pdLoading: boolean;
  pd: any;
  stockCode: string;
  timeLabel: "realtime" | "daily" | "weekly" | "monthly";
  onTabChange: (tab: string) => void;
}

export function SummaryTab({ d, data, period, summaries, pdLoading, pd, stockCode, timeLabel, onTabChange }: SummaryTabProps) {
  const [showHistory, setShowHistory] = useState(false);

  const isToday = period === "today";
  const tfLabel = PERIOD_LABELS[period];

  // AI source: daily -> cron summaries[0], period -> period API response
  const ai = !isToday ? (pd?.aiAnalysis as { summaryText: string; bullCase: string; bearCase: string; sentimentValue: number; confidence: string } | null) : null;
  const cs = isToday && summaries.length > 0 ? summaries[0] : null;

  // Fallback: build from live data if no AI text
  const liveScore = d?.score;
  const liveTech = d?.technicals as Record<string, number | string | null> | null;
  let fallbackText: string | null = null;
  let fallbackBull: string | null = null;
  let fallbackBear: string | null = null;
  const isFallback = !cs?.aiSummaryText && !ai?.summaryText;

  if (isFallback && liveScore && liveTech) {
    const label = liveScore.composite >= 65 ? "güçlü pozitif" : liveScore.composite >= 55 ? "pozitif" : liveScore.composite >= 45 ? "nötr" : liveScore.composite >= 35 ? "negatif" : "güçlü negatif";
    const rsi = liveTech.rsi14 as number | null;
    const rsiLabel = rsi != null ? (rsi >= 70 ? "aşırı alım" : rsi <= 30 ? "aşırı satım" : "normal") : null;
    const trend = liveTech.maAlignment as string | null;
    const trendLabel = trend === "STRONG_BULLISH" ? "güçlü yükseliş" : trend === "BULLISH" ? "yükseliş" : trend === "BEARISH" ? "düşüş" : trend === "STRONG_BEARISH" ? "güçlü düşüş" : "karışık";
    const sigBull = d?.signals?.filter((s: { direction: string }) => s.direction === "BULLISH").length ?? 0;
    const sigBear = d?.signals?.filter((s: { direction: string }) => s.direction === "BEARISH").length ?? 0;
    fallbackText = [
      `${stockCode} ${liveScore.composite}/100 puanla ${label} görünüm sergiliyor.`,
      `Teknik: ${liveScore.technical}, Momentum: ${liveScore.momentum}, Hacim: ${liveScore.volume}, Temel: ${liveScore.fundamental}.`,
      rsiLabel ? `RSI ${rsi?.toFixed(0)} (${rsiLabel}).` : null,
      `Trend: ${trendLabel}.`,
      sigBull + sigBear > 0 ? `${sigBull} boğa, ${sigBear} ayı sinyali aktif.` : null,
    ].filter(Boolean).join(" ");
    fallbackBull = [
      liveTech.support != null ? `Destek: ₺${liveTech.support}.` : null,
      liveScore.technical >= 50 ? `Teknik görünüm olumlu (${liveScore.technical}/100).` : null,
      sigBull > 0 ? `${sigBull} boğa sinyali mevcut.` : null,
    ].filter(Boolean).join(" ") || null;
    fallbackBear = [
      liveTech.resistance != null ? `Direnç: ₺${liveTech.resistance}.` : null,
      liveScore.technical < 50 ? `Teknik görünüm zayıf (${liveScore.technical}/100).` : null,
      sigBear > 0 ? `${sigBear} ayı sinyali mevcut.` : null,
    ].filter(Boolean).join(" ") || null;
  }

  // Unified values
  const text = (isToday ? cs?.aiSummaryText : ai?.summaryText) ?? fallbackText;
  const bull = (isToday ? cs?.bullCase : ai?.bullCase) ?? fallbackBull;
  const bear = (isToday ? cs?.bearCase : ai?.bearCase) ?? fallbackBear;
  const hasAI = !!text;

  // History
  const history: { id: string; date: string; aiSummaryText: string | null; closePrice: number | null; compositeScore: number | null }[] =
    isToday ? summaries.slice(1) : (pd?.pastAnalyses ?? []);

  // Top 3 signals by strength
  const topSignals = [...(d.signals ?? [])].sort((a, b) => b.strength - a.strength).slice(0, 3);

  // Score drift
  const todaySummary = summaries[0];
  const liveScoreVal = data?.score?.composite;
  const dailyScoreVal = todaySummary?.compositeScore;
  const scoreDiff = liveScoreVal != null && dailyScoreVal != null ? Math.abs(liveScoreVal - dailyScoreVal) : 0;

  // Verdict data
  const verdictSentiment = isToday ? (cs?.sentimentScore === "POSITIVE" ? 50 : cs?.sentimentScore === "NEGATIVE" ? -50 : 0) : (ai?.sentimentValue ?? null);
  const verdictReasonText = isToday ? cs?.verdictReason : (pd?.aiAnalysis as { verdictReason?: string } | null)?.verdictReason ?? cs?.verdictReason;

  return (
    <div className="space-y-4">
      {/* Verdict */}
      <VerdictCard
        d={d}
        sentimentValue={verdictSentiment}
        verdictReason={verdictReasonText}
      />

      {/* AI Analysis */}
      <div>
        <SectionHeader icon={Sparkles} label={`${tfLabel} AI Analizi`} timeLabel={timeLabel} />

        {/* Loading */}
        {!isToday && pdLoading && (
          <div className="rounded-xl border border-ai-primary/20 bg-ai-primary/5 p-6">
            <div className="flex items-center gap-2 text-ai-primary">
              <Sparkles className="h-4 w-4 animate-pulse" />
              <span className="text-sm font-medium">{tfLabel} analizi yükleniyor...</span>
            </div>
            <div className="mt-3 space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-4 w-3/5" /></div>
          </div>
        )}

        {/* Main AI card */}
        {hasAI && (
          <div className="rounded-xl border border-ai-primary/20 bg-ai-primary/5 p-4">
            {/* AI source badge */}
            <div className="flex items-center gap-2 mb-2">
              {isFallback ? (
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/30">Otomatik Analiz</span>
              ) : (
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-ai-primary/10 text-ai-primary border border-ai-primary/20">AI Destekli</span>
              )}
            </div>

            <p className="text-[12px] leading-relaxed text-foreground mb-3">{text}</p>
            {(bull || bear) && (
              <div className="grid grid-cols-2 gap-3">
                {bull && (
                  <div className="rounded-lg border border-gain/15 bg-gain/5 p-3">
                    <div className="flex items-center gap-1.5 mb-1.5"><TrendingUp className="h-3 w-3 text-gain" /><span className="text-[10px] font-medium text-gain uppercase">Boğa</span></div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">{bull}</p>
                  </div>
                )}
                {bear && (
                  <div className="rounded-lg border border-loss/15 bg-loss/5 p-3">
                    <div className="flex items-center gap-1.5 mb-1.5"><TrendingDown className="h-3 w-3 text-loss" /><span className="text-[10px] font-medium text-loss uppercase">Ayı</span></div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">{bear}</p>
                  </div>
                )}
              </div>
            )}
            {ai && ai.sentimentValue != null && (
              <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/20 text-[10px] text-muted-foreground/60">
                <span>Duyarlılık: <span className={cn("font-medium", ai.sentimentValue > 0 ? "text-gain" : ai.sentimentValue < 0 ? "text-loss" : "text-muted-foreground")}>{ai.sentimentValue > 0 ? "+" : ""}{ai.sentimentValue}</span></span>
                <span>Güven: <span className="font-medium text-foreground">{ai.confidence === "HIGH" ? "Yüksek" : ai.confidence === "LOW" ? "Düşük" : "Orta"}</span></span>
              </div>
            )}
          </div>
        )}

        {/* No AI available */}
        {!isToday && !pdLoading && !hasAI && (
          <div className="rounded-xl border border-border/40 bg-card/30 p-6 text-center">
            <p className="text-sm text-muted-foreground">AI analizi üretilemedi.</p>
          </div>
        )}

        {/* Past analyses */}
        {history.length > 0 && (
          <div className="mt-4">
            <button onClick={() => setShowHistory(!showHistory)} className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-border/30 bg-card/30 text-[11px] text-muted-foreground hover:text-foreground hover:bg-card/50 transition-all">
              <Sparkles className="h-3 w-3" />
              {showHistory ? "Geçmişi gizle" : `Geçmiş analizleri göster (${history.length})`}
            </button>
            {showHistory && (
              <div className="space-y-2 mt-2">
                {history.map((s: any) => (
                  <div key={s.id} className="rounded-lg border border-border/30 bg-card/20 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-muted-foreground/50">{new Date(s.date).toLocaleDateString("tr-TR", { weekday: "short", day: "numeric", month: "short" })}</span>
                      <div className="flex items-center gap-1.5">
                        {s.closePrice != null && <span className="text-[10px] text-muted-foreground tabular-nums">₺{s.closePrice.toFixed(2)}</span>}
                        {s.compositeScore != null && <span className={cn("text-[9px] font-bold tabular-nums px-1 py-0.5 rounded", s.compositeScore >= 58 ? "bg-gain/10 text-gain" : s.compositeScore >= 42 ? "bg-amber-400/10 text-amber-400" : "bg-loss/10 text-loss")}>{s.compositeScore}</span>}
                      </div>
                    </div>
                    {s.aiSummaryText && <p className="text-[11px] leading-relaxed text-muted-foreground">{s.aiSummaryText}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Factor Breakdown */}
      {!d?.score && (
        <div className="rounded-xl border border-border/40 bg-card/30 p-4 text-center">
          <p className="text-xs text-muted-foreground">Skor verisi şu anda alınamıyor. Piyasa kapalı olabilir veya yeterli geçmiş veri yok.</p>
        </div>
      )}
      {d.score && (
        <div className="rounded-xl border border-border/40 bg-card/30 p-4">
          <SectionHeader icon={Target} label="Faktör Analizi" subtitle="Hisseyi 8 farklı açıdan değerlendiren bileşik skor. Yeşil güçlü, kırmızı zayıf." tooltip="Teknik, temel, makro, hacim, momentum, sentiment, volatilite ve para akışı olmak üzere 8 farklı açıdan değerlendiren skor sistemi." timeLabel={timeLabel} />
          <div className="space-y-2">
            <FactorBar label="Teknik" value={d.score.technical} icon={Activity} factorKey="technical" />
            <FactorBar label="Momentum" value={d.score.momentum} icon={Zap} factorKey="momentum" />
            <FactorBar label="Hacim+Akış" value={d.score.volume} icon={BarChart3} factorKey="volume" />
            <FactorBar label="Temel" value={d.score.fundamental} icon={DollarSign} factorKey="fundamental" />
            <FactorBar label="Makro" value={d.score.macro} icon={Globe} factorKey="macro" />
            <FactorBar label="Duyarlılık" value={d.score.sentiment} icon={Sparkles} factorKey="sentiment" />
            <FactorBar label="Volatilite" value={d.score.volatility} icon={Shield} factorKey="volatility" />
          </div>
        </div>
      )}

      {/* Score drift warning (today only) */}
      {period === "today" && scoreDiff >= 10 && (
        <div className="bg-amber-400/10 border border-amber-400/20 rounded-xl p-3">
          <p className="text-[11px] text-amber-400 font-medium">Skor gün içinde değişti</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Anlık skor ({liveScoreVal}) ile günlük AI analizi ({dailyScoreVal}) arasında {Math.round(scoreDiff)} puan fark var. Piyasa gün içinde hareket etmiş olabilir.
          </p>
        </div>
      )}

      {/* Top 3 Signals with backtest badges */}
      {topSignals.length > 0 && (
        <div className="rounded-xl border border-border/40 bg-card/30 p-4">
          <SectionHeader icon={Zap} label="En Güçlü Sinyaller" subtitle="En yüksek güçlü aktif sinyaller ve kanıtlanmış başarı oranları." timeLabel={timeLabel} />
          <div className="space-y-3">
            {topSignals.map((s, i) => {
              const acc = d.signalAccuracy?.[s.type];
              const bt = d.signalBacktest?.performances?.find(p => p.signalType === s.type && p.signalDirection === s.direction);
              const hasBacktest = bt && bt.horizon1D.sampleSize >= 3;
              return (
                <div key={i} className="flex items-start gap-3">
                  <SignalBadge type={s.type} direction={s.direction} strength={s.strength} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{s.description}</p>
                    {hasBacktest ? (
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={cn("text-[10px] font-medium", bt.horizon1D.winRate >= 60 ? "text-gain" : bt.horizon1D.winRate >= 45 ? "text-amber-400" : "text-loss")}>
                          %{bt.horizon1D.winRate} başarı ({bt.horizon1D.sampleSize} sinyal)
                        </span>
                        {bt.horizon1D.profitFactor >= 1 && (
                          <span className="text-[9px] text-muted-foreground/50">
                            KF: {bt.horizon1D.profitFactor}x
                          </span>
                        )}
                        <span className={cn("text-[8px] px-1 py-0.5 rounded-full font-medium",
                          bt.confidence === "HIGH" ? "bg-gain/10 text-gain" : bt.confidence === "LOW" ? "bg-loss/10 text-loss" : "bg-amber-400/10 text-amber-400"
                        )}>
                          {bt.confidence === "HIGH" ? "Kanıtlanmış" : bt.confidence === "MEDIUM" ? "Orta Güven" : "Düşük Güven"}
                        </span>
                      </div>
                    ) : acc && acc.count >= 3 ? (
                      <p className={cn("text-[10px] mt-0.5 font-medium", acc.rate >= 70 ? "text-gain" : acc.rate >= 50 ? "text-amber-400" : "text-loss")}>
                        Geçmiş doğruluk: %{acc.rate} ({acc.count} sinyal)
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          {d.signals.length > 3 && (
            <button
              onClick={() => onTabChange("technical")}
              className="mt-3 w-full text-center text-[11px] text-ai-primary hover:underline"
            >
              Tüm sinyalleri ve performansları gör ({d.signals.length}) &rarr;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
