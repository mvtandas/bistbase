import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300;

/**
 * Geçmiş DailySummary kayıtlarını compositeScore'dan verdict'e dönüştürür
 * ve outcome'ları gelecek günlerin closePrice'larından hesaplar.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const reset = url.searchParams.get("reset") === "true";

  try {
    // Reset: mevcut verdict verilerini sıfırla
    if (reset) {
      await prisma.dailySummary.updateMany({
        where: { timeframe: "daily", verdictAction: { not: null } },
        data: {
          verdictAction: null, verdictScore: null, verdictConfidence: null,
          priceAfter1D: null, priceAfter5D: null, priceAfter10D: null, priceAfter20D: null,
          outcomePercent1D: null, outcomePercent5D: null, outcomePercent10D: null, outcomePercent20D: null,
          verdictAccurate: null,
        },
      });
    }

    // Phase 1: compositeScore → verdictAction dönüşümü
    const summaries = await prisma.dailySummary.findMany({
      where: {
        verdictAction: null,
        compositeScore: { not: null },
        status: "COMPLETED",
        timeframe: "daily",
      },
      select: { id: true, stockCode: true, date: true, closePrice: true, compositeScore: true },
      orderBy: { date: "asc" },
    });

    let verdictsFilled = 0;
    for (const s of summaries) {
      const score = s.compositeScore!;
      const { action, verdictScore, confidence } = scoreToVerdict(score);
      await prisma.dailySummary.update({
        where: { id: s.id },
        data: { verdictAction: action, verdictScore, verdictConfidence: confidence },
      });
      verdictsFilled++;
    }

    // Phase 2: Outcome'ları gelecek günlerin closePrice'larından doldur
    const withVerdict = await prisma.dailySummary.findMany({
      where: {
        verdictAction: { not: null },
        closePrice: { not: null },
        priceAfter1D: null,
        timeframe: "daily",
      },
      select: { id: true, stockCode: true, date: true, closePrice: true, verdictAction: true },
      orderBy: { date: "asc" },
      take: 500,
    });

    let outcomesFilled = 0;
    for (const v of withVerdict) {
      // N gün sonraki closePrice'ları bul
      const futureSummaries = await prisma.dailySummary.findMany({
        where: {
          stockCode: v.stockCode,
          date: { gt: v.date },
          timeframe: "daily",
          closePrice: { not: null },
          status: "COMPLETED",
        },
        select: { date: true, closePrice: true },
        orderBy: { date: "asc" },
        take: 25, // 20 iş günü + tolerans
      });

      if (futureSummaries.length === 0) continue;

      const basePrice = v.closePrice!;
      const price1D = findClosestPrice(futureSummaries, v.date, 1);
      const price5D = findClosestPrice(futureSummaries, v.date, 5);
      const price10D = findClosestPrice(futureSummaries, v.date, 10);
      const price20D = findClosestPrice(futureSummaries, v.date, 20);

      const data: Record<string, unknown> = {};
      if (price1D != null) {
        data.priceAfter1D = price1D;
        data.outcomePercent1D = round2(((price1D - basePrice) / basePrice) * 100);
      }
      if (price5D != null) {
        data.priceAfter5D = price5D;
        data.outcomePercent5D = round2(((price5D - basePrice) / basePrice) * 100);
      }
      if (price10D != null) {
        data.priceAfter10D = price10D;
        data.outcomePercent10D = round2(((price10D - basePrice) / basePrice) * 100);
      }
      if (price20D != null) {
        data.priceAfter20D = price20D;
        data.outcomePercent20D = round2(((price20D - basePrice) / basePrice) * 100);
        data.verdictAccurate = determineAccuracy(
          v.verdictAction!,
          (data.outcomePercent20D as number),
        );
      }

      if (Object.keys(data).length > 0) {
        await prisma.dailySummary.update({ where: { id: v.id }, data });
        outcomesFilled++;
      }
    }

    return NextResponse.json({ success: true, verdictsFilled, outcomesFilled });
  } catch (error) {
    console.error("Verdict backfill failed:", error);
    return NextResponse.json({ error: "Backfill failed" }, { status: 500 });
  }
}

function scoreToVerdict(compositeScore: number): { action: string; verdictScore: number; confidence: number } {
  if (compositeScore >= 68) return { action: "GUCLU_AL", verdictScore: 0.60, confidence: 60 };
  if (compositeScore >= 55) return { action: "AL", verdictScore: 0.25, confidence: 50 };
  if (compositeScore >= 45) return { action: "TUT", verdictScore: 0.00, confidence: 30 };
  if (compositeScore >= 32) return { action: "SAT", verdictScore: -0.25, confidence: 50 };
  return { action: "GUCLU_SAT", verdictScore: -0.60, confidence: 60 };
}

function findClosestPrice(
  futures: { date: Date; closePrice: number | null }[],
  baseDate: Date,
  targetDays: number,
): number | null {
  const targetDate = new Date(baseDate);
  targetDate.setDate(targetDate.getDate() + targetDays);

  // Hedef güne en yakın kaydı bul (±2 gün tolerans)
  let best: { date: Date; closePrice: number | null } | null = null;
  let bestDiff = Infinity;
  for (const f of futures) {
    const diff = Math.abs(f.date.getTime() - targetDate.getTime());
    const dayDiff = diff / (1000 * 60 * 60 * 24);
    if (dayDiff <= 3 && diff < bestDiff) {
      bestDiff = diff;
      best = f;
    }
  }
  return best?.closePrice ?? null;
}

function determineAccuracy(verdictAction: string, outcomePercent: number): boolean {
  switch (verdictAction) {
    case "GUCLU_AL":
    case "AL":
      return outcomePercent > 0;
    case "SAT":
    case "GUCLU_SAT":
      return outcomePercent < 0;
    case "TUT":
      return Math.abs(outcomePercent) < 3;
    default:
      return false;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
