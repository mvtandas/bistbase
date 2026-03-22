/**
 * Sektör Rotasyonu Analizi
 * Para hangi sektöre giriyor, hangisinden çıkıyor?
 */

import { prisma } from "@/lib/prisma";
import { SECTOR_INDICES } from "./sectors";

export interface SectorRotation {
  sector: string;
  sectorName: string;
  change1W: number | null;  // Son 1 hafta toplam değişim
  change1M: number | null;  // Son 1 ay
  momentum: "INFLOW" | "OUTFLOW" | "NEUTRAL";
  rank1W: number;
}

export async function getSectorRotation(): Promise<SectorRotation[]> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const oneMonthAgo = new Date();
  oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

  const results: SectorRotation[] = [];

  for (const [code, info] of Object.entries(SECTOR_INDICES)) {
    // Son 1 hafta
    const weekSnapshots = await prisma.sectorSnapshot.findMany({
      where: { sectorCode: code, date: { gte: oneWeekAgo } },
      orderBy: { date: "asc" },
      select: { changePercent: true },
    });

    // Son 1 ay
    const monthSnapshots = await prisma.sectorSnapshot.findMany({
      where: { sectorCode: code, date: { gte: oneMonthAgo } },
      orderBy: { date: "asc" },
      select: { changePercent: true },
    });

    const change1W = weekSnapshots.length > 0
      ? (weekSnapshots.reduce((p, s) => p * (1 + (s.changePercent ?? 0) / 100), 1) - 1) * 100
      : null;

    const change1M = monthSnapshots.length > 0
      ? (monthSnapshots.reduce((p, s) => p * (1 + (s.changePercent ?? 0) / 100), 1) - 1) * 100
      : null;

    const momentum: SectorRotation["momentum"] =
      change1W != null
        ? change1W > 2 ? "INFLOW" : change1W < -2 ? "OUTFLOW" : "NEUTRAL"
        : "NEUTRAL";

    results.push({
      sector: code,
      sectorName: info.name,
      change1W: change1W != null ? Math.round(change1W * 100) / 100 : null,
      change1M: change1M != null ? Math.round(change1M * 100) / 100 : null,
      momentum,
      rank1W: 0,
    });
  }

  // Rank by 1W change
  const sorted = [...results]
    .filter(r => r.change1W != null)
    .sort((a, b) => (b.change1W ?? 0) - (a.change1W ?? 0));
  sorted.forEach((r, i) => { r.rank1W = i + 1; });

  // Apply ranks back
  for (const r of results) {
    const ranked = sorted.find(s => s.sector === r.sector);
    if (ranked) r.rank1W = ranked.rank1W;
  }

  return results.sort((a, b) => (b.change1W ?? 0) - (a.change1W ?? 0));
}
