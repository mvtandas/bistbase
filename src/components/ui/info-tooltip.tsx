"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info } from "lucide-react";

interface InfoTooltipProps {
  title: string;
  description: string;
  thresholds?: string[];
}

export function InfoTooltip({ title, description, thresholds }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="inline-flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        onClick={() => setOpen(!open)}
      >
        <Info className="h-3 w-3" />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 text-xs" side="top" align="start">
        <p className="font-semibold text-foreground mb-1">{title}</p>
        <p className="text-muted-foreground leading-relaxed">{description}</p>
        {thresholds && thresholds.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/30 space-y-0.5">
            {thresholds.map((t, i) => (
              <p key={i} className="text-muted-foreground/70">{t}</p>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
