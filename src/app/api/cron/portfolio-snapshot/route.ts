import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getIstanbulToday } from "@/lib/date-utils";

export const maxDuration = 300;

/**
 * Portfolio Snapshot Cron
 * Günlük çalışır — her kullanıcı portföyü için snapshot kaydeder
 * GET /api/cron/portfolio-snapshot?secret=...
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const todayDate = getIstanbulToday();

    // Tüm kullanıcıların portföylerini getir
    const users = await prisma.portfolio.findMany({
      select: { userId: true },
      distinct: ["userId"],
    });

    let saved = 0;
    let skipped = 0;

    for (const { userId } of users) {
      // Bugün zaten snapshot var mı?
      const existing = await prisma.portfolioSnapshot.findUnique({
        where: { userId_date_timeframe: { userId, date: todayDate, timeframe: "daily" } },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Portföy intelligence API'sini dahili çağır
      try {
        const baseUrl = process.env.NEXTAUTH_URL ?? process.env.VERCEL_URL ?? "http://localhost:3000";
        const url = `${baseUrl}/api/portfolio-intelligence?timeframe=daily`;

        // Kullanıcı adına çağrı yapamıyoruz, doğrudan DB'den hesaplıyoruz
        // Basit yaklaşım: mevcut portfolio verilerinden snapshot oluştur
        const portfolios = await prisma.portfolio.findMany({
          where: { userId },
          select: { stockCode: true, quantity: true, avgCost: true },
        });

        if (portfolios.length === 0) continue;

        // Minimal snapshot kaydet (tam analiz cron dışında çalışır)
        await prisma.portfolioSnapshot.create({
          data: {
            userId,
            date: todayDate,
            timeframe: "daily",
            // Diğer alanlar daha sonra portfolio-intelligence API'si tarafından doldurulabilir
          },
        });

        saved++;
      } catch (err) {
        console.error(`[portfolio-snapshot] User ${userId} failed:`, (err as Error)?.message);
      }
    }

    return NextResponse.json({
      success: true,
      date: todayDate.toISOString().split("T")[0],
      users: users.length,
      saved,
      skipped,
    });
  } catch (error) {
    console.error("Portfolio snapshot cron failed:", error);
    return NextResponse.json(
      { error: "Snapshot oluşturma başarısız" },
      { status: 500 }
    );
  }
}
