"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MetricCard } from "@/components/ui/metric-card";
import {
  Bot,
  Loader2,
  AlertTriangle,
  Play,
  TrendingUp,
  TrendingDown,
  CircleDollarSign,
  Timer,
  ShieldAlert,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { toast } from "sonner";

// ═══ Types ═══

interface PaperAccount {
  id: string;
  initialBalance: number;
  currentBalance: number;
  portfolioValue: number;
  totalReturn: number;
  totalPnl: number;
  totalTrades: number;
  winCount: number;
  lossCount: number;
  totalCommission: number;
  maxDrawdown: number;
  peakBalance: number;
  scope: string;
  isActive: boolean;
  pausedUntil: string | null;
  pauseReason: string | null;
  openPositionsValue: number;
  totalUnrealizedPnl: number;
}

interface OpenTrade {
  id: string;
  stockCode: string;
  action: string;
  lots: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  verdictAction: string;
  confidence: number;
  entryDate: string;
  maxHoldingDays: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPct: number;
  holdingDays: number;
}

interface ClosedTrade {
  id: string;
  stockCode: string;
  action: string;
  lots: number;
  entryPrice: number;
  exitPrice: number;
  verdictAction: string;
  status: string;
  exitReason: string;
  pnlAmount: number;
  pnlPercent: number;
  commission: number;
  holdingDays: number;
  entryDate: string;
  exitDate: string;
}

interface EquitySnapshot {
  date: string;
  portfolioValue: number;
  cashBalance: number;
  openPositions: number;
  dailyPnl: number;
  dailyPnlPct: number;
  drawdown: number;
}

interface Stats {
  totalTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  avgHoldingDays: number;
  byVerdict: Record<string, { total: number; wins: number; avgPnl: number }>;
  byExitReason: Record<string, number>;
}

interface PaperTradingData {
  account: PaperAccount | null;
  openTrades: OpenTrade[];
  closedTrades: ClosedTrade[];
  equity: EquitySnapshot[];
  stats: Stats | null;
}

// ═══ Constants ═══

const ACTION_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  GUCLU_AL: { label: "Güçlü Al", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  AL: { label: "Al", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
  SAT: { label: "Sat", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  GUCLU_SAT: { label: "Güçlü Sat", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
};

const STATUS_LABELS: Record<string, string> = {
  CLOSED_TP: "Take Profit",
  CLOSED_SL: "Stop Loss",
  CLOSED_TRAIL: "Trailing Stop",
  CLOSED_TIME: "Zaman Aşımı",
  CLOSED_VERDICT: "Verdikt Değişimi",
  CLOSED_CIRCUIT: "Circuit Breaker",
};

// ═══ Main Component ═══

export function PaperTradingClient() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<PaperTradingData>({
    queryKey: ["paper-trading"],
    queryFn: async () => {
      const r = await fetch("/api/paper-trading");
      if (!r.ok) throw new Error(`API error: ${r.status}`);
      return r.json();
    },
    staleTime: 60 * 1000,
  });

  const activateMutation = useMutation({
    mutationFn: async (scope: string) => {
      const r = await fetch("/api/paper-trading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });
      if (!r.ok) {
        const body = await r.json();
        throw new Error(body.error || "Hata");
      }
      return r.json();
    },
    onSuccess: () => {
      toast.success("Paper trading hesabı aktifleştirildi!");
      queryClient.invalidateQueries({ queryKey: ["paper-trading"] });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Bot className="h-6 w-6 text-ai-primary" />
          Paper Trading
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sanal ₺100.000 ile otomatik al-sat. Gerçek verdiktlerle, gerçek fiyatlarla.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-loss/20 bg-loss/5 p-6 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto text-loss mb-2" />
          <p className="text-sm text-loss">Veri yüklenemedi.</p>
        </div>
      )}

      {data && !data.account && (
        <ActivateSection onActivate={(scope: string) => activateMutation.mutate(scope)} isLoading={activateMutation.isPending} />
      )}

      {data?.account && (
        <>
          {/* Scope Selector */}
          <ScopeSelector currentScope={data.account.scope ?? "bist100"} onScopeChange={async (scope: string) => {
            const r = await fetch("/api/paper-trading", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ scope }),
            });
            if (r.ok) {
              toast.success(`Scope ${scope.toUpperCase()} olarak güncellendi`);
              queryClient.invalidateQueries({ queryKey: ["paper-trading"] });
            }
          }} />

          {/* Circuit Breaker Warning */}
          {data.account.pausedUntil && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-400">Circuit Breaker Aktif</p>
                <p className="text-xs text-muted-foreground">
                  {data.account.pauseReason} — {new Date(data.account.pausedUntil).toLocaleDateString("tr-TR")} tarihine kadar duraklama.
                </p>
              </div>
            </div>
          )}

          {/* Summary Metrics */}
          <AccountSummary account={data.account} stats={data.stats} />

          {/* Equity Curve */}
          {data.equity.length > 1 && <EquityCurve data={data.equity} initial={data.account.initialBalance} />}

          {/* Open Positions */}
          <OpenPositions trades={data.openTrades} />

          {/* Stats Breakdown */}
          {data.stats && data.stats.totalTrades > 0 && <StatsBreakdown stats={data.stats} />}

          {/* Closed Trades */}
          <ClosedTradesList trades={data.closedTrades} />
        </>
      )}
    </div>
  );
}

