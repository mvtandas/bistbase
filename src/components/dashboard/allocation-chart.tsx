"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { PieChart } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortfolioCore } from "@/hooks/use-portfolio-data";

const COLORS = ["#818cf8", "#34d399", "#fbbf24", "#fb7185", "#a78bfa", "#22d3ee", "#f97316", "#f472b6", "#6ee7b7", "#fcd34d"];

function DonutChart({ items, size = 180 }: { items: { label: string; value: number }[]; size?: number }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total === 0) return null;

  const cx = size / 2, cy = size / 2, radius = (size / 2) - 12, innerRadius = radius * 0.6;
  let startAngle = -90;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[180px] mx-auto">
      {items.map((item, i) => {
        const percent = item.value / total;
        const angle = percent * 360;
        const endAngle = startAngle + angle;

        const largeArc = angle > 180 ? 1 : 0;
        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;

        const x1 = cx + radius * Math.cos(startRad);
        const y1 = cy + radius * Math.sin(startRad);
        const x2 = cx + radius * Math.cos(endRad);
        const y2 = cy + radius * Math.sin(endRad);
        const ix1 = cx + innerRadius * Math.cos(startRad);
        const iy1 = cy + innerRadius * Math.sin(startRad);
        const ix2 = cx + innerRadius * Math.cos(endRad);
        const iy2 = cy + innerRadius * Math.sin(endRad);

        const path = `M ${ix1} ${iy1} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1}`;

        startAngle = endAngle;

        return (
          <path
            key={item.label}
            d={path}
            fill={COLORS[i % COLORS.length]}
            opacity={0.85}
            className="transition-opacity hover:opacity-100"
          >
            <title>{item.label}: %{Math.round(item.value * 10) / 10}</title>
          </path>
        );
      })}
    </svg>
  );
}

function Treemap({ items }: { items: { label: string; value: number }[] }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total === 0) return null;

  return (
    <div className="flex gap-1 h-20 rounded-lg overflow-hidden">
      {items.map((item, i) => {
        const pct = (item.value / total) * 100;
        if (pct < 2) return null;
        return (
          <div
            key={item.label}
            className="relative flex items-center justify-center rounded-md overflow-hidden transition-all hover:brightness-110"
            style={{
              width: `${pct}%`,
              backgroundColor: COLORS[i % COLORS.length] + "30",
              borderLeft: `2px solid ${COLORS[i % COLORS.length]}`,
            }}
            title={`${item.label}: %${Math.round(pct)}`}
          >
            {pct > 10 && (
              <div className="text-center">
                <div className="text-[10px] font-bold text-foreground/80 truncate px-1">{item.label}</div>
                <div className="text-[9px] text-muted-foreground/60">%{Math.round(pct)}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

type ViewMode = "hisse" | "sektor";

export function AllocationChart() {
  const [view, setView] = useState<ViewMode>("hisse");

  const { data, isLoading } = usePortfolioCore();

  if (isLoading) {
    return (
      <div className="bento-card">
        <div className="bento-card-header"><Skeleton className="h-4 w-32" /></div>
        <div className="bento-card-body"><Skeleton className="h-[300px] w-full" /></div>
      </div>
    );
  }

  const allocation = data?.allocation ?? [];
  const sectorAllocation = data?.sectorAllocation ?? [];

  if (allocation.length === 0) return (
    <div className="bento-card">
      <div className="bento-card-header">
        <PieChart className="h-4 w-4 text-ai-primary" />
        <span className="bento-card-title">Dağılım</span>
      </div>
      <div className="bento-card-body flex items-center justify-center py-8">
        <p className="text-xs text-muted-foreground/50">Portföyünüzde henüz hisse bulunmuyor.</p>
      </div>
    </div>
  );

  const items = view === "hisse"
    ? allocation.map((a: { stockCode: string; weight: number }) => ({ label: a.stockCode, value: a.weight }))
    : sectorAllocation.map((s: { sectorName: string; weight: number }) => ({ label: s.sectorName, value: s.weight }));

  return (
    <div className="bento-card animate-slide-up">
      <div className="bento-card-header">
        <PieChart className="h-4 w-4 text-ai-primary" />
        <span className="bento-card-title">Dağılım</span>
        <div className="flex items-center gap-1 ml-auto p-0.5 rounded-lg bg-card/40 border border-border/20">
          {(["hisse", "sektor"] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all capitalize",
                view === v ? "bg-ai-primary text-white shadow-sm" : "text-muted-foreground/60 hover:text-muted-foreground",
              )}
            >
              {v === "hisse" ? "Hisse" : "Sektör"}
            </button>
          ))}
        </div>
      </div>
      <div className="bento-card-body">
        <DonutChart items={items} />

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-5 justify-center">
          {items.map((item: { label: string; value: number }, i: number) => (
            <span key={item.label} className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              {item.label} <span className="font-bold text-foreground/80">%{Math.round(item.value)}</span>
            </span>
          ))}
        </div>

        {/* Treemap */}
        <div className="mt-4">
          <Treemap items={items} />
        </div>
      </div>
    </div>
  );
}
