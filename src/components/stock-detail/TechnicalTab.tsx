"use client";

import { cn } from "@/lib/utils";
import { SignalBadge } from "@/components/dashboard/signal-badge";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { IndicatorGauge, RSI_GAUGE, STOCH_GAUGE, MFI_GAUGE, ADX_GAUGE, BB_GAUGE, CMF_GAUGE } from "@/components/ui/indicator-gauge";
import * as I from "@/lib/stock/interpretations";
import {
  Activity, Zap, BarChart3, TrendingUp, Target,
} from "lucide-react";
import { SectionHeader, fmt } from "@/components/stock-detail/shared";
import { SignalPerformanceCard } from "@/components/stock-detail/SignalPerformanceCard";
import type { StockDetail } from "@/components/stock-detail/types";

interface TechnicalTabProps {
  d: StockDetail;
  stockCode: string;
  timeLabel: "realtime" | "daily" | "weekly" | "monthly";
}

export function TechnicalTab({ d, stockCode, timeLabel }: TechnicalTabProps) {
  const t = d.technicals as Record<string, number | string | boolean | null> | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawTech = d.technicals as any;
  const ichimoku = rawTech?.ichimoku as { tenkan: number; kijun: number; senkouA: number; senkouB: number; cloudTop: number; cloudBottom: number; cloudColor: string; priceVsCloud: string; tkCross: string | null; kumoBreakout: string | null } | null;
  const fibonacci = rawTech?.fibonacci as { swingHigh: number; swingLow: number; levels: { level: number; price: number; label: string }[]; nearestLevel: { level: number; price: number; distance: number } | null; priceZone: string } | null;

  return (
    <div className="space-y-4">

      {/* Multi-Timeframe Alignment */}
      {d.multiTimeframe && (
        <div className={cn("rounded-xl border p-4",
          d.multiTimeframe.alignment === "STRONG_ALIGNED" ? "border-gain/20 bg-gain/5" :
          d.multiTimeframe.alignment === "CONFLICTING" ? "border-loss/20 bg-loss/5" :
          "border-border/40 bg-card/30"
        )}>
          <SectionHeader icon={Activity} label="Zaman Dilimi Uyumu" subtitle="Haftalık ve günlük trendlerin birbirleriyle uyumu." tooltip="Haftalık trend yönü ile günlük trend yönü aynıysa sinyaller daha güvenilir." timeLabel={timeLabel} />
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div className="space-y-1">
              <p className="text-[9px] text-muted-foreground/50 uppercase">Haftalık</p>
              <p className={cn("text-sm font-bold", d.multiTimeframe.weekly.trend.includes("UP") ? "text-gain" : d.multiTimeframe.weekly.trend.includes("DOWN") ? "text-loss" : "text-muted-foreground")}>
                {d.multiTimeframe.weekly.trend === "STRONG_UP" ? "Güçlü Yükseliş" : d.multiTimeframe.weekly.trend === "UP" ? "Yükseliş" : d.multiTimeframe.weekly.trend === "STRONG_DOWN" ? "Güçlü Düşüş" : d.multiTimeframe.weekly.trend === "DOWN" ? "Düşüş" : "Yatay"}
              </p>
              {d.multiTimeframe.weekly.rsi != null && <p className="text-[10px] text-muted-foreground/60">RSI: {d.multiTimeframe.weekly.rsi.toFixed(1)}</p>}
            </div>
            <div className="space-y-1">
              <p className="text-[9px] text-muted-foreground/50 uppercase">Günlük</p>
              <p className={cn("text-sm font-bold", d.multiTimeframe.daily.trend?.includes("UP") ? "text-gain" : d.multiTimeframe.daily.trend?.includes("DOWN") ? "text-loss" : "text-muted-foreground")}>
                {d.multiTimeframe.daily.trend === "STRONG_UP" ? "Güçlü Yükseliş" : d.multiTimeframe.daily.trend === "UP" ? "Yükseliş" : d.multiTimeframe.daily.trend === "STRONG_DOWN" ? "Güçlü Düşüş" : d.multiTimeframe.daily.trend === "DOWN" ? "Düşüş" : "Yatay"}
              </p>
              {d.multiTimeframe.daily.rsi != null && <p className="text-[10px] text-muted-foreground/60">RSI: {d.multiTimeframe.daily.rsi.toFixed(1)}</p>}
            </div>
          </div>
          <div className={cn("rounded-lg px-3 py-2 text-[11px] font-medium",
            d.multiTimeframe.alignment === "STRONG_ALIGNED" ? "bg-gain/10 text-gain" :
            d.multiTimeframe.alignment === "ALIGNED" ? "bg-gain/5 text-gain/80" :
            d.multiTimeframe.alignment === "CONFLICTING" ? "bg-loss/10 text-loss" :
            "bg-secondary text-muted-foreground"
          )}>
            {d.multiTimeframe.alignmentTr}
            {d.multiTimeframe.signalBonus !== 0 && (
              <span className="ml-2 text-[10px] opacity-70">
                (sinyal etkisi: {d.multiTimeframe.signalBonus > 0 ? "+" : ""}{d.multiTimeframe.signalBonus})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Core Technical Indicators with Gauges */}
      {t && (
        <div className="rounded-xl border border-border/40 bg-card/30 p-4">
          <SectionHeader icon={Activity} label="Teknik Göstergeler" subtitle="Fiyat ve hacim verilerinden hesaplanan matematiksel göstergeler." timeLabel={timeLabel} />
          <div className="space-y-1">
            {t.rsi14 != null && (
              <IndicatorGauge
                label="RSI(14)"
                value={t.rsi14 as number}
                {...RSI_GAUGE}
                interpretation={I.interpretRSI(t.rsi14 as number)}
                tooltip={{ title: "Göreceli Güç Endeksi", description: "14 günlük fiyat değişimlerinin gücünü ölçer. 30 altı = aşırı satım, 70 üstü = aşırı alım." }}
              />
            )}
            {t.stochK != null && (
              <IndicatorGauge
                label="Stoch %K"
                value={t.stochK as number}
                {...STOCH_GAUGE}
                interpretation={I.interpretStoch(t.stochK as number)}
                tooltip={{ title: "Stokastik Osilatör", description: "Fiyatın son 14 günlük aralıktaki konumu. 20 altı = dip bölgesi, 80 üstü = tepe bölgesi." }}
              />
            )}
            {t.mfi14 != null && (
              <IndicatorGauge
                label="MFI"
                value={t.mfi14 as number}
                {...MFI_GAUGE}
                interpretation={undefined}
                tooltip={{ title: "Para Akış Endeksi", description: "Hacim ağırlıklı RSI. 20 altı = aşırı satım, 80 üstü = aşırı alım." }}
              />
            )}
            {t.adx14 != null && (
              <IndicatorGauge
                label="ADX"
                value={t.adx14 as number}
                {...ADX_GAUGE}
                interpretation={I.interpretADX(t.adx14 as number)}
                tooltip={{ title: "Ortalama Yön Endeksi", description: "Trendin gücünü ölçer. 25+ = güçlü trend, 20 altı = trend yok." }}
              />
            )}
            {t.bbPercentB != null && (
              <IndicatorGauge
                label="BB %B"
                value={(t.bbPercentB as number) * 100}
                {...BB_GAUGE}
                interpretation={I.interpretBB(t.bbPercentB as number, t.bbSqueeze as boolean)}
                tooltip={{ title: "Bollinger Bant Pozisyonu", description: "Fiyatın bantlar içindeki konumu. 0 = alt bant (ucuz), 1 = üst bant (pahalı)." }}
              />
            )}
            {t.cmf20 != null && (
              <IndicatorGauge
                label="CMF"
                value={(t.cmf20 as number) * 100}
                {...CMF_GAUGE}
                interpretation={I.interpretCMF(t.cmf20 as number)}
                tooltip={{ title: "Chaikin Para Akışı", description: "Pozitif = kurumsal alım (birikim), negatif = kurumsal satış (dağıtım)." }}
              />
            )}

            {/* MACD — show as colored value, not gauge */}
            {t.macdHistogram != null && (
              <div className="py-1.5">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 w-20 shrink-0">
                    <span className="text-[11px] font-medium text-muted-foreground">MACD</span>
                    <InfoTooltip title="Hareketli Ortalama Yakınsama" description="İki farklı hızda hareketli ortalamanın farkı. Pozitif = yukarı momentum, negatif = aşağı." />
                  </div>
                  <div className="flex-1">
                    <span className={cn("text-sm font-bold tabular-nums", (t.macdHistogram as number) >= 0 ? "text-gain" : "text-loss")}>
                      {(t.macdHistogram as number) >= 0 ? "+" : ""}{fmt(t.macdHistogram as number)}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground/50 ml-[92px] mt-0.5">{I.interpretMACD(t.macdHistogram as number)}</p>
              </div>
            )}

            {/* ATR */}
            {t.atr14 != null && (
              <div className="py-1.5">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 w-20 shrink-0">
                    <span className="text-[11px] font-medium text-muted-foreground">ATR</span>
                    <InfoTooltip title="Ortalama Gerçek Aralık" description="Son 14 günün ortalama günlük fiyat hareket aralığı." />
                  </div>
                  <span className="text-xs font-bold tabular-nums text-foreground">₺{fmt(t.atr14 as number)}</span>
                </div>
              </div>
            )}

            {/* Support / Resistance */}
            {t.support != null && t.resistance != null && d.price != null && (
              <div className="py-1.5">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-medium text-muted-foreground w-20 shrink-0">Destek/Direnç</span>
                  <span className="text-xs font-bold tabular-nums">
                    <span className="text-gain">₺{fmt(t.support as number)}</span>
                    {" / "}
                    <span className="text-loss">₺{fmt(t.resistance as number)}</span>
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground/50 ml-[92px] mt-0.5">{I.interpretSR(d.price, t.support as number, t.resistance as number)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ichimoku Cloud */}
      {ichimoku && (
        <div className="rounded-xl border border-border/40 bg-card/30 p-4">
          <SectionHeader icon={Activity} label="Ichimoku Bulutu" subtitle="Japon teknik analizinin en kapsamlı göstergesi — trend, momentum ve destek/direnç." tooltip="Tenkan-Kijun çizgileri, Kumo bulutu ve fiyat pozisyonu ile trend yönünü belirler." timeLabel={timeLabel} />
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[11px]">
            <div className="flex justify-between"><span className="text-muted-foreground/60">Tenkan</span><span className="font-medium">₺{ichimoku.tenkan}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground/60">Kijun</span><span className="font-medium">₺{ichimoku.kijun}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground/60">Bulut</span><span className={cn("font-medium", ichimoku.cloudColor === "GREEN" ? "text-gain" : "text-loss")}>{ichimoku.cloudColor === "GREEN" ? "Yeşil (Boğa)" : "Kırmızı (Ayı)"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground/60">Fiyat vs Bulut</span><span className={cn("font-medium", ichimoku.priceVsCloud === "ABOVE" ? "text-gain" : ichimoku.priceVsCloud === "BELOW" ? "text-loss" : "text-amber-400")}>{ichimoku.priceVsCloud === "ABOVE" ? "Üstünde" : ichimoku.priceVsCloud === "BELOW" ? "Altında" : "İçinde"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground/60">Bulut Aralığı</span><span className="font-medium">₺{ichimoku.cloudBottom}–₺{ichimoku.cloudTop}</span></div>
          </div>
          <p className="text-[10px] text-muted-foreground/50 mt-2 italic">{I.interpretIchimoku(ichimoku.priceVsCloud, ichimoku.cloudColor)}</p>
        </div>
      )}

      {/* Fibonacci */}
      {fibonacci && (
        <div className="rounded-xl border border-border/40 bg-card/30 p-4">
          <SectionHeader icon={Target} label="Fibonacci Seviyeleri" subtitle="Son fiyat hareketinden türetilen kritik destek ve direnç seviyeleri." tooltip="%38.2 = sığ düzeltme (trend güçlü), %61.8 = derin düzeltme (kritik destek), %78.6 = trend bozulma riski." timeLabel={timeLabel} />
          <div className="space-y-1">
            {fibonacci.levels?.map((l) => {
              const isNearest = fibonacci.nearestLevel && l.price === fibonacci.nearestLevel.price;
              return (
                <div key={l.level} className={cn("flex justify-between text-[11px] py-0.5 px-2 rounded", isNearest ? "bg-ai-primary/10 border border-ai-primary/20" : "")}>
                  <span className={cn("text-muted-foreground/60", isNearest && "text-ai-primary font-medium")}>{l.label}</span>
                  <span className={cn("font-medium tabular-nums", isNearest ? "text-ai-primary" : "text-foreground")}>₺{l.price.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground/50 mt-2 italic">{I.interpretFibZone(fibonacci.priceZone)}</p>
        </div>
      )}

      {/* Candlestick Patterns */}
      {d.candlestickPatterns?.length > 0 && (
        <div className="rounded-xl border border-border/40 bg-card/30 p-4">
          <SectionHeader icon={BarChart3} label="Mum Formasyonları" subtitle="Son mumlarda tespit edilen fiyat formasyonları — trend dönüşü veya devam sinyalleri." timeLabel={timeLabel} />
          <div className="space-y-2">
            {d.candlestickPatterns.map((cp: any, i: number) => (
              <div key={i} className="flex items-start gap-2">
                <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 mt-0.5", cp.direction === "BULLISH" ? "bg-gain/10 text-gain" : cp.direction === "BEARISH" ? "bg-loss/10 text-loss" : "bg-secondary text-muted-foreground")}>
                  {cp.nameTr} ({cp.strength})
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{cp.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chart Patterns */}
      {d.chartPatterns?.length > 0 && (
        <div className="rounded-xl border border-border/40 bg-card/30 p-4">
          <SectionHeader icon={TrendingUp} label="Grafik Formasyonları" subtitle="Fiyat grafiğinde tespit edilen büyük formasyonlar — omuz-baş-omuz, ikili tepe/dip, üçgen." timeLabel={timeLabel} />
          <div className="space-y-2">
            {d.chartPatterns.map((cp: any, i: number) => (
              <div key={i} className={cn("flex items-start gap-2 p-2 rounded-lg border", cp.direction === "BULLISH" ? "border-gain/15 bg-gain/5" : "border-loss/15 bg-loss/5")}>
                <span className={cn("text-[10px] font-bold shrink-0", cp.direction === "BULLISH" ? "text-gain" : "text-loss")}>
                  {cp.nameTr} ({cp.strength})
                </span>
                <p className="text-[11px] text-muted-foreground">{cp.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extra Indicators */}
      {d.extraIndicators && (
        <div className="rounded-xl border border-border/40 bg-card/30 p-4">
          <SectionHeader icon={Activity} label="Gelişmiş Göstergeler" subtitle="Profesyonel analizde kullanılan ek teknik indikatörler." timeLabel={timeLabel} />
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[11px]">
            {d.extraIndicators.vwap != null && <div><div className="flex justify-between"><span className="text-muted-foreground/60 flex items-center gap-1">VWAP <InfoTooltip title="Hacim Ağırlıklı Ort. Fiyat" description="Kurumsal yatırımcıların referans noktası. Fiyat VWAP üstünde = alıcılar güçlü, altında = satıcılar güçlü." /></span><span className={cn("font-medium", d.extraIndicators.priceVsVwap === "ABOVE" ? "text-gain" : "text-loss")}>₺{d.extraIndicators.vwap} ({d.extraIndicators.priceVsVwap === "ABOVE" ? "Üstünde" : "Altında"})</span></div></div>}
            {d.extraIndicators.kama != null && <div><div className="flex justify-between"><span className="text-muted-foreground/60 flex items-center gap-1">KAMA <InfoTooltip title="Adaptif Hareketli Ortalama" description="Trend güçlüyken hızlı, yatay piyasada yavaş tepki verir. Normal MA'lardan daha akıllı." /></span><span className={cn("font-medium", d.extraIndicators.priceVsKama === "ABOVE" ? "text-gain" : "text-loss")}>₺{d.extraIndicators.kama}</span></div></div>}
            {d.extraIndicators.williamsR != null && <div><div className="flex justify-between"><span className="text-muted-foreground/60 flex items-center gap-1">Williams %R <InfoTooltip title="Williams Yüzde Aralığı" description="-100 ile 0 arası. -80 altı aşırı satım, -20 üstü aşırı alım." /></span><span className={cn("font-medium", d.extraIndicators.williamsSignal === "OVERSOLD" ? "text-gain" : d.extraIndicators.williamsSignal === "OVERBOUGHT" ? "text-loss" : "")}>{d.extraIndicators.williamsR}</span></div><p className="text-[9px] text-muted-foreground/40 italic">{d.extraIndicators.williamsSignal === "OVERSOLD" ? "Aşırı satım — dip bölgesi" : d.extraIndicators.williamsSignal === "OVERBOUGHT" ? "Aşırı alım — tepe bölgesi" : "Normal aralıkta"}</p></div>}
            {d.extraIndicators.parabolicSar != null && <div><div className="flex justify-between"><span className="text-muted-foreground/60 flex items-center gap-1">Parabolic SAR <InfoTooltip title="Durma ve Dönüş" description="Trend takip göstergesi. Fiyatın altında = yükseliş trendi, üstünde = düşüş trendi." /></span><span className={cn("font-medium", d.extraIndicators.sarTrend === "BULLISH" ? "text-gain" : "text-loss")}>₺{d.extraIndicators.parabolicSar} ({d.extraIndicators.sarTrend === "BULLISH" ? "Yükseliş" : "Düşüş"})</span></div></div>}
            {d.extraIndicators.elderBullPower != null && <div><div className="flex justify-between"><span className="text-muted-foreground/60 flex items-center gap-1">Elder Bull <InfoTooltip title="Alıcı Gücü" description="Alıcıların fiyatı EMA üstüne taşıma gücü." /></span><span className={cn("font-medium", (d.extraIndicators.elderBullPower ?? 0) > 0 ? "text-gain" : "text-loss")}>{d.extraIndicators.elderBullPower}</span></div></div>}
            {d.extraIndicators.elderBearPower != null && <div><div className="flex justify-between"><span className="text-muted-foreground/60 flex items-center gap-1">Elder Bear <InfoTooltip title="Satıcı Gücü" description="Satıcıların fiyatı EMA altına çekme gücü." /></span><span className={cn("font-medium", (d.extraIndicators.elderBearPower ?? 0) < 0 ? "text-loss" : "text-gain")}>{d.extraIndicators.elderBearPower}</span></div></div>}
            {d.extraIndicators.ttmSqueeze && <div className="col-span-2 rounded-lg bg-amber-400/10 border border-amber-400/20 p-2"><span className="text-amber-400 font-medium flex items-center gap-1">&#x26A1; TTM Squeeze aktif <InfoTooltip title="Volatilite Sıkışması" description="Bollinger bantları Keltner kanalının içine girdi. Piyasa sıkışıyor, yakında güçlü bir kırılım hareketi bekleniyor." /></span><p className="text-[9px] text-muted-foreground/50 mt-0.5">Bollinger bantları sıkıştı — yön belirlendikten sonra güçlü hareket gelir</p></div>}
          </div>
        </div>
      )}

      {/* All Signals — Backtest Performance */}
      {d.signals?.length > 0 && (
        <div className="rounded-xl border border-border/40 bg-card/30 p-4">
          <SectionHeader icon={Zap} label="Aktif Sinyaller & Performans" subtitle="Algoritmanın tespit ettiği sinyaller ve kanıtlanmış geçmiş başarı oranları." timeLabel={timeLabel} />
          <SignalPerformanceCard d={d} />
        </div>
      )}

      {/* Signal Combination */}
      {d.signalCombination && d.signals?.length > 0 && (
        <div className={cn("rounded-xl border p-3",
          d.signalCombination.confluenceType === "STRONG_BULLISH" ? "border-gain/20 bg-gain/5" :
          d.signalCombination.confluenceType === "STRONG_BEARISH" ? "border-loss/20 bg-loss/5" :
          d.signalCombination.conflicting ? "border-amber-400/20 bg-amber-400/5" :
          "border-border/40 bg-card/30"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className={cn("h-4 w-4",
                d.signalCombination.confluenceType === "STRONG_BULLISH" ? "text-gain" :
                d.signalCombination.confluenceType === "STRONG_BEARISH" ? "text-loss" :
                "text-amber-400"
              )} />
              <span className="text-xs font-medium text-foreground">{d.signalCombination.confluenceLabel}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-gain">{d.signalCombination.totalBullish} boğa</span>
              <span className="text-muted-foreground/40">|</span>
              <span className="text-loss">{d.signalCombination.totalBearish} ayı</span>
            </div>
          </div>
        </div>
      )}

      {/* Signal Chains */}
      {d.signalChains?.length > 0 && (
        <div className="rounded-xl border border-ai-primary/20 bg-ai-primary/5 p-4">
          <SectionHeader icon={Zap} label="Sinyal Zincirleri" subtitle="Ardışık sinyallerin birleşerek oluşturduğu güçlü bileşik sinyaller." tooltip="Birden fazla teknik sinyalin belirli bir sırayla ve zaman aralığında oluşması, daha güvenilir alım/satım sinyali verir." timeLabel={timeLabel} />
          <div className="space-y-3">
            {d.signalChains.map((chain: any, i: number) => (
              <div key={i} className={cn("rounded-lg border p-3", chain.direction === "BULLISH" ? "border-gain/20 bg-gain/5" : "border-loss/20 bg-loss/5")}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs font-bold", chain.direction === "BULLISH" ? "text-gain" : "text-loss")}>{chain.nameTr}</span>
                    <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-medium", chain.direction === "BULLISH" ? "bg-gain/10 text-gain" : "bg-loss/10 text-loss")}>{chain.strength}</span>
                  </div>
                  <span className={cn("text-[9px] font-medium", chain.direction === "BULLISH" ? "text-gain" : "text-loss")}>{chain.direction === "BULLISH" ? "BOĞA" : "AYI"}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mb-2">{chain.description}</p>
                <div className="flex flex-wrap gap-1">
                  {chain.steps.map((step: any, j: number) => (
                    <span key={j} className="text-[9px] bg-background/50 border border-border/30 px-1.5 py-0.5 rounded text-muted-foreground/70">{step}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Signal History (today only) */}
      {d.recentSignals?.length > 0 && (
        <div className="rounded-xl border border-border/40 bg-card/30 p-4">
          <SectionHeader icon={Activity} label="Sinyal Geçmişi (30 gün)" subtitle="Son sinyallerin sonuçları — doğru mu çıktı, 1 günde ne oldu?" tooltip="Her sinyalin 1 gün sonraki fiyat hareketine göre doğruluğu takip edilir." timeLabel="daily" />
          <div className="space-y-1.5">
            {d.recentSignals.slice(0, 8).map((s: any) => (
              <div key={s.id} className="flex items-center justify-between text-[11px] py-1">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground/50 w-12">{new Date(s.date).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" })}</span>
                  <SignalBadge type={s.type} direction={s.direction as "BULLISH" | "BEARISH"} strength={s.strength} />
                </div>
                <div className="flex items-center gap-2">
                  {s.outcomePercent1D != null && (
                    <span className={cn("text-[10px] font-medium tabular-nums", s.outcomePercent1D >= 0 ? "text-gain" : "text-loss")}>
                      1G: {s.outcomePercent1D >= 0 ? "+" : ""}{s.outcomePercent1D}%
                    </span>
                  )}
                  {s.wasAccurate != null && (
                    <span className={cn("text-[9px] px-1 rounded", s.wasAccurate ? "bg-gain/10 text-gain" : "bg-loss/10 text-loss")}>
                      {s.wasAccurate ? "Doğru" : "Yanlış"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
