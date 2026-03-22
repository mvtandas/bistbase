"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Shield } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { QUERY_KEYS } from "@/lib/constants";

function GaugeArc({ score }: { score: number }) {
  const radius = 45;
  const circumference = Math.PI * radius; // half circle
  const percent = Math.max(0, Math.min(100, score)) / 100;
  const offset = circumference * (1 - percent);

  const getColor = (s: number) => {
    if (s >= 70) return "#34d399"; // gain
    if (s >= 50) return "#fbbf24"; // amber
    return "#fb7185"; // loss
  };

  return (
    <svg viewBox="0 0 100 60" className="w-full max-w-[180px] mx-auto">
      {/* Background arc */}
      <path
        d="M 5 55 A 45 45 0 0 1 95 55"
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="8"
        strokeLinecap="round"
      />
      {/* Score arc */}
      <path
        d="M 5 55 A 45 45 0 0 1 95 55"
        fill="none"
        stroke={getColor(score)}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="animate-gauge-arc"
        style={{ transition: "stroke-dashoffset 1.2s ease-out" }}
      />
    </svg>
  );
}

export function PortfolioHealthGauge() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, isLoading } = useQuery<any>({
    queryKey: QUERY_KEYS.PORTFOLIO_INTELLIGENCE,
    queryFn: () => fetch("/api/portfolio-intelligence").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="bento-card">
        <div className="bento-card-header"><Skeleton className="h-4 w-32" /></div>
        <div className="bento-card-body"><Skeleton className="h-[200px] w-full" /></div>
      </div>
    );
  }

  const health = data?.healthScore;
  if (!health) return null;

  return (
    <div className="bento-card animate-slide-up">
      <div className="bento-card-header">
        <Shield className="h-4 w-4 text-ai-primary" />
        <span className="bento-card-title">Portföy Sağlığı</span>
      </div>
      <div className="bento-card-body">
        {/* Gauge */}
        <div className="relative mb-2">
          <GaugeArc score={health.totalScore} />
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
            <span className={cn("text-3xl font-black tabular-nums",
              health.totalScore >= 70 ? "text-gain" :
              health.totalScore >= 50 ? "text-amber-400" : "text-loss"
            )}>
              {health.grade}
            </span>
            <span className="text-xs text-muted-foreground/60">{health.gradeLabel} · {health.totalScore}/100</span>
          </div>
        </div>

        {/* Sub scores */}
        <div className="space-y-2.5 mt-4">
          {health.subScores.map((sub: { label: string; score: number; weight: number; description: string }) => (
            <div key={sub.label}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground/70">{sub.label}</span>
                <span className={cn("font-bold tabular-nums",
                  sub.score >= 70 ? "text-gain" : sub.score >= 50 ? "text-amber-400" : "text-loss"
                )}>{sub.score}</span>
              </div>
              <div className="h-1.5 rounded-full bg-border/20 overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-1000",
                    sub.score >= 70 ? "bg-gain" : sub.score >= 50 ? "bg-amber-400" : "bg-loss"
                  )}
                  style={{ width: `${sub.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
