"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { AlertTriangle, TrendingDown, ArrowRightLeft, ShieldAlert } from "lucide-react";
import { QUERY_KEYS } from "@/lib/constants";

interface Alert {
  type: "verdict_change" | "drawdown" | "concentration" | "signal";
  severity: "warning" | "danger";
  message: string;
  icon: typeof AlertTriangle;
}

export function PortfolioAlerts() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, isLoading } = useQuery<any>({
    queryKey: QUERY_KEYS.PORTFOLIO_INTELLIGENCE,
    queryFn: () => fetch("/api/portfolio-intelligence").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading || !data) return null;

  const alerts: Alert[] = [];

  // Drawdown alert
  if (data.drawdown?.currentDrawdown < -5) {
    alerts.push({
      type: "drawdown",
      severity: data.drawdown.currentDrawdown < -10 ? "danger" : "warning",
      message: `Portföy zirveden %${Math.abs(data.drawdown.currentDrawdown)} düşüşte`,
      icon: TrendingDown,
    });
  }

  // Concentration alerts from suggestions
  for (const s of (data.suggestions ?? [])) {
    if (s.type === "SINGLE_STOCK" && s.severity === "HIGH") {
      alerts.push({
        type: "concentration",
        severity: "warning",
        message: s.message,
        icon: ShieldAlert,
      });
    }
    if (s.type === "SELL_VERDICT") {
      alerts.push({
        type: "verdict_change",
        severity: "danger",
        message: s.message,
        icon: ArrowRightLeft,
      });
    }
  }

  // High correlation warning
  const highCorr = (data.correlations ?? []).filter((c: { correlation: number }) => Math.abs(c.correlation) > 0.85);
  if (highCorr.length > 0) {
    alerts.push({
      type: "signal",
      severity: "warning",
      message: `${highCorr.length} hisse çifti çok yüksek korelasyona sahip (>0.85)`,
      icon: AlertTriangle,
    });
  }

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2 animate-slide-up">
      {alerts.slice(0, 3).map((alert, i) => {
        const Icon = alert.icon;
        return (
          <div
            key={i}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl border text-sm",
              alert.severity === "danger"
                ? "bg-loss/5 border-loss/20 text-loss/90"
                : "bg-amber-400/5 border-amber-400/20 text-amber-400/90",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{alert.message}</span>
          </div>
        );
      })}
    </div>
  );
}
