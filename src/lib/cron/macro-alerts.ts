/**
 * Macro Alert Cron
 * USD/TRY %2+, VIX 25+, BIST100 %3+ hareketlerinde email gönder
 */

import { prisma } from "@/lib/prisma";
import { getMacroData } from "@/lib/stock/macro";
import { sendEmail, buildMacroAlertHtml } from "@/lib/email";

export async function sendMacroAlerts(): Promise<{ sent: number; alerts: number }> {
  const macro = await getMacroData();
  const alerts: { type: string; label: string; value: number; change: number }[] = [];

  // USD/TRY %2+ hareket
  if (macro.usdTryChange != null && Math.abs(macro.usdTryChange) >= 2) {
    alerts.push({
      type: "USD_TRY",
      label: "USD/TRY",
      value: macro.usdTry ?? 0,
      change: macro.usdTryChange,
    });
  }

  // VIX 25+ seviyesi
  if (macro.vix != null && macro.vix >= 25) {
    alerts.push({
      type: "VIX_HIGH",
      label: `VIX (Korku Endeksi)`,
      value: macro.vix,
      change: macro.vixChange ?? 0,
    });
  }

  // BIST100 %3+ hareket
  if (macro.bist100Change != null && Math.abs(macro.bist100Change) >= 3) {
    alerts.push({
      type: "BIST100",
      label: "BİST-100",
      value: macro.bist100 ?? 0,
      change: macro.bist100Change,
    });
  }

  if (alerts.length === 0) return { sent: 0, alerts: 0 };

  // Macro alert isteyen kullanıcıları bul
  const users = await prisma.user.findMany({
    where: { alertPrefs: { macroAlerts: true } },
    select: { email: true },
  });

  const html = buildMacroAlertHtml(alerts);
  let sent = 0;

  for (const user of users) {
    if (!user.email) continue;
    await sendEmail({
      to: user.email,
      subject: `Bistbase — Makro alarm: ${alerts.map((a) => a.label).join(", ")}`,
      html,
    });
    sent++;
  }

  return { sent, alerts: alerts.length };
}
