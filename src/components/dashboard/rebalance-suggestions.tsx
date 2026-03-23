"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Scale, TrendingDown, TrendingUp, AlertTriangle, Shield, Layers } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortfolioCore } from "@/hooks/use-portfolio-data";

interface Holding {
  stockCode: string;
  weight: number;
  compositeScore: number | null;
  verdictAction: string | null;
  verdictActionLabel: string | null;
  changePercent: number | null;
  pnlPercent: number | null;
  sectorCode: string | null;
}

interface Suggestion {
  type: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  message: string;
}

interface RebalanceAction {
  icon: typeof TrendingDown;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  title: string;
  description: string;
  stockCode: string | null;
  priority: number; // lower = higher priority
}

function deriveActions(holdings: Holding[], suggestions: Suggestion[]): RebalanceAction[] {
  const actions: RebalanceAction[] = [];

  // 1. Sell signals: SAT/GUCLU_SAT verdict with significant weight
  const sellCandidates = holdings.filter(
    (h) => (h.verdictAction === "SAT" || h.verdictAction === "GUCLU_SAT") && h.weight > 5
  );
  for (const h of sellCandidates) {
    const targetWeight = Math.max(0, Math.round(h.weight * 0.4));
    actions.push({
      icon: TrendingDown,
      iconColor: "text-loss",
      bgColor: "bg-loss/5",
      borderColor: "border-loss/20",
      title: `${h.stockCode} ağırlığını azalt`,
      description: `${h.verdictActionLabel} kararı ile %${h.weight.toFixed(1)} ağırlık taşıyor. %${targetWeight}'e düşürmeyi değerlendirin.`,
      stockCode: h.stockCode,
      priority: h.verdictAction === "GUCLU_SAT" ? 1 : 2,
    });
  }

  // 2. Concentration warning: any stock > 30%
  const concentrated = holdings.filter((h) => h.weight > 30);
  for (const h of concentrated) {
    if (sellCandidates.some((s) => s.stockCode === h.stockCode)) continue;
    actions.push({
      icon: AlertTriangle,
      iconColor: "text-amber-400",
      bgColor: "bg-amber-400/5",
      borderColor: "border-amber-400/20",
      title: `${h.stockCode} yoğunluğu yüksek`,
      description: `%${h.weight.toFixed(1)} ağırlık ile portföyde aşırı yoğunlaşma riski var. %20 altına düşürmeyi değerlendirin.`,
      stockCode: h.stockCode,
      priority: 3,
    });
  }

  // 3. Buy signals: strong holdings with low weight
  const buyCandidates = holdings.filter(
    (h) =>
      (h.verdictAction === "AL" || h.verdictAction === "GUCLU_AL") &&
      h.weight < 15 &&
      (h.compositeScore ?? 0) > 60
  );
  for (const h of buyCandidates) {
    const targetWeight = Math.min(20, Math.round(h.weight * 2.5));
    actions.push({
      icon: TrendingUp,
      iconColor: "text-gain",
      bgColor: "bg-gain/5",
      borderColor: "border-gain/20",
      title: `${h.stockCode} ağırlığını artır`,
      description: `${h.verdictActionLabel} kararı ve ${h.compositeScore} skor ile güçlü. %${h.weight.toFixed(1)}'den %${targetWeight}'e çıkarmayı değerlendirin.`,
      stockCode: h.stockCode,
      priority: h.verdictAction === "GUCLU_AL" ? 4 : 5,
    });
  }

  // 4. Sector diversification from existing suggestions
  const sectorSuggestions = suggestions.filter(
    (s) => s.type === "SECTOR_CONCENTRATION" && s.severity !== "LOW"
  );
  for (const s of sectorSuggestions) {
    actions.push({
      icon: Layers,
      iconColor: "text-ai-primary",
      bgColor: "bg-ai-primary/5",
      borderColor: "border-ai-primary/20",
      title: "Sektör çeşitlendirmesi gerekli",
      description: s.message,
      stockCode: null,
      priority: 6,
    });
  }

  // 5. Low diversification
  if (holdings.length < 4) {
    actions.push({
      icon: Shield,
      iconColor: "text-amber-400",
      bgColor: "bg-amber-400/5",
      borderColor: "border-amber-400/20",
      title: "Portföy çeşitlendirmesi düşük",
      description: `Portföyde sadece ${holdings.length} hisse var. En az 5-8 farklı sektörden hisse eklemeniz önerilir.`,
      stockCode: null,
      priority: 7,
    });
  }

  return actions.sort((a, b) => a.priority - b.priority).slice(0, 5);
}

export function RebalanceSuggestions() {
  const { data, isLoading } = usePortfolioCore();

  const actions = useMemo(() => {
    if (!data?.holdings) return [];
    return deriveActions(data.holdings, data.suggestions ?? []);
  }, [data]);

  if (isLoading) {
    return (
      <div className="bento-card">
        <div className="bento-card-header">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="bento-card-body space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (actions.length === 0) {
    return (
      <div className="bento-card animate-slide-up">
        <div className="bento-card-header">
          <Scale className="h-4 w-4 text-ai-primary" />
          <span className="bento-card-title">Rebalance Önerileri</span>
        </div>
        <div className="bento-card-body flex items-center justify-center">
          <p className="text-sm text-muted-foreground/50">
            Portföyünüz dengeli görünüyor — şu an bir öneri yok.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bento-card animate-slide-up">
      <div className="bento-card-header">
        <Scale className="h-4 w-4 text-ai-primary" />
        <span className="bento-card-title">Rebalance Önerileri</span>
        <span className="bento-card-subtitle">{actions.length} öneri</span>
      </div>
      <div className="bento-card-body space-y-2.5">
        {actions.map((action, i) => (
          <div
            key={i}
            className={cn(
              "flex items-start gap-3 rounded-xl border p-3.5 transition-colors",
              action.bgColor,
              action.borderColor
            )}
          >
            <div className={cn("mt-0.5 shrink-0", action.iconColor)}>
              <action.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{action.title}</p>
              <p className="text-xs text-muted-foreground/70 mt-0.5 leading-relaxed">
                {action.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
