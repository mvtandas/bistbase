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
  const { data, isLoading } = useQuery<{ attribution: Attribution | null }>({
    queryKey: QUERY_KEYS.PORTFOLIO_INTELLIGENCE,
    queryFn: () => fetch("/api/portfolio-intelligence").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <div className="rounded-xl border border-border/40 bg-card/30 p-4"><Skeleton className="h-32 w-full" /></div>;

  const attr = data?.attribution;
  if (!attr || attr.sectorDetails.length === 0) return null;

  const outperforming = attr.totalExcessReturn > 0;

  return (
    <div className="rounded-xl border border-border/40 bg-card/30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <PieChart className="h-4 w-4 text-ai-primary" />
        <h3 className="text-[12px] font-semibold text-foreground">Performans Ayrıştırma</h3>
        <span className="text-[9px] text-muted-foreground/40 ml-auto">Brinson-Fachler</span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center p-2 rounded-lg bg-card/40 border border-border/15">
          <div className="text-[9px] text-muted-foreground/40">Sektör Ağırlığı</div>
          <div className={cn("text-[13px] font-bold tabular-nums", attr.allocationEffect >= 0 ? "text-gain" : "text-loss")}>
            {attr.allocationEffect > 0 ? "+" : ""}{attr.allocationEffect}%
          </div>
        </div>
        <div className="text-center p-2 rounded-lg bg-card/40 border border-border/15">
          <div className="text-[9px] text-muted-foreground/40">Hisse Seçimi</div>
          <div className={cn("text-[13px] font-bold tabular-nums", attr.selectionEffect >= 0 ? "text-gain" : "text-loss")}>
            {attr.selectionEffect > 0 ? "+" : ""}{attr.selectionEffect}%
          </div>
        </div>
        <div className="text-center p-2 rounded-lg bg-card/40 border border-border/15">
          <div className="text-[9px] text-muted-foreground/40">Toplam Alfa</div>
          <div className={cn("text-[13px] font-bold tabular-nums", outperforming ? "text-gain" : "text-loss")}>
            {attr.totalExcessReturn > 0 ? "+" : ""}{attr.totalExcessReturn}%
          </div>
        </div>
      </div>

      {/* Sector breakdown */}
      <div className="space-y-1.5">
        {attr.sectorDetails.slice(0, 5).map(s => {
          const totalContrib = s.allocationContrib + s.selectionContrib;
          const positive = totalContrib > 0;
          return (
            <div key={s.sector} className="flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-2 flex-1">
                {positive ? <TrendingUp className="h-3 w-3 text-gain/60" /> : <TrendingDown className="h-3 w-3 text-loss/60" />}
                <span className="text-muted-foreground">{s.sectorName}</span>
                <span className="text-[8px] text-muted-foreground/30">P:%{s.portfolioWeight} B:%{s.benchmarkWeight}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("tabular-nums font-medium", s.allocationContrib >= 0 ? "text-gain/70" : "text-loss/70")}>
                  A:{s.allocationContrib > 0 ? "+" : ""}{s.allocationContrib}%
                </span>
                <span className={cn("tabular-nums font-medium", s.selectionContrib >= 0 ? "text-gain/70" : "text-loss/70")}>
                  S:{s.selectionContrib > 0 ? "+" : ""}{s.selectionContrib}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[8px] text-muted-foreground/30 mt-2 pt-2 border-t border-border/10">
        A = Sektör ağırlık kararı etkisi · S = Hisse seçimi etkisi · BİST100 benchmark
      </p>
    </div>
  );
}
