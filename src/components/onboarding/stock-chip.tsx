"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StockChipProps {
  code: string;
  name: string;
  onRemove: (code: string) => void;
}

export function StockChip({ code, name, onRemove }: StockChipProps) {
  return (
    <Badge
      variant="secondary"
      className="flex items-center gap-2 px-3 py-2 text-sm bg-ai-primary/10 text-ai-primary border-ai-primary/20"
    >
      <span className="font-semibold">{code}</span>
      <span className="text-muted-foreground">{name}</span>
      <button
        type="button"
        onClick={() => onRemove(code)}
        className="ml-1 hover:text-foreground transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </Badge>
  );
}
