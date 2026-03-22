/**
 * Bistbase Candlestick Pattern Recognition
 * Mum formasyon tanıma — 20+ formasyon, tek/ikili/üçlü
 */

import type { HistoricalBar } from "./technicals";

export interface CandlestickPattern {
  name: string;
  nameTr: string;
  type: "REVERSAL" | "CONTINUATION" | "INDECISION";
  direction: "BULLISH" | "BEARISH" | "NEUTRAL";
  strength: number;
  barIndex: number;
  description: string;
}

// ═══ HELPERS ═══

function body(bar: HistoricalBar): number {
  return Math.abs(bar.close - (bar as BarWithOpen).open);
}

function totalRange(bar: HistoricalBar): number {
  return bar.high - bar.low;
}

function upperShadow(bar: HistoricalBar): number {
  const o = (bar as BarWithOpen).open;
  return bar.high - Math.max(bar.close, o);
}

function lowerShadow(bar: HistoricalBar): number {
  const o = (bar as BarWithOpen).open;
  return Math.min(bar.close, o) - bar.low;
}

function isGreen(bar: HistoricalBar): boolean {
  return bar.close >= (bar as BarWithOpen).open;
}

function isRed(bar: HistoricalBar): boolean {
  return bar.close < (bar as BarWithOpen).open;
}

// Yahoo historical doesn't always have open, approximate from previous close
interface BarWithOpen extends HistoricalBar {
  open: number;
}

function ensureOpen(bars: HistoricalBar[]): BarWithOpen[] {
  return bars.map((bar, i) => ({
    ...bar,
    open: (bar as unknown as Record<string, unknown>).open as number ?? (i > 0 ? bars[i - 1].close : bar.close),
  }));
}

// Trend: son 5 mum
function getTrend(bars: BarWithOpen[], idx: number): "UPTREND" | "DOWNTREND" | "SIDEWAYS" {
  if (idx < 5) return "SIDEWAYS";
  const start = bars[idx - 5].close;
  const end = bars[idx].close;
  const greenCount = bars.slice(idx - 5, idx).filter((b) => isGreen(b)).length;
  if (end > start && greenCount >= 3) return "UPTREND";
  if (end < start && greenCount <= 2) return "DOWNTREND";
  return "SIDEWAYS";
}

// ═══ DETECTION ═══