// ═══ Scope Selector ═══

const SCOPE_OPTIONS = [
  { key: "bist30", label: "BIST30", wr: "58.4" },
  { key: "bist50", label: "BIST50", wr: "58.0" },
  { key: "bist100", label: "BIST100", wr: "57.0" },
  { key: "portfolio", label: "Portföyüm", wr: "-" },
];

function ScopeSelector({ currentScope, onScopeChange }: { currentScope: string; onScopeChange: (scope: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Tarama:</span>
      <div className="flex gap-1 rounded-lg border border-border/40 p-0.5">
        {SCOPE_OPTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => { if (s.key !== currentScope) onScopeChange(s.key); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              currentScope === s.key
                ? "bg-ai-primary text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.label}
            {s.wr !== "-" && <span className="ml-1 text-[10px] opacity-70">%{s.wr}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══ Activate Section ═══

function ActivateSection({ onActivate, isLoading }: { onActivate: (scope: string) => void; isLoading: boolean }) {
  const [selectedScope, setSelectedScope] = useState("bist100");
  const scopeOptions = [
    { key: "bist30", label: "BIST30", desc: "En likit 30 hisse — en yüksek WR (%58.4)" },
    { key: "bist50", label: "BIST50", desc: "50 likit hisse — güçlü WR (%58.0)" },
    { key: "bist100", label: "BIST100", desc: "100 hisse — geniş kapsam, iyi WR (%57.0)" },
    { key: "portfolio", label: "Portföyüm", desc: "Sadece takip ettiğin hisseler" },
  ];

  return (
    <div className="rounded-xl border border-ai-primary/20 bg-card/30 backdrop-blur-sm p-8 text-center">
      <Bot className="h-12 w-12 mx-auto text-ai-primary mb-4" />
      <h2 className="text-lg font-bold text-foreground mb-2">Paper Trading Başlat</h2>
      <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
        Sanal ₺100.000 ile başla. Bistbase verdiktleri otomatik olarak al-sat yapacak.
      </p>

      {/* Scope Selection */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-w-lg mx-auto mb-6">
        {scopeOptions.map((s) => (
          <button
            key={s.key}
            onClick={() => setSelectedScope(s.key)}
            className={`rounded-lg border p-3 text-left transition-colors ${
              selectedScope === s.key
                ? "border-ai-primary bg-ai-primary/10"
                : "border-border/40 hover:border-border/60"
            }`}
          >
            <span className={`text-sm font-bold ${selectedScope === s.key ? "text-ai-primary" : "text-foreground"}`}>
              {s.label}
            </span>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.desc}</p>
          </button>
        ))}
      </div>

      <button
        onClick={() => onActivate(selectedScope)}
        disabled={isLoading}
        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-ai-primary text-white font-medium text-sm hover:bg-ai-primary/90 transition-colors disabled:opacity-50"
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        Hesabı Aktifleştir
      </button>
    </div>
  );
}

// ═══ Account Summary ═══

function AccountSummary({ account, stats }: { account: PaperAccount; stats: Stats | null }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
      <MetricCard
        label="Portföy Değeri"
        value={`₺${account.portfolioValue.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}`}
        status={account.totalReturn >= 0 ? "positive" : "negative"}
        interpretation={`Başlangıç: ₺${account.initialBalance.toLocaleString("tr-TR")}`}
      />
      <MetricCard
        label="Toplam Getiri"
        value={`%${account.totalReturn.toFixed(1)}`}
        status={account.totalReturn > 0 ? "positive" : account.totalReturn === 0 ? "neutral" : "negative"}
        interpretation={`₺${account.totalPnl.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}`}
      />
      <MetricCard
        label="Win Rate"
        value={stats ? `%${stats.winRate.toFixed(0)}` : "-"}
        status={(stats?.winRate ?? 0) >= 55 ? "positive" : (stats?.winRate ?? 0) >= 45 ? "neutral" : "negative"}
        interpretation={`${account.winCount}W / ${account.lossCount}L`}
      />
      <MetricCard
        label="Profit Factor"
        value={stats?.profitFactor.toFixed(2) ?? "-"}
        status={(stats?.profitFactor ?? 0) >= 1.3 ? "positive" : (stats?.profitFactor ?? 0) >= 1.0 ? "neutral" : "negative"}
      />
      <MetricCard
        label="Max Drawdown"
        value={`%${Math.abs(account.maxDrawdown).toFixed(1)}`}
        status={Math.abs(account.maxDrawdown) < 5 ? "positive" : Math.abs(account.maxDrawdown) < 10 ? "neutral" : "negative"}
      />
      <MetricCard
        label="Toplam Komisyon"
        value={`₺${account.totalCommission.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}`}
        interpretation={`${account.totalTrades} işlem`}
      />
    </div>
  );
}

// ═══ Equity Curve ═══

function EquityCurve({ data, initial }: { data: EquitySnapshot[]; initial: number }) {
  if (data.length < 2) return null;

  const W = 700;
  const H = 180;
  const PAD = 10;

  const values = data.map(d => d.portfolioValue);
  const allVals = [...values, initial];
  const minVal = Math.min(...allVals);
  const maxVal = Math.max(...allVals);
  const range = maxVal - minVal || 1;

  const toX = (i: number) => PAD + (i / (data.length - 1)) * (W - 2 * PAD);
  const toY = (v: number) => H - PAD - ((v - minVal) / range) * (H - 2 * PAD);

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(d.portfolioValue).toFixed(1)}`).join(" ");
  const baseY = toY(initial);
  const areaPath = line + ` L${toX(data.length - 1).toFixed(1)},${H - PAD} L${PAD},${H - PAD} Z`;

  const lastValue = values[values.length - 1];
  const profitable = lastValue >= initial;

  return (
    <div className="rounded-xl border border-border/25 bg-card/20 backdrop-blur-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground">Equity Curve</span>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1">
            <span className={`w-2 h-0.5 rounded ${profitable ? "bg-gain" : "bg-loss"}`} /> Portföy
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-0.5 bg-muted-foreground/30 rounded" /> Başlangıç
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[180px]" preserveAspectRatio="none">
        <path d={areaPath} fill={profitable ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)"} />
        <line x1={PAD} y1={baseY} x2={W - PAD} y2={baseY} stroke="currentColor" strokeWidth="1" opacity="0.1" strokeDasharray="4 4" className="text-muted-foreground" />
        <path d={line} fill="none" stroke={profitable ? "var(--color-gain, #22c55e)" : "var(--color-loss, #ef4444)"} strokeWidth="2" />
      </svg>
    </div>
  );
}

// ═══ Open Positions ═══

function OpenPositions({ trades }: { trades: OpenTrade[] }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
        <CircleDollarSign className="h-4 w-4" /> Açık Pozisyonlar ({trades.length})
      </h2>

      {trades.length === 0 ? (
        <div className="rounded-xl border border-border/25 bg-card/20 p-6 text-center">
          <p className="text-xs text-muted-foreground">Henüz açık pozisyon yok.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/25 bg-card/20 backdrop-blur-sm overflow-hidden">
          <div className="grid grid-cols-[1fr_60px_70px_70px_70px_80px_60px] gap-2 px-4 py-2.5 border-b border-border/20 text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider">
            <span>Hisse</span>
            <span className="text-right">Lot</span>
            <span className="text-right">Giriş</span>
            <span className="text-right">Güncel</span>
            <span className="text-right">P&L</span>
            <span className="text-right">P&L %</span>
            <span className="text-right">Gün</span>
          </div>
          {trades.map((trade) => {
            const config = ACTION_CONFIG[trade.verdictAction] ?? { label: trade.verdictAction, color: "text-foreground", bg: "" };
            return (
              <div key={trade.id} className="grid grid-cols-[1fr_60px_70px_70px_70px_80px_60px] gap-2 px-4 py-2.5 border-b border-border/10 last:border-0 text-xs items-center hover:bg-card/30 transition-colors">
                <div className="flex items-center gap-2">
                  {trade.action === "BUY"
                    ? <ArrowUpRight className="h-3 w-3 text-gain" />
                    : <ArrowDownRight className="h-3 w-3 text-loss" />
                  }
                  <span className="font-medium text-foreground">{trade.stockCode}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${config.bg}`}>
                    {config.label}
                  </span>
                </div>
                <span className="text-right text-muted-foreground">{trade.lots}</span>
                <span className="text-right text-muted-foreground">₺{trade.entryPrice.toFixed(2)}</span>
                <span className="text-right text-foreground font-medium">₺{trade.currentPrice.toFixed(2)}</span>
                <span className={`text-right font-semibold ${trade.unrealizedPnl >= 0 ? "text-gain" : "text-loss"}`}>
                  ₺{trade.unrealizedPnl.toFixed(0)}
                </span>
                <span className={`text-right font-bold ${trade.unrealizedPct >= 0 ? "text-gain" : "text-loss"}`}>
                  {trade.unrealizedPct >= 0 ? "+" : ""}{trade.unrealizedPct.toFixed(1)}%
                </span>
                <span className="text-right text-muted-foreground">{trade.holdingDays}g</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══ Stats Breakdown ═══

function StatsBreakdown({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Verdikt Performansı */}
      <div className="rounded-xl border border-border/25 bg-card/20 backdrop-blur-sm p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <BarChart3 className="h-3.5 w-3.5" /> Verdikt Bazlı
        </h3>
        <div className="space-y-2">
          {Object.entries(stats.byVerdict).map(([verdict, data]) => {
            const config = ACTION_CONFIG[verdict] ?? { label: verdict, color: "text-foreground", bg: "" };
            const wr = data.total > 0 ? (data.wins / data.total) * 100 : 0;
            return (
              <div key={verdict} className="flex items-center justify-between text-xs">
                <span className={`font-medium ${config.color}`}>{config.label}</span>
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground">{data.total} işlem</span>
                  <span className={`font-semibold ${wr >= 55 ? "text-gain" : wr >= 45 ? "text-amber-400" : "text-loss"}`}>
                    %{wr.toFixed(0)} WR
                  </span>
                  <span className={`font-semibold ${data.avgPnl >= 0 ? "text-gain" : "text-loss"}`}>
                    {data.avgPnl >= 0 ? "+" : ""}{data.avgPnl.toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Çıkış Nedenleri */}
      <div className="rounded-xl border border-border/25 bg-card/20 backdrop-blur-sm p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Timer className="h-3.5 w-3.5" /> Çıkış Nedenleri
        </h3>
        <div className="space-y-2">
          {Object.entries(stats.byExitReason).map(([reason, count]) => {
            const total = stats.totalTrades;
            const pct = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={reason} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{STATUS_LABELS[reason] ?? reason}</span>
                <div className="flex items-center gap-3">
                  <div className="w-20 bg-muted/30 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-ai-primary/60" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-foreground font-medium w-8 text-right">{count}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══ Closed Trades ═══

function ClosedTradesList({ trades }: { trades: ClosedTrade[] }) {
  if (trades.length === 0) return null;

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4" /> Son İşlemler
      </h2>
      <div className="rounded-xl border border-border/25 bg-card/20 backdrop-blur-sm overflow-hidden">
        <div className="grid grid-cols-[1fr_70px_70px_80px_70px_90px] gap-2 px-4 py-2.5 border-b border-border/20 text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider">
          <span>Hisse</span>
          <span className="text-right">Giriş</span>
          <span className="text-right">Çıkış</span>
          <span className="text-right">P&L</span>
          <span className="text-right">Süre</span>
          <span className="text-right">Neden</span>
        </div>
        {trades.slice(0, 20).map((trade) => {
          const config = ACTION_CONFIG[trade.verdictAction] ?? { label: trade.verdictAction, color: "text-foreground", bg: "" };
          return (
            <div key={trade.id} className="grid grid-cols-[1fr_70px_70px_80px_70px_90px] gap-2 px-4 py-2 border-b border-border/10 last:border-0 text-xs items-center">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{trade.stockCode}</span>
                <span className={`text-[10px] px-1 py-0.5 rounded border ${config.bg}`}>
                  {config.label}
                </span>
              </div>
              <span className="text-right text-muted-foreground">₺{trade.entryPrice.toFixed(2)}</span>
              <span className="text-right text-muted-foreground">₺{trade.exitPrice?.toFixed(2) ?? "-"}</span>
              <span className={`text-right font-bold ${(trade.pnlPercent ?? 0) >= 0 ? "text-gain" : "text-loss"}`}>
                {(trade.pnlPercent ?? 0) >= 0 ? "+" : ""}{trade.pnlPercent?.toFixed(1) ?? "0"}%
              </span>
              <span className="text-right text-muted-foreground">{trade.holdingDays ?? 0}g</span>
              <span className="text-right text-[10px] text-muted-foreground/70">
                {STATUS_LABELS[trade.status] ?? trade.status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
