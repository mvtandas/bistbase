import { NextRequest, NextResponse } from "next/server";
import { runBackfill } from "@/lib/cron/analyze";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const rawDays = parseInt(url.searchParams.get("days") ?? "30", 10);
  const days = Number.isNaN(rawDays) ? 30 : Math.max(1, Math.min(365, rawDays));
  const skipAI = url.searchParams.get("skipAI") === "true";
  const reset = url.searchParams.get("reset") === "true";

  try {
    // Reset: mevcut COMPLETED kayıtları sil, sıfırdan hesaplansın
    if (reset) {
      const { prisma } = await import("@/lib/prisma");
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      await prisma.dailySummary.deleteMany({
        where: { timeframe: "daily", date: { gte: cutoff } },
      });
      await prisma.technicalSnapshot.deleteMany({
        where: { date: { gte: cutoff } },
      });
      await prisma.signal.deleteMany({
        where: { date: { gte: cutoff } },
      });
    }

    const result = await runBackfill(days, skipAI);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Backfill failed:", error);
    return NextResponse.json({ error: "Backfill başarısız oldu", detail: String(error) }, { status: 500 });
  }
}
