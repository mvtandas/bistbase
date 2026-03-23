"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { QUERY_KEYS } from "@/lib/constants";

function getReturnColor(value: number): string {
  if (value >= 2) return "bg-gain/80";
  if (value >= 1) return "bg-gain/50";
  if (value >= 0.3) return "bg-gain/25";
  if (value >= -0.3) return "bg-border/20";
  if (value >= -1) return "bg-loss/25";
  if (value >= -2) return "bg-loss/50";
  return "bg-loss/80";
}

export function PerformanceCalendar() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, isLoading } = useQuery<any>({
    queryKey: QUERY_KEYS.PORTFOLIO_INTELLIGENCE,
    queryFn: () => fetch("/api/portfolio-intelligence").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="bento-card">
        <div className="bento-card-header"><Skeleton className="h-4 w-40" /></div>
        <div className="bento-card-body"><Skeleton className="h-24 w-full" /></div>
      </div>
    );
  }

  const curve = data?.equityCurve ?? [];
  if (curve.length < 10) return (
    <div className="bento-card">
      <div className="bento-card-header">
        <Calendar className="h-4 w-4 text-ai-primary" />
        <span className="bento-card-title">Performans Takvimi</span>
      </div>
      <div className="bento-card-body flex items-center justify-center py-8">
        <p className="text-xs text-muted-foreground/50">Takvim görünümü için en az 10 günlük veri gerekli.</p>
      </div>
    </div>
  );

  // Calculate daily returns from equity curve
  const dailyData: { date: string; returnPct: number }[] = [];
  for (let i = 1; i < curve.length; i++) {
    const prev = curve[i - 1].portfolioValue;
    const curr = curve[i].portfolioValue;
    if (prev > 0) {
      dailyData.push({
        date: curve[i].date,
        returnPct: Math.round(((curr - prev) / prev) * 10000) / 100,
      });
    }
  }

  // Take last ~120 trading days (≈6 months)
  const recent = dailyData.slice(-120);

  // Group by ISO week for GitHub-style grid (5 trading days per column)
  type DayCell = { date: string; returnPct: number } | null;
  const weekMap = new Map<string, DayCell[]>();

  for (const day of recent) {
    const d = new Date(day.date);
    const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon ... 5=Fri
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // skip weekends

    // ISO week key: year-weekNumber
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
    const weekKey = `${d.getFullYear()}-${weekNum}`;

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, [null, null, null, null, null]); // Mon-Fri placeholders
    }
    const row = dayOfWeek - 1; // Mon=0, Tue=1, ... Fri=4
    weekMap.get(weekKey)![row] = day;
  }

  const weeks = Array.from(weekMap.values());

  const positiveCount = recent.filter(d => d.returnPct > 0).length;
  const negativeCount = recent.filter(d => d.returnPct < 0).length;

  return (
    <div className="bento-card animate-slide-up">
      <div className="bento-card-header">
        <Calendar className="h-4 w-4 text-ai-primary" />
        <span className="bento-card-title">Performans Takvimi</span>
        <span className="bento-card-subtitle">{recent.length} gün</span>
      </div>
      <div className="bento-card-body">
        {/* Calendar grid — fills container width */}
        <div
          className="grid pb-2"
          style={{
            gridTemplateColumns: `repeat(${weeks.length}, 1fr)`,
            gap: "3px",
          }}
        >
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((day, di) => (
                day ? (
                  <div
                    key={day.date}
                    className={cn("w-full aspect-square rounded-[3px] transition-transform hover:scale-125 cursor-default", getReturnColor(day.returnPct))}
                    title={`${day.date}: ${day.returnPct > 0 ? "+" : ""}${day.returnPct}%`}
                  />
                ) : (
                  <div key={`empty-${wi}-${di}`} className="w-full aspect-square rounded-[3px] bg-border/5" />
                )
              ))}
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/15 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground/60">
              <span className="font-bold text-gain">{positiveCount}</span> pozitif
            </span>
            <span className="text-muted-foreground/60">
              <span className="font-bold text-loss">{negativeCount}</span> negatif
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground/50">Az</span>
            <div className="flex gap-[2px]">
              {["bg-loss/60", "bg-loss/30", "bg-border/20", "bg-gain/30", "bg-gain/60"].map((c, i) => (
                <div key={i} className={cn("w-2.5 h-2.5 rounded-[2px]", c)} />
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground/50">Çok</span>
          </div>
        </div>
      </div>
    </div>
  );
}
