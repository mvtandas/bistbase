/**
 * Bistbase Monte Carlo Simulation Engine
 * Geometrik Brownian Motion ile portföy gelecek projeksiyonu
 */

export interface MonteCarloPercentile {
  date: string;
  p5: number;    // en kötü %5
  p25: number;   // alt çeyrek
  p50: number;   // median
  p75: number;   // üst çeyrek
  p95: number;   // en iyi %5
}

export interface MonteCarloResult {
  projections: MonteCarloPercentile[];
  probabilityOfLoss: number;         // kayıp olasılığı %
  expectedReturn: number;            // beklenen getiri %
  expectedReturnRange: [number, number]; // %5-%95 aralığı
  medianFinalValue: number;          // median son değer (100 bazlı)
  worstCase: number;                 // %5 son değer
  bestCase: number;                  // %95 son değer
}

/**
 * Monte Carlo simülasyonu çalıştır
 * @param dailyReturns — tarihi günlük getiriler
 * @param simCount — simülasyon sayısı (default 1000)
 * @param projectionDays — projeksiyon gün sayısı (default 126 = ~6 ay)
 * @param startValue — başlangıç değeri (default 100)
 */
export function runMonteCarloSimulation(
  dailyReturns: number[],
  simCount = 1000,
  projectionDays = 126,
  startValue = 100,
): MonteCarloResult {
  const n = dailyReturns.length;

  if (n < 20) {
    return {
      projections: [],
      probabilityOfLoss: 0,
      expectedReturn: 0,
      expectedReturnRange: [0, 0],
      medianFinalValue: startValue,
      worstCase: startValue,
      bestCase: startValue,
    };
  }

  // Parametreleri tahmin et (log-normal)
  const logReturns = dailyReturns.map(r => Math.log(1 + r));
  const mu = logReturns.reduce((a, b) => a + b, 0) / n;
  const sigma = Math.sqrt(logReturns.reduce((s, r) => s + (r - mu) ** 2, 0) / n);

  // Box-Muller transform ile normal dağılımlı rastgele sayı
  function randNormal(): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  // Simülasyonları çalıştır
  // Her simülasyon: S(t+1) = S(t) * exp((mu - sigma²/2) + sigma * Z)
  const drift = mu - (sigma * sigma) / 2;

  // Tüm simülasyonların son değerlerini ve yollarını sakla
  const allPaths: number[][] = [];
  const finalValues: number[] = [];

  for (let sim = 0; sim < simCount; sim++) {
    const path: number[] = [startValue];
    let value = startValue;

    for (let day = 0; day < projectionDays; day++) {
      const z = randNormal();
      value = value * Math.exp(drift + sigma * z);
      path.push(value);
    }

    allPaths.push(path);
    finalValues.push(value);
  }

  // Her gün için yüzdelik bantları hesapla
  const projections: MonteCarloPercentile[] = [];

  // Her 5 günde bir nokta al (grafik performansı için)
  const step = Math.max(1, Math.floor(projectionDays / 25));

  // Bugünün tarihini başlangıç olarak kullan
  const today = new Date();

  for (let day = 0; day <= projectionDays; day += step) {
    const dayValues = allPaths.map(p => p[day]).sort((a, b) => a - b);

    const projDate = new Date(today);
    projDate.setDate(projDate.getDate() + day);
    const dateStr = projDate.toISOString().split("T")[0];

    projections.push({
      date: dateStr,
      p5: Math.round(dayValues[Math.floor(simCount * 0.05)] * 100) / 100,
      p25: Math.round(dayValues[Math.floor(simCount * 0.25)] * 100) / 100,
      p50: Math.round(dayValues[Math.floor(simCount * 0.50)] * 100) / 100,
      p75: Math.round(dayValues[Math.floor(simCount * 0.75)] * 100) / 100,
      p95: Math.round(dayValues[Math.floor(simCount * 0.95)] * 100) / 100,
    });
  }

  // Son gün istatistikleri
  const sortedFinal = [...finalValues].sort((a, b) => a - b);
  const probabilityOfLoss = Math.round((finalValues.filter(v => v < startValue).length / simCount) * 10000) / 100;
  const expectedReturn = Math.round(((finalValues.reduce((a, b) => a + b, 0) / simCount - startValue) / startValue) * 10000) / 100;
  const medianFinalValue = Math.round(sortedFinal[Math.floor(simCount * 0.5)] * 100) / 100;
  const worstCase = Math.round(sortedFinal[Math.floor(simCount * 0.05)] * 100) / 100;
  const bestCase = Math.round(sortedFinal[Math.floor(simCount * 0.95)] * 100) / 100;

  return {
    projections,
    probabilityOfLoss,
    expectedReturn,
    expectedReturnRange: [
      Math.round(((worstCase - startValue) / startValue) * 10000) / 100,
      Math.round(((bestCase - startValue) / startValue) * 10000) / 100,
    ],
    medianFinalValue,
    worstCase,
    bestCase,
  };
}
