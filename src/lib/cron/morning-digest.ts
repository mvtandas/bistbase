/**
 * Sabah Bülteni — Her sabah 08:30'da portföy özeti e-posta
 */

import { prisma } from "@/lib/prisma";
import { sendEmail, buildMorningDigestHtml } from "@/lib/email";
import { getIstanbulYesterday } from "@/lib/date-utils";

export async function sendMorningDigests(): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  // morningDigest açık olan kullanıcıları bul
  const users = await prisma.user.findMany({
    where: {
      alertPrefs: { morningDigest: true },
    },
    include: {
      portfolios: { select: { stockCode: true } },
      alertPrefs: true,
    },
  });

  // Dünün verileri (sabah gönderiyoruz, dünkü analiz)
  const yesterdayDate = getIstanbulYesterday();

  for (const user of users) {
    if (!user.email) {
      console.warn(`[morning-digest] User ${user.id} has no email, skipping`);
      continue;
    }
    if (user.portfolios.length === 0) continue;

    const stockCodes = user.portfolios.map((p) => p.stockCode);

    // Dünkü analizleri çek
    const summaries = await prisma.dailySummary.findMany({
      where: {
        stockCode: { in: stockCodes },
        date: yesterdayDate,
        status: "COMPLETED",
      },
    });

    // Dünkü sinyalleri çek
    const signals = await prisma.signal.findMany({
      where: {
        stockCode: { in: stockCodes },
        date: yesterdayDate,
      },
      select: { stockCode: true },
    });

    const signalCounts = new Map<string, number>();
    for (const s of signals) {
      signalCounts.set(s.stockCode, (signalCounts.get(s.stockCode) ?? 0) + 1);
    }

    if (summaries.length === 0) {
      console.warn(`[morning-digest] No summaries found for user ${user.id} (${stockCodes.join(",")})`);
      continue;
    }

    const stocks = summaries.map((s) => ({
      code: s.stockCode,
      score: s.compositeScore ?? 50,
      change: s.changePercent ?? 0,
      summary: s.aiSummaryText?.substring(0, 200) ?? "",
      signals: signalCounts.get(s.stockCode) ?? 0,
    }));

    const html = buildMorningDigestHtml(stocks);
    const success = await sendEmail({
      to: user.email,
      subject: `Bistbase Sabah Bülteni — ${stocks.length} hisse özeti`,
      html,
    });

    if (success) sent++;
    else failed++;
  }

  return { sent, failed };
}
