"use client";

import { useQuery } from "@tanstack/react-query";
import { Newspaper, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarketPollingInterval } from "@/hooks/use-market-polling";

interface NewsItem {
  stockCode: string;
  title: string;
}

export function NewsFeed() {
  const pollingInterval = useMarketPollingInterval();
  const { data, isLoading, refetch, isFetching } = useQuery<{ news: NewsItem[] }>({
    queryKey: ["portfolio-news"],
    queryFn: () => fetch("/api/portfolio-news").then((r) => r.json()),
    staleTime: pollingInterval * 4, // haberler daha az sık yeterli
    refetchInterval: pollingInterval * 4,
  });

  if (isLoading) {
    return (
      <div className="bento-card">
        <div className="bento-card-header"><Skeleton className="h-4 w-32" /></div>
        <div className="bento-card-body space-y-2.5">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const news = data?.news ?? [];
  if (news.length === 0) {
    return (
      <div className="bento-card animate-slide-up">
        <div className="bento-card-header">
          <Newspaper className="h-4 w-4 text-ai-primary" />
          <span className="bento-card-title">Portföy Haberleri</span>
        </div>
        <div className="bento-card-body flex items-center justify-center">
          <p className="text-sm text-muted-foreground/50">Henüz haber bulunamadı.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bento-card animate-slide-up">
      <div className="bento-card-header">
        <Newspaper className="h-4 w-4 text-ai-primary" />
        <span className="bento-card-title">Portföy Haberleri</span>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="ml-auto p-1.5 rounded-lg hover:bg-card/50 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>
      <div className="bento-card-body">
        <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
          {news.map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-2.5 rounded-xl border border-border/15 bg-card/20 px-3.5 py-2.5 hover:bg-card/40 transition-colors"
            >
              <span className="shrink-0 text-[10px] font-bold text-ai-primary bg-ai-primary/10 px-2 py-0.5 rounded-md mt-0.5">
                {item.stockCode}
              </span>
              <p className="text-xs text-foreground/80 leading-relaxed line-clamp-2">
                {item.title}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
