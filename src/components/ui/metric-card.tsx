"use client";

import { cn } from "@/lib/utils";
import { InfoTooltip } from "./info-tooltip";

interface MetricCardProps {
  label: string;
  subtitle?: string;
  value: string;
  status?: "positive" | "neutral" | "negative";
  interpretation?: string | null;
  tooltip?: { title: string; description: string };
  className?: string;
}

const STATUS_STYLES = {
  positive: { dot: "bg-gain", text: "text-gain" },
  neutral: { dot: "bg-amber-400", text: "text-amber-400" },
  negative: { dot: "bg-loss", text: "text-loss" },
};

export function MetricCard({ label, subtitle, value, status, interpretation, tooltip, className }: MetricCardProps) {
  const s = status ? STATUS_STYLES[status] : null;

  return (
    <div className={cn(
      "rounded-xl border bg-card/20 backdrop-blur-sm p-3.5 space-y-1.5 transition-colors hover:bg-card/30",
      s ? {
        positive: "border-gain/15",
        neutral: "border-amber-400/15",
        negative: "border-loss/15",
      }[status!] : "border-border/25",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-semibold">{label}</span>
        {tooltip && <InfoTooltip title={tooltip.title} description={tooltip.description} />}
      </div>

      {/* Subtitle */}
      {subtitle && <p className="text-[10px] text-muted-foreground/40 leading-relaxed">{subtitle}</p>}

      {/* Value + Status */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xl font-extrabold tabular-nums text-foreground tracking-tight">{value}</span>
        {s && (
          <div className="flex items-center gap-1.5">
            <span className={cn("w-1.5 h-1.5 rounded-full ring-2 ring-offset-1 ring-offset-background", s.dot, `ring-${s.dot.replace("bg-", "")}/30`)} />
            {interpretation && <span className={cn("text-[10px] font-semibold", s.text)}>{interpretation}</span>}
          </div>
        )}
      </div>

      {/* Interpretation without status */}
      {!s && interpretation && (
        <p className="text-[10px] text-muted-foreground/50 leading-relaxed">{interpretation}</p>
      )}
    </div>
  );
}
