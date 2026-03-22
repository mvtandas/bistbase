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
import { AiInsightCard } from "@/components/stock-detail/AiInsightCard";
import { PERIOD_LABELS } from "@/components/stock-detail/types";
import type { StockDetail, Summary, Period } from "@/components/stock-detail/types";
import type { AkilliOzetOutput, GirisCikisOutput } from "@/lib/ai/types";

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
  akilliOzet: AkilliOzetOutput | null;
  aoLoading: boolean;
  aoError: boolean;
  girisCikis: GirisCikisOutput | null;
  gcLoading: boolean;
  gcError: boolean;
}

export function SummaryTab({ d, data, period, summaries, pdLoading, pd, stockCode, timeLabel, onTabChange, akilliOzet, aoLoading, aoError, girisCikis, gcLoading, gcError }: SummaryTabProps) {
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

  // Category colors for bullets
  const catColor: Record<string, string> = {
    technical: "text-ai-primary",
    fundamental: "text-amber-400",
    macro: "text-blue-400",
    risk: "text-loss",
  };

  return (
    <div className="space-y-3">
      {/* 1. Verdict — ana aksiyon, ilk bakışta durum */}
      <VerdictCard
        d={d}
        sentimentValue={verdictSentiment}
        verdictReason={verdictReasonText}
        stockCode={stockCode}
      />

      {/* 2. Akıllı Özet — AI brifing */}
      <AiInsightCard title="Akilli Ozet" icon={Sparkles} loading={aoLoading} error={aoError}>
        {akilliOzet && (
          <div className="space-y-2.5">
            <p className="text-sm font-semibold text-foreground leading-snug">{akilliOzet.tldr}</p>

            <div className="space-y-1">
              {akilliOzet.bullets.map((b, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-xs shrink-0 mt-0.5">{b.icon}</span>
                  <p className={cn("text-[11px] leading-relaxed", catColor[b.category] ?? "text-muted-foreground")}>{b.text}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/15">
              {[
                { label: "Kisa Vade", text: akilliOzet.timeHorizon.shortTerm },
                { label: "Orta Vade", text: akilliOzet.timeHorizon.mediumTerm },
                { label: "Uzun Vade", text: akilliOzet.timeHorizon.longTerm },
              ].map((h) => (
                <div key={h.label}>
                  <p className="text-[9px] text-muted-foreground/50 uppercase mb-0.5">{h.label}</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{h.text}</p>
                </div>
              ))}
            </div>

            {akilliOzet.watchlist.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/15">
                <span className="text-[9px] text-muted-foreground/50 uppercase mr-1 self-center">Izle:</span>
                {akilliOzet.watchlist.map((w, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20">{w}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </AiInsightCard>

      {/* 3. Faktör Analizi — hızlı tarama */}
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
          <p className="text-[11px] text-amber-400 font-medium">Skor gun icinde degisti</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Anlik skor ({liveScoreVal}) ile gunluk AI analizi ({dailyScoreVal}) arasinda {Math.round(scoreDiff)} puan fark var.
          </p>
        </div>
      )}

      {/* 4. Giriş-Çıkış Noktaları — compact layout */}
      <AiInsightCard title="Giris-Cikis Noktalari" icon={Target} loading={gcLoading} error={gcError}>
        {girisCikis && (
          <div className="space-y-2.5">
            {/* Setup header */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-foreground">{girisCikis.tradeSetupType}</span>
              <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded",
                girisCikis.setupQuality === "A" ? "bg-amber-300/20 text-amber-300" :
                girisCikis.setupQuality === "B" ? "bg-slate-300/20 text-slate-300" :
                "bg-orange-700/20 text-orange-400"
              )}>
                {girisCikis.setupQuality === "A" ? "A" : girisCikis.setupQuality === "B" ? "B" : "C"}
              </span>
            </div>

            {/* Entry + Exit grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Entry zones */}
              <div className="space-y-1.5">
                {girisCikis.entryZones.map((ez, i) => (
                  <div key={i} className="rounded-lg border border-gain/15 bg-gain/5 p-2.5">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] font-medium text-gain flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Giris {i + 1}</span>
                      <span className="text-[11px] font-bold text-gain tabular-nums">{ez.priceRange}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-snug">{ez.reasoning}</p>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {ez.confluence.map((c, j) => (
                        <span key={j} className="text-[9px] px-1 py-0.5 rounded bg-gain/10 text-gain/80">{c}</span>
                      ))}
                      {ez.riskReward && <span className="text-[9px] text-muted-foreground/40 ml-auto">{ez.riskReward}</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Exit targets */}
              <div className="space-y-1.5">
                {girisCikis.exitTargets.map((et, i) => (
                  <div key={i} className="rounded-lg border border-loss/15 bg-loss/5 p-2.5">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] font-medium text-loss flex items-center gap-1"><TrendingDown className="h-3 w-3" /> {et.type === "partial" ? "Kismi" : "Cikis"} {i + 1}</span>
                      <span className="text-[11px] font-bold text-loss tabular-nums">{et.price}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-snug">{et.reasoning}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Stop Loss — compact */}
            <div className="flex items-center gap-3 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2">
              <Shield className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-amber-400 font-medium">Stop-Loss: </span>
                <span className="text-[11px] font-bold text-amber-400 tabular-nums">{girisCikis.stopLoss.price}</span>
                <span className="text-[10px] text-muted-foreground/60 ml-1.5">{girisCikis.stopLoss.atrBased}</span>
              </div>
            </div>
          </div>
        )}
      </AiInsightCard>

      {/* 5. En Güçlü Sinyaller */}
      {topSignals.length > 0 && (
        <div className="rounded-xl border border-border/30 bg-card/30 p-4">
          <SectionHeader icon={Zap} label="En Guclu Sinyaller" subtitle="En yuksek guclu aktif sinyaller ve kanitlanmis basari oranlari." timeLabel={timeLabel} />
          <div className="space-y-2.5">
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
                          %{bt.horizon1D.winRate} basari ({bt.horizon1D.sampleSize} sinyal)
                        </span>
                        {bt.horizon1D.profitFactor >= 1 && (
                          <span className="text-[9px] text-muted-foreground/50">KF: {bt.horizon1D.profitFactor}x</span>
                        )}
                        <span className={cn("text-[9px] px-1 py-0.5 rounded-full font-medium",
                          bt.confidence === "HIGH" ? "bg-gain/10 text-gain" : bt.confidence === "LOW" ? "bg-loss/10 text-loss" : "bg-amber-400/10 text-amber-400"
                        )}>
                          {bt.confidence === "HIGH" ? "Kanitlanmis" : bt.confidence === "MEDIUM" ? "Orta" : "Dusuk"}
                        </span>
                      </div>
                    ) : acc && acc.count >= 3 ? (
                      <p className={cn("text-[10px] mt-0.5 font-medium", acc.rate >= 70 ? "text-gain" : acc.rate >= 50 ? "text-amber-400" : "text-loss")}>
                        Gecmis dogruluk: %{acc.rate} ({acc.count} sinyal)
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          {d.signals.length > 3 && (
            <button onClick={() => onTabChange("technical")} className="mt-3 w-full text-center text-[11px] text-ai-primary hover:underline">
              Tum sinyalleri gor ({d.signals.length}) &rarr;
            </button>
          )}
        </div>
      )}

      {/* 6. Geçmiş Analizler */}
      {history.length > 0 && (
        <div>
          <button onClick={() => setShowHistory(!showHistory)} className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-border/30 bg-card/20 text-[11px] text-muted-foreground hover:text-foreground hover:bg-card/40 transition-all">
            <Sparkles className="h-3 w-3" />
            {showHistory ? "Gecmisi gizle" : `Gecmis analizler (${history.length})`}
          </button>
          {showHistory && (
            <div className="space-y-1.5 mt-2">
              {history.map((s: any) => (
                <div key={s.id} className="rounded-lg border border-border/20 bg-card/20 p-2.5">
                  <div className="flex items-center justify-between mb-0.5">
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
  );
}
