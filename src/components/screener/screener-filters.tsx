"use client";

import { cn } from "@/lib/utils";
import { Filter, X } from "lucide-react";
import type { VerdictAction } from "@/lib/stock/verdict";

const SECTOR_OPTIONS: { code: string; name: string }[] = [
  { code: "XBANK", name: "Bankacılık" },
  { code: "XBLSM", name: "Bilişim" },
  { code: "XELKT", name: "Elektrik" },
  { code: "XGIDA", name: "Gıda" },
  { code: "XGMYO", name: "GYO" },
  { code: "XHOLD", name: "Holding" },
  { code: "XILTM", name: "İletişim" },
  { code: "XINSA", name: "İnşaat" },
  { code: "XKAGT", name: "Kağıt" },
  { code: "XKMYA", name: "Kimya" },
  { code: "XMANA", name: "Maden & Metal" },
  { code: "XSGRT", name: "Sigorta" },
  { code: "XUSIN", name: "Sınai" },
  { code: "XSPOR", name: "Spor" },
  { code: "XTCRT", name: "Ticaret" },
  { code: "XTEKS", name: "Tekstil" },
  { code: "XTRZM", name: "Turizm" },
  { code: "XUHIZ", name: "Hizmetler" },
  { code: "XULAS", name: "Ulaştırma" },
];

interface ScreenerFiltersProps {
  verdictFilter: VerdictAction | "ALL";
  sectorFilter: string;
  scoreRange: [number, number];
  onVerdictChange: (v: VerdictAction | "ALL") => void;
  onSectorChange: (s: string) => void;
  onScoreRangeChange: (r: [number, number]) => void;
  totalCount: number;
  filteredCount: number;
}

const VERDICT_OPTIONS: { value: VerdictAction | "ALL"; label: string }[] = [
  { value: "ALL", label: "Tümü" },
  { value: "GUCLU_AL", label: "Güçlü Al" },
  { value: "AL", label: "Al" },
  { value: "TUT", label: "Tut" },
  { value: "SAT", label: "Sat" },
  { value: "GUCLU_SAT", label: "Güçlü Sat" },
];

const SCORE_PRESETS: { label: string; range: [number, number] }[] = [
  { label: "Tümü", range: [0, 100] },
  { label: "75+", range: [75, 100] },
  { label: "50-75", range: [50, 75] },
  { label: "25-50", range: [25, 50] },
  { label: "<25", range: [0, 25] },
];

export function ScreenerFilters({
  verdictFilter,
  sectorFilter,
  scoreRange,
  onVerdictChange,
  onSectorChange,
  onScoreRangeChange,
  totalCount,
  filteredCount,
}: ScreenerFiltersProps) {
  const hasFilters = verdictFilter !== "ALL" || sectorFilter !== "ALL" || scoreRange[0] !== 0 || scoreRange[1] !== 100;

  const resetAll = () => {
    onVerdictChange("ALL");
    onSectorChange("ALL");
    onScoreRangeChange([0, 100]);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5 text-muted-foreground/60">
        <Filter className="h-3.5 w-3.5" />
        <span className="text-[11px] uppercase tracking-wider font-medium">Filtreler</span>
      </div>

      {/* Verdict Filter */}
      <select
        value={verdictFilter}
        onChange={e => onVerdictChange(e.target.value as VerdictAction | "ALL")}
        className="text-xs bg-card border border-border/50 rounded-lg px-2.5 py-1.5 text-foreground outline-none focus:border-ai-primary/50"
      >
        {VERDICT_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {/* Sector Filter */}
      <select
        value={sectorFilter}
        onChange={e => onSectorChange(e.target.value)}
        className="text-xs bg-card border border-border/50 rounded-lg px-2.5 py-1.5 text-foreground outline-none focus:border-ai-primary/50"
      >
        <option value="ALL">Tüm Sektörler</option>
        {SECTOR_OPTIONS.map(({ code, name }) => (
          <option key={code} value={code}>{name}</option>
        ))}
      </select>

      {/* Score Range */}
      <div className="flex items-center gap-1">
        {SCORE_PRESETS.map(preset => (
          <button
            key={preset.label}
            onClick={() => onScoreRangeChange(preset.range)}
            className={cn(
              "text-[11px] px-2 py-1 rounded-md transition-colors",
              scoreRange[0] === preset.range[0] && scoreRange[1] === preset.range[1]
                ? "bg-ai-primary/15 text-ai-primary font-medium"
                : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-card"
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Count + Reset */}
      <div className="flex items-center gap-2 ml-auto">
        <span className="text-[11px] text-muted-foreground/50">
          {filteredCount}/{totalCount} hisse
        </span>
        {hasFilters && (
          <button
            onClick={resetAll}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
            Temizle
          </button>
        )}
      </div>
    </div>
  );
}
