"use client";

import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { AiInsightCard } from "@/components/stock-detail/AiInsightCard";
import type { PortfoyOzetOutput } from "@/lib/ai/types";

interface Props {
  enabled: boolean;
}

export function PortfolioOzetCard({ enabled }: Props) {
  const { data, isLoading, isError } = useQuery<PortfoyOzetOutput>({
    queryKey: ["portfolio-ai", "portfoy-ozet"],
    queryFn: async () => {
      const r = await fetch("/api/portfolio-intelligence/ai/portfoy-ozet");
      if (!r.ok) throw new Error("AI analizi yuklenemedi");
      const json = await r.json();
      return json.data;
    },
    enabled,
    retry: 1,
    staleTime: 10 * 60 * 1000,
  });

  return (
    <AiInsightCard title="Portfoy Ozeti" icon={Sparkles} loading={isLoading && enabled} error={isError}>
      {data && (
        <div className="space-y-2.5">
          {/* TLDR */}
          <p className="text-[12px] font-medium text-foreground leading-relaxed">{data.tldr}</p>

          {/* Bullets */}
          <div className="space-y-1">
            {data.bullets.map((b, i) => (
              <div key={i} className="flex items-start gap-2 text-[11px]">
                <span className="shrink-0 mt-0.5">{b.icon}</span>
                <span className="text-muted-foreground leading-relaxed">{b.text}</span>
              </div>
            ))}
          </div>

          {/* Health Analysis */}
          <div className="rounded-lg border border-ai-primary/15 bg-ai-primary/5 p-2.5">
            <p className="text-[9px] text-ai-primary font-medium uppercase mb-0.5">Saglik Degerlendirmesi</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed">{data.healthAnalysis}</p>
          </div>

          {/* Top Priority */}
          <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-2.5">
            <p className="text-[9px] text-amber-400 font-medium uppercase mb-0.5">Oncelikli Aksiyon</p>
            <p className="text-[10px] text-foreground leading-relaxed">{data.topPriority}</p>
          </div>

          {/* Watchlist */}
          {data.watchlist.length > 0 && (
            <div className="pt-1.5 border-t border-border/10">
              <p className="text-[9px] text-muted-foreground/50 font-medium uppercase mb-1">Izlenecekler</p>
              <div className="space-y-0.5">
                {data.watchlist.map((w, i) => (
                  <p key={i} className="text-[10px] text-muted-foreground/70">• {w}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </AiInsightCard>
  );
}
