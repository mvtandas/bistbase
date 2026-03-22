"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MetricCard } from "@/components/ui/metric-card";
import {
  Target,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
  ShieldCheck,
  Loader2,
  AlertTriangle,
} from "lucide-react";
// Types inlined to avoid importing server-only module
interface HorizonMetrics {
  winRate: number;
  avgReturn: number;
  avgWin: number;
  avgLoss: number;
  medianReturn: number;
  profitFactor: number;
  expectancy: number;
  sampleSize: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  bestReturn: number;
  worstReturn: number;
  stdDev: number;
}

interface VerdictPerformance {
  verdictAction: string;
  totalCount: number;
  horizons: Record<"1D" | "5D" | "10D" | "20D", HorizonMetrics | null>;
  highConfWinRate: number | null;
  lowConfWinRate: number | null;
  bestCall: { stockCode: string; date: string; returnPct: number } | null;
  worstCall: { stockCode: string; date: string; returnPct: number } | null;
  summaryTr: string;
}

interface PortfolioSimulation {
  startDate: string;
  endDate: string;
  initialCapital: number;
  finalValue: number;
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  maxDrawdownDuration: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  totalTrades: number;
  winRate: number;
  avgHoldingDays: number;
  totalCommission: number;
  benchmarkReturn: number;
  alpha: number;
  equityCurve: { date: string; value: number; benchmark: number }[];
  drawdownCurve: { date: string; drawdown: number }[];
  trades: unknown[];
}

interface VerdictBacktestResult {
  performances: VerdictPerformance[];
  simulation: PortfolioSimulation;
  overall: {
    totalVerdicts: number;
    overallWinRate: number;
    bestPerformingVerdict: string;
    worstPerformingVerdict: string;
    avgConfidenceAccuracy: { high: number; medium: number; low: number };
  };
  generatedAt: string;
  dataSpanDays: number;
}

const PERIODS = [
  { label: "30g", days: 30 },
  { label: "90g", days: 90 },
  { label: "180g", days: 180 },
];

