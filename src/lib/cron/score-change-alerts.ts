/**
 * Score Change Alert Cron
 * Portföydeki hisselerde compositeScore ±15 puan değiştiğinde email gönder
 */

import { prisma } from "@/lib/prisma";
import { sendEmail, buildScoreChangeAlertHtml } from "@/lib/email";

export async function sendScoreChangeAlerts(): Promise<{ sent: number; skipped: number }> {
  let sent = 0, skipped = 0;

  // Score change alert isteyen kullanıcıları bul
  const users = await prisma.user.findMany({
    where: { alertPrefs: { scoreChangeAlerts: true } },
    select: {
      id: true,
      email: true,
      portfolios: { select: { stockCode: true } },
    },
  });

  if (users.length === 0) return { sent: 0, skipped: 0 };

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const todayDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const yesterdayDate = new Date(Date.UTC(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()));

  for (const user of users) {
    if (!user.email || user.portfolios.length === 0) { skipped++; continue; }

    const stockCodes = user.portfolios.map((p) => p.stockCode);

    // Bugün ve dünün skorlarını al
    const [todaySummaries, yesterdaySummaries] = await Promise.all([
      prisma.dailySummary.findMany({
        where: { stockCode: { in: stockCodes }, date: todayDate, timeframe: "daily", status: "COMPLETED" },
        select: { stockCode: true, compositeScore: true, verdictAction: true },
      }),
      prisma.dailySummary.findMany({
        where: { stockCode: { in: stockCodes }, date: yesterdayDate, timeframe: "daily", status: "COMPLETED" },
        select: { stockCode: true, compositeScore: true },
      }),
    ]);

    const yesterdayMap = new Map(yesterdaySummaries.map((s) => [s.stockCode, s.compositeScore]));
    const changedStocks: { stockCode: string; oldScore: number; newScore: number; verdict: string | null }[] = [];

    for (const s of todaySummaries) {
      if (s.compositeScore == null) continue;
      const oldScore = yesterdayMap.get(s.stockCode);
      if (oldScore == null) continue;

      const diff = Math.abs(s.compositeScore - oldScore);
      if (diff >= 15) {
        changedStocks.push({
          stockCode: s.stockCode,
          oldScore,
          newScore: s.compositeScore,
          verdict: s.verdictAction,
        });
      }
    }

    if (changedStocks.length === 0) { skipped++; continue; }

    const html = buildScoreChangeAlertHtml(changedStocks);
    await sendEmail({
      to: user.email,
      subject: `Bistbase — ${changedStocks.length} hissede skor değişimi`,
      html,
    });
    sent++;
  }

  return { sent, skipped };
}
