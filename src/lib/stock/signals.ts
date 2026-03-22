/**
 * Bistbase Signal Detection Engine v2
 * Algoritmik sinyal tespiti — her sinyal kodla bulunur, AI'a söylenir.
 */

import type { FullTechnicalData } from "./technicals";

export interface DetectedSignal {
  type: string;
  direction: "BULLISH" | "BEARISH" | "NEUTRAL";
  strength: number; // 0-100 (context-adjusted)
  description: string; // Turkish
}

/**
 * Context-aware strength adjustment
 * ADX güçlü trend → trend sinyalleri güçlenir, mean-reversion zayıflar
 * ADX zayıf trend → mean-reversion sinyalleri güçlenir
 */
function adjustStrength(
  base: number,
  type: "trend" | "reversal" | "volume" | "neutral",
  adx: number | null,
): number {
  if (adx == null) return base;

  let multiplier = 1.0;
  if (type === "trend") {
    // Trend sinyalleri güçlü trendde daha güvenilir
    if (adx >= 35) multiplier = 1.15;
    else if (adx >= 25) multiplier = 1.05;
    else if (adx < 15) multiplier = 0.80; // Zayıf trend ortamında trend sinyali güvenilmez
  } else if (type === "reversal") {
    // Mean-reversion sinyalleri zayıf trendde daha güvenilir
    if (adx < 15) multiplier = 1.10;
    else if (adx >= 35) multiplier = 0.85; // Güçlü trendde reversal sinyali tehlikeli
  }
  // volume & neutral: no adjustment

  return Math.min(95, Math.round(base * multiplier));
}

function sig(type: string, direction: DetectedSignal["direction"], baseStrength: number, description: string, signalType: "trend" | "reversal" | "volume" | "neutral", adx: number | null): DetectedSignal {
  return { type, direction, strength: adjustStrength(baseStrength, signalType, adx), description };
}

