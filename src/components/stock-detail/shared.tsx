import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import * as I from "@/lib/stock/interpretations";
import type { LucideIcon } from "lucide-react";

// ═══ FORMATTERS ═══

export function formatCap(v: number | null) {
  if (!v) return "—";
  if (v >= 1e12) return `₺${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9) return `₺${(v / 1e9).toFixed(1)}B`;
  return `₺${(v / 1e6).toFixed(0)}M`;
}

export function formatVol(v: number | null) {
  if (!v) return "—";
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  return `${(v / 1e3).toFixed(0)}K`;
}

export function fmt(v: number | string | null | undefined, d = 2) {
  if (v == null) return "—";
  if (typeof v === "string") return v;
  return v.toFixed(d);
}

// ═══ MINI SPARKLINE ═══

export function MiniSparkline({ data, className }: { data: { close: number }[]; className?: string }) {
  if (data.length < 2) return null;
  const prices = data.map(d => d.close);
  const min = Math.min(...prices), max = Math.max(...prices), range = max - min || 1;
  const w = 200, h = 40;
  const points = prices.map((p, i) => `${(i / (prices.length - 1)) * w},${h - ((p - min) / range) * h}`).join(" ");
  const isUp = prices[prices.length - 1] >= prices[0];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("w-full h-10", className)} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={isUp ? "oklch(0.765 0.177 163.223)" : "oklch(0.712 0.194 13.428)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ═══ FACTOR BAR ═══

export function FactorBar({ label, value, icon: Icon, factorKey }: { label: string; value: number; icon: LucideIcon; factorKey?: string }) {
  const color = value >= 60 ? "bg-gain" : value >= 40 ? "bg-amber-400" : "bg-loss";
  const interp = factorKey ? I.interpretFactor(factorKey, value) : null;
  return (
    <div>
      <div className="flex items-center gap-3">
        <Icon className="h-3 w-3 text-muted-foreground/50 shrink-0" />
        <span className="text-[11px] text-muted-foreground/60 w-16 shrink-0">{label}</span>
        <div className="flex-1 h-2.5 rounded-full bg-border/30">
          <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${value}%` }} />
        </div>
        <span className="text-[11px] font-bold text-foreground tabular-nums w-7 text-right">{value}</span>
      </div>
      {interp && <p className="text-[10px] text-muted-foreground/40 ml-8 mt-0.5">{interp}</p>}
    </div>
  );
}

// ═══ STAT MINI ═══

export function StatMini({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] text-muted-foreground/50 uppercase">{label}</p>
      <p className={cn("text-sm font-bold tabular-nums", color ?? "text-foreground")}>{value}</p>
    </div>
  );
}

// ═══ SECTION HEADER ═══

export function SectionHeader({ icon: Icon, label, subtitle, tooltip, timeLabel }: {
  icon: LucideIcon;
  label: string;
  subtitle?: string;
  tooltip?: string;
  timeLabel?: "realtime" | "daily" | "weekly" | "monthly";
}) {
  const TIME_BADGES: Record<string, { text: string; cls: string }> = {
    realtime: { text: "Anlık", cls: "text-ai-primary bg-ai-primary/10 border-ai-primary/15" },
    daily: { text: "Günlük", cls: "text-amber-400 bg-amber-400/10 border-amber-400/15" },
    weekly: { text: "Haftalık", cls: "text-purple-400 bg-purple-400/10 border-purple-400/15" },
    monthly: { text: "Aylık", cls: "text-blue-400 bg-blue-400/10 border-blue-400/15" },
  };
  const timeBadge = timeLabel ? TIME_BADGES[timeLabel] : undefined;

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-ai-primary/80" />
        <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">{label}</span>
        {tooltip && <InfoTooltip title={label} description={tooltip} />}
        {timeBadge && <span className={cn("text-[9px] px-1.5 py-0.5 rounded-md font-medium border", timeBadge.cls)}>{timeBadge.text}</span>}
      </div>
      {subtitle && <p className="text-[10px] text-muted-foreground/40 mt-1 ml-[22px] leading-relaxed">{subtitle}</p>}
    </div>
  );
}

// ═══ CARD WRAPPER ═══

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border/30 bg-card/20 backdrop-blur-sm p-4 shadow-sm", className)}>
      {children}
    </div>
  );
}
