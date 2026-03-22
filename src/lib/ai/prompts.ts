import type { StockAnalysisInputV2 } from "./types";

function fmt(v: number | null | undefined, decimals = 2): string {
  return v != null ? v.toFixed(decimals) : "—";
}

function formatTechnicals(input: StockAnalysisInputV2): string {
  const t = input.technicals;
  if (!t) return "Teknik veri mevcut değil.";
  const lines: string[] = [];
  if (t.rsi14 != null) lines.push(`RSI(14): ${t.rsi14} [${t.rsiSignal === "OVERBOUGHT" ? "AŞIRI ALIM" : t.rsiSignal === "OVERSOLD" ? "AŞIRI SATIM" : "normal"}]`);
  if (t.ma20 != null) lines.push(`MA20: ₺${t.ma20} | MA50: ₺${t.ma50 ?? "—"} | MA200: ₺${t.ma200 ?? "—"} [Hizalama: ${t.maAlignment ?? "—"}]`);
  if (t.macdLine != null) lines.push(`MACD: ${fmt(t.macdLine)} | Sinyal: ${fmt(t.macdSignal)} | Histogram: ${fmt(t.macdHistogram)}${t.macdCrossover ? ` [${t.macdCrossover}]` : ""}`);
  if (t.bbUpper != null) lines.push(`Bollinger: ₺${fmt(t.bbLower)}–₺${fmt(t.bbUpper)} | %B: ${fmt(t.bbPercentB)}${t.bbSqueeze ? " [SIKIŞMA!]" : ""}`);
  if (t.atr14 != null) lines.push(`ATR(14): ₺${t.atr14} (%${fmt(t.atrPercent, 1)} volatilite)`);
  if (t.stochK != null) lines.push(`Stochastic: %K ${fmt(t.stochK, 1)} | %D ${fmt(t.stochD, 1)} [${t.stochSignal ?? ""}]`);
  if (t.adx14 != null) lines.push(`ADX: ${t.adx14} | +DI: ${fmt(t.plusDI, 1)} | -DI: ${fmt(t.minusDI, 1)} [${t.trendStrength ?? ""}]`);
  if (t.obvTrend) lines.push(`OBV: ${t.obvTrend}${t.obvDivergence ? ` [${t.obvDivergence} DİVERJANS]` : ""}`);
  if (t.support != null) lines.push(`Destek: ₺${t.support} | Direnç: ₺${t.resistance}`);
  if (t.volumeRatio != null) lines.push(`Hacim: ${t.volumeRatio.toFixed(1)}x ort.${t.volumeAnomaly ? " [ANOMALİ!]" : ""}`);
  if (t.cmf20 != null) lines.push(`CMF(20): ${t.cmf20.toFixed(3)} → ${t.cmfSignal === "ACCUMULATION" ? "PARA GİRİŞİ" : t.cmfSignal === "DISTRIBUTION" ? "PARA ÇIKIŞI" : "nötr"}`);
  if (t.mfi14 != null) lines.push(`MFI(14): ${t.mfi14.toFixed(1)} [${t.mfiSignal ?? ""}]`);
  if (t.rsiBullishDivergence) lines.push(`⚡ RSI BOĞA DİVERJANSI`);
  if (t.rsiBearishDivergence) lines.push(`⚡ RSI AYI DİVERJANSI`);
  if (t.crossSignal) lines.push(`⚡ ${t.crossSignal === "GOLDEN_CROSS" ? "ALTIN KESİŞİM" : "ÖLÜM KESİŞİMİ"}`);
  if (t.breakoutSignal) lines.push(`⚡ ${t.breakoutSignal === "RESISTANCE_BREAK" ? "DİRENÇ KIRILIMI" : "DESTEK KIRILIMI"}`);
  // Ichimoku
  if (t.ichimoku) {
    const ic = t.ichimoku;
    lines.push(`Ichimoku: Tenkan ₺${ic.tenkan} | Kijun ₺${ic.kijun} | Bulut ${ic.cloudColor === "GREEN" ? "YEŞİL" : "KIRMIZI"} (₺${ic.cloudBottom}-₺${ic.cloudTop}) | Fiyat ${ic.priceVsCloud === "ABOVE" ? "bulutun ÜSTÜNDE" : ic.priceVsCloud === "BELOW" ? "bulutun ALTINDA" : "bulutun İÇİNDE"}`);
    if (ic.tkCross) lines.push(`⚡ Ichimoku TK Kesişim: ${ic.tkCross}`);
    if (ic.kumoBreakout) lines.push(`⚡ Kumo Kırılımı: ${ic.kumoBreakout}`);
  }
  // Fibonacci
  if (t.fibonacci) {
    const fb = t.fibonacci;
    lines.push(`Fibonacci: Zirve ₺${fb.swingHigh} | Dip ₺${fb.swingLow} | En yakın: ${fb.nearestLevel ? `₺${fb.nearestLevel.price} (%${fb.nearestLevel.level * 100} seviyesi, ${fb.nearestLevel.distance}% uzak)` : "—"}`);
  }
  return lines.join("\n");
}

