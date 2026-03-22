"use client";

import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { MetricCard } from "@/components/ui/metric-card";
import * as I from "@/lib/stock/interpretations";
import { Wallet, Calendar, Globe, Users } from "lucide-react";
import { SectionHeader, fmt, formatCap } from "@/components/stock-detail/shared";
import { AiInsightCard } from "@/components/stock-detail/AiInsightCard";
import type { StockDetail } from "@/components/stock-detail/types";
import type { SektorAnalizOutput } from "@/lib/ai/types";

interface FundamentalTabProps {
  d: StockDetail;
  stockCode: string;
  timeLabel: "realtime" | "daily" | "weekly" | "monthly";
  sektorAnaliz: SektorAnalizOutput | null;
  saLoading: boolean;
  saError: boolean;
}

export function FundamentalTab({ d, stockCode, timeLabel, sektorAnaliz, saLoading, saError }: FundamentalTabProps) {
  return (
    <div className="space-y-3">

      {/* Fundamentals Panel */}
      {d.financials && (
        <div className="rounded-xl border border-border/40 bg-card/30 p-4">
          <SectionHeader icon={Wallet} label="Temel Analiz" subtitle="Şirketin finansal sağlığı — bilanço, karlılık, büyüme ve değerleme." tooltip="Şirketin bilanço verileri, karlılık oranları, büyüme hızı ve piyasadaki değerlemesi." timeLabel={timeLabel} />

          {/* Fundamental sub-scores with MetricCard */}
          {d.fundamentalScore && (
            <div className="mb-3 pb-3 border-b border-border/20">
              <div className="flex items-center gap-4 mb-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{d.fundamentalScore.fundamentalScore}</p>
                  <p className="text-[9px] text-muted-foreground/50">TEMEL SKOR</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <MetricCard
                  label="Değerleme"
                  value={String(d.fundamentalScore.valuationScore)}
                  status={d.fundamentalScore.valuationScore >= 50 ? "positive" : "negative"}
                  interpretation={d.fundamentalScore.valuationScore >= 60 ? "Cazip" : d.fundamentalScore.valuationScore >= 40 ? "Makul" : "Pahalı"}
                />
                <MetricCard
                  label="Karlılık"
                  value={String(d.fundamentalScore.profitabilityScore)}
                  status={d.fundamentalScore.profitabilityScore >= 50 ? "positive" : "negative"}
                  interpretation={d.fundamentalScore.profitabilityScore >= 60 ? "Güçlü" : d.fundamentalScore.profitabilityScore >= 40 ? "Orta" : "Zayıf"}
                />
                <MetricCard
                  label="Büyüme"
                  value={String(d.fundamentalScore.growthScore)}
                  status={d.fundamentalScore.growthScore >= 50 ? "positive" : "negative"}
                  interpretation={d.fundamentalScore.growthScore >= 60 ? "Hızlı" : d.fundamentalScore.growthScore >= 40 ? "Orta" : "Yavaş"}
                />
                <MetricCard
                  label="Sağlık"
                  value={String(d.fundamentalScore.healthScore)}
                  status={d.fundamentalScore.healthScore >= 50 ? "positive" : "negative"}
                  interpretation={d.fundamentalScore.healthScore >= 60 ? "Sağlam" : d.fundamentalScore.healthScore >= 40 ? "Makul" : "Riskli"}
                />
              </div>
            </div>
          )}

          {/* Ratio grid */}
          <div className="grid grid-cols-3 gap-x-6 gap-y-3 text-[11px]">
            <div><div className="flex items-center gap-1"><span className="text-muted-foreground/60">F/K</span><InfoTooltip title="Fiyat/Kazanç Oranı" description="Hisse fiyatının hisse başı kâra oranı. Düşük F/K ucuzluğa, yüksek F/K büyüme primine işaret edebilir." thresholds={["<10: Ucuz", "10-20: Makul", ">20: Pahalı"]} /></div><span className="font-medium">{fmt(d.financials.peRatio, 1)}</span><p className="text-[9px] text-muted-foreground/40 italic">{I.interpretPE(d.financials.peRatio as number)}</p></div>
            <div><div className="flex items-center gap-1"><span className="text-muted-foreground/60">PD/DD</span><InfoTooltip title="Piyasa Değeri / Defter Değeri" description="Şirketin piyasa değerinin muhasebe defter değerine oranı. 1 altı varlıklarından ucuz demek." /></div><span className="font-medium">{fmt(d.financials.pbRatio)}</span></div>
            <div><div className="flex items-center gap-1"><span className="text-muted-foreground/60">FD/FAVÖK</span><InfoTooltip title="Firma Değeri / FAVÖK" description="Borç dahil toplam değerin faiz-amortisman öncesi kâra oranı. Sektörler arası en güvenilir değerleme metriği." /></div><span className="font-medium">{fmt(d.financials.evToEbitda, 1)}</span></div>
            <div><div className="flex items-center gap-1"><span className="text-muted-foreground/60">ROE</span><InfoTooltip title="Özsermaye Karlılığı" description="Şirketin kendi sermayesi üzerinden ne kadar kâr ürettiği. %15+ güçlü, %25+ mükemmel." /></div><span className="font-medium text-foreground">%{fmt(d.financials.roe, 1)}</span><p className="text-[9px] text-muted-foreground/40 italic">{I.interpretROE(d.financials.roe as number)}</p></div>
            <div><div className="flex items-center gap-1"><span className="text-muted-foreground/60">Kar Marjı</span><InfoTooltip title="Net Kar Marjı" description="Gelirin ne kadarının net kâra dönüştüğü. Yüksek marj = güçlü fiyatlama gücü." /></div><span className="font-medium">%{fmt(d.financials.profitMargin, 1)}</span></div>
            <div><div className="flex items-center gap-1"><span className="text-muted-foreground/60">Gelir Büyüme</span><InfoTooltip title="Yıllık Gelir Büyümesi" description="Şirketin gelirinin önceki yıla göre değişimi. Enflasyonun üstünde büyüme gerçek büyümedir." /></div><span className={cn("font-medium", (d.financials.revenueGrowth as number) > 0 ? "text-gain" : "text-loss")}>%{fmt(d.financials.revenueGrowth, 1)}</span><p className="text-[9px] text-muted-foreground/40 italic">{I.interpretGrowth(d.financials.revenueGrowth as number)}</p></div>
            <div><div className="flex items-center gap-1"><span className="text-muted-foreground/60">Borç/Özser.</span><InfoTooltip title="Kaldıraç Oranı" description="Şirketin ne kadar borçla finanse edildiği. 1 altı sağlıklı, 2 üstü riskli." /></div><span className="font-medium">{fmt(d.financials.debtToEquity, 1)}</span><p className="text-[9px] text-muted-foreground/40 italic">{I.interpretDebtEquity(d.financials.debtToEquity as number)}</p></div>
            <div><div className="flex items-center gap-1"><span className="text-muted-foreground/60">Cari Oran</span><InfoTooltip title="Kısa Vadeli Likidite" description="Kısa vadeli varlıkların borçlara oranı. 1.5+ güvenli, 1 altı likidite riski." /></div><span className={cn("font-medium", (d.financials.currentRatio as number) >= 1.5 ? "text-gain" : (d.financials.currentRatio as number) < 1 ? "text-loss" : "")}>{fmt(d.financials.currentRatio)}</span><p className="text-[9px] text-muted-foreground/40 italic">{I.interpretCurrentRatio(d.financials.currentRatio as number)}</p></div>
            <div><div className="flex items-center gap-1"><span className="text-muted-foreground/60">Temetü</span><InfoTooltip title="Temetü Verimi" description="Yıllık temetü / hisse fiyatı. Düzenli gelir isteyenler için önemli." /></div><span className="font-medium">%{fmt(d.financials.dividendYield)}</span><p className="text-[9px] text-muted-foreground/40 italic">{I.interpretDividend(d.financials.dividendYield as number)}</p></div>
            <div><div className="flex items-center gap-1"><span className="text-muted-foreground/60">P. Değeri</span><InfoTooltip title="Piyasa Değeri" description="Şirketin borsadaki toplam değeri = hisse fiyatı × toplam hisse adedi." /></div><span className="font-medium">{formatCap(d.financials.marketCap as number)}</span></div>
            <div><div className="flex items-center gap-1"><span className="text-muted-foreground/60">52H Zirve</span><InfoTooltip title="52 Haftalık En Yüksek" description="Son 1 yıldaki en yüksek fiyat. Zirveye yakınlık momentum göstergesi." /></div><span className="font-medium">₺{fmt(d.financials.fiftyTwoWeekHigh)}</span></div>
            <div><div className="flex items-center gap-1"><span className="text-muted-foreground/60">52H Dip</span><InfoTooltip title="52 Haftalık En Düşük" description="Son 1 yıldaki en düşük fiyat. Dip'e yakınlık değer fırsatı veya sorun işareti olabilir." /></div><span className="font-medium">₺{fmt(d.financials.fiftyTwoWeekLow)}</span></div>
          </div>
          {d.financials.earningsDate && (
            <div className="mt-3 pt-3 border-t border-border/20 flex items-center gap-2">
              <Calendar className="h-3 w-3 text-amber-400" />
              <span className="text-[11px] text-muted-foreground">Bilanço: <span className="text-foreground font-medium">{d.financials.earningsDate as string}</span></span>
            </div>
          )}
        </div>
      )}

      {/* Macro Bar */}
      {d.macroData && (
        <div className="rounded-xl border border-border/40 bg-card/30 p-4">
          <SectionHeader icon={Globe} label={`Makro Ortam — ${d.macroData.macroLabel}`} subtitle="Hisseyi etkileyen makroekonomik koşullar — döviz, endeks ve küresel risk iştahı." tooltip="Piyasanın genel yönünü belirleyen makro faktörler. Makro olumsuzken teknik sinyaller genelde zayıf çalışır." timeLabel={timeLabel} />
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-[9px] text-muted-foreground/50 flex items-center justify-center gap-1">USD/TRY <InfoTooltip title="Dolar/TL Kuru" description="TL zayıflaması ihracatçıları destekler, ithalatçıları ve borçluları baskılar." /></p>
              <p className="text-sm font-bold text-foreground">₺{fmt(d.macroData.usdTry)}</p>
              {d.macroData.usdTryChange != null && <p className={cn("text-[10px]", d.macroData.usdTryChange > 0 ? "text-loss" : "text-gain")}>{d.macroData.usdTryChange > 0 ? "+" : ""}{fmt(d.macroData.usdTryChange)}%</p>}
              <p className="text-[9px] text-muted-foreground/40 italic">{I.interpretUSDTRY(d.macroData.usdTryChange)}</p>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground/50 flex items-center justify-center gap-1">BİST 100 <InfoTooltip title="Ana Piyasa Endeksi" description="Türk borsasının genel yönü. Düşüşte çoğu hisse etkilenir." /></p>
              <p className="text-sm font-bold text-foreground">{d.macroData.bist100?.toLocaleString("tr-TR", { maximumFractionDigits: 0 }) ?? "—"}</p>
              {d.macroData.bist100Change != null && <p className={cn("text-[10px]", d.macroData.bist100Change >= 0 ? "text-gain" : "text-loss")}>{d.macroData.bist100Change >= 0 ? "+" : ""}{fmt(d.macroData.bist100Change)}%</p>}
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground/50 flex items-center justify-center gap-1">DXY <InfoTooltip title="Dolar Endeksi" description="Doların küresel gücü. Yükselirse gelişen piyasalardan para çıkışı olur." /></p>
              <p className="text-sm font-bold text-foreground">{fmt(d.macroData.dxy, 1)}</p>
              {d.macroData.dxyChange != null && <p className={cn("text-[10px]", d.macroData.dxyChange < 0 ? "text-gain" : "text-loss")}>{d.macroData.dxyChange >= 0 ? "+" : ""}{fmt(d.macroData.dxyChange)}%</p>}
            </div>
          </div>
          {d.macroData.vix != null && (
            <div className="mt-2 pt-2 border-t border-border/20 flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground/60 flex items-center gap-1">VIX <InfoTooltip title="Küresel Korku Endeksi" description="Piyasa stresini ölçer. 15 altı sakin, 25+ tedirgin, 35+ panik." /></span>
              <span className={cn("font-medium", d.macroData.vix < 20 ? "text-gain" : d.macroData.vix < 25 ? "text-amber-400" : "text-loss")}>{d.macroData.vix.toFixed(1)}</span>
              <span className="text-[9px] text-muted-foreground/40 italic">{I.interpretVIX(d.macroData.vix)}</span>
            </div>
          )}
        </div>
      )}

      {/* Sector + Peers */}
      {d.sectorContext && (
        <div className="rounded-xl border border-border/40 bg-card/30 p-4">
          <SectionHeader icon={Users} label={`Sektör: ${d.sectorContext.sectorName}`} subtitle="Aynı sektördeki rakiplere göre hissenin konumu ve göreceli performansı." tooltip="Göreceli güç: hissenin sektör endeksine göre ne kadar iyi/kötü performans gösterdiği." timeLabel={timeLabel} />
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-border/20">
            <span className="text-[11px] text-muted-foreground">Göreceli Güç</span>
            <span className={cn("text-xs font-bold", d.sectorContext.outperforming ? "text-gain" : "text-loss")}>
              {d.sectorContext.outperforming ? "Sektörden İyi" : "Sektörden Kötü"} ({d.sectorContext.relativeStrength >= 0 ? "+" : ""}{d.sectorContext.relativeStrength.toFixed(2)}%)
            </span>
          </div>
          {/* Peer table */}
          {d.peerComparison && d.peerComparison.peers.length > 1 && (
            <div>
              <p className="text-[10px] text-muted-foreground/50 mb-2">Sektör Karşılaştırma ({d.peerComparison.totalPeers} hisse)</p>
              <div className="space-y-1.5">
                {d.peerComparison.peers.map((p: any) => {
                  const isCurrent = p.code === stockCode;
                  const pUp = (p.changePercent ?? 0) >= 0;
                  return (
                    <div key={p.code} className={cn("flex items-center justify-between py-1 px-2 rounded text-[11px]", isCurrent ? "bg-ai-primary/5 border border-ai-primary/15" : "")}>
                      <div className="flex items-center gap-2">
                        <span className={cn("font-semibold", isCurrent ? "text-ai-primary" : "text-foreground")}>{p.code}</span>
                        {isCurrent && <span className="text-[8px] text-ai-primary bg-ai-primary/10 px-1 rounded">SEN</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground tabular-nums">₺{p.price?.toFixed(2) ?? "—"}</span>
                        <span className={cn("tabular-nums font-medium w-14 text-right", pUp ? "text-gain" : "text-loss")}>{pUp ? "+" : ""}{p.changePercent?.toFixed(2) ?? "—"}%</span>
                        <span className="text-muted-foreground/50 w-12 text-right">F/K {p.peRatio?.toFixed(1) ?? "—"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {d.peerComparison.rankByChange && (
                <div className="mt-2 space-y-0.5">
                  <p className="text-[10px] text-muted-foreground/40">
                    Değişimde {d.peerComparison.rankByChange}/{d.peerComparison.totalPeers}
                    {d.peerComparison.rankByPE ? ` · F/K'da ${d.peerComparison.rankByPE}/${d.peerComparison.totalPeers}` : ""}
                  </p>
                  <p className="text-[9px] text-muted-foreground/40 italic">{I.interpretPeerRank(d.peerComparison.rankByChange, d.peerComparison.totalPeers, "günlük değişim")}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sektör Karşılaştırma AI — sektör verisinden hemen sonra */}
      <AiInsightCard title="Sektor Karsilastirma" icon={Users} loading={saLoading} error={saError}>
        {sektorAnaliz && (
          <div className="space-y-2">
            <p className="text-[11px] text-foreground leading-relaxed">{sektorAnaliz.positionSummary}</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{sektorAnaliz.competitiveAdvantage}</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{sektorAnaliz.valuationComparison}</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{sektorAnaliz.sectorOutlook}</p>
            {sektorAnaliz.betterAlternative && (
              <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-2.5">
                <p className="text-[10px] text-amber-400 font-medium">Alternatif: {sektorAnaliz.betterAlternative}</p>
              </div>
            )}
          </div>
        )}
      </AiInsightCard>

      {/* Seasonality */}
      {d.seasonality && d.seasonality.monthlyAvgReturn != null && (
        <div className="rounded-xl border border-border/40 bg-card/30 p-4">
          <SectionHeader icon={Calendar} label={`Mevsimsellik — ${d.seasonality.currentMonthName}`} subtitle="Bu hissenin geçmiş yıllarda aynı dönemdeki performans eğilimi." tooltip="Tarihsel aylık getiri ortalaması ve kazanma oranı. Geçmiş performans gelecek için garanti değildir." timeLabel={timeLabel} />
          <div className="flex items-center gap-4 mb-3">
            <div className="text-center">
              <p className={cn("text-xl font-bold", d.seasonality.monthlyAvgReturn >= 0 ? "text-gain" : "text-loss")}>
                {d.seasonality.monthlyAvgReturn >= 0 ? "+" : ""}{d.seasonality.monthlyAvgReturn}%
              </p>
              <p className="text-[9px] text-muted-foreground/50">Ort. Getiri</p>
            </div>
            {d.seasonality.monthlyWinRate != null && (
              <div className="text-center">
                <p className="text-xl font-bold text-foreground">%{d.seasonality.monthlyWinRate}</p>
                <p className="text-[9px] text-muted-foreground/50">Kazanma Oranı</p>
              </div>
            )}
            <div className="flex-1">
              <span className={cn("text-[11px] font-medium px-2 py-1 rounded",
                d.seasonality.isHistoricallyStrong ? "bg-gain/10 text-gain" : "bg-secondary text-muted-foreground"
              )}>
                {d.seasonality.seasonalLabel}
              </span>
            </div>
          </div>
          <p className="text-[9px] text-muted-foreground/40 italic mb-2">{I.interpretSeason(d.seasonality.monthlyAvgReturn, d.seasonality.monthlyWinRate)}</p>
          {/* Mini monthly bar chart */}
          {d.seasonality?.monthlyReturns?.length > 0 && (
            <div className="flex items-end gap-1 h-12">
              {d.seasonality.monthlyReturns.map((m: any) => {
                const returns = d.seasonality?.monthlyReturns ?? [];
                const maxAbs = returns.length > 0 ? Math.max(...returns.map((r: any) => Math.abs(r.avgReturn)), 1) : 1;
                const height = Math.abs(m.avgReturn) / maxAbs * 100;
                const isCurrent = m.month === d.seasonality?.currentMonth;
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5" title={`${m.name}: ${m.avgReturn >= 0 ? "+" : ""}${m.avgReturn}%`}>
                    <div
                      className={cn("w-full rounded-sm min-h-[2px] transition-all",
                        isCurrent ? "ring-1 ring-ai-primary" : "",
                        m.avgReturn >= 0 ? "bg-gain/60" : "bg-loss/60"
                      )}
                      style={{ height: `${Math.max(height, 5)}%` }}
                    />
                    <span className={cn("text-[7px]", isCurrent ? "text-ai-primary font-bold" : "text-muted-foreground/40")}>
                      {m.name.slice(0, 1)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
