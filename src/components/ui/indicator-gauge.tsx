"use client";

import { cn } from "@/lib/utils";
import { InfoTooltip } from "./info-tooltip";

interface Zone {
  start: number;
  end: number;
  color: string; // tailwind bg class
}

interface IndicatorGaugeProps {
  label: string;
  value: number | null;
  min?: number;
  max?: number;
  zones: Zone[];
  thresholds?: number[];
  interpretation?: string | null;
  tooltip?: { title: string; description: string };
}

export function IndicatorGauge({
  label,
  value,
  min = 0,
  max = 100,
  zones,
  thresholds = [],
  interpretation,
  tooltip,
}: IndicatorGaugeProps) {
  if (value == null) return null;

  const range = max - min;
  const pct = range > 0 ? ((value - min) / range) * 100 : 50;
  const clampedPct = Math.max(0, Math.min(100, pct));

  // Status color based on zones
  const activeZone = zones.find(z => value >= z.start && value <= z.end);
  const dotColor = activeZone?.color ?? "bg-muted-foreground";

  return (
    <div className="py-1.5">
      <div className="flex items-center gap-3">
        {/* Label */}
        <div className="flex items-center gap-1 w-20 shrink-0">
          <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
          {tooltip && <InfoTooltip title={tooltip.title} description={tooltip.description} />}
        </div>

        {/* Gauge bar */}
        <div className="flex-1 relative h-3">
          {/* Track with zone backgrounds */}
          <div className="absolute inset-0 rounded-full overflow-hidden bg-border/20">
            {zones.map((zone, i) => {
              const left = ((zone.start - min) / range) * 100;
              const width = ((zone.end - zone.start) / range) * 100;
              return (
                <div
                  key={i}
                  className={cn("absolute inset-y-0 opacity-15", zone.color)}
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              );
            })}

            {/* Threshold markers */}
            {thresholds.map((t, i) => {
              const pos = ((t - min) / range) * 100;
              return (
                <div
                  key={i}
                  className="absolute inset-y-0 w-px bg-muted-foreground/30"
                  style={{ left: `${pos}%` }}
                />
              );
            })}
          </div>

          {/* Current value marker (outside overflow-hidden so it doesn't clip) */}
          <div
            className={cn("absolute top-1/2 w-3 h-3 rounded-full border-2 border-background shadow-sm transition-all duration-500 z-10", dotColor)}
            style={{ left: `calc(${clampedPct}% - 6px)`, top: "50%", transform: "translateY(-50%)" }}
          />
        </div>

        {/* Value */}
        <span className="text-xs font-bold tabular-nums w-10 text-right text-foreground shrink-0">
          {typeof value === "number" ? (Math.abs(value) < 1 ? value.toFixed(2) : value.toFixed(1)) : value}
        </span>
      </div>

      {/* Interpretation */}
      {interpretation && (
        <p className="text-[10px] text-muted-foreground/50 ml-[92px] mt-0.5">{interpretation}</p>
      )}
    </div>
  );
}

// ═══ PRESET CONFIGURATIONS ═══

export const RSI_GAUGE = {
  min: 0,
  max: 100,
  zones: [
    { start: 0, end: 30, color: "bg-gain" },
    { start: 30, end: 70, color: "bg-muted-foreground" },
    { start: 70, end: 100, color: "bg-loss" },
  ],
  thresholds: [30, 70],
};

export const STOCH_GAUGE = {
  min: 0,
  max: 100,
  zones: [
    { start: 0, end: 20, color: "bg-gain" },
    { start: 20, end: 80, color: "bg-muted-foreground" },
    { start: 80, end: 100, color: "bg-loss" },
  ],
  thresholds: [20, 80],
};

export const MFI_GAUGE = { ...STOCH_GAUGE };

export const ADX_GAUGE = {
  min: 0,
  max: 80,
  zones: [
    { start: 0, end: 15, color: "bg-muted-foreground" },
    { start: 15, end: 25, color: "bg-amber-400" },
    { start: 25, end: 80, color: "bg-ai-primary" },
  ],
  thresholds: [15, 25],
};

export const BB_GAUGE = {
  min: 0,
  max: 100,
  zones: [
    { start: 0, end: 20, color: "bg-gain" },
    { start: 20, end: 80, color: "bg-muted-foreground" },
    { start: 80, end: 100, color: "bg-loss" },
  ],
  thresholds: [20, 80],
};

export const CMF_GAUGE = {
  min: -30,
  max: 30,
  zones: [
    { start: -30, end: -5, color: "bg-loss" },
    { start: -5, end: 5, color: "bg-muted-foreground" },
    { start: 5, end: 30, color: "bg-gain" },
  ],
  thresholds: [-5, 0, 5],
};

export const WILLIAMS_GAUGE = {
  min: -100,
  max: 0,
  zones: [
    { start: -100, end: -80, color: "bg-gain" },
    { start: -80, end: -20, color: "bg-muted-foreground" },
    { start: -20, end: 0, color: "bg-loss" },
  ],
  thresholds: [-80, -20],
};