function formatExtraIndicators(input: StockAnalysisInputV2): string {
  const e = input.extraIndicators;
  if (!e) return "";
  const lines: string[] = [];
  if (e.vwap != null) lines.push(`VWAP: ₺${e.vwap} → Fiyat ${e.priceVsVwap === "ABOVE" ? "ÜSTÜNDE (alıcı güçlü)" : "ALTINDA (satıcı güçlü)"}`);
  if (e.kama != null) lines.push(`KAMA (Adaptif MA): ₺${e.kama} → Fiyat ${e.priceVsKama === "ABOVE" ? "ÜSTÜNDE" : "ALTINDA"}`);
  if (e.williamsR != null) lines.push(`Williams %R: ${e.williamsR} [${e.williamsSignal === "OVERBOUGHT" ? "AŞIRI ALIM" : e.williamsSignal === "OVERSOLD" ? "AŞIRI SATIM" : "normal"}]`);
  if (e.parabolicSar != null) lines.push(`Parabolic SAR: ₺${e.parabolicSar} → ${e.sarTrend === "BULLISH" ? "YÜKSELİŞ trendi" : "DÜŞÜŞ trendi"}`);
  if (e.elderBullPower != null) lines.push(`Elder Ray: Bull ${e.elderBullPower} | Bear ${e.elderBearPower}`);
  if (e.ttmSqueeze) lines.push(`⚡ TTM SQUEEZE AKTİF — Bollinger bantları Keltner kanalının içinde, çok güçlü kırılım bekleniyor`);
  return lines.length > 0 ? lines.join("\n") : "";
}

function formatCandlesticks(input: StockAnalysisInputV2): string {
  const patterns = input.candlestickPatterns;
  if (!patterns || patterns.length === 0) return "Önemli mum formasyonu yok.";
  return patterns.slice(0, 3).map(p =>
    `${p.nameTr} (${p.direction}, güç: ${p.strength}) → ${p.description}`
  ).join("\n");
}

function formatChartPatterns(input: StockAnalysisInputV2): string {
  const patterns = input.chartPatterns;
  if (!patterns || patterns.length === 0) return "";
  return patterns.map(p =>
    `⚡ ${p.nameTr} (${p.direction}, güç: ${p.strength}) → ${p.description}`
  ).join("\n");
}

function formatSignalChains(input: StockAnalysisInputV2): string {
  const chains = input.signalChains;
  if (!chains || chains.length === 0) return "";
  return chains.map(c =>
    `🔗 ${c.nameTr} (${c.direction}, güç: ${c.strength}) → ${c.description}`
  ).join("\n");
}

function formatFundamentals(input: StockAnalysisInputV2): string {
  const f = input.fundamentals;
  const s = input.fundamentalScore;
  if (!f) return "Temel analiz verisi mevcut değil.";
  const lines: string[] = [];
  lines.push(`TEMEL SKOR: ${s?.fundamentalScore ?? "—"}/100 (Değerleme: ${s?.valuationScore} | Karlılık: ${s?.profitabilityScore} | Büyüme: ${s?.growthScore} | Sağlık: ${s?.healthScore})`);
  if (f.peRatio != null) lines.push(`F/K: ${fmt(f.peRatio, 1)} | PD/DD: ${fmt(f.pbRatio)} | FD/FAVÖK: ${fmt(f.evToEbitda, 1)}`);
  if (f.roe != null) lines.push(`ROE: %${fmt(f.roe, 1)} | Net Kar Marjı: %${fmt(f.profitMargin, 1)}`);
  if (f.revenueGrowth != null) lines.push(`Gelir Büyümesi: %${fmt(f.revenueGrowth, 1)} | Kazanç Büyümesi: %${fmt(f.earningsGrowth, 1)}`);
  if (f.debtToEquity != null) lines.push(`Borç/Özsermaye: ${fmt(f.debtToEquity, 1)} | Cari Oran: ${fmt(f.currentRatio)}`);
  if (f.dividendYield != null) lines.push(`Temettü: %${fmt(f.dividendYield)}`);
  if (f.fromFiftyTwoHigh != null) lines.push(`52H Zirveden: %${fmt(f.fromFiftyTwoHigh, 1)}`);
  if (f.earningsDate) lines.push(`📅 Bilanço: ${f.earningsDate}${f.daysToEarnings ? ` (${f.daysToEarnings} gün)` : ""}`);
  if (f.daysToEarnings != null && f.daysToEarnings <= 14) lines.push(`⚠️ BİLANÇO YAKLAŞIYOR`);
  return lines.join("\n");
}

