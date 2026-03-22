"use client";

import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { MetricCard } from "@/components/ui/metric-card";
import * as I from "@/lib/stock/interpretations";
import { AlertTriangle } from "lucide-react";
import { SectionHeader } from "@/components/stock-detail/shared";
import type { StockDetail } from "@/components/stock-detail/types";

interface RiskTabProps {
  d: StockDetail;
  timeLabel: "realtime" | "daily" | "weekly" | "monthly";
}

export function RiskTab({ d, timeLabel }: RiskTabProps) {
  const rm = d.riskMetrics;

  if (!rm) {
    return (
      <div className="rounded-xl border border-border/40 bg-card/30 p-6 text-center">
        <p className="text-sm text-muted-foreground">Risk verisi mevcut değil.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Risk Profile */}
      <div className="rounded-xl border border-border/40 bg-card/30 p-4">
        <SectionHeader icon={AlertTriangle} label="Risk Profili" subtitle="Bu hisseyi tutmanın riskleri — oynakılık, kayıp senaryoları ve piyasa hassasiyeti." tooltip="Sharpe oranı, VaR, max drawdown, beta gibi risk metrikleri." timeLabel={timeLabel} />

        {/* Risk level badge */}
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border/20">
          <span className={cn("text-sm font-bold px-2 py-1 rounded", rm.riskLevel === "LOW" ? "bg-gain/10 text-gain" : rm.riskLevel === "MODERATE" ? "bg-amber-400/10 text-amber-400" : "bg-loss/10 text-loss")}>
            {rm.riskLevelTr}
          </span>
          {rm.annualVolatility != null && (
            <span className="text-[11px] text-muted-foreground">Yıllık Volatilite: %{rm.annualVolatility}</span>
          )}
        </div>

        {/* Key risk metrics with MetricCard */}
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="Sharpe Oranı"
            subtitle="Risk-Getiri Kalitesi"
            value={rm.sharpeRatio != null ? String(rm.sharpeRatio) : "—"}
            status={rm.sharpeRatio != null ? ((rm.sharpeRatio) > 1 ? "positive" : (rm.sharpeRatio) > 0 ? "neutral" : "negative") : undefined}
            interpretation={I.interpretSharpe(rm.sharpeRatio)}
            tooltip={{ title: "Sharpe Oranı", description: "Aldığın risk başına ne kadar getiri kazandığını ölçer. 1+ iyi, 2+ mükemmel, 0 altı mevduattan kötü." }}
          />
          <MetricCard
            label="VaR (95%)"
            subtitle="Günlük Max Kayıp Riski"
            value={rm.var95Daily != null ? `%${rm.var95Daily}` : "—"}
            status={rm.var95Daily != null ? (Math.abs(rm.var95Daily) < 2 ? "positive" : Math.abs(rm.var95Daily) < 4 ? "neutral" : "negative") : undefined}
            interpretation={I.interpretVaR(rm.var95Daily)}
            tooltip={{ title: "Riske Maruz Değer", description: "%95 güvenle normal bir günde en fazla bu kadar kayıp yaşanır. 20 işlem gününde 1 gün aşılabilir." }}
          />
          <MetricCard
            label="Max Düşüş"
            subtitle="En Büyük Çöküş"
            value={rm.maxDrawdown != null ? `%${rm.maxDrawdown}` : "—"}
            status={rm.maxDrawdown != null ? (Math.abs(rm.maxDrawdown) < 15 ? "positive" : Math.abs(rm.maxDrawdown) < 30 ? "neutral" : "negative") : undefined}
            interpretation={I.interpretMaxDD(rm.maxDrawdown, rm.maxDrawdownDays)}
            tooltip={{ title: "En Büyük Düşüş", description: "Son dönemdeki en derin zirveden-dibe düşüş. Ne kadar düşük olursa hisse o kadar dirençli." }}
          />
          <MetricCard
            label="Beta"
            subtitle="Piyasa Hassasiyeti"
            value={rm.beta != null ? rm.beta.toFixed(2) : "—"}
            status={rm.beta != null ? (rm.beta < 0.8 ? "positive" : rm.beta < 1.3 ? "neutral" : "negative") : undefined}
            interpretation={I.interpretBeta(rm.beta)}
            tooltip={{ title: "Beta Katsayısı", description: "1 = piyasayla aynı hareket. 1+ daha oynak, 1− daha savunmacı. Negatif beta ise ters hareket." }}
          />
        </div>
      </div>

      {/* Stress Tests */}
      {rm.stressTests && rm.stressTests.length > 0 && (
        <div className="rounded-xl border border-border/40 bg-card/30 p-4">
          <SectionHeader icon={AlertTriangle} label="Stres Testi" subtitle="Olası kriz senaryolarında bu hissenin tahmini değer kaybı." timeLabel={timeLabel} />
          <div className="space-y-1.5">
            {rm.stressTests.map((st: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">{st.name}</span>
                <div className="text-right">
                  <span className="font-medium text-loss">%{Math.abs(st.estimatedLoss).toFixed(1)} kayıp</span>
                  <p className="text-[9px] text-muted-foreground/40 italic">{I.interpretStress(st.estimatedLoss)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Liquidity */}
          {rm.liquidityLevel && (
            <div className="mt-2 pt-2 border-t border-border/20 flex justify-between text-[11px]">
              <span className="text-muted-foreground/60 flex items-center gap-1">Likidite <InfoTooltip title="İşlem Hacmi Yeterliliği" description="Hissenin ne kadar kolay alınıp satılabileceği. Düşük likidite = büyük emirlerde fiyat kayması riski." /></span>
              <span className="font-medium text-foreground">{rm.liquidityLevel} ({rm.liquidityScore})</span>
            </div>
          )}

          {/* CVaR */}
          {rm.cvar95Daily != null && (
            <div className="flex justify-between text-[11px] mt-1">
              <span className="text-muted-foreground/60 flex items-center gap-1">CVaR (95%) <InfoTooltip title="Koşullu Riske Maruz Değer" description="VaR aşıldığında ortalama kayıp ne olur? En kötü %5'lik günlerin ortalaması." /></span>
              <span className="font-medium text-loss">%{rm.cvar95Daily} günlük en kötü ort.</span>
            </div>
          )}

          {/* Current Drawdown */}
          {rm.currentDrawdown != null && (
            <div className="flex justify-between text-[11px] mt-1">
              <span className="text-muted-foreground/60">Mevcut Düşüş</span>
              <span className="font-medium text-loss">Zirveden %{rm.currentDrawdown}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
