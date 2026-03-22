"use client";

import { useState, type ReactNode, Children } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, BarChart3, Activity, Zap, Shield } from "lucide-react";

const SECTIONS = [
  { label: "Benchmark & Risk", icon: BarChart3 },
  { label: "Performans Analizi", icon: Activity },
  { label: "Ne Olsaydı?", icon: Zap },
  { label: "Risk Detay & Sektör", icon: Shield },
];

interface Props {
  children: ReactNode;
}

export function DashboardSections({ children }: Props) {
  const [openSections, setOpenSections] = useState<Set<number>>(new Set([0])); // İlk bölüm açık

  const toggle = (idx: number) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const childArray = Children.toArray(children);

  return (
    <div className="space-y-2">
      {childArray.map((child, i) => {
        const section = SECTIONS[i];
        if (!section) return child; // Fallback for extra children
        const isOpen = openSections.has(i);
        const Icon = section.icon;

        return (
          <div key={i} className="rounded-xl border border-border/30 bg-card/10 overflow-hidden">
            {/* Section header — clickable */}
            <button
              onClick={() => toggle(i)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-card/20 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-muted-foreground/50" />
                <span className="text-[11px] font-semibold text-muted-foreground/70">{section.label}</span>
              </div>
              <ChevronDown className={cn(
                "h-3.5 w-3.5 text-muted-foreground/40 transition-transform duration-200",
                isOpen && "rotate-180",
              )} />
            </button>

            {/* Section content — collapsible */}
            <div className={cn(
              "overflow-hidden transition-all duration-300 ease-in-out",
              isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0",
            )}>
              <div className="px-3 pb-3">
                {child}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
