/**
 * Chart Pattern Recognition
 * Grafik formasyonları: Double Top/Bottom, Head & Shoulders, Triangles
 */

import type { HistoricalBar } from "./technicals";

export interface ChartPattern {
  name: string;
  nameTr: string;
  type: "REVERSAL" | "CONTINUATION";
  direction: "BULLISH" | "BEARISH";
  strength: number;
  description: string;
}

interface SwingPoint {
  index: number;
  price: number;
  type: "HIGH" | "LOW";
}

function findSwingPoints(bars: HistoricalBar[], lookback = 5): SwingPoint[] {
  const points: SwingPoint[] = [];
  for (let i = lookback; i < bars.length - lookback; i++) {
    const window = bars.slice(i - lookback, i + lookback + 1);
    const isHigh = window.every(b => bars[i].high >= b.high);
    const isLow = window.every(b => bars[i].low <= b.low);
    if (isHigh) points.push({ index: i, price: bars[i].high, type: "HIGH" });
    if (isLow) points.push({ index: i, price: bars[i].low, type: "LOW" });
  }
  return points;
}

export function detectChartPatterns(bars: HistoricalBar[]): ChartPattern[] {
  if (bars.length < 30) return [];
  const patterns: ChartPattern[] = [];
  const swings = findSwingPoints(bars, 5);
  const highs = swings.filter(s => s.type === "HIGH");
  const lows = swings.filter(s => s.type === "LOW");
  const price = bars[bars.length - 1].close;

  // ── Double Top ──
  if (highs.length >= 2) {
    const h1 = highs[highs.length - 2];
    const h2 = highs[highs.length - 1];
    const gap = h2.index - h1.index;
    if (gap >= 10 && gap <= 60 && Math.abs(h1.price - h2.price) / h1.price < 0.02) {
      // Neckline: aradaki en düşük low
      const between = bars.slice(h1.index, h2.index);
      const neckline = Math.min(...between.map(b => b.low));
      if (price < neckline) {
        patterns.push({
          name: "DOUBLE_TOP", nameTr: "İkili Tepe", type: "REVERSAL", direction: "BEARISH", strength: 75,
          description: `İkili tepe formasyonu: ₺${h1.price.toFixed(2)} ve ₺${h2.price.toFixed(2)} seviyelerinde çift tepe. Boyun çizgisi ₺${neckline.toFixed(2)} kırıldı.`,
        });
      }
    }
  }

  // ── Double Bottom ──
  if (lows.length >= 2) {
    const l1 = lows[lows.length - 2];
    const l2 = lows[lows.length - 1];
    const gap = l2.index - l1.index;
    if (gap >= 10 && gap <= 60 && Math.abs(l1.price - l2.price) / l1.price < 0.02) {
      const between = bars.slice(l1.index, l2.index);
      const neckline = Math.max(...between.map(b => b.high));
      if (price > neckline) {
        patterns.push({
          name: "DOUBLE_BOTTOM", nameTr: "İkili Dip", type: "REVERSAL", direction: "BULLISH", strength: 75,
          description: `İkili dip formasyonu: ₺${l1.price.toFixed(2)} ve ₺${l2.price.toFixed(2)} seviyelerinde çift dip. Boyun çizgisi ₺${neckline.toFixed(2)} kırıldı.`,
        });
      }
    }
  }

  // ── Head & Shoulders ──
  if (highs.length >= 3) {
    const h = highs.slice(-3);
    if (h[1].price > h[0].price && h[1].price > h[2].price && Math.abs(h[0].price - h[2].price) / h[1].price < 0.03 && h[2].index - h[0].index >= 3) {
      const betweenBars = bars.slice(h[0].index + 1, h[2].index);
      if (betweenBars.length > 0) {
        const neckline = Math.min(...betweenBars.map(b => b.low));
        if (price < neckline && isFinite(neckline)) {
          patterns.push({
            name: "HEAD_SHOULDERS", nameTr: "Omuz-Baş-Omuz", type: "REVERSAL", direction: "BEARISH", strength: 85,
            description: `Omuz-Baş-Omuz formasyonu: Sol omuz ₺${h[0].price.toFixed(2)}, Baş ₺${h[1].price.toFixed(2)}, Sağ omuz ₺${h[2].price.toFixed(2)}. Boyun çizgisi kırıldı.`,
          });
        }
      }
    }
  }

  // ── Inverse Head & Shoulders ──
  if (lows.length >= 3) {
    const l = lows.slice(-3);
    if (l[1].price < l[0].price && l[1].price < l[2].price && Math.abs(l[0].price - l[2].price) / l[1].price < 0.03) {
      const neckline = Math.max(
        ...bars.slice(l[0].index, l[2].index + 1).map(b => b.high)
      );
      if (price > neckline) {
        patterns.push({
          name: "INVERSE_HEAD_SHOULDERS", nameTr: "Ters Omuz-Baş-Omuz", type: "REVERSAL", direction: "BULLISH", strength: 85,
          description: `Ters Omuz-Baş-Omuz: Güçlü dip dönüş formasyonu. Boyun çizgisi yukarı kırıldı.`,
        });
      }
    }
  }

  // ── Ascending / Descending Triangle ──
  if (highs.length >= 2 && lows.length >= 2) {
    const recentHighs = highs.slice(-3);
    const recentLows = lows.slice(-3);

    // Ascending: flat resistance, rising support
    const highFlat = recentHighs.length >= 2 && Math.abs(recentHighs[recentHighs.length - 1].price - recentHighs[recentHighs.length - 2].price) / recentHighs[0].price < 0.015;
    const lowRising = recentLows.length >= 2 && recentLows[recentLows.length - 1].price > recentLows[recentLows.length - 2].price;

    if (highFlat && lowRising) {
      patterns.push({
        name: "ASCENDING_TRIANGLE", nameTr: "Yükselen Üçgen", type: "CONTINUATION", direction: "BULLISH", strength: 70,
        description: "Yükselen üçgen: Yatay direnç + yükselen destek. Yukarı kırılım olasılığı yüksek.",
      });
    }

    // Descending: flat support, falling resistance
    const lowFlat = recentLows.length >= 2 && Math.abs(recentLows[recentLows.length - 1].price - recentLows[recentLows.length - 2].price) / recentLows[0].price < 0.015;
    const highFalling = recentHighs.length >= 2 && recentHighs[recentHighs.length - 1].price < recentHighs[recentHighs.length - 2].price;

    if (lowFlat && highFalling) {
      patterns.push({
        name: "DESCENDING_TRIANGLE", nameTr: "Düşen Üçgen", type: "CONTINUATION", direction: "BEARISH", strength: 70,
        description: "Düşen üçgen: Yatay destek + düşen direnç. Aşağı kırılım olasılığı yüksek.",
      });
    }
  }

  // ── Simetrik Üçgen ──
  if (highs.length >= 2 && lows.length >= 2) {
    const recentHighs = highs.slice(-3);
    const recentLows = lows.slice(-3);
    const highFalling = recentHighs.length >= 2 && recentHighs[recentHighs.length - 1].price < recentHighs[recentHighs.length - 2].price;
    const lowRising = recentLows.length >= 2 && recentLows[recentLows.length - 1].price > recentLows[recentLows.length - 2].price;

    if (highFalling && lowRising) {
      // Daralan range kontrolü
      const range1 = recentHighs[recentHighs.length - 2].price - recentLows[recentLows.length - 2].price;
      const range2 = recentHighs[recentHighs.length - 1].price - recentLows[recentLows.length - 1].price;
      if (range2 < range1 * 0.8) {
        patterns.push({
          name: "SYMMETRICAL_TRIANGLE", nameTr: "Simetrik Üçgen", type: "CONTINUATION", direction: price > (recentHighs[recentHighs.length - 1].price + recentLows[recentLows.length - 1].price) / 2 ? "BULLISH" : "BEARISH", strength: 65,
          description: "Simetrik üçgen: Düşen direnç + yükselen destek. Daralan range, kırılım yakın. Kırılım yönü trendin devamı olasılığı yüksek.",
        });
      }
    }
  }

  // ── Bayrak (Flag) — Devam formasyonu ──
  // Keskin hareket sonrası kısa konsolidasyon
  if (bars.length >= 30) {
    const recent20 = bars.slice(-20);
    const prior10 = bars.slice(-30, -20);

    // Önceki 10 barda güçlü hareket (>%8)
    const priorMove = (prior10[prior10.length - 1].close - prior10[0].close) / prior10[0].close;
    const recentRange = Math.max(...recent20.map(b => b.high)) - Math.min(...recent20.map(b => b.low));
    const priorRange = Math.max(...prior10.map(b => b.high)) - Math.min(...prior10.map(b => b.low));

    if (Math.abs(priorMove) > 0.08 && recentRange < priorRange * 0.5) {
      const isBullFlag = priorMove > 0;
      patterns.push({
        name: isBullFlag ? "BULL_FLAG" : "BEAR_FLAG",
        nameTr: isBullFlag ? "Boğa Bayrağı" : "Ayı Bayrağı",
        type: "CONTINUATION",
        direction: isBullFlag ? "BULLISH" : "BEARISH",
        strength: 70,
        description: `${isBullFlag ? "Boğa" : "Ayı"} bayrağı: Güçlü %${Math.abs(priorMove * 100).toFixed(0)} ${isBullFlag ? "yükseliş" : "düşüş"} sonrası dar konsolidasyon. Trend devamı olasılığı yüksek.`,
      });
    }
  }

  // ── Kama (Wedge) ──
  // Rising wedge (bearish) veya Falling wedge (bullish)
  if (highs.length >= 3 && lows.length >= 3) {
    const h3 = highs.slice(-3);
    const l3 = lows.slice(-3);

    const highsRising = h3[2].price > h3[1].price && h3[1].price > h3[0].price;
    const lowsRising = l3[2].price > l3[1].price && l3[1].price > l3[0].price;
    const highsFalling = h3[2].price < h3[1].price && h3[1].price < h3[0].price;
    const lowsFalling = l3[2].price < l3[1].price && l3[1].price < l3[0].price;

    // Daralan range (kama özelliği)
    const range0 = h3[0].price - l3[0].price;
    const range2 = h3[2].price - l3[2].price;
    const converging = range2 < range0 * 0.85;

    if (highsRising && lowsRising && converging) {
      patterns.push({
        name: "RISING_WEDGE", nameTr: "Yükselen Kama", type: "REVERSAL", direction: "BEARISH", strength: 72,
        description: "Yükselen kama: Hem tepeler hem dipler yükseliyor ama daralan range. Aşağı kırılım olasılığı yüksek.",
      });
    }
    if (highsFalling && lowsFalling && converging) {
      patterns.push({
        name: "FALLING_WEDGE", nameTr: "Düşen Kama", type: "REVERSAL", direction: "BULLISH", strength: 72,
        description: "Düşen kama: Hem tepeler hem dipler düşüyor ama daralan range. Yukarı kırılım olasılığı yüksek.",
      });
    }
  }

  // ── Fincan-Kulp (Cup & Handle) — Devam formasyonu ──
  if (bars.length >= 60 && lows.length >= 3 && highs.length >= 2) {
    // Sol kenar (önceki yüksek), dip ve sağ kenar (güncel yüksek)
    const leftRim = highs.find(h => h.index < bars.length - 40 && h.index > bars.length - 60);
    const cupBottom = lows.filter(l => l.index > (leftRim?.index ?? 0) && l.index < bars.length - 10);
    const rightRim = highs.filter(h => h.index > bars.length - 15);

    if (leftRim && cupBottom.length > 0 && rightRim.length > 0) {
      const deepest = cupBottom.reduce((a, b) => a.price < b.price ? a : b);
      const rightTop = rightRim[rightRim.length - 1];
      const rimMatch = Math.abs(leftRim.price - rightTop.price) / leftRim.price < 0.05;
      const cupDepth = (leftRim.price - deepest.price) / leftRim.price;

      if (rimMatch && cupDepth > 0.10 && cupDepth < 0.40) {
        // Handle: son 10 barda hafif geri çekilme
        const handleBars = bars.slice(-10);
        const handleDip = (rightTop.price - Math.min(...handleBars.map(b => b.low))) / rightTop.price;
        if (handleDip > 0.02 && handleDip < 0.10) {
          patterns.push({
            name: "CUP_AND_HANDLE", nameTr: "Fincan-Kulp", type: "CONTINUATION", direction: "BULLISH", strength: 80,
            description: `Fincan-Kulp: ₺${leftRim.price.toFixed(2)} kenar, %${(cupDepth * 100).toFixed(0)} derinlik, kulp oluşuyor. Kırılımda güçlü yükseliş potansiyeli.`,
          });
        }
      }
    }
  }

  patterns.sort((a, b) => b.strength - a.strength);
  return patterns;
}
