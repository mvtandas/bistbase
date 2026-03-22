/**
 * E-posta gönderim servisi — Resend API
 */

import { Resend } from "resend";

const resend = new Resend(process.env.EMAIL_SERVER_PASSWORD);
const FROM = process.env.EMAIL_FROM ?? "onboarding@resend.dev";

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
    return true;
  } catch (error) {
    console.error("Email send error:", error);
    return false;
  }
}

// Şablon: Sabah Bülteni
export function buildMorningDigestHtml(stocks: {
  code: string;
  score: number;
  change: number;
  summary: string;
  signals: number;
}[]): string {
  const rows = stocks.map((s) => {
    const changeColor = s.change >= 0 ? "#34d399" : "#fb7185";
    const scoreColor = s.score >= 58 ? "#34d399" : s.score >= 42 ? "#fbbf24" : "#fb7185";
    return `
      <tr style="border-bottom:1px solid #1e293b">
        <td style="padding:12px 8px;font-weight:700;color:#f8fafc">${s.code}</td>
        <td style="padding:12px 8px;color:${changeColor};font-weight:600">${s.change >= 0 ? "+" : ""}${s.change.toFixed(2)}%</td>
        <td style="padding:12px 8px"><span style="background:${scoreColor}20;color:${scoreColor};padding:2px 8px;border-radius:4px;font-weight:700;font-size:12px">${s.score}</span></td>
        <td style="padding:12px 8px;color:#94a3b8;font-size:12px">${s.signals > 0 ? `${s.signals} sinyal` : "—"}</td>
      </tr>`;
  }).join("");

  return `
    <div style="font-family:system-ui,sans-serif;max-width:500px;margin:0 auto;background:#0a0a0f;color:#f8fafc;padding:24px;border-radius:12px">
      <h2 style="margin:0 0 4px;font-size:18px;color:#818cf8">bistbase</h2>
      <p style="margin:0 0 20px;color:#64748b;font-size:13px">Sabah Bülteni — ${new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" })}</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="border-bottom:1px solid #334155">
          <th style="text-align:left;padding:8px;color:#64748b;font-size:11px">HİSSE</th>
          <th style="text-align:left;padding:8px;color:#64748b;font-size:11px">DEĞİŞİM</th>
          <th style="text-align:left;padding:8px;color:#64748b;font-size:11px">SKOR</th>
          <th style="text-align:left;padding:8px;color:#64748b;font-size:11px">SİNYAL</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${stocks.length > 0 ? `<div style="margin-top:16px;padding:12px;background:#1a1a2e;border-radius:8px;font-size:12px;color:#94a3b8">${stocks[0].summary}</div>` : ""}
      <p style="margin-top:20px;font-size:10px;color:#475569">Bu analiz yatırım danışmanlığı kapsamında değildir (YTD).</p>
    </div>`;
}

// Şablon: Sinyal Alarmı
export function buildSignalAlertHtml(stockCode: string, signals: {
  type: string;
  direction: string;
  strength: number;
  description: string;
}[]): string {
  const signalRows = signals.map((s) => {
    const color = s.direction === "BULLISH" ? "#34d399" : "#fb7185";
    return `<div style="padding:8px 12px;margin:4px 0;background:#1a1a2e;border-radius:6px;border-left:3px solid ${color}">
      <span style="color:${color};font-weight:600;font-size:11px">${s.direction === "BULLISH" ? "BOĞA" : "AYI"} | Güç: ${s.strength}</span>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:12px">${s.description}</p>
    </div>`;
  }).join("");

  return `
    <div style="font-family:system-ui,sans-serif;max-width:500px;margin:0 auto;background:#0a0a0f;color:#f8fafc;padding:24px;border-radius:12px">
      <h2 style="margin:0 0 4px;font-size:18px;color:#818cf8">bistbase</h2>
      <p style="margin:0 0 16px;color:#64748b;font-size:13px">Sinyal Alarmı — ${stockCode}</p>
      <p style="margin:0 0 12px;color:#f8fafc;font-size:14px"><strong>${stockCode}</strong> hissesinde <strong>${signals.length}</strong> yeni sinyal tespit edildi:</p>
      ${signalRows}
      <p style="margin-top:16px;font-size:10px;color:#475569">Bu analiz yatırım danışmanlığı kapsamında değildir (YTD).</p>
    </div>`;
}
