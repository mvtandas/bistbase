"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Zap, Shield } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { QUERY_KEYS } from "@/lib/constants";

const SEVERITY_CONFIG = {
  LOW: { bg: "bg-gain/10", text: "text-gain", label: "Düşük" },
  MEDIUM: { bg: "bg-amber-400/10", text: "text-amber-400", label: "Orta" },
  HIGH: { bg: "bg-loss/10", text: "text-loss", label: "Yüksek" },
  EXTREME: { bg: "bg-loss/20", text: "text-loss", label: "Aşırı" },
};

export function StressTestCard() {
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

  const stressTest = data?.stressTest;
  if (!stressTest || !stressTest.scenarios || stressTest.scenarios.length === 0) return (
    <div className="bento-card">
      <div className="bento-card-header">
        <Zap className="h-4 w-4 text-amber-400" />
        <span className="bento-card-title">Stres Testi</span>
      </div>
      <div className="bento-card-body flex items-center justify-center py-8">
        <p className="text-xs text-muted-foreground/50">Stres testi verisi mevcut değil.</p>
      </div>
    </div>
  );

  return (
    <div className="bento-card animate-slide-up">
      <div className="bento-card-header">
        <Zap className="h-4 w-4 text-amber-400" />
        <span className="bento-card-title">Stres Testi</span>
        <div className="flex items-center gap-1.5 ml-auto">
          <Shield className="h-3.5 w-3.5 text-muted-foreground/40" />
          <span className={cn("text-xs font-bold",
            stressTest.portfolioResilience >= 60 ? "text-gain" :
            stressTest.portfolioResilience >= 40 ? "text-amber-400" : "text-loss"
          )}>
            Dayanıklılık: {stressTest.portfolioResilience}/100
          </span>
        </div>
      </div>
      <div className="bento-card-body">
        <div className="space-y-2.5">
          {stressTest.scenarios.map((s: { id: string; name: string; description: string; severity: string; estimatedImpact: number }) => {
            const sev = SEVERITY_CONFIG[s.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.MEDIUM;
            return (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-card/20 border border-border/10 hover:border-border/25 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-foreground">{s.name}</span>
                    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", sev.bg, sev.text)}>
                      {sev.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground/60 truncate">{s.description}</p>
                </div>
                <div className={cn("text-base font-bold tabular-nums ml-3",
                  s.estimatedImpact > -5 ? "text-amber-400" : "text-loss"
                )}>
                  {s.estimatedImpact}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
