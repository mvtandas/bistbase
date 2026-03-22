"use client";

import { cn } from "@/lib/utils";
import { SignalBadge } from "@/components/dashboard/signal-badge";
import { TrendingUp, TrendingDown, Trophy, AlertTriangle, BarChart3 } from "lucide-react";
import type { StockDetail } from "@/components/stock-detail/types";

type Signal = StockDetail["signals"][number];
type BacktestPerf = NonNullable<StockDetail["signalBacktest"]>["performances"][number];

/* ── Mini outcome dots (sparkline) ── */
function OutcomeDots({ outcomes }: { outcomes: BacktestPerf["recentOutcomes"] }) {
  if (outcomes.length === 0) return null;
  const reversed = [...outcomes].reverse(); // oldest first
  return (
    <div className="flex items-center gap-0.5">
      {reversed.map((o, i) => {
        const isWin = o.wasAccurate === true;
        const isLoss = o.wasAccurate === false;
        return (
          <div
            key={i}
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              isWin ? "bg-gain" : isLoss ? "bg-loss" : "bg-border/40",
            )}
            title={`${o.date}: ${o.outcome1D != null ? `${o.outcome1D > 0 ? "+" : ""}${o.outcome1D}%` : "—"}`}
          />
        );
      })}
    </div>
  );
}

/* ── Win rate bar ── */
function WinRateBar({ label, winRate, sampleSize }: { label: string; winRate: number; sampleSize: number }) {
  if (sampleSize < 2) return null;
  const color = winRate >= 60 ? "bg-gain" : winRate >= 45 ? "bg-amber-400" : "bg-loss";
  const textColor = winRate >= 60 ? "text-gain" : winRate >= 45 ? "text-amber-400" : "text-loss";

  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-muted-foreground/40 w-6 text-right">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-border/20 overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.min(100, winRate)}%`, transition: "width 0.8s ease-out" }} />
      </div>
      <span className={cn("text-[9px] font-bold tabular-nums w-8", textColor)}>%{winRate}</span>
      <span className="text-[8px] text-muted-foreground/30 tabular-nums w-6">({sampleSize})</span>
    </div>
  );
}

