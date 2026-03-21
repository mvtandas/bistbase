import { cn } from "@/lib/utils";

interface SentimentIndicatorProps {
  sentiment: string | null;
}

const sentimentConfig = {
  POSITIVE: { label: "Pozitif Duyarlılık", color: "bg-gain", textColor: "text-gain" },
  NEGATIVE: { label: "Negatif Duyarlılık", color: "bg-loss", textColor: "text-loss" },
  NEUTRAL: { label: "Nötr Duyarlılık", color: "bg-muted-foreground", textColor: "text-muted-foreground" },
} as const;

export function SentimentIndicator({ sentiment }: SentimentIndicatorProps) {
  const config = sentiment
    ? sentimentConfig[sentiment as keyof typeof sentimentConfig]
    : sentimentConfig.NEUTRAL;

  if (!config) return null;

  return (
    <div className="flex items-center gap-2">
      <div className={cn("h-1.5 w-1.5 rounded-full", config.color)} />
      <span className={cn("text-xs font-medium", config.textColor)}>
        {config.label}
      </span>
    </div>
  );
}
