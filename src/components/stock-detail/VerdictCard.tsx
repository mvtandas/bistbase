"use client";

import { cn } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, Minus, ShieldAlert, Info,
  ChevronRight, BarChart3, DollarSign, Zap, Target,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { calculateVerdict, type VerdictAction, type Verdict, type VerdictInput } from "@/lib/stock/verdict";
import type { StockDetail } from "@/components/stock-detail/types";

/* ═══ Colour config ═══ */

const ACTION_CONFIG: Record<VerdictAction, {
  gradient: string; glow: string; border: string; text: string;
  accent: string; ring: string; icon: typeof TrendingUp; arcStroke: string;
}> = {
  GUCLU_AL: { gradient: "from-gain/15 via-gain/5 to-transparent", glow: "shadow-[0_0_40px_-8px] shadow-gain/25", border: "border-gain/30", text: "text-gain", accent: "bg-gain", ring: "ring-gain/20", icon: TrendingUp, arcStroke: "stroke-gain" },
  AL: { gradient: "from-gain/10 via-gain/3 to-transparent", glow: "shadow-[0_0_30px_-8px] shadow-gain/15", border: "border-gain/20", text: "text-gain", accent: "bg-gain", ring: "ring-gain/15", icon: TrendingUp, arcStroke: "stroke-gain" },
  TUT: { gradient: "from-amber-400/10 via-amber-400/3 to-transparent", glow: "shadow-[0_0_30px_-8px] shadow-amber-400/15", border: "border-amber-400/20", text: "text-amber-400", accent: "bg-amber-400", ring: "ring-amber-400/15", icon: Minus, arcStroke: "stroke-amber-400" },
  SAT: { gradient: "from-loss/10 via-loss/3 to-transparent", glow: "shadow-[0_0_30px_-8px] shadow-loss/15", border: "border-loss/20", text: "text-loss", accent: "bg-loss", ring: "ring-loss/15", icon: TrendingDown, arcStroke: "stroke-loss" },
  GUCLU_SAT: { gradient: "from-loss/15 via-loss/5 to-transparent", glow: "shadow-[0_0_40px_-8px] shadow-loss/25", border: "border-loss/30", text: "text-loss", accent: "bg-loss", ring: "ring-loss/20", icon: TrendingDown, arcStroke: "stroke-loss" },
};

/* ═══ Mini components ═══ */