/* ── Single signal performance card ── */
function SignalPerfCard({ signal, perf }: { signal: Signal; perf: BacktestPerf }) {
  const confColor = perf.confidence === "HIGH" ? "bg-gain/15 text-gain"
    : perf.confidence === "LOW" ? "bg-loss/15 text-loss"
      : "bg-amber-400/15 text-amber-400";

  return (
    <div className="rounded-lg border border-border/30 bg-card/20 p-3 space-y-2">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <SignalBadge type={signal.type} direction={signal.direction} strength={signal.strength} />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{signal.description}</p>
          </div>
        </div>
        <span className={cn("text-[8px] font-semibold px-1.5 py-0.5 rounded-full shrink-0", confColor)}>
          %{perf.confidenceScore}
        </span>
      </div>

      {/* Summary */}
      <p className="text-[10px] font-medium text-foreground/80">{perf.summaryTr}</p>

      {/* Win rate bars */}
      <div className="space-y-1">
        <WinRateBar label="1G" winRate={perf.horizon1D.winRate} sampleSize={perf.horizon1D.sampleSize} />
        <WinRateBar label="5G" winRate={perf.horizon5D.winRate} sampleSize={perf.horizon5D.sampleSize} />
        <WinRateBar label="10G" winRate={perf.horizon10D.winRate} sampleSize={perf.horizon10D.sampleSize} />
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-4 gap-1.5">
        <div className="text-center">
          <div className="text-[9px] text-muted-foreground/40">Ort. Kazanç</div>
          <div className="text-[10px] font-bold text-gain tabular-nums">+{perf.horizon1D.avgWinPct}%</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] text-muted-foreground/40">Ort. Kayıp</div>
          <div className="text-[10px] font-bold text-loss tabular-nums">{perf.horizon1D.avgLossPct}%</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] text-muted-foreground/40">Kâr Faktörü</div>
          <div className={cn("text-[10px] font-bold tabular-nums", perf.horizon1D.profitFactor >= 1.5 ? "text-gain" : perf.horizon1D.profitFactor >= 1 ? "text-amber-400" : "text-loss")}>
            {perf.horizon1D.profitFactor}x
          </div>
        </div>
        <div className="text-center">
          <div className="text-[9px] text-muted-foreground/40">Maks Seri</div>
          <div className="text-[10px] font-bold tabular-nums">
            <span className="text-gain">{perf.streaks.maxConsecutiveWins}W</span>
            <span className="text-muted-foreground/30 mx-0.5">/</span>
            <span className="text-loss">{perf.streaks.maxConsecutiveLosses}L</span>
          </div>
        </div>
      </div>

      {/* Regime + Outcomes row */}
      <div className="flex items-center justify-between">
        {/* Regime pills */}
        <div className="flex items-center gap-1">
          {perf.regimePerformance.bullMarket && (
            <span className="text-[8px] px-1.5 py-0.5 rounded bg-gain/10 text-gain/70">
              Boğa %{perf.regimePerformance.bullMarket.winRate}
            </span>
          )}
          {perf.regimePerformance.bearMarket && (
            <span className="text-[8px] px-1.5 py-0.5 rounded bg-loss/10 text-loss/70">
              Ayı %{perf.regimePerformance.bearMarket.winRate}
            </span>
          )}
        </div>
        {/* Outcome dots */}
        <OutcomeDots outcomes={perf.recentOutcomes} />
      </div>

      {/* Best/Worst */}
      {(perf.bestOutcome || perf.worstOutcome) && (
        <div className="flex items-center justify-between text-[8px] text-muted-foreground/40 pt-1 border-t border-border/10">
          {perf.bestOutcome && (
            <span className="flex items-center gap-0.5">
              <Trophy className="h-2.5 w-2.5 text-gain/50" />
              En iyi: <span className="text-gain font-medium">{perf.bestOutcome.percent > 0 ? "+" : ""}{perf.bestOutcome.percent}%</span> ({perf.bestOutcome.date})
            </span>
          )}
          {perf.worstOutcome && (
            <span className="flex items-center gap-0.5">
              <AlertTriangle className="h-2.5 w-2.5 text-loss/50" />
              En kötü: <span className="text-loss font-medium">{perf.worstOutcome.percent > 0 ? "+" : ""}{perf.worstOutcome.percent}%</span> ({perf.worstOutcome.date})
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Fallback: basit sinyal gösterimi (backtest verisi yoksa) ── */
function SimpleSignalCard({ signal, accuracy }: { signal: Signal; accuracy?: { rate: number; count: number } }) {
  return (
    <div className="flex items-start gap-3">
      <SignalBadge type={signal.type} direction={signal.direction} strength={signal.strength} />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-muted-foreground leading-relaxed">{signal.description}</p>
        {accuracy && accuracy.count >= 3 && (
          <p className={cn("text-[10px] mt-0.5 font-medium", accuracy.rate >= 70 ? "text-gain" : accuracy.rate >= 50 ? "text-amber-400" : "text-loss")}>
            Geçmiş doğruluk: %{accuracy.rate} ({accuracy.count} sinyal)
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Main Export ── */
export function SignalPerformanceCard({ d }: { d: StockDetail }) {
  const signals = d.signals ?? [];
  const backtest = d.signalBacktest;
  const hasBacktest = backtest && backtest.performances.length > 0;

  if (signals.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Stats header */}
      {hasBacktest && backtest.totalSignalsAnalyzed > 0 && (
        <div className="flex items-center gap-2 text-[9px] text-muted-foreground/40">
          <BarChart3 className="h-3 w-3" />
          <span>Son {backtest.dataSpanDays} günde {backtest.totalSignalsAnalyzed} sinyal analiz edildi</span>
        </div>
      )}

      {signals.map((s, i) => {
        const perf = hasBacktest
          ? backtest.performances.find(p => p.signalType === s.type && p.signalDirection === s.direction)
          : undefined;

        if (perf && perf.horizon1D.sampleSize >= 3) {
          return <SignalPerfCard key={i} signal={s} perf={perf} />;
        }

        return <SimpleSignalCard key={i} signal={s} accuracy={d.signalAccuracy?.[s.type]} />;
      })}
    </div>
  );
}
