"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface AiInsightCardProps {
  title: string;
  icon: LucideIcon;
  loading?: boolean;
  error?: boolean;
  className?: string;
  borderColor?: string;
  children: React.ReactNode;
}

function ShimmerSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded bg-muted/40", className)}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}

export function AiInsightCard({ title, icon: Icon, loading, error, className, borderColor, children }: AiInsightCardProps) {
  if (loading) {
    return (
      <div className={cn("rounded-xl border-l-2 border-l-ai-primary border border-ai-primary/15 bg-gradient-to-r from-ai-primary/8 to-transparent p-4", className)}>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-6 w-6 rounded-md bg-ai-primary/15 flex items-center justify-center">
            <Icon className="h-3.5 w-3.5 text-ai-primary animate-pulse" />
          </div>
          <span className="text-xs font-semibold text-ai-primary">{title}</span>
          <div className="flex items-center gap-1.5 ml-auto">
            <div className="h-1.5 w-1.5 rounded-full bg-ai-primary animate-pulse" />
            <span className="text-[10px] text-muted-foreground/50">Analiz ediliyor</span>
          </div>
        </div>
        <div className="space-y-2">
          <ShimmerSkeleton className="h-4 w-full" />
          <ShimmerSkeleton className="h-4 w-5/6" />
          <ShimmerSkeleton className="h-4 w-4/6" />
          <ShimmerSkeleton className="h-3 w-3/6" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("rounded-xl border border-border/30 bg-card/20 p-4", className)}>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground/40" />
          <span className="text-xs font-medium text-muted-foreground/60">{title}</span>
        </div>
        <p className="text-[11px] text-muted-foreground/50 mt-2">AI analizi su anda uretilemedi.</p>
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-xl border-l-2 border-l-ai-primary border bg-gradient-to-r from-ai-primary/5 to-transparent p-4",
      borderColor ?? "border-ai-primary/15",
      className
    )}>
      <div className="flex items-center gap-2 mb-3">
        <div className="h-6 w-6 rounded-md bg-ai-primary/10 flex items-center justify-center">
          <Icon className="h-3.5 w-3.5 text-ai-primary" />
        </div>
        <span className="text-xs font-semibold text-foreground">{title}</span>
        <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-ai-primary/10 text-ai-primary ml-auto tracking-wide">AI</span>
      </div>
      {children}
      <p className="text-[9px] text-muted-foreground/40 mt-3 pt-2 border-t border-border/10">
        Yatirim tavsiyesi degildir. Kararlarinizi kendi arastirmaniza dayandirin.
      </p>
    </div>
  );
}