function formatMacro(input: StockAnalysisInputV2): string {
  const m = input.macroData;
  if (!m) return "Makro veri yok.";
  const lines: string[] = [];
  lines.push(`MAKRO SKOR: ${m.macroScore}/100 (${m.macroLabel})`);
  if (m.usdTry != null) lines.push(`USD/TRY: ₺${fmt(m.usdTry, 2)} (${(m.usdTryChange ?? 0) >= 0 ? "+" : ""}${fmt(m.usdTryChange)}%)`);
  if (m.dxy != null) lines.push(`DXY: ${fmt(m.dxy, 1)} (${(m.dxyChange ?? 0) >= 0 ? "+" : ""}${fmt(m.dxyChange)}%)`);
  if (m.vix != null) lines.push(`VIX: ${fmt(m.vix, 1)} → ${m.vix < 15 ? "Risk iştahı yüksek" : m.vix < 25 ? "Normal" : "TEDİRGİNLİK"}`);
  if (m.bist100 != null) lines.push(`BİST 100: ${m.bist100.toLocaleString("tr-TR")} (${(m.bist100Change ?? 0) >= 0 ? "+" : ""}${fmt(m.bist100Change)}%)`);
  return lines.join("\n");
}

function formatRisk(input: StockAnalysisInputV2): string {
  const r = input.riskMetrics;
  if (!r) return "Risk verisi yok.";
  const lines: string[] = [];
  lines.push(`Risk: ${r.riskLevelTr} | Sharpe: ${r.sharpeRatio ?? "—"} | MaxDD: %${r.maxDrawdown ?? "—"} | VaR: %${r.var95Daily ?? "—"}/gün | Beta: ${r.beta ?? "—"}`);
  return lines.join("\n");
}

function formatScore(input: StockAnalysisInputV2): string {
  const s = input.compositeScore;
  if (!s) return "Skor hesaplanamadı.";
  return `KOMPOZİT SKOR: ${s.composite}/100 (${s.labelTr}) | Teknik ${s.technical} | Momentum ${s.momentum} | Hacim ${s.volume} | Temel ${s.fundamental} | Makro ${s.macro} | Duyarlılık ${s.sentiment}`;
}

function formatSignals(input: StockAnalysisInputV2): string {
  if (input.signals.length === 0) return "Aktif sinyal yok.";
  return input.signals.slice(0, 6).map(s => `[${s.direction}|${s.strength}] ${s.description}`).join("\n");
}

function formatSector(input: StockAnalysisInputV2): string {
  const c = input.sectorContext;
  if (!c) return "Sektör verisi yok.";
  return `Sektör: ${c.sectorName} (${c.sectorChange >= 0 ? "+" : ""}${c.sectorChange.toFixed(2)}%) | Göreceli: ${c.relativeStrength >= 0 ? "+" : ""}${c.relativeStrength.toFixed(2)}% → ${c.outperforming ? "ÜSTÜN" : "DÜŞÜK"}`;
}

const TIMEFRAME_CONFIG = {
  daily: {
    label: "Günlük",
    perspective: "bugünkü",
    bars: "günlük mumlar",
    periodNote: "İndikatörler günlük bar bazlı: RSI(14 gün), MA(20/50/200 gün), MACD(12,26,9 gün), Bollinger(20 gün).",
    summaryInstruction: "Günün özeti (3-4 cümle). Skor, en güçlü sinyal/formasyon, temel durum, makro.",
    bullInstruction: "Boğa senaryosu (3-4 cümle). Pozitif göstergeler, destek seviyeleri, Fibonacci, Ichimoku bulut üstü, mum formasyonu.",
    bearInstruction: "Ayı senaryosu (3-4 cümle). Risk, direnç, bearish sinyaller, VaR, Sharpe, bulut altı.",
  },
  weekly: {
    label: "Haftalık",
    perspective: "bu haftanın",
    bars: "haftalık mumlar",
    periodNote: "İndikatörler haftalık bar bazlı: RSI(14 hafta), MA(10/20/40 hafta), MACD(12,26,9 hafta), Bollinger(20 hafta). Her bar 1 haftayı temsil eder.",
    summaryInstruction: "Haftalık özet (3-4 cümle). Haftalık trend yönü, haftalık RSI/MACD durumu, haftalık formasyonlar ve skor.",
    bullInstruction: "Haftalık boğa senaryosu (3-4 cümle). Haftalık destek seviyeleri, trend güçlenmesi, haftalık mum formasyonları.",
    bearInstruction: "Haftalık ayı senaryosu (3-4 cümle). Haftalık direnç, trend zayıflaması, haftalık kırılım riskleri.",
  },
  monthly: {
    label: "Aylık",
    perspective: "bu ayın",
    bars: "aylık mumlar",
    periodNote: "İndikatörler aylık bar bazlı: RSI(12 ay), MA(6/12/24 ay), MACD(9,18,6 ay), Bollinger(12 ay). Her bar 1 ayı temsil eder. Ichimoku aylık veride hesaplanamaz.",
    summaryInstruction: "Aylık özet (3-4 cümle). Uzun vadeli trend, aylık RSI/MACD, aylık formasyonlar ve makro etki.",
    bullInstruction: "Aylık boğa senaryosu (3-4 cümle). Uzun vadeli destek, aylık trend güçlenmesi, temel güç.",
    bearInstruction: "Aylık ayı senaryosu (3-4 cümle). Uzun vadeli direnç, makro riskler, temel zayıflıklar.",
  },
} as const;

