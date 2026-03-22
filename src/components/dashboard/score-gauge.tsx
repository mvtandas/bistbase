"use client";

import { cn } from "@/lib/utils";

interface ScoreGaugeProps {
  score: number; // 0-100
  label: string;
  size?: "sm" | "md" | "lg";
}

export function ScoreGauge({ score, label, size = "md" }: ScoreGaugeProps) {
  const clampedScore = Math.max(0, Math.min(100, score));

  // Color based on score
  const color =
    clampedScore >= 70
      ? "text-gain"
      : clampedScore >= 45
        ? "text-amber-400"
        : "text-loss";

  const strokeColor =
    clampedScore >= 70
      ? "stroke-gain"
      : clampedScore >= 45
        ? "stroke-amber-400"
        : "stroke-loss";

  // SVG arc math
  const radius = 40;
  const circumference = Math.PI * radius; // half circle
  const dashOffset = circumference - (clampedScore / 100) * circumference;

  const dimensions = {
    sm: { w: "w-16", h: "h-10", text: "text-sm", label: "text-[8px]" },
    md: { w: "w-24", h: "h-14", text: "text-xl", label: "text-[9px]" },
    lg: { w: "w-32", h: "h-20", text: "text-3xl", label: "text-[10px]" },
  }[size];

  return (
    <div className={cn("flex flex-col items-center", dimensions.w)}>
      <div className={cn("relative", dimensions.w, dimensions.h)}>
        <svg
          viewBox="0 0 100 55"
          className="w-full h-full"
          fill="none"
        >
          {/* Background arc */}
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            className="text-border/30"
          />
          {/* Score arc */}
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            strokeWidth="6"
            strokeLinecap="round"
            className={strokeColor}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
          />
        </svg>
        {/* Score number */}
        <div className="absolute inset-0 flex items-end justify-center pb-0">
          <span className={cn("font-bold tabular-nums", dimensions.text, color)}>
            {clampedScore}
          </span>
        </div>
      </div>
      <span
        className={cn(
          "font-medium text-muted-foreground mt-0.5 text-center",
          dimensions.label
        )}
      >
        {label}
      </span>
    </div>
  );
}