export function detectSignals(
  t: FullTechnicalData,
  currentPrice: number
): DetectedSignal[] {
  const signals: DetectedSignal[] = [];
  const adx = t.adx14 ?? null;

  // ── Golden Cross / Death Cross ──
  if (t.crossSignal === "GOLDEN_CROSS") {
    signals.push(sig("GOLDEN_CROSS", "BULLISH", 85, "Altın Kesişim: 50 günlük ortalama, 200 günlüğü yukarı kesti. Uzun vadeli yükseliş trendi başlangıcı olabilir.", "trend", adx));
  }
  if (t.crossSignal === "DEATH_CROSS") {
    signals.push(sig("DEATH_CROSS", "BEARISH", 85, "Ölüm Kesişimi: 50 günlük ortalama, 200 günlüğü aşağı kesti. Uzun vadeli düşüş trendi başlangıcı olabilir.", "trend", adx));
  }

  // ── MACD Crossover ──
  if (t.macdCrossover === "BULLISH_CROSS") {
    const base = t.macdHistogram != null && t.macdHistogram > 0 ? 75 : 60;
    signals.push(sig("MACD_BULLISH_CROSS", "BULLISH", base, `MACD boğa kesişimi: Sinyal hattını yukarı kesti. MACD histogram ${t.macdHistogram?.toFixed(2)} ile pozitif bölgede.`, "trend", adx));
  }
  if (t.macdCrossover === "BEARISH_CROSS") {
    const base = t.macdHistogram != null && t.macdHistogram < 0 ? 75 : 60;
    signals.push(sig("MACD_BEARISH_CROSS", "BEARISH", base, `MACD ayı kesişimi: Sinyal hattını aşağı kesti. MACD histogram ${t.macdHistogram?.toFixed(2)} ile negatif bölgede.`, "trend", adx));
  }

  // ── RSI Diverjans ──
  if (t.rsiBullishDivergence && t.rsiSignal !== "OVERSOLD") {
    signals.push(sig("RSI_BULLISH_DIVERGENCE", "BULLISH", 70, `Boğa diverjansı: Fiyat düşerken RSI (${t.rsi14}) yükselmeye başladı. Trend dönüşü sinyali olabilir.`, "reversal", adx));
  }
  if (t.rsiBearishDivergence && t.rsiSignal !== "OVERBOUGHT") {
    signals.push(sig("RSI_BEARISH_DIVERGENCE", "BEARISH", 70, `Ayı diverjansı: Fiyat yükselirken RSI (${t.rsi14}) düşmeye başladı. Zayıflama sinyali olabilir.`, "reversal", adx));
  }

  // ── RSI Extremes (trend filtreli) ──
  // Güçlü trendde (ADX > 25) trend yönündeki RSI extreme → yoksay (false positive)
  const adxStrong = adx != null && adx > 25;
  const trendBullish = t.plusDI != null && t.minusDI != null && t.plusDI > t.minusDI;
  const trendBearish = t.plusDI != null && t.minusDI != null && t.minusDI > t.plusDI;

  if (t.rsiSignal === "OVERSOLD") {
    // Güçlü düşüş trendinde oversold = trend devam, sinyal üretme
    const skipSignal = adxStrong && trendBearish;
    if (!skipSignal) {
      const hasDivergence = t.rsiBullishDivergence;
      signals.push(sig(
        hasDivergence ? "RSI_BULLISH_DIVERGENCE" : "RSI_OVERSOLD", "BULLISH", hasDivergence ? 85 : 55,
        hasDivergence
          ? `Boğa diverjansı + aşırı satım: Fiyat düşerken RSI (${t.rsi14}) yükseliyor. Güçlü geri dönüş sinyali!`
          : `RSI ${t.rsi14} ile aşırı satım bölgesinde. Hisse gereğinden fazla satılmış olabilir, tepki yükselişi gelebilir.`,
        "reversal", adx,
      ));
    }
  }
  if (t.rsiSignal === "OVERBOUGHT") {
    // Güçlü yükseliş trendinde overbought = trend devam, sinyal üretme
    const skipSignal = adxStrong && trendBullish;
    if (!skipSignal) {
      const hasDivergence = t.rsiBearishDivergence;
      signals.push(sig(
        hasDivergence ? "RSI_BEARISH_DIVERGENCE" : "RSI_OVERBOUGHT", "BEARISH", hasDivergence ? 80 : 55,
        hasDivergence
          ? `Ayı diverjansı: Fiyat yükselirken RSI (${t.rsi14}) düşmeye başladı. Aşırı alım bölgesinde geri çekilme sinyali.`
          : `RSI ${t.rsi14} ile aşırı alım bölgesinde. Hisse aşırı değerlenmiş olabilir, düzeltme gelebilir.`,
        "reversal", adx,
      ));
    }
  }

  // ── Bollinger Squeeze (yön belirsiz → düşük strength) ──
  if (t.bbSqueeze) {
    signals.push(sig("BOLLINGER_SQUEEZE", "NEUTRAL", 40, `Bollinger sıkışması: Bantlar daraldı (genişlik: ${t.bbWidth?.toFixed(3)}). Sert bir kırılım hareketi yaklaşıyor olabilir, yön belirsiz.`, "neutral", adx));
  }

  // ── Bollinger Band Break (hacim onaylı) ──
  const hasVolumeConfirmation = t.volumeRatio != null && t.volumeRatio >= 1.5;
  if (t.bbPercentB != null) {
    if (t.bbPercentB > 1) {
      const strength = hasVolumeConfirmation ? 65 : 38; // Hacim onayı yoksa çok düşük
      signals.push(sig("BB_UPPER_BREAK", "BULLISH", strength,
        `Fiyat üst Bollinger bandını (₺${t.bbUpper?.toFixed(2)}) aştı.${hasVolumeConfirmation ? " Hacim onayı var — güçlü momentum." : " Hacim zayıf, sahte kırılım olabilir."}`,
        "trend", adx));
    }
    if (t.bbPercentB < 0) {
      const strength = hasVolumeConfirmation ? 65 : 38;
      signals.push(sig("BB_LOWER_BREAK", "BEARISH", strength,
        `Fiyat alt Bollinger bandının (₺${t.bbLower?.toFixed(2)}) altına indi.${hasVolumeConfirmation ? " Hacim onayı var — satış baskısı güçlü." : " Hacim zayıf, geri dönüş olası."}`,
        "reversal", adx));
    }
  }

  // ── Volume Anomaly (fiyat yönüyle) ──
  if (t.volumeAnomaly && t.volumeRatio != null) {
    // Fiyat değişimi ile yön belirle (RSI yerine changePercent daha doğru)
    const changePercent = t.ma20 != null ? ((currentPrice - t.ma20) / t.ma20) * 100 : null;
    const priceUp = changePercent != null ? changePercent > 0.5 : (t.rsi14 != null && t.rsi14 > 50);
    const priceDown = changePercent != null ? changePercent < -0.5 : (t.rsi14 != null && t.rsi14 < 50);
    const flat = !priceUp && !priceDown;

    const direction: DetectedSignal["direction"] = priceUp ? "BULLISH" : priceDown ? "BEARISH" : "NEUTRAL";
    const strength = flat ? 45 : 70; // Fiyat değişmeden yüksek hacim → belirsizlik, düşük strength

    signals.push(sig("VOLUME_ANOMALY", direction, strength,
      `Hacim anomalisi: İşlem hacmi 20 gün ortalamasının ${t.volumeRatio.toFixed(1)} katı. ${
        priceUp ? "Kurumsal alım hareketliliği olabilir."
        : priceDown ? "Büyük çıkış baskısı olabilir."
        : "Fiyat stabil — birikme veya dağıtım belirsiz."}`,
      "volume", adx));
  }

  // ── MA Alignment ──
  if (t.maAlignment === "STRONG_BULLISH") {
    signals.push(sig("MA_STRONG_BULLISH", "BULLISH", 70, "Güçlü yükseliş hizalaması: Fiyat > MA20 > MA50 > MA200. Tüm hareketli ortalamalar yükseliş trendini destekliyor.", "trend", adx));
  }
  if (t.maAlignment === "STRONG_BEARISH") {
    signals.push(sig("MA_STRONG_BEARISH", "BEARISH", 70, "Güçlü düşüş hizalaması: Fiyat < MA20 < MA50 < MA200. Tüm hareketli ortalamalar düşüş trendini destekliyor.", "trend", adx));
  }

  // ── Stochastic Extremes ──
  if (t.stochSignal === "OVERSOLD" && t.stochK != null) {
    signals.push(sig("STOCH_OVERSOLD", "BULLISH", 55, `Stochastic %K ${t.stochK.toFixed(1)} ile aşırı satım bölgesinde. Kısa vadeli geri dönüş sinyali.`, "reversal", adx));
  }
  if (t.stochSignal === "OVERBOUGHT" && t.stochK != null) {
    signals.push(sig("STOCH_OVERBOUGHT", "BEARISH", 55, `Stochastic %K ${t.stochK.toFixed(1)} ile aşırı alım bölgesinde. Kısa vadeli geri çekilme olası.`, "reversal", adx));
  }

  // ── ADX Strong Trend ──
  if (t.adx14 != null && t.adx14 >= 30 && t.plusDI != null && t.minusDI != null) {
    const bullish = t.plusDI > t.minusDI;
    const base = Math.min(90, Math.round(t.adx14));
    signals.push(sig(
      bullish ? "STRONG_UPTREND" : "STRONG_DOWNTREND",
      bullish ? "BULLISH" : "BEARISH", base,
      bullish
        ? `Güçlü yükseliş trendi: ADX ${t.adx14.toFixed(1)}, +DI (${t.plusDI.toFixed(1)}) > -DI (${t.minusDI.toFixed(1)}). Trend güçlü ve yükseliş yönünde.`
        : `Güçlü düşüş trendi: ADX ${t.adx14.toFixed(1)}, -DI (${t.minusDI.toFixed(1)}) > +DI (${t.plusDI.toFixed(1)}). Trend güçlü ve düşüş yönünde.`,
      "trend", adx,
    ));
  }

  // ── Support/Resistance Break (hacim onaylı) ──
  if (t.breakoutSignal === "RESISTANCE_BREAK" && t.resistance != null) {
    const strength = hasVolumeConfirmation ? 80 : 50; // Hacim onayı ile güçlü, yoksa zayıf
    signals.push(sig("RESISTANCE_BREAK", "BULLISH", strength,
      `Direnç kırılımı: Fiyat ₺${currentPrice.toFixed(2)}, direnç ₺${t.resistance.toFixed(2)}'yi aştı.${hasVolumeConfirmation ? " Hacim onayı var — kırılım güçlü." : " Hacim düşük, sahte kırılım riski."}`,
      "trend", adx));
  }
  if (t.breakoutSignal === "SUPPORT_BREAK" && t.support != null) {
    const strength = hasVolumeConfirmation ? 80 : 50;
    signals.push(sig("SUPPORT_BREAK", "BEARISH", strength,
      `Destek kırılımı: Fiyat ₺${currentPrice.toFixed(2)}, destek ₺${t.support.toFixed(2)}'nin altına indi.${hasVolumeConfirmation ? " Hacim onayı var — satış baskısı güçlü." : " Hacim düşük, geri dönüş olası."}`,
      "trend", adx));
  }

  // ── OBV Divergence ──
  if (t.obvDivergence === "BULLISH") {
    signals.push(sig("OBV_BULLISH_DIVERGENCE", "BULLISH", 65, "OBV boğa diverjansı: Fiyat düşerken hacim bazlı para akışı yükseliyor. Akıllı para birikimi olabilir.", "volume", adx));
  }
  if (t.obvDivergence === "BEARISH") {
    signals.push(sig("OBV_BEARISH_DIVERGENCE", "BEARISH", 65, "OBV ayı diverjansı: Fiyat yükselirken hacim bazlı para akışı düşüyor. Dağıtım (çıkış) başlamış olabilir.", "volume", adx));
  }

  // ── CMF Money Flow ──
  if (t.cmfSignal === "ACCUMULATION" && t.cmf20 != null) {
    signals.push(sig("CMF_ACCUMULATION", "BULLISH", 65, `Para girişi tespit edildi: CMF ${t.cmf20.toFixed(3)} ile pozitif. Akıllı para hisseye giriyor olabilir.`, "volume", adx));
  }
  if (t.cmfSignal === "DISTRIBUTION" && t.cmf20 != null) {
    signals.push(sig("CMF_DISTRIBUTION", "BEARISH", 65, `Para çıkışı tespit edildi: CMF ${t.cmf20.toFixed(3)} ile negatif. Kurumsal satış baskısı olabilir.`, "volume", adx));
  }

  // ── MFI Extremes ──
  if (t.mfiSignal === "OVERSOLD" && t.mfi14 != null) {
    signals.push(sig("MFI_OVERSOLD", "BULLISH", 60, `MFI ${t.mfi14.toFixed(1)} ile aşırı satım. Hacim bazlı gösterge hissede dip fırsatına işaret ediyor.`, "reversal", adx));
  }
  if (t.mfiSignal === "OVERBOUGHT" && t.mfi14 != null) {
    signals.push(sig("MFI_OVERBOUGHT", "BEARISH", 60, `MFI ${t.mfi14.toFixed(1)} ile aşırı alım. Hacim bazlı gösterge hissede aşırı değerlenmeye işaret ediyor.`, "reversal", adx));
  }

  // Sort by strength descending
  signals.sort((a, b) => b.strength - a.strength);

  return signals;
}
