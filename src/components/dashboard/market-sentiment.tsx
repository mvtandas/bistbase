"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreGauge } from "./score-gauge";

interface SentimentData {
  avgScore: number;
  totalAnalyzed: number;
  verdictDistribution: Record<string, number>;
  signalCounts: { BULLISH: number; BEARISH: number; NEUTRAL: number };
}

const VERDICT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  GUCLU_AL: { bg: "bg-gain", text: "text-gain", label: "Güçlü Al" },
  AL: { bg: "bg-emerald-400", text: "text-emerald-400", label: "Al" },
  TUT: { bg: "bg-amber-400", text: "text-amber-400", label: "Tut" },
  SAT: { bg: "bg-orange-400", text: "text-orange-400", label: "Sat" },
  GUCLU_SAT: { bg: "bg-loss", text: "text-loss", label: "Güçlü Sat" },
};

export function MarketSentiment() {
  const { data, isLoading } = useQuery<SentimentData>({
    queryKey: ["market-sentiment"],
    queryFn: () => fetch("/api/market-sentiment").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="bento-card">
        <div className="bento-card-header"><Skeleton className="h-4 w-36" /></div>
        <div className="bento-card-body flex flex-col items-center gap-4">
          <Skeleton className="h-20 w-24 rounded" />
          <Skeleton className="h-4 w-full rounded-full" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const totalSignals = data.signalCounts.BULLISH + data.signalCounts.BEARISH + data.signalCounts.NEUTRAL;

  return (
    <div className="bento-card animate-slide-up">
      <div className="bento-card-header">
        <Activity className="h-4 w-4 text-ai-primary" />
        <span className="bento-card-title">Piyasa Duyarlılığı</span>
        <span className="bento-card-subtitle">{data.totalAnalyzed} hisse</span>
      </div>
      <div className="bento-card-body space-y-4">
        {/* Score Gauge */}
        <div className="flex justify-center">
          <ScoreGauge
            score={data.avgScore}
            label={data.avgScore >= 65 ? "Boğa" : data.avgScore >= 45 ? "Nötr" : "Ayı"}
            size="lg"
          />
        </div>

        {/* Verdict Distribution Bar */}
        <div>
          <div className="text-[10px] text-muted-foreground/50 mb-1.5">Karar Dağılımı</div>
          <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
            {Object.entries(VERDICT_COLORS).map(([key, vc]) => {
              const pct = data.verdictDistribution[key] ?? 0;
              if (pct === 0) return null;
              return (
                <div
                  key={key}
                  className={cn("h-full transition-all duration-700", vc.bg)}
                  style={{ width: `${pct}%` }}
                  title={`${vc.label}: %${pct}`}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
            {Object.entries(VERDICT_COLORS).map(([key, vc]) => {
              const pct = data.verdictDistribution[key] ?? 0;
              if (pct === 0) return null;
              return (
                <span key={key} className={cn("text-[10px] font-medium", vc.text)}>
                  {vc.label} %{pct}
                </span>
              );
            })}
          </div>
        </div>

        {/* Signal Counts */}
        {totalSignals > 0 && (
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-gain font-semibold">
              {data.signalCounts.BULLISH} boğa sinyali
            </span>
            <span className="text-loss font-semibold">
              {data.signalCounts.BEARISH} ayı sinyali
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