export function buildAnalysisPrompt(input: StockAnalysisInputV2): string {
  const tf = TIMEFRAME_CONFIG[input.timeframe ?? "daily"];
  const priceStr = input.price != null ? `₺${input.price.toFixed(2)}` : "—";
  const changeStr = input.changePercent != null ? `%${input.changePercent.toFixed(2)}` : "—";
  const volumeStr = input.volume != null ? input.volume.toLocaleString("tr-TR") : "—";
  const newsSection = input.newsHeadlines.length > 0
    ? input.newsHeadlines.map((h, i) => `${i + 1}. ${h}`).join("\n")
    : "Haber yok.";

  // Ek katmanlar
  const extraSection = formatExtraIndicators(input);
  const candleSection = formatCandlesticks(input);
  const chartSection = formatChartPatterns(input);
  const chainSection = formatSignalChains(input);
  const seasonSection = input.seasonalLabel ? `Mevsimsellik: ${input.seasonalLabel}` : "";
  const mtfSection = input.multiTimeframeAlignment ? `Multi-Timeframe: ${input.multiTimeframeAlignment}` : "";

  return `Sen ${input.stockCode} hissesini analiz eden BİST uzmanısın. ${tf.label} (${tf.bars}) bazında 10 katmanlı veri sağlanıyor.
${tf.periodNote}

═══ FİYAT (${tf.label}) ═══
${input.date} | ${priceStr} | ${changeStr} | Hacim: ${volumeStr}

═══ 1. TEKNİK ═══
${formatTechnicals(input)}
${extraSection ? `\n${extraSection}` : ""}

═══ 2. MUM FORMASYONLARI ═══
${candleSection}
${chartSection ? `\n${chartSection}` : ""}

═══ 3. TEMEL ═══
${formatFundamentals(input)}

═══ 4. MAKRO ═══
${formatMacro(input)}

═══ 5. SEKTÖR ═══
${formatSector(input)}

═══ 6. RİSK ═══
${formatRisk(input)}

═══ 7. SKOR ═══
${formatScore(input)}

═══ 8. SİNYALLER ═══
${formatSignals(input)}
${chainSection ? `\nSinyal Zincirleri:\n${chainSection}` : ""}

═══ 9. BAĞLAM ═══
${seasonSection ? seasonSection + "\n" : ""}${mtfSection ? mtfSection + "\n" : ""}

═══ 10. HABERLER ═══
${newsSection}

═══ GÖREV (${tf.label} ANALİZ) ═══
${tf.bars.toUpperCase()} bazında tüm 10 katmanı değerlendir. ${tf.perspective} teknik göstergeleri, mum formasyonlarını, Ichimoku bulutunu, Fibonacci seviyelerini yorumla. Sinyal zincirleri varsa vurgula.

1. "summaryText": ${tf.summaryInstruction}
2. "bullCase": ${tf.bullInstruction}
3. "bearCase": ${tf.bearInstruction}
4. "sentimentValue": -100..+100
5. "confidence": "HIGH" (tüm katmanlar aynı yönü gösteriyor, sinyaller uyumlu) / "MEDIUM" (karışık sinyaller var ama genel yön belli) / "LOW" (zıt sinyaller çok, belirsizlik yüksek)
6. "verdictReason": Tek cümleyle bu hisseye ne yapılmalı? Skor, sinyaller ve temel durumu özetleyen kısa, açıkça yönlendirici bir cümle. Örnek: "Teknik göstergeler ve güçlü hacim desteği ile kısa vadede yükseliş potansiyeli yüksek." veya "Zayıf temel ve düşüş trendi nedeniyle temkinli olunmalı."

Türkçe, sade, sayılara referans ver, tavsiye verme.

JSON:
{"summaryText":"...","bullCase":"...","bearCase":"...","sentimentValue":0,"confidence":"MEDIUM","verdictReason":"..."}`;
}
