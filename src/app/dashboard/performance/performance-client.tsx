"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MetricCard } from "@/components/ui/metric-card";
import {
  Zap,
  TrendingUp,
  TrendingDown,
  BarChart3,
  ShieldAlert,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  CircleDollarSign,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";

// ═══ Types ═══

interface HorizonDetail {
  winRate: number;
  avgWinPct: number;
  avgLossPct: number;
  profitFactor: number;
  grossExpectancy: number;
  netExpectancy: number;
  sampleSize: number;
}

interface SignalTypePerformance {
  signalType: string;
  direction: string;
  totalCount: number;
  horizons: {
    "1D": HorizonDetail | null;
    "5D": HorizonDetail | null;
    "10D": HorizonDetail | null;
  };
  bestHorizon: "1D" | "5D" | "10D";
  netExpectancy: number;
  profitableAfterCosts: boolean;
  streaks: { maxWins: number; maxLosses: number };
}

interface SignalPerformanceResult {
  signals: SignalTypePerformance[];
  summary: {
    totalSignals: number;
    profitableSignalTypes: number;
    unprofitableSignalTypes: number;
    bestSignal: { type: string; direction: string; netExpectancy: number } | null;
    worstSignal: { type: string; direction: string; netExpectancy: number } | null;
    avgWinRate: number;
    avgProfitFactor: number;
    overallReadiness: "READY" | "NEEDS_WORK" | "NOT_READY";
    readinessReasons: string[];
  };
  dataSpanDays: number;
  generatedAt: string;
}

interface VerdictBacktestResult {
  performances: VerdictPerformance[];
  simulation: {
    totalReturn: number;
    annualizedReturn: number;
    maxDrawdown: number;
    sharpeRatio: number;
    sortinoRatio: number;
    totalTrades: number;
    winRate: number;
    totalCommission: number;
    benchmarkReturn: number;
    alpha: number;
    equityCurve: { date: string; value: number; benchmark: number }[];
  };
  overall: {
    totalVerdicts: number;
    overallWinRate: number;
    bestPerformingVerdict: string;
    worstPerformingVerdict: string;
    avgConfidenceAccuracy: { high: number; medium: number; low: number };
  };
  dataSpanDays: number;
}

interface VerdictPerformance {
  verdictAction: string;
  totalCount: number;
  horizons: Record<"1D" | "5D" | "10D" | "20D", {
    winRate: number;
    avgReturn: number;
    profitFactor: number;
    expectancy: number;
    sampleSize: number;
  } | null>;
  highConfWinRate: number | null;
  lowConfWinRate: number | null;
  summaryTr: string;
}

// ═══ Constants ═══

const PERIODS = [
  { label: "30g", days: 30 },
  { label: "90g", days: 90 },
  { label: "180g", days: 180 },
];

const SIGNAL_LABELS: Record<string, string> = {
  GOLDEN_CROSS: "Golden Cross",
  DEATH_CROSS: "Death Cross",
  MACD_BULLISH_CROSS: "MACD Bullish",
  MACD_BEARISH_CROSS: "MACD Bearish",
  RSI_OVERSOLD: "RSI Aşırı Satım",
  RSI_OVERBOUGHT: "RSI Aşırı Alım",
  RSI_BULLISH_DIVERGENCE: "RSI Bullish Diverjans",
  RSI_BEARISH_DIVERGENCE: "RSI Bearish Diverjans",
  BOLLINGER_SQUEEZE: "Bollinger Squeeze",
  BOLLINGER_UPPER_BREAK: "BB Üst Kırılım",
  BOLLINGER_LOWER_BREAK: "BB Alt Kırılım",
  VOLUME_ANOMALY: "Hacim Anomalisi",
  MA_ALIGNMENT_BULLISH: "MA Uyumu (Yükseliş)",
  MA_ALIGNMENT_BEARISH: "MA Uyumu (Düşüş)",
  STOCHASTIC_OVERSOLD: "Stochastic Aşırı Satım",
  STOCHASTIC_OVERBOUGHT: "Stochastic Aşırı Alım",
  ADX_STRONG_TREND: "ADX Güçlü Trend",
  SUPPORT_BREAK: "Destek Kırılımı",
  RESISTANCE_BREAK: "Direnç Kırılımı",
  OBV_DIVERGENCE: "OBV Diverjans",
  CMF_ACCUMULATION: "CMF Birikim",
  CMF_DISTRIBUTION: "CMF Dağıtım",
  MFI_OVERSOLD: "MFI Aşırı Satım",
  MFI_OVERBOUGHT: "MFI Aşırı Alım",
};

const READINESS_CONFIG = {
  READY: { label: "Hazır", color: "text-gain", bg: "bg-gain/10 border-gain/20", icon: ShieldCheck },
  NEEDS_WORK: { label: "Geliştirilmeli", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", icon: ShieldAlert },
  NOT_READY: { label: "Hazır Değil", color: "text-loss", bg: "bg-loss/10 border-loss/20", icon: ShieldAlert },
};

const ACTION_LABELS: Record<string, string> = {
  GUCLU_AL: "Güçlü Al",
  AL: "Al",
  TUT: "Tut",
  SAT: "Sat",
  GUCLU_SAT: "Güçlü Sat",
};

// ═══ Main Component ═══

const SCOPES = [
  { key: "portfolio", label: "Portföyüm" },
  { key: "bist100", label: "BIST100" },
  { key: "bist-all", label: "Tüm BIST" },
];

export function PerformanceClient() {
  const [days, setDays] = useState(180);
  const [scope, setScope] = useState("portfolio");

  const isBacktestScope = scope !== "portfolio";

  const { data: signalData, isLoading: signalLoading, error: signalError } = useQuery<SignalPerformanceResult>({
    queryKey: ["signal-performance", isBacktestScope ? scope : days, scope],
    queryFn: async () => {
      const params = isBacktestScope
        ? `scope=${scope}`
        : `days=${days}&scope=portfolio`;
      const r = await fetch(`/api/signal-performance?${params}`);
      if (!r.ok) throw new Error(`API error: ${r.status}`);
      return r.json();
    },
    staleTime: isBacktestScope ? 60 * 60 * 1000 : 5 * 60 * 1000,
  });

  const { data: verdictData, isLoading: verdictLoading } = useQuery<VerdictBacktestResult>({
    queryKey: ["verdict-backtest", days],
    queryFn: async () => {
      const r = await fetch(`/api/verdict-backtest?days=${days}`);
      if (!r.ok) throw new Error(`API error: ${r.status}`);
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
    enabled: !isBacktestScope, // Backtest scope'ta ayrı verdikt fetch'e gerek yok
  });

  const isLoading = signalLoading || verdictLoading;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="h-6 w-6 text-ai-primary" />
            Sinyal Performansı
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sinyallerimiz gerçekten para kazandırıyor mu? Komisyon sonrası net performans analizi.
          </p>
        </div>
        <div className="flex flex-col gap-2 items-end">
          {/* Scope Toggle */}
          <div className="flex gap-1 rounded-lg border border-border/40 p-0.5">
            {SCOPES.map((s) => (
              <button
                key={s.key}
                onClick={() => setScope(s.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  scope === s.key
                    ? "bg-ai-primary text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          {/* Period Toggle (only for portfolio scope) */}
          {!isBacktestScope && (
            <div className="flex gap-1 rounded-lg border border-border/40 p-0.5">
              {PERIODS.map((p) => (
                <button
                  key={p.days}
                  onClick={() => setDays(p.days)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    days === p.days
                      ? "bg-ai-primary/70 text-white"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {signalError && (
        <div className="rounded-xl border border-loss/20 bg-loss/5 p-6 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto text-loss mb-2" />
          <p className="text-sm text-loss">Performans verisi yüklenemedi.</p>
        </div>
      )}

      {signalData && (
        <>
          {/* Section 1: Readiness Assessment */}
          <ReadinessSection data={signalData} />

          {/* Section 2: Summary Metrics */}
          <SummaryMetrics signalData={signalData} verdictData={verdictData ?? null} />

          {/* Section 3: Signal Type Performance Table */}
          <SignalTable signals={signalData.signals} />

          {/* Section 4: Verdict Performance (portfolio scope only — backtest has it in signalData) */}
          {!isBacktestScope && verdictData && <VerdictSection data={verdictData} />}

          {/* Section 5: Confidence Calibration (portfolio scope only) */}
          {!isBacktestScope && verdictData && <ConfidenceCalibration data={verdictData} />}
        </>
      )}
    </div>
  );
}

// ═══ Section 1: Readiness Assessment ═══

function ReadinessSection({ data }: { data: SignalPerformanceResult }) {
  const { overallReadiness, readinessReasons } = data.summary;
  const config = READINESS_CONFIG[overallReadiness];
  const Icon = config.icon;

  return (
    <div className={`rounded-xl border p-5 ${config.bg}`}>
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-lg bg-card/50 ${config.color}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h2 className={`text-lg font-bold ${config.color}`}>
              Oto İşlem Hazırlık: {config.label}
            </h2>
          </div>
          <div className="space-y-1 mt-2">
            {readinessReasons.map((reason, i) => (
              <p key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-current opacity-50" />
                {reason}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══ Section 2: Summary Metrics ═══

function SummaryMetrics({ signalData, verdictData }: { signalData: SignalPerformanceResult; verdictData: VerdictBacktestResult | null }) {
  const { summary } = signalData;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
      <MetricCard
        label="Toplam Sinyal"
        value={summary.totalSignals.toString()}
        interpretation={`${signalData.dataSpanDays} günlük veri`}
      />
      <MetricCard
        label="Ort. Win Rate"
        value={`%${summary.avgWinRate.toFixed(1)}`}
        status={summary.avgWinRate >= 55 ? "positive" : summary.avgWinRate >= 45 ? "neutral" : "negative"}
        interpretation={summary.avgWinRate >= 55 ? "Hedef: >%55" : "Hedef: >%55"}
      />
      <MetricCard
        label="Ort. Profit Factor"
        value={summary.avgProfitFactor.toFixed(2)}
        status={summary.avgProfitFactor >= 1.3 ? "positive" : summary.avgProfitFactor >= 1.0 ? "neutral" : "negative"}
        interpretation={summary.avgProfitFactor >= 1.3 ? "Hedef: >1.3" : "Hedef: >1.3"}
      />
      <MetricCard
        label="Kârlı Sinyal Tipi"
        value={`${summary.profitableSignalTypes}/${summary.profitableSignalTypes + summary.unprofitableSignalTypes}`}
        status={summary.profitableSignalTypes > summary.unprofitableSignalTypes ? "positive" : "negative"}
        interpretation="Komisyon sonrası"
      />
      {verdictData && (
        <>
          <MetricCard
            label="Simülasyon Getiri"
            value={`%${verdictData.simulation.totalReturn.toFixed(1)}`}
            status={verdictData.simulation.totalReturn > 0 ? "positive" : "negative"}
            interpretation={`Alpha: %${verdictData.simulation.alpha.toFixed(1)}`}
          />
          <MetricCard
            label="Max Drawdown"
            value={`%${verdictData.simulation.maxDrawdown.toFixed(1)}`}
            status={verdictData.simulation.maxDrawdown < 10 ? "positive" : verdictData.simulation.maxDrawdown < 20 ? "neutral" : "negative"}
            interpretation="Hedef: <%15"
          />
        </>
      )}
    </div>
  );
}

// ═══ Section 3: Signal Table ═══

function SignalTable({ signals }: { signals: SignalTypePerformance[] }) {
  const [filter, setFilter] = useState<"all" | "profitable" | "unprofitable">("all");

  const filtered = signals.filter(s => {
    if (filter === "profitable") return s.profitableAfterCosts;
    if (filter === "unprofitable") return !s.profitableAfterCosts;
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <BarChart3 className="h-4 w-4" /> Sinyal Tipi Bazlı Performans
        </h2>
        <div className="flex gap-1 rounded-lg border border-border/40 p-0.5">
          {([
            { key: "all" as const, label: "Tümü" },
            { key: "profitable" as const, label: "Kârlı" },
            { key: "unprofitable" as const, label: "Zararlı" },
          ]).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${
                filter === f.key
                  ? "bg-ai-primary/80 text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border/25 bg-card/20 backdrop-blur-sm overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_60px_70px_70px_80px_80px_70px] gap-2 px-4 py-2.5 border-b border-border/20 text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider">
          <span>Sinyal</span>
          <span className="text-right">Adet</span>
          <span className="text-right">Win Rate</span>
          <span className="text-right">PF</span>
          <span className="text-right">Brüt Exp.</span>
          <span className="text-right">Net Exp.</span>
          <span className="text-right">Durum</span>
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Veri bulunamadı.</p>
        ) : (
          filtered.map((s) => <SignalRow key={`${s.signalType}-${s.direction}`} signal={s} />)
        )}
      </div>
    </div>
  );
}

function SignalRow({ signal }: { signal: SignalTypePerformance }) {
  const horizon = signal.horizons[signal.bestHorizon];
  const label = SIGNAL_LABELS[signal.signalType] ?? signal.signalType;
  const dirIcon = signal.direction === "BULLISH"
    ? <ArrowUpRight className="h-3 w-3 text-gain" />
    : <ArrowDownRight className="h-3 w-3 text-loss" />;

  return (
    <div className="grid grid-cols-[1fr_60px_70px_70px_80px_80px_70px] gap-2 px-4 py-2.5 border-b border-border/10 last:border-0 hover:bg-card/30 transition-colors items-center text-xs">
      {/* Signal name + direction */}
      <div className="flex items-center gap-2 min-w-0">
        {dirIcon}
        <span className="font-medium text-foreground truncate">{label}</span>
        <span className="text-[10px] text-muted-foreground/50 shrink-0">{signal.bestHorizon}</span>
      </div>

      {/* Count */}
      <span className="text-right text-muted-foreground">{signal.totalCount}</span>

      {/* Win Rate */}
      <span className={`text-right font-semibold ${
        (horizon?.winRate ?? 0) >= 55 ? "text-gain" : (horizon?.winRate ?? 0) >= 45 ? "text-amber-400" : "text-loss"
      }`}>
        {horizon ? `%${horizon.winRate.toFixed(1)}` : "-"}
      </span>

      {/* Profit Factor */}
      <span className={`text-right font-semibold ${
        (horizon?.profitFactor ?? 0) >= 1.3 ? "text-gain" : (horizon?.profitFactor ?? 0) >= 1.0 ? "text-foreground" : "text-loss"
      }`}>
        {horizon ? horizon.profitFactor.toFixed(2) : "-"}
      </span>

      {/* Gross Expectancy */}
      <span className={`text-right ${(horizon?.grossExpectancy ?? 0) > 0 ? "text-gain" : "text-loss"}`}>
        {horizon ? `%${horizon.grossExpectancy > 0 ? "+" : ""}${horizon.grossExpectancy.toFixed(2)}` : "-"}
      </span>

      {/* Net Expectancy (after commission) */}
      <span className={`text-right font-bold ${signal.netExpectancy > 0 ? "text-gain" : "text-loss"}`}>
        {horizon ? `%${signal.netExpectancy > 0 ? "+" : ""}${signal.netExpectancy.toFixed(2)}` : "-"}
      </span>

      {/* Status */}
      <div className="text-right">
        {signal.profitableAfterCosts ? (
          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-gain/10 text-gain border border-gain/20">
            <CircleDollarSign className="h-2.5 w-2.5" />
            Kârlı
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-loss/10 text-loss border border-loss/20">
            <Minus className="h-2.5 w-2.5" />
            Zarar
          </span>
        )}
      </div>
    </div>
  );
}

// ═══ Section 4: Verdict Performance ═══

function VerdictSection({ data }: { data: VerdictBacktestResult }) {
  const order = ["GUCLU_AL", "AL", "TUT", "SAT", "GUCLU_SAT"];
  const sorted = [...data.performances].sort((a, b) => order.indexOf(a.verdictAction) - order.indexOf(b.verdictAction));

  const ACTION_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    GUCLU_AL: { label: "Güçlü Al", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
    AL: { label: "Al", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
    TUT: { label: "Tut", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
    SAT: { label: "Sat", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
    GUCLU_SAT: { label: "Güçlü Sat", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  };

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
        <Target className="h-4 w-4" /> Verdikt Bazlı Performans
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {sorted.map((p) => {
          const config = ACTION_CONFIG[p.verdictAction] ?? { label: p.verdictAction, color: "text-foreground", bg: "bg-card/20 border-border/25" };
          const isShort = p.verdictAction === "SAT" || p.verdictAction === "GUCLU_SAT";
          const horizon = p.horizons["20D"] ?? p.horizons["10D"] ?? p.horizons["5D"] ?? p.horizons["1D"];
          const horizonLabel = p.horizons["20D"] ? "20G" : p.horizons["10D"] ? "10G" : p.horizons["5D"] ? "5G" : "1G";

          return (
            <div key={p.verdictAction} className={`rounded-xl border p-4 space-y-3 ${config.bg}`}>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-bold ${config.color}`}>{config.label}</span>
                <span className="text-[10px] text-muted-foreground/50">{p.totalCount} karar</span>
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
                      <span className={`font-bold ${
                        isShort ? (horizon.avgReturn < 0 ? "text-gain" : "text-loss") : (horizon.avgReturn > 0 ? "text-gain" : "text-loss")
                      }`}>
                        %{horizon.avgReturn.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Profit Factor</span>
                      <span className="font-semibold text-foreground">{horizon.profitFactor.toFixed(2)}</span>
                    </div>
                    {p.highConfWinRate != null && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Yüksek Güven WR</span>
                        <span className={`font-semibold ${p.highConfWinRate >= 55 ? "text-gain" : "text-amber-400"}`}>
                          %{p.highConfWinRate.toFixed(0)}
                        </span>
                      </div>
                    )}
                  </div>

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
        })}
      </div>
    </div>
  );
}

// ═══ Section 5: Confidence Calibration ═══

function ConfidenceCalibration({ data }: { data: VerdictBacktestResult }) {
  const { avgConfidenceAccuracy } = data.overall;
  const hasData = avgConfidenceAccuracy.high > 0 || avgConfidenceAccuracy.medium > 0 || avgConfidenceAccuracy.low > 0;

  if (!hasData) return null;

  const isCalibrated = avgConfidenceAccuracy.high > avgConfidenceAccuracy.medium && avgConfidenceAccuracy.medium > avgConfidenceAccuracy.low;

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4" /> Güven Kalibrasyonu
      </h2>
      <div className={`rounded-xl border p-5 ${isCalibrated ? "border-gain/15 bg-card/20" : "border-amber-500/15 bg-card/20"} backdrop-blur-sm`}>
        <p className="text-xs text-muted-foreground mb-1">
          Güven seviyesi arttıkça isabet de artıyor mu?
          {isCalibrated
            ? <span className="ml-2 text-gain font-medium">Evet — kalibrasyon iyi</span>
            : <span className="ml-2 text-amber-400 font-medium">Hayır — kalibrasyon bozuk</span>
          }
        </p>
        <p className="text-[10px] text-muted-foreground/50 mb-4">
          {isCalibrated
            ? "Yüksek güvenli kararlar daha isabetli. Confidence güvenilir."
            : "Yüksek güvenli kararlar daha isabetli değil. Confidence sistemi iyileştirilmeli."
          }
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
