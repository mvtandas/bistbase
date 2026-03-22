"use client";

import { useQuery } from "@tanstack/react-query";
import { Sparkles, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { QUERY_KEYS } from "@/lib/constants";

export function PortfolioNarrative() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, isLoading, refetch, isFetching } = useQuery<any>({
    queryKey: QUERY_KEYS.PORTFOLIO_INTELLIGENCE,
    queryFn: () => fetch("/api/portfolio-intelligence").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="bento-card">
        <div className="bento-card-header"><Skeleton className="h-4 w-32" /></div>
        <div className="bento-card-body"><Skeleton className="h-24 w-full" /></div>
      </div>
    );
  }

  const narrative = data?.narrative;
  if (!narrative) return null;

  return (
    <div className="bento-card animate-slide-up relative overflow-hidden">
      {/* AI gradient accent */}
      <div className="absolute inset-0 bg-gradient-to-br from-ai-primary/5 via-transparent to-ai-premium/5 pointer-events-none" />

      <div className="bento-card-header relative z-10">
        <Sparkles className="h-4 w-4 text-ai-primary" />
        <span className="bento-card-title">AI Portföy Özeti</span>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="ml-auto p-1.5 rounded-lg hover:bg-card/50 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>
      <div className="bento-card-body relative z-10">
        <p className="text-sm text-foreground/85 leading-relaxed">{narrative}</p>
      </div>
    </div>
  );
}
