"use client";

import { Sparkles, TrendingUp, Minus, TrendingDown } from "lucide-react";

const VERDICT_BADGES = [
  { label: "Güçlü Al", confidence: 82, color: "from-emerald-500/20 to-emerald-500/5", border: "border-emerald-500/30", text: "text-emerald-400", icon: TrendingUp },
  { label: "Tut", confidence: 55, color: "from-amber-500/20 to-amber-500/5", border: "border-amber-400/30", text: "text-amber-400", icon: Minus },
  { label: "Sat", confidence: 71, color: "from-rose-500/20 to-rose-500/5", border: "border-rose-500/30", text: "text-rose-400", icon: TrendingDown },
];

export function StepWelcome() {
  return (
    <div className="flex flex-col items-center text-center space-y-8">
      {/* Hero Icon */}
      <div className="relative">
        <div className="absolute inset-0 bg-ai-primary/20 rounded-full blur-2xl animate-morph-blob" />
        <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-ai-primary/20 to-ai-premium/20 border border-ai-primary/20 flex items-center justify-center animate-float-slow">
          <Sparkles className="h-10 w-10 text-ai-primary" />
        </div>
        {/* Floating sparkle particles */}
        <div className="absolute -top-2 -right-2 w-3 h-3 rounded-full bg-ai-primary/40 animate-sparkle" />
        <div className="absolute -bottom-1 -left-3 w-2 h-2 rounded-full bg-ai-premium/40 animate-sparkle" style={{ animationDelay: "0.7s" }} />
        <div className="absolute top-1 -left-4 w-1.5 h-1.5 rounded-full bg-gain/40 animate-sparkle" style={{ animationDelay: "1.4s" }} />
      </div>

      {/* Text */}
      <div className="space-y-3 max-w-md">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
          Yapay Zeka ile
          <br />
          <span className="bg-gradient-to-r from-ai-primary via-ai-premium to-ai-primary bg-[length:200%_auto] animate-[gradientShift_3s_ease-in-out_infinite] bg-clip-text text-transparent">
            Borsa Analizi
          </span>
        </h1>
        <p className="text-muted-foreground text-base leading-relaxed">
          bistbase, BİST hisselerini her gün yapay zeka ile analiz eder ve size
          <span className="text-foreground font-medium"> kişiselleştirilmiş yatırım kararları </span>
          sunar.
        </p>
      </div>

      {/* Verdict Preview Cards */}
      <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-sm">
        {VERDICT_BADGES.map((badge, i) => {
          const Icon = badge.icon;
          return (
            <div
              key={badge.label}
              className={`flex-1 w-full sm:w-auto relative overflow-hidden rounded-xl border ${badge.border} bg-gradient-to-b ${badge.color} p-3 backdrop-blur-sm animate-slide-up`}
              style={{ animationDelay: `${0.2 + i * 0.1}s`, animationFillMode: "both" }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className={`h-4 w-4 ${badge.text}`} strokeWidth={2.5} />
                <span className={`text-sm font-bold ${badge.text}`}>{badge.label}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${badge.text === "text-emerald-400" ? "bg-emerald-400" : badge.text === "text-amber-400" ? "bg-amber-400" : "bg-rose-400"}`}
                    style={{ width: `${badge.confidence}%`, transition: "width 1s ease-out" }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground font-medium tabular-nums">%{badge.confidence}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
