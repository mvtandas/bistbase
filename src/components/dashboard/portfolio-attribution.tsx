"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { PieChart, TrendingUp, TrendingDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { QUERY_KEYS } from "@/lib/constants";

interface Attribution {
  totalExcessReturn: number;
  allocationEffect: number;
  selectionEffect: number;
  interactionEffect: number;
  sectorDetails: {
    sector: string;
    sectorName: string;
    portfolioWeight: number;
    benchmarkWeight: number;
    portfolioReturn: number;
    benchmarkReturn: number;
    allocationContrib: number;
    selectionContrib: number;
  }[];
}

export function PortfolioAttribution() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, isLoading } = useQuery<any>({
    queryKey: QUERY_KEYS.PORTFOLIO_INTELLIGENCE,
    queryFn: () => fetch("/api/portfolio-intelligence").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <div className="bento-card"><div className="bento-card-body"><Skeleton className="h-40 w-full" /></div></div>;

  const attr: Attribution | null = data?.attribution ?? null;
  if (!attr || attr.sectorDetails.length === 0) return (
    <div className="bento-card min-w-0">
      <div className="bento-card-header">
        <PieChart className="h-4 w-4 text-ai-primary" />
        <span className="bento-card-title">Performans Ayrıştırma</span>
      </div>
      <div className="bento-card-body flex items-center justify-center py-8">
        <p className="text-xs text-muted-foreground/50">Performans ayrıştırma verisi henüz mevcut değil.</p>
      </div>
    </div>
  );

  return (
    <div className="bento-card animate-slide-up min-w-0">
      <div className="bento-card-header">
        <PieChart className="h-4 w-4 text-ai-primary" />
        <span className="bento-card-title">Performans Ayrıştırma</span>
        <span className="bento-card-subtitle">Brinson-Fachler</span>
      </div>
      <div className="bento-card-body">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="text-center p-3 rounded-xl bg-card/40 border border-border/15">
            <div className="text-[11px] text-muted-foreground/50">Sektör Ağırlığı</div>
            <div className={cn("text-base font-bold tabular-nums mt-0.5", attr.allocationEffect >= 0 ? "text-gain" : "text-loss")}>
              {attr.allocationEffect > 0 ? "+" : ""}{attr.allocationEffect}%
            </div>
          </div>
          <div className="text-center p-3 rounded-xl bg-card/40 border border-border/15">
            <div className="text-[11px] text-muted-foreground/50">Hisse Seçimi</div>
            <div className={cn("text-base font-bold tabular-nums mt-0.5", attr.selectionEffect >= 0 ? "text-gain" : "text-loss")}>
              {attr.selectionEffect > 0 ? "+" : ""}{attr.selectionEffect}%
            </div>
          </div>
          <div className="text-center p-3 rounded-xl bg-card/40 border border-border/15">
            <div className="text-[11px] text-muted-foreground/50">Toplam Alfa</div>
            <div className={cn("text-base font-bold tabular-nums mt-0.5", attr.totalExcessReturn > 0 ? "text-gain" : "text-loss")}>
              {attr.totalExcessReturn > 0 ? "+" : ""}{attr.totalExcessReturn}%
            </div>
          </div>
        </div>

        {/* Sector breakdown */}
        <div className="space-y-2">
          {attr.sectorDetails.slice(0, 5).map(s => {
            const totalContrib = s.allocationContrib + s.selectionContrib;
            const positive = totalContrib > 0;
            return (
              <div key={s.sector} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 flex-1">
                  {positive ? <TrendingUp className="h-3.5 w-3.5 text-gain/70" /> : <TrendingDown className="h-3.5 w-3.5 text-loss/70" />}
                  <span className="text-muted-foreground/70">{s.sectorName}</span>
                  <span className="text-[10px] text-muted-foreground/40">P:%{s.portfolioWeight} B:%{s.benchmarkWeight}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn("tabular-nums font-semibold", s.allocationContrib >= 0 ? "text-gain/80" : "text-loss/80")}>
                    A:{s.allocationContrib > 0 ? "+" : ""}{s.allocationContrib}%
                  </span>
                  <span className={cn("tabular-nums font-semibold", s.selectionContrib >= 0 ? "text-gain/80" : "text-loss/80")}>
                    S:{s.selectionContrib > 0 ? "+" : ""}{s.selectionContrib}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-muted-foreground/40 mt-3 pt-3 border-t border-border/15">
          A = Sektör ağırlık kararı etkisi · S = Hisse seçimi etkisi · BİST100 benchmark
        </p>
      </div>
    </div>
  );
}
