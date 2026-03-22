/**
 * Signal Calibration — Geçmiş performansa göre sinyal güçlerini ayarla
 * DB'deki wasAccurate verisini kullanır
 */

import { prisma } from "@/lib/prisma";
import { cacheGet, cacheSet } from "@/lib/redis";

export interface SignalAccuracy {
  signalType: string;
  totalCount: number;
  accurateCount: number;
  accuracyRate: number;  // 0-100
  adjustedStrength: number; // sinyal bazında ayarlanmış güç multiplier
  reliabilityLabel: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT"; // kullanıcıya gösterilecek
}

// Son 180 günün verilerinden sinyal doğruluklarını hesapla
export async function getSignalAccuracyMap(): Promise<Map<string, SignalAccuracy>> {
  // Redis cache (6 hours — accuracy doesn't change frequently)
  const cacheKey = "signal:accuracy:map";
  const cached = await cacheGet<[string, SignalAccuracy][]>(cacheKey);
  if (cached) {
    return new Map(cached);
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 180);

  const signals = await prisma.signal.findMany({
    where: {
      wasAccurate: { not: null },
      date: { gte: cutoff },
    },
    select: {
      signalType: true,
      wasAccurate: true,
    },
  });

  const grouped = new Map<string, { total: number; accurate: number }>();

  for (const s of signals) {
    const existing = grouped.get(s.signalType) ?? { total: 0, accurate: 0 };
    existing.total++;
    if (s.wasAccurate) existing.accurate++;
    grouped.set(s.signalType, existing);
  }

  const result = new Map<string, SignalAccuracy>();

  for (const [type, data] of grouped) {
    const accuracyRate = (data.accurate / data.total) * 100;

    // Insufficient data — neutral strength, no adjustment
    let adjustedStrength = 1.0;
    let reliabilityLabel: SignalAccuracy["reliabilityLabel"] = "INSUFFICIENT";

    if (data.total >= 10) {
      // Güç çarpanı: %70+ doğruluk = güçlendir, %40- = zayıflat
      if (accuracyRate >= 80) adjustedStrength = 1.3;
      else if (accuracyRate >= 70) adjustedStrength = 1.15;
      else if (accuracyRate >= 60) adjustedStrength = 1.0;
      else if (accuracyRate >= 50) adjustedStrength = 0.9;
      else if (accuracyRate >= 40) adjustedStrength = 0.75;
      else adjustedStrength = 0.5;

      // Reliability label for UI display
      if (accuracyRate >= 65) reliabilityLabel = "HIGH";
      else if (accuracyRate >= 50) reliabilityLabel = "MEDIUM";
      else reliabilityLabel = "LOW";
    }

    result.set(type, {
      signalType: type,
      totalCount: data.total,
      accurateCount: data.accurate,
      accuracyRate: Math.round(accuracyRate),
      adjustedStrength,
      reliabilityLabel,
    });
  }

  // Cache as serializable array
  await cacheSet(cacheKey, [...result.entries()], 21600); // 6 hours

  return result;
}

// Sinyal güçlerini geçmiş performansa göre ayarla
export function calibrateSignalStrength(
  originalStrength: number,
  signalType: string,
  accuracyMap: Map<string, SignalAccuracy>
): number {
  const accuracy = accuracyMap.get(signalType);
  if (!accuracy) return originalStrength; // Veri yoksa orijinal güç
  if (accuracy.reliabilityLabel === "INSUFFICIENT") return originalStrength; // < 10 sample — ayarlama yapma

  const calibrated = Math.round(originalStrength * accuracy.adjustedStrength);
  return Math.max(10, Math.min(100, calibrated));
}