const ACTION_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  GUCLU_AL: { label: "Güçlü Al", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  AL: { label: "Al", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
  TUT: { label: "Tut", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  SAT: { label: "Sat", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  GUCLU_SAT: { label: "Güçlü Sat", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
};

export function BacktestClient() {
  const [days, setDays] = useState(180);

  const { data, isLoading, error } = useQuery<VerdictBacktestResult>({
    queryKey: ["verdict-backtest", days],
    queryFn: async () => {
      const r = await fetch(`/api/verdict-backtest?days=${days}`);
      if (!r.ok) throw new Error(`API error: ${r.status}`);
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Target className="h-6 w-6 text-ai-primary" />
            Karar Performansı
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Verdiğimiz kararlar ne kadar tutarlı? Gerçek piyasa verileriyle backtest.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border/40 p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              onClick={() => setDays(p.days)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                days === p.days
                  ? "bg-ai-primary text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-loss/20 bg-loss/5 p-6 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto text-loss mb-2" />
          <p className="text-sm text-loss">Backtest verisi yüklenemedi.</p>
        </div>
      )}

      {data && (
        <>
          {/* Section 1: Overall Summary */}
          <OverallSummary data={data} />

          {/* Section 2: Verdict Performance Cards */}
          <VerdictCards performances={data.performances} />

          {/* Section 3: Portfolio Simulation */}
          <SimulationSection simulation={data.simulation} />

          {/* Section 4: Confidence Analysis */}
          <ConfidenceSection data={data} />

          {/* Section 5: Best/Worst Calls */}
          <BestWorstCalls performances={data.performances} />
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// Section 1: Overall Summary
// ═══════════════════════════════════════

function OverallSummary({ data }: { data: VerdictBacktestResult }) {
  const { overall, simulation } = data;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <MetricCard
        label="Toplam Karar"
        value={overall.totalVerdicts.toString()}
        interpretation={`${data.dataSpanDays} günlük veri`}
      />
      <MetricCard
        label="Genel İsabet"
        value={`%${overall.overallWinRate.toFixed(1)}`}
        status={overall.overallWinRate >= 55 ? "positive" : overall.overallWinRate >= 45 ? "neutral" : "negative"}
        interpretation={overall.overallWinRate >= 55 ? "Başarılı" : overall.overallWinRate >= 45 ? "Ortalama" : "Zayıf"}
      />
      <MetricCard
        label="Simülasyon Getiri"
        value={`%${simulation.totalReturn.toFixed(1)}`}
        status={simulation.totalReturn > 0 ? "positive" : simulation.totalReturn === 0 ? "neutral" : "negative"}
        interpretation={`Alpha: %${simulation.alpha.toFixed(1)}`}
      />
      <MetricCard
        label="BIST-100 Getiri"
        value={`%${simulation.benchmarkReturn.toFixed(1)}`}
        status={simulation.benchmarkReturn > 0 ? "positive" : "negative"}
        interpretation="Benchmark"
      />
    </div>
  );
}

// ═══════════════════════════════════════
// Section 2: Verdict Performance Cards
// ═══════════════════════════════════════

function VerdictCards({ performances }: { performances: VerdictPerformance[] }) {
  const order = ["GUCLU_AL", "AL", "TUT", "SAT", "GUCLU_SAT"];
  const sorted = [...performances].sort((a, b) => order.indexOf(a.verdictAction) - order.indexOf(b.verdictAction));

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
        <BarChart3 className="h-4 w-4" /> Karar Bazlı Performans
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {sorted.map((p) => (
          <VerdictCard key={p.verdictAction} perf={p} />
        ))}
        {sorted.length === 0 && (
          <p className="col-span-full text-sm text-muted-foreground text-center py-8">
            Henüz yeterli karar verisi yok.
          </p>
        )}
      </div>
    </div>
  );
}

function VerdictCard({ perf }: { perf: VerdictPerformance }) {
  const config = ACTION_CONFIG[perf.verdictAction] ?? { label: perf.verdictAction, color: "text-foreground", bg: "bg-card/20 border-border/25" };
  const isShort = perf.verdictAction === "SAT" || perf.verdictAction === "GUCLU_SAT";
  // Prefer 20D, fallback to 10D, 5D, 1D
  const horizon: HorizonMetrics | null = perf.horizons["20D"] ?? perf.horizons["10D"] ?? perf.horizons["5D"] ?? perf.horizons["1D"];
  const horizonLabel = perf.horizons["20D"] ? "20G" : perf.horizons["10D"] ? "10G" : perf.horizons["5D"] ? "5G" : "1G";

  // SAT'ta pozitif getiri kötü (fiyat yükselmemeli), AL'da pozitif iyi
  const returnColor = (r: number) => {
    const good = isShort ? r < 0 : r > 0;
    return good ? "text-gain" : "text-loss";
  };

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${config.bg}`}>
      <div className="flex items-center justify-between">
        <span className={`text-sm font-bold ${config.color}`}>{config.label}</span>
        <span className="text-[10px] text-muted-foreground/50">{perf.totalCount} karar</span>
      </div>

      {horizon ? (
        <>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Win Rate ({horizonLabel})</span>
              <span className={`font-bold ${horizon.winRate >= 55 ? "text-gain" : horizon.winRate >= 45 ? "text-amber-400" : "text-loss"}`}>
                %{horizon.winRate.toFixed(1)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Ort. Getiri</span>
              <span className={`font-bold ${returnColor(horizon.avgReturn)}`}>
                %{horizon.avgReturn.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Profit Factor</span>
              <span className="font-semibold text-foreground">{horizon.profitFactor.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Expectancy</span>
              <span className={`font-semibold ${horizon.expectancy > 0 ? "text-gain" : "text-loss"}`}>
                {horizon.expectancy > 0 ? "+" : ""}{horizon.expectancy.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Win rate bar */}
          <div className="w-full bg-muted/30 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${
                horizon.winRate >= 55 ? "bg-gain" : horizon.winRate >= 45 ? "bg-amber-400" : "bg-loss"
              }`}
              style={{ width: `${Math.min(horizon.winRate, 100)}%` }}
            />
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground/50 py-3">Henüz yeterli veri yok</p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// Section 3: Simulation
// ═══════════════════════════════════════

function SimulationSection({ simulation }: { simulation: VerdictBacktestResult["simulation"] }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
        <Activity className="h-4 w-4" /> Portföy Simülasyonu (BIST-Gerçekçi)
      </h2>

      {/* Equity Curve */}
      {simulation.equityCurve.length > 1 && (
        <div className="rounded-xl border border-border/25 bg-card/20 backdrop-blur-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-muted-foreground">Equity Curve vs BIST-100</span>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-ai-primary rounded" /> Portföy</span>
              <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-muted-foreground/50 rounded" /> BIST-100</span>
            </div>
          </div>
          <MiniEquityCurve data={simulation.equityCurve} />
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <MetricCard
          label="Toplam Getiri"
          value={`%${simulation.totalReturn.toFixed(1)}`}
          status={simulation.totalReturn > 0 ? "positive" : "negative"}
        />
        <MetricCard
          label="Yıllık Getiri"
          value={`%${simulation.annualizedReturn.toFixed(1)}`}
          status={simulation.annualizedReturn > 0 ? "positive" : "negative"}
        />
        <MetricCard
          label="Max Drawdown"
          value={`%${simulation.maxDrawdown.toFixed(1)}`}
          status={simulation.maxDrawdown < 10 ? "positive" : simulation.maxDrawdown < 20 ? "neutral" : "negative"}
          interpretation={`${simulation.maxDrawdownDuration}g sürdü`}
        />
        <MetricCard
          label="Sharpe"
          value={simulation.sharpeRatio.toFixed(2)}
          status={simulation.sharpeRatio > 1 ? "positive" : simulation.sharpeRatio > 0 ? "neutral" : "negative"}
        />
        <MetricCard
          label="Sortino"
          value={simulation.sortinoRatio.toFixed(2)}
          status={simulation.sortinoRatio > 1 ? "positive" : simulation.sortinoRatio > 0 ? "neutral" : "negative"}
        />
        <MetricCard
          label="Calmar"
          value={simulation.calmarRatio.toFixed(2)}
          status={simulation.calmarRatio > 1 ? "positive" : simulation.calmarRatio > 0 ? "neutral" : "negative"}
        />
      </div>

      {/* Trade Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Toplam İşlem"
          value={simulation.totalTrades.toString()}
          interpretation={`Win rate: %${simulation.winRate.toFixed(0)}`}
        />
        <MetricCard
          label="Ort. Pozisyon Süresi"
          value={`${simulation.avgHoldingDays.toFixed(0)}g`}
        />
        <MetricCard
          label="Toplam Komisyon"
          value={`₺${simulation.totalCommission.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}`}
          interpretation="Komisyon + BSMV"
        />
        <MetricCard
          label="Alpha"
          value={`%${simulation.alpha.toFixed(1)}`}
          status={simulation.alpha > 0 ? "positive" : simulation.alpha === 0 ? "neutral" : "negative"}
          interpretation="vs BIST-100"
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Section 4: Confidence Analysis
// ═══════════════════════════════════════

function ConfidenceSection({ data }: { data: VerdictBacktestResult }) {
  const { avgConfidenceAccuracy } = data.overall;
  const hasData = avgConfidenceAccuracy.high > 0 || avgConfidenceAccuracy.medium > 0 || avgConfidenceAccuracy.low > 0;

  if (!hasData) return null;

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4" /> Güven Seviyesi Analizi
      </h2>
      <div className="rounded-xl border border-border/25 bg-card/20 backdrop-blur-sm p-5">
        <p className="text-xs text-muted-foreground mb-4">
          Güven seviyemiz arttıkça isabetimiz de artıyor mu?
        </p>
        <div className="grid grid-cols-3 gap-4">
          <ConfidenceBar label="Yüksek Güven" sublabel="≥65" rate={avgConfidenceAccuracy.high} color="bg-emerald-500" />
          <ConfidenceBar label="Orta Güven" sublabel="45-64" rate={avgConfidenceAccuracy.medium} color="bg-amber-500" />
          <ConfidenceBar label="Düşük Güven" sublabel="<45" rate={avgConfidenceAccuracy.low} color="bg-red-500" />
        </div>
      </div>
    </div>
  );
}

function ConfidenceBar({ label, sublabel, rate, color }: { label: string; sublabel: string; rate: number; color: string }) {
  return (
    <div className="text-center space-y-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-[10px] text-muted-foreground/50">{sublabel}</div>
      <div className="mx-auto w-full max-w-[80px] bg-muted/30 rounded-full h-24 relative overflow-hidden flex items-end">
        <div
          className={`w-full rounded-full transition-all ${color}`}
          style={{ height: `${Math.max(rate, 5)}%` }}
        />
      </div>
      <div className={`text-lg font-bold ${rate >= 55 ? "text-gain" : rate >= 45 ? "text-amber-400" : "text-loss"}`}>
        %{rate.toFixed(0)}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Section 5: Best/Worst Calls
// ═══════════════════════════════════════

function BestWorstCalls({ performances }: { performances: VerdictPerformance[] }) {
  const best = performances
    .filter((p) => p.bestCall)
    .map((p) => ({ ...p.bestCall!, verdict: p.verdictAction }))
    .sort((a, b) => b.returnPct - a.returnPct)
    .slice(0, 10);

  const worst = performances
    .filter((p) => p.worstCall)
    .map((p) => ({ ...p.worstCall!, verdict: p.verdictAction }))
    .sort((a, b) => a.returnPct - b.returnPct)
    .slice(0, 10);

  if (best.length === 0 && worst.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {best.length > 0 && (
        <div className="rounded-xl border border-gain/15 bg-card/20 backdrop-blur-sm p-4">
          <h3 className="text-sm font-semibold text-gain flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4" /> En İyi Kararlar
          </h3>
          <div className="space-y-2">
            {best.map((call, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-border/10 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">{call.stockCode}</span>
                  <span className="text-muted-foreground/50">{call.date}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${ACTION_CONFIG[call.verdict]?.bg ?? ""}`}>
                    {ACTION_CONFIG[call.verdict]?.label ?? call.verdict}
                  </span>
                </div>
                <span className="font-bold text-gain">%{call.returnPct > 0 ? "+" : ""}{call.returnPct.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {worst.length > 0 && (
        <div className="rounded-xl border border-loss/15 bg-card/20 backdrop-blur-sm p-4">
          <h3 className="text-sm font-semibold text-loss flex items-center gap-2 mb-3">
            <TrendingDown className="h-4 w-4" /> En Kötü Kararlar
          </h3>
          <div className="space-y-2">
            {worst.map((call, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-border/10 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">{call.stockCode}</span>
                  <span className="text-muted-foreground/50">{call.date}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${ACTION_CONFIG[call.verdict]?.bg ?? ""}`}>
                    {ACTION_CONFIG[call.verdict]?.label ?? call.verdict}
                  </span>
                </div>
                <span className="font-bold text-loss">%{call.returnPct > 0 ? "+" : ""}{call.returnPct.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// Mini Equity Curve (SVG)
// ═══════════════════════════════════════

function MiniEquityCurve({ data }: { data: { date: string; value: number; benchmark: number }[] }) {
  if (data.length < 2) return null;

  const W = 700;
  const H = 180;
  const PAD = 10;

  const allValues = [...data.map((d) => d.value), ...data.map((d) => d.benchmark)];
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const range = maxVal - minVal || 1;

  const toX = (i: number) => PAD + (i / (data.length - 1)) * (W - 2 * PAD);
  const toY = (v: number) => H - PAD - ((v - minVal) / range) * (H - 2 * PAD);

  const portfolioLine = data.map((d, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(d.value).toFixed(1)}`).join(" ");
  const benchmarkLine = data.map((d, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(d.benchmark).toFixed(1)}`).join(" ");

  // Area fill for portfolio
  const areaPath = portfolioLine + ` L${toX(data.length - 1).toFixed(1)},${H - PAD} L${PAD},${H - PAD} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[180px]" preserveAspectRatio="none">
      {/* Portfolio area */}
      <path d={areaPath} fill="url(#portfolioGrad)" opacity="0.15" />
      {/* Benchmark line */}
      <path d={benchmarkLine} fill="none" stroke="currentColor" strokeWidth="1" opacity="0.2" className="text-muted-foreground" />
      {/* Portfolio line */}
      <path d={portfolioLine} fill="none" stroke="var(--color-ai-primary, #6366f1)" strokeWidth="2" />
      <defs>
        <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-ai-primary, #6366f1)" />
          <stop offset="100%" stopColor="var(--color-ai-primary, #6366f1)" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