function VerdictArc({ score, strokeClass }: { score: number; strokeClass: string }) {
  const radius = 40;
  const circumference = Math.PI * radius;
  const pct = Math.max(0, Math.min(100, (score + 1) * 50));
  const dashOffset = circumference - (pct / 100) * circumference;
  const textColor = strokeClass.replace("stroke-", "text-");

  return (
    <div className="relative w-[80px] h-[48px]">
      <svg viewBox="0 0 100 55" className="w-full h-full" fill="none">
        <path d="M 10 50 A 40 40 0 0 1 90 50" stroke="currentColor" strokeWidth="5" strokeLinecap="round" className="text-border/20" />
        <path d="M 10 50 A 40 40 0 0 1 90 50" strokeWidth="5" strokeLinecap="round" className={strokeClass} strokeDasharray={circumference} strokeDashoffset={dashOffset} style={{ transition: "stroke-dashoffset 1s ease-out" }} />
      </svg>
      <div className="absolute inset-0 flex items-end justify-center pb-0">
        <span className={cn("text-lg font-extrabold tabular-nums", textColor)}>
          {score > 0 ? "+" : ""}{score.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

function PillarBar({ label, rating, icon: Icon }: {
  label: string; rating: number; icon: typeof BarChart3;
}) {
  const pct = ((rating + 1) / 2) * 100;
  const color = rating > 0.1 ? "bg-gain" : rating < -0.1 ? "bg-loss" : "bg-amber-400";
  const textColor = rating > 0.1 ? "text-gain" : rating < -0.1 ? "text-loss" : "text-amber-400";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3 w-3 text-muted-foreground/50" />
          <span className="text-[10px] font-medium text-muted-foreground/70">{label}</span>
        </div>
        <span className={cn("text-[10px] font-bold tabular-nums", textColor)}>
          {rating > 0 ? "+" : ""}{rating.toFixed(2)}
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-border/20 overflow-hidden">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border/40 z-10" />
        {rating > 0 ? (
          <div className={cn("absolute top-0 bottom-0 rounded-r-full", color)} style={{ left: "50%", width: `${(rating / 1) * 50}%`, transition: "width 0.8s ease-out" }} />
        ) : rating < 0 ? (
          <div className={cn("absolute top-0 bottom-0 rounded-l-full", color)} style={{ right: "50%", width: `${(Math.abs(rating) / 1) * 50}%`, transition: "width 0.8s ease-out" }} />
        ) : null}
        <div className={cn("absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border border-background", color)} style={{ left: `${clampPct(pct)}%`, transform: `translate(-50%, -50%)`, transition: "left 0.8s ease-out" }} />
      </div>
    </div>
  );
}

function clampPct(v: number) { return Math.max(4, Math.min(96, v)); }

const AGREEMENT_LABELS: Record<string, { label: string; color: string }> = {
  STRONG: { label: "Güçlü Uyum", color: "bg-gain/15 text-gain" },
  MODERATE: { label: "Orta Uyum", color: "bg-amber-400/15 text-amber-400" },
  WEAK: { label: "Zayıf Veri", color: "bg-muted text-muted-foreground" },
  CONFLICTING: { label: "Çakışma", color: "bg-loss/15 text-loss" },
};

/** verdictReason boşken otomatik özet üret */
function generateFallbackSummary(v: Verdict): string {
  const totalBuy = v.summary.totalBuy;
  const totalSell = v.summary.totalSell;
  const total = totalBuy + totalSell + v.summary.totalNeutral;

  if (v.action === "GUCLU_AL" || v.action === "AL") {
    return `${total} göstergeden ${totalBuy} tanesi alım yönünde. Teknik görünüm ${v.technical.rating > 0.3 ? "güçlü" : "olumlu"}, ${v.fundamental.rating > 0 ? "temel veriler destekliyor" : "temel veriler nötr"}.`;
  }
  if (v.action === "GUCLU_SAT" || v.action === "SAT") {
    return `${total} göstergeden ${totalSell} tanesi satış yönünde. Teknik görünüm ${v.technical.rating < -0.3 ? "zayıf" : "olumsuz"}, ${v.fundamental.rating < 0 ? "temel veriler de baskı altında" : "temel veriler nötr"}.`;
  }
  return `${total} göstergeden ${totalBuy} alım, ${totalSell} satış yönünde. Piyasa kararsız, net yön belirsiz.`;
}

/* ═══ Main Component ═══ */

interface VerdictAccuracy {
  winRate: number;
  totalVerdicts: number;
  byHorizon: {
    "20D": { winRate: number; sampleSize: number } | null;
    "10D": { winRate: number; sampleSize: number } | null;
  };
}

interface VerdictCardProps {
  d: StockDetail;
  sentimentValue?: number | null;
  verdictReason?: string | null;
  stockCode?: string;
}

export function VerdictCard({ d, sentimentValue, verdictReason, stockCode }: VerdictCardProps) {
  // Fetch accuracy data for this stock
  const { data: accuracy } = useQuery<VerdictAccuracy>({
    queryKey: ["verdict-accuracy", stockCode],
    queryFn: async () => {
      const r = await fetch(`/api/verdict-accuracy${stockCode ? `?stockCode=${stockCode}` : ""}`);
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!stockCode,
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  if (!d.price || !d.technicals) return null;

  const input: VerdictInput = {
    price: d.price,
    technicals: d.technicals as Record<string, unknown>,
    extraIndicators: d.extraIndicators,
    score: d.score,
    fundamentalScore: d.fundamentalScore,
    signals: d.signals,
    signalCombination: d.signalCombination,
    signalAccuracy: d.signalAccuracy,
    multiTimeframe: d.multiTimeframe,
    macroData: d.macroData,
    riskMetrics: d.riskMetrics,
    sentimentValue,
    signalBacktest: d.signalBacktest,
  };

  const v = calculateVerdict(input);
  const c = ACTION_CONFIG[v.action];
  const Icon = c.icon;
  const agree = AGREEMENT_LABELS[v.summary.interPillarAgreement] ?? AGREEMENT_LABELS.WEAK;

  const summaryText = verdictReason || generateFallbackSummary(v);

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl border backdrop-blur-sm",
      c.border, c.glow, "bg-gradient-to-br", c.gradient,
    )}>
      {/* Radial glow */}
      <div className={cn("absolute -top-10 -left-10 w-40 h-40 rounded-full blur-3xl opacity-20 pointer-events-none", c.accent)} />

      <div className="relative z-10 p-4 sm:p-5">
        {/* ── Header: Action + Arc ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-xl ring-1", c.ring, c.accent + "/10")}>
              <Icon className={cn("h-5 w-5 sm:h-6 sm:w-6", c.text)} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className={cn("text-lg sm:text-xl font-black tracking-tight leading-none", c.text)}>
                {v.actionLabel}
              </h3>
              <div className="flex items-center gap-1.5 sm:gap-2 mt-1 flex-wrap">
                <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-full",
                  v.confidenceLevel === "HIGH" ? "bg-gain/15 text-gain"
                    : v.confidenceLevel === "LOW" ? "bg-loss/15 text-loss"
                      : "bg-amber-400/15 text-amber-400",
                )}>
                  %{v.confidence} Güven
                </span>
                <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-full", agree.color)}>
                  {agree.label}
                </span>
                {accuracy && accuracy.totalVerdicts >= 10 && (
                  <span className={cn(
                    "text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-0.5",
                    accuracy.winRate >= 55 ? "bg-gain/15 text-gain"
                      : accuracy.winRate >= 45 ? "bg-amber-400/15 text-amber-400"
                        : "bg-loss/15 text-loss",
                  )}>
                    <Target className="h-2.5 w-2.5" />
                    %{accuracy.winRate.toFixed(0)} İsabet
                  </span>
                )}
              </div>
            </div>
          </div>
          <VerdictArc score={v.score} strokeClass={c.arcStroke} />
        </div>

        {/* ── Summary Text (AI or fallback) ── */}
        <p className="mt-3 text-[12px] sm:text-[12.5px] leading-relaxed text-foreground/85 font-medium">
          {summaryText}
        </p>

        {/* ── Three Pillar Bars ── */}
        <div className="mt-3 space-y-2.5 p-3 rounded-xl bg-card/30 border border-border/15">
          <PillarBar label="Teknik" rating={v.technical.rating} icon={BarChart3} />
          <div className="pl-5 space-y-1">
            <div className="flex items-center justify-between text-[9px]">
              <span className="text-muted-foreground/40">Hareketli Ort.</span>
              <span className="tabular-nums">
                <span className="text-gain font-medium">{v.technical.maBuy} AL</span>
                <span className="text-muted-foreground/30 mx-0.5">·</span>
                <span className="text-muted-foreground/40">{v.technical.maNeutral} Nötr</span>
                <span className="text-muted-foreground/30 mx-0.5">·</span>
                <span className="text-loss font-medium">{v.technical.maSell} SAT</span>
              </span>
            </div>
            <div className="flex items-center justify-between text-[9px]">
              <span className="text-muted-foreground/40">Osilatörler</span>
              <span className="tabular-nums">
                <span className="text-gain font-medium">{v.technical.oscBuy} AL</span>
                <span className="text-muted-foreground/30 mx-0.5">·</span>
                <span className="text-muted-foreground/40">{v.technical.oscNeutral} Nötr</span>
                <span className="text-muted-foreground/30 mx-0.5">·</span>
                <span className="text-loss font-medium">{v.technical.oscSell} SAT</span>
              </span>
            </div>
          </div>
          <PillarBar label="Temel" rating={v.fundamental.rating} icon={DollarSign} />
          <PillarBar label="Momentum & Akış" rating={v.flow.rating} icon={Zap} />
        </div>

        {/* ── Reasons ── */}
        <div className="mt-3 space-y-1.5">
          {v.topReasons.map((reason, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <ChevronRight className={cn("h-3 w-3 shrink-0 opacity-60", c.text)} />
              <span>{reason}</span>
            </div>
          ))}
        </div>

        {/* ── Strongest Bull vs Bear ── */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          <div className="flex items-start gap-1.5 px-2.5 py-2 rounded-lg bg-gain/5 border border-gain/10">
            <TrendingUp className="h-3 w-3 shrink-0 mt-0.5 text-gain/60" />
            <span className="text-[9px] sm:text-[10px] leading-tight text-gain/80 line-clamp-2">{v.strongestBull}</span>
          </div>
          <div className="flex items-start gap-1.5 px-2.5 py-2 rounded-lg bg-loss/5 border border-loss/10">
            <TrendingDown className="h-3 w-3 shrink-0 mt-0.5 text-loss/60" />
            <span className="text-[9px] sm:text-[10px] leading-tight text-loss/80 line-clamp-2">{v.strongestBear}</span>
          </div>
        </div>

        {/* ── Risk + Disclaimer ── */}
        <div className="mt-3 flex items-start gap-1.5 text-[10px] text-muted-foreground/50">
          <ShieldAlert className="h-3 w-3 shrink-0 mt-0.5" />
          <span>{v.riskNote}</span>
        </div>

        <div className="mt-2 pt-2 border-t border-border/10 flex items-center gap-1 text-[9px] text-muted-foreground/30">
          <Info className="h-2.5 w-2.5 shrink-0" />
          <span>Bu bir yatırım tavsiyesi değildir. Tüm yatırım kararları sizin sorumluluğunuzdadır.</span>
        </div>
      </div>
    </div>
  );
}
