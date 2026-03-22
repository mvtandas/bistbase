/**
 * Adaptif İndikatör Periyotları + KAMA
 * Volatiliteye göre RSI/Stoch/BB periyotlarını ayarla
 */

export function getAdaptivePeriod(basePeriod: number, atrPercent: number | null): number {
  if (atrPercent == null) return basePeriod;
  if (atrPercent > 5) return Math.round(basePeriod * 1.3);   // Yüksek vol → yavaş (gürültüyü azalt)
  if (atrPercent > 3) return Math.round(basePeriod * 1.15);
  if (atrPercent < 1) return Math.round(basePeriod * 0.7);   // Düşük vol → hızlı (ince hareketleri yakala)
  if (atrPercent < 1.5) return Math.round(basePeriod * 0.85);
  return basePeriod;
}

/**
 * Kaufman Adaptive Moving Average (KAMA)
 * Trend güçlüyse hızlı, gürültülüyse yavaş
 */
export function calculateKAMA(closes: number[], erPeriod = 10, fastPeriod = 2, slowPeriod = 30): number | null {
  if (closes.length < erPeriod + 1) return null;

  const fastest = 2 / (fastPeriod + 1);
  const slowest = 2 / (slowPeriod + 1);

  let kama = closes[erPeriod]; // Seed

  for (let i = erPeriod + 1; i < closes.length; i++) {
    // Efficiency Ratio
    const direction = Math.abs(closes[i] - closes[i - erPeriod]);
    let volatility = 0;
    for (let j = i - erPeriod + 1; j <= i; j++) {
      volatility += Math.abs(closes[j] - closes[j - 1]);
    }

    const er = volatility > 0 ? direction / volatility : 0;
    const sc = Math.pow(er * (fastest - slowest) + slowest, 2);
    kama = kama + sc * (closes[i] - kama);
  }

  return Math.round(kama * 100) / 100;
}