export function detectCandlestickPatterns(rawBars: HistoricalBar[]): CandlestickPattern[] {
  if (rawBars.length < 5) return [];
  const bars = ensureOpen(rawBars);
  const patterns: CandlestickPattern[] = [];
  const i = bars.length - 1; // Son mum
  const b = bars[i];
  const prev = i > 0 ? bars[i - 1] : null;
  const prev2 = i > 1 ? bars[i - 2] : null;
  const trend = getTrend(bars, i);
  const range = totalRange(b);
  const bod = body(b);

  if (range === 0) return patterns;

  // ── TEK MUM ──

  // Doji
  if (bod <= range * 0.1) {
    if (b.close <= b.low + range * 0.15 && upperShadow(b) > range * 0.6) {
      patterns.push({ name: "GRAVESTONE_DOJI", nameTr: "Mezar Taşı Doji", type: "REVERSAL", direction: "BEARISH", strength: 50, barIndex: i, description: "Mezar taşı doji: Üst gölge çok uzun, gövde dipte. Yükseliş trendinde tepe sinyali." });
    } else if (b.close >= b.high - range * 0.15 && lowerShadow(b) > range * 0.6) {
      patterns.push({ name: "DRAGONFLY_DOJI", nameTr: "Yusufçuk Doji", type: "REVERSAL", direction: "BULLISH", strength: 50, barIndex: i, description: "Yusufçuk doji: Alt gölge çok uzun, gövde tepede. Düşüş trendinde dip sinyali." });
    } else {
      patterns.push({ name: "DOJI", nameTr: "Doji", type: "INDECISION", direction: "NEUTRAL", strength: 40, barIndex: i, description: "Doji: Alıcı ve satıcılar dengede, kararsızlık. Trend dönüşü öncüsü olabilir." });
    }
  }

  // Hammer / Hanging Man
  if (lowerShadow(b) >= bod * 2 && upperShadow(b) <= bod * 0.3 && bod > range * 0.1) {
    if (trend === "DOWNTREND") {
      patterns.push({ name: "HAMMER", nameTr: "Çekiç", type: "REVERSAL", direction: "BULLISH", strength: 65, barIndex: i, description: "Çekiç formasyonu: Düşüş trendinde dip dönüş sinyali. Alt gölge güçlü alıcı tepkisini gösteriyor." });
    } else if (trend === "UPTREND") {
      patterns.push({ name: "HANGING_MAN", nameTr: "Asılan Adam", type: "REVERSAL", direction: "BEARISH", strength: 60, barIndex: i, description: "Asılan adam formasyonu: Yükseliş trendinde tepe dönüş uyarısı." });
    }
  }

  // Shooting Star / Inverted Hammer
  if (upperShadow(b) >= bod * 2 && lowerShadow(b) <= bod * 0.3 && bod > range * 0.1) {
    if (trend === "UPTREND") {
      patterns.push({ name: "SHOOTING_STAR", nameTr: "Kayan Yıldız", type: "REVERSAL", direction: "BEARISH", strength: 65, barIndex: i, description: "Kayan yıldız: Yükseliş trendinde tepe dönüş sinyali. Üst gölge reddedilen fiyatı gösteriyor." });
    } else if (trend === "DOWNTREND") {
      patterns.push({ name: "INVERTED_HAMMER", nameTr: "Ters Çekiç", type: "REVERSAL", direction: "BULLISH", strength: 55, barIndex: i, description: "Ters çekiç: Düşüş trendinde potansiyel dip sinyali. Teyit gerektirir." });
    }
  }

  // Marubozu
  if (bod > range * 0.9) {
    if (isGreen(b)) {
      patterns.push({ name: "BULLISH_MARUBOZU", nameTr: "Boğa Marubozu", type: "CONTINUATION", direction: "BULLISH", strength: 70, barIndex: i, description: "Boğa marubozu: Gölgesiz güçlü yeşil mum. Alıcılar tam hakimiyette." });
    } else {
      patterns.push({ name: "BEARISH_MARUBOZU", nameTr: "Ayı Marubozu", type: "CONTINUATION", direction: "BEARISH", strength: 70, barIndex: i, description: "Ayı marubozu: Gölgesiz güçlü kırmızı mum. Satıcılar tam hakimiyette." });
    }
  }

  // ── İKİLİ MUM ──
  if (prev) {
    const prevBod = body(prev);

    // Bullish Engulfing
    if (isRed(prev) && isGreen(b) && b.open <= prev.close && b.close >= prev.open && bod >= prevBod * 1.1 && trend === "DOWNTREND") {
      const volBonus = b.volume > prev.volume ? 10 : 0;
      patterns.push({ name: "BULLISH_ENGULFING", nameTr: "Boğa Yutma", type: "REVERSAL", direction: "BULLISH", strength: 75 + volBonus, barIndex: i, description: "Boğa yutma formasyonu: Yeşil mum önceki kırmızı mumu tamamen kapladı. Güçlü dip dönüş sinyali." });
    }

    // Bearish Engulfing
    if (isGreen(prev) && isRed(b) && b.open >= prev.close && b.close <= prev.open && bod >= prevBod * 1.1 && trend === "UPTREND") {
      const volBonus = b.volume > prev.volume ? 10 : 0;
      patterns.push({ name: "BEARISH_ENGULFING", nameTr: "Ayı Yutma", type: "REVERSAL", direction: "BEARISH", strength: 75 + volBonus, barIndex: i, description: "Ayı yutma formasyonu: Kırmızı mum önceki yeşil mumu tamamen kapladı. Güçlü tepe dönüş sinyali." });
    }

    // Bullish Harami
    if (isRed(prev) && isGreen(b) && prevBod > bod * 1.5 && b.open >= prev.close && b.close <= prev.open && trend === "DOWNTREND") {
      patterns.push({ name: "BULLISH_HARAMI", nameTr: "Boğa Harami", type: "REVERSAL", direction: "BULLISH", strength: 55, barIndex: i, description: "Boğa harami: Küçük yeşil mum büyük kırmızı mumun içinde. Düşüş trendinde zayıflama sinyali." });
    }

    // Bearish Harami
    if (isGreen(prev) && isRed(b) && prevBod > bod * 1.5 && b.open <= prev.close && b.close >= prev.open && trend === "UPTREND") {
      patterns.push({ name: "BEARISH_HARAMI", nameTr: "Ayı Harami", type: "REVERSAL", direction: "BEARISH", strength: 55, barIndex: i, description: "Ayı harami: Küçük kırmızı mum büyük yeşil mumun içinde. Yükseliş trendinde zayıflama sinyali." });
    }

    // Piercing Line
    if (isRed(prev) && isGreen(b) && b.open < prev.close && b.close > (prev.open + prev.close) / 2 && trend === "DOWNTREND") {
      patterns.push({ name: "PIERCING_LINE", nameTr: "Delici Çizgi", type: "REVERSAL", direction: "BULLISH", strength: 65, barIndex: i, description: "Delici çizgi: Gap down sonrası güçlü toparlanma. Dip dönüş formasyonu." });
    }

    // Dark Cloud Cover
    if (isGreen(prev) && isRed(b) && b.open > prev.close && b.close < (prev.open + prev.close) / 2 && trend === "UPTREND") {
      patterns.push({ name: "DARK_CLOUD", nameTr: "Kara Bulut Örtüsü", type: "REVERSAL", direction: "BEARISH", strength: 65, barIndex: i, description: "Kara bulut örtüsü: Gap up sonrası sert düşüş. Tepe dönüş formasyonu." });
    }

    // Tweezer Top/Bottom (ATR toleransı yerine range %2)
    const tolerance = range * 0.02 || 0.01;
    if (Math.abs(b.high - prev.high) < tolerance && isGreen(prev) && isRed(b) && trend === "UPTREND") {
      patterns.push({ name: "TWEEZER_TOP", nameTr: "Cımbız Tepe", type: "REVERSAL", direction: "BEARISH", strength: 60, barIndex: i, description: "Cımbız tepe: İki mum aynı tepede reddedildi. Tepe dönüş sinyali." });
    }
    if (Math.abs(b.low - prev.low) < tolerance && isRed(prev) && isGreen(b) && trend === "DOWNTREND") {
      patterns.push({ name: "TWEEZER_BOTTOM", nameTr: "Cımbız Dip", type: "REVERSAL", direction: "BULLISH", strength: 60, barIndex: i, description: "Cımbız dip: İki mum aynı dipte destek buldu. Dip dönüş sinyali." });
    }
  }

  // ── ÜÇLÜ MUM ──
  if (prev && prev2) {
    const prev2Bod = body(prev2);
    const prevBod = body(prev);

    // Morning Star
    const windowRange = Math.max(totalRange(prev2), totalRange(prev), totalRange(b));
    if (isRed(prev2) && prev2Bod > totalRange(prev2) * 0.4 && prevBod < windowRange * 0.2 && isGreen(b) && bod > totalRange(b) * 0.4 && b.close > (prev2.open + prev2.close) / 2 && trend === "DOWNTREND") {
      patterns.push({ name: "MORNING_STAR", nameTr: "Sabah Yıldızı", type: "REVERSAL", direction: "BULLISH", strength: 80, barIndex: i, description: "Sabah yıldızı: Güçlü dip dönüş formasyonu. Büyük kırmızı → küçük gövde → büyük yeşil." });
    }

    // Evening Star
    if (isGreen(prev2) && prev2Bod > totalRange(prev2) * 0.4 && prevBod < windowRange * 0.2 && isRed(b) && bod > totalRange(b) * 0.4 && b.close < (prev2.open + prev2.close) / 2 && trend === "UPTREND") {
      patterns.push({ name: "EVENING_STAR", nameTr: "Akşam Yıldızı", type: "REVERSAL", direction: "BEARISH", strength: 80, barIndex: i, description: "Akşam yıldızı: Güçlü tepe dönüş formasyonu. Büyük yeşil → küçük gövde → büyük kırmızı." });
    }

    // Three White Soldiers
    if (isGreen(prev2) && isGreen(prev) && isGreen(b) && prev.close > prev2.close && b.close > prev.close && upperShadow(b) < bod * 0.3 && upperShadow(prev) < body(prev) * 0.3) {
      patterns.push({ name: "THREE_WHITE_SOLDIERS", nameTr: "Üç Beyaz Asker", type: "CONTINUATION", direction: "BULLISH", strength: 85, barIndex: i, description: "Üç beyaz asker: 3 ardışık güçlü yeşil mum. Güçlü yükseliş devamı." });
    }

    // Three Black Crows
    if (isRed(prev2) && isRed(prev) && isRed(b) && prev.close < prev2.close && b.close < prev.close && lowerShadow(b) < bod * 0.3 && lowerShadow(prev) < body(prev) * 0.3) {
      patterns.push({ name: "THREE_BLACK_CROWS", nameTr: "Üç Kara Karga", type: "CONTINUATION", direction: "BEARISH", strength: 85, barIndex: i, description: "Üç kara karga: 3 ardışık güçlü kırmızı mum. Güçlü düşüş devamı." });
    }

    // Three Inside Up (Bullish Harami + teyit)
    if (isRed(prev2) && isGreen(prev) && body(prev2) > body(prev) * 1.5 && prev.open >= prev2.close && prev.close <= prev2.open && isGreen(b) && b.close > prev2.open) {
      patterns.push({ name: "THREE_INSIDE_UP", nameTr: "Üçlü İç Yükseliş", type: "REVERSAL", direction: "BULLISH", strength: 70, barIndex: i, description: "Üçlü iç yükseliş: Harami + teyit mumu. Dip dönüş teyidi." });
    }

    // Three Inside Down (Bearish Harami + teyit)
    if (isGreen(prev2) && isRed(prev) && body(prev2) > body(prev) * 1.5 && prev.open <= prev2.close && prev.close >= prev2.open && isRed(b) && b.close < prev2.open) {
      patterns.push({ name: "THREE_INSIDE_DOWN", nameTr: "Üçlü İç Düşüş", type: "REVERSAL", direction: "BEARISH", strength: 70, barIndex: i, description: "Üçlü iç düşüş: Harami + teyit mumu. Tepe dönüş teyidi." });
    }
  }

  // Güce göre sırala
  patterns.sort((a, b) => b.strength - a.strength);
  return patterns;
}
