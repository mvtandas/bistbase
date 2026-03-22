"use client";

import { Briefcase, Plus, Compass } from "lucide-react";
import Link from "next/link";

interface HoldingsEmptyStateProps {
  onAdd: () => void;
}

export function HoldingsEmptyState({ onAdd }: HoldingsEmptyStateProps) {
  return (
    <div className="bento-card p-10 animate-slide-up">
      <div className="flex flex-col items-center text-center space-y-5">
        {/* Icon */}
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-ai-primary/10">
          <Briefcase className="h-7 w-7 text-ai-primary" />
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-foreground">Portföyünüz Boş</h3>
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
            Hisse ekleyerek AI destekli analiz, sinyal takibi ve risk yönetiminden yararlanın.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-2 rounded-xl bg-ai-primary text-white px-5 py-2.5 text-sm font-medium hover:bg-ai-primary/90 transition-colors shadow-lg shadow-ai-primary/20"
          >
            <Plus className="h-4 w-4" />
            Hisse Ekle
            <kbd className="hidden sm:inline-flex ml-1 px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-mono">
              ⌘K
            </kbd>
          </button>
          <Link
            href="/dashboard/explore"
            className="inline-flex items-center gap-2 rounded-xl border border-border/40 px-5 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Compass className="h-4 w-4" />
            Keşfet
          </Link>
        </div>

        {/* Feature hints */}
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {["AI Analiz", "Sinyal Takibi", "Risk Yönetimi"].map((feature) => (
            <span
              key={feature}
              className="px-3 py-1 rounded-full bg-muted/50 text-[11px] text-muted-foreground/60"
            >
              {feature}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
