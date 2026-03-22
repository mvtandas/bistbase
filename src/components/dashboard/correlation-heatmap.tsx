"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Grid3X3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { QUERY_KEYS } from "@/lib/constants";

function getCorrelationColor(value: number): string {
  const abs = Math.abs(value);
  if (value >= 0.7) return `rgba(251, 113, 133, ${0.3 + abs * 0.5})`; // red
  if (value >= 0.3) return `rgba(251, 191, 36, ${0.2 + abs * 0.3})`; // amber
  if (value >= -0.3) return `rgba(255, 255, 255, 0.05)`; // neutral
  if (value >= -0.7) return `rgba(34, 211, 238, ${0.2 + abs * 0.3})`; // cyan
  return `rgba(34, 211, 238, ${0.3 + abs * 0.5})`; // deep cyan
}

export function CorrelationHeatmap() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, isLoading } = useQuery<any>({
    queryKey: QUERY_KEYS.PORTFOLIO_INTELLIGENCE,
    queryFn: () => fetch("/api/portfolio-intelligence").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="bento-card">
        <div className="bento-card-header"><Skeleton className="h-4 w-32" /></div>
        <div className="bento-card-body"><Skeleton className="h-[200px] w-full" /></div>
      </div>
    );
  }

  const correlations: { pair: [string, string]; correlation: number }[] = data?.correlations ?? [];
  const holdings: { stockCode: string }[] = data?.holdings ?? [];

  if (holdings.length < 3 || correlations.length === 0) return null;

  const codes = holdings.map(h => h.stockCode);

  // Build correlation matrix
  const matrix = new Map<string, number>();
  for (const c of correlations) {
    matrix.set(`${c.pair[0]}-${c.pair[1]}`, c.correlation);
    matrix.set(`${c.pair[1]}-${c.pair[0]}`, c.correlation);
  }

  return (
    <div className="bento-card animate-slide-up">
      <div className="bento-card-header">
        <Grid3X3 className="h-4 w-4 text-ai-primary" />
        <span className="bento-card-title">Korelasyon Matrisi</span>
        <span className="bento-card-subtitle">{codes.length} hisse</span>
      </div>
      <div className="bento-card-body">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="w-16" />
                {codes.map(code => (
                  <th key={code} className="text-[10px] font-medium text-muted-foreground/60 px-1 py-1.5 text-center" style={{ writingMode: codes.length > 6 ? "vertical-rl" : undefined }}>
                    {code}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {codes.map((row, ri) => (
                <tr key={row}>
                  <td className="text-[10px] font-medium text-muted-foreground/60 pr-2 py-1">{row}</td>
                  {codes.map((col, ci) => {
                    const isIdentity = ri === ci;
                    const corr = isIdentity ? 1 : (matrix.get(`${row}-${col}`) ?? 0);

                    return (
                      <td
                        key={col}
                        className="p-0.5 text-center"
                        title={`${row} × ${col}: ${corr.toFixed(2)}`}
                      >
                        <div
                          className="w-full aspect-square rounded-sm flex items-center justify-center text-[9px] font-bold tabular-nums transition-transform hover:scale-110"
                          style={{ backgroundColor: isIdentity ? "rgba(129,140,248,0.15)" : getCorrelationColor(corr), minWidth: "28px", minHeight: "28px" }}
                        >
                          {isIdentity ? "1" : corr.toFixed(1)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-3 mt-3 pt-3 border-t border-border/15 text-[10px] text-muted-foreground/60">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "rgba(34,211,238,0.5)" }} /> Negatif</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "rgba(255,255,255,0.05)" }} /> Nötr</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "rgba(251,113,133,0.5)" }} /> Pozitif</span>
        </div>
      </div>
    </div>
  );
}
