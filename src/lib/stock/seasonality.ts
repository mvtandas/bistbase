/**
 * Mevsimsellik Analizi
 * Hisse tarihsel olarak bu ayda nasıl performans gösteriyor?
 */

import type { HistoricalBar } from "./technicals";

export interface SeasonalityData {
  currentMonth: number;
  currentMonthName: string;
  monthlyAvgReturn: number | null;     // Bu ay ortalama getiri %
  monthlyMedianReturn: number | null;
  monthlyWinRate: number | null;       // Bu ayda yüzde kaç yılda pozitif?
  isHistoricallyStrong: boolean;
  seasonalLabel: string;
  monthlyReturns: { month: number; name: string; avgReturn: number; dataPoints: number }[];
}

const MONTH_NAMES_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
];

export function analyzeSeasonality(bars: HistoricalBar[]): SeasonalityData {
  const currentMonth = new Date().getMonth(); // 0-indexed

  if (bars.length < 60) {
    return {
      currentMonth: currentMonth + 1,
      currentMonthName: MONTH_NAMES_TR[currentMonth],
      monthlyAvgReturn: null,
      monthlyMedianReturn: null,
      monthlyWinRate: null,
      isHistoricallyStrong: false,
      seasonalLabel: "Yeterli veri yok",
      monthlyReturns: [],
    };
  }

  // Aylık getirileri hesapla
  const monthlyData = new Map<number, number[]>(); // month -> returns[]

  // Günlük bar'lardan aylık getiri hesapla
  let monthStart = 0;
  let currentBar = bars[0];
  let prevMonthClose = bars[0].close;

  for (let i = 1; i < bars.length; i++) {
    const barDate = new Date(bars[i].date);
    const prevDate = new Date(bars[i - 1].date);

    if (barDate.getMonth() !== prevDate.getMonth() || i === bars.length - 1) {
      // Ay değişti — önceki ayın getirisini kaydet
      const month = prevDate.getMonth();
      const monthReturn = prevMonthClose > 0
        ? ((bars[i - 1].close - prevMonthClose) / prevMonthClose) * 100
        : 0;

      const existing = monthlyData.get(month) ?? [];
      existing.push(monthReturn);
      monthlyData.set(month, existing);

      prevMonthClose = bars[i - 1].close;
    }
  }

  // Her ay için istatistikler
  const monthlyReturns = Array.from({ length: 12 }, (_, m) => {
    const returns = monthlyData.get(m) ?? [];
    const avg = returns.length > 0
      ? returns.reduce((a, b) => a + b, 0) / returns.length
      : 0;
    return {
      month: m + 1,
      name: MONTH_NAMES_TR[m],
      avgReturn: Math.round(avg * 100) / 100,
      dataPoints: returns.length,
    };
  });

  // Mevcut ay analizi
  const currentReturns = monthlyData.get(currentMonth) ?? [];
  const monthlyAvgReturn = currentReturns.length > 0
    ? Math.round((currentReturns.reduce((a, b) => a + b, 0) / currentReturns.length) * 100) / 100
    : null;

  const sorted = [...currentReturns].sort((a, b) => a - b);
  const monthlyMedianReturn = sorted.length > 0
    ? Math.round(sorted[Math.floor(sorted.length / 2)] * 100) / 100
    : null;

  const monthlyWinRate = currentReturns.length > 0
    ? Math.round((currentReturns.filter(r => r > 0).length / currentReturns.length) * 100)
    : null;

  const isHistoricallyStrong = monthlyAvgReturn != null && monthlyAvgReturn > 1;

  const seasonalLabel = monthlyAvgReturn == null ? "Veri yetersiz"
    : monthlyAvgReturn > 3 ? "Tarihsel olarak güçlü ay"
    : monthlyAvgReturn > 1 ? "Tarihsel olarak olumlu ay"
    : monthlyAvgReturn > -1 ? "Tarihsel olarak nötr ay"
    : monthlyAvgReturn > -3 ? "Tarihsel olarak zayıf ay"
    : "Tarihsel olarak kötü ay";

  return {
    currentMonth: currentMonth + 1,
    currentMonthName: MONTH_NAMES_TR[currentMonth],
    monthlyAvgReturn,
    monthlyMedianReturn,
    monthlyWinRate,
    isHistoricallyStrong,
    seasonalLabel,
    monthlyReturns,
  };
}
