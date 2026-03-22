/**
 * Haftalık AI Piyasa Raporu
 * Her Cuma tüm portföy + makro + sektör verilerini birleştirip AI'a yazdırır
 */

import { prisma } from "@/lib/prisma";
import { getMacroData } from "@/lib/stock/macro";
import { getSectorRotation } from "@/lib/stock/sector-rotation";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function generateWeeklyReport(): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("[weekly-report] GROQ_API_KEY is not set");
    return null;
  }

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  // Haftalık performans verileri
  const summaries = await prisma.dailySummary.findMany({
    where: { date: { gte: oneWeekAgo }, status: "COMPLETED" },
    orderBy: { date: "desc" },
  });

  // Hisse bazlı haftalık özet
  const stockMap = new Map<string, { scores: number[]; changes: number[]; lastBull: string; lastBear: string }>();
  for (const s of summaries) {
    const existing = stockMap.get(s.stockCode) ?? { scores: [], changes: [], lastBull: "", lastBear: "" };
    if (s.compositeScore != null) existing.scores.push(s.compositeScore);
    if (s.changePercent != null) existing.changes.push(s.changePercent);
    if (s.bullCase && !existing.lastBull) existing.lastBull = s.bullCase;
    if (s.bearCase && !existing.lastBear) existing.lastBear = s.bearCase;
    stockMap.set(s.stockCode, existing);
  }

  // Haftalık sinyal sayısı
  const signals = await prisma.signal.findMany({
    where: { date: { gte: oneWeekAgo } },
    select: { stockCode: true, signalType: true, signalDirection: true },
  });

  const bullSignals = signals.filter(s => s.signalDirection === "BULLISH").length;
  const bearSignals = signals.filter(s => s.signalDirection === "BEARISH").length;

  // Makro + sektör
  const macro = await getMacroData();
  const sectorRotation = await getSectorRotation();

  // Prompt oluştur
  const stockLines = Array.from(stockMap.entries()).map(([code, data]) => {
    const avgScore = data.scores.length > 0 ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length) : null;
    const totalChange = data.changes.reduce((a, b) => a + b, 0);
    const firstScore = data.scores.length > 0 ? data.scores[data.scores.length - 1] : null;
    const lastScore = data.scores.length > 0 ? data.scores[0] : null;
    const scoreTrend = firstScore != null && lastScore != null
      ? `Skor: ${firstScore}→${lastScore} (${lastScore > firstScore ? "yükseliş" : lastScore < firstScore ? "düşüş" : "stabil"})`
      : `Ort. Skor ${avgScore ?? "—"}`;
    return `${code}: Haftalık %${totalChange.toFixed(2)}, ${scoreTrend}`;
  }).join("\n");

  const sectorLines = sectorRotation
    .filter(s => s.change1W != null)
    .map(s => `${s.sectorName}: ${s.change1W! >= 0 ? "+" : ""}${s.change1W}% (${s.momentum === "INFLOW" ? "PARA GİRİŞİ" : s.momentum === "OUTFLOW" ? "PARA ÇIKIŞI" : "nötr"})`)
    .join("\n");

  const prompt = `Haftalık BİST piyasa raporu yaz. Türkçe, profesyonel.

PORTFÖY PERFORMANSI:
${stockLines}

HAFTALIK SİNYALLER: ${bullSignals} boğa, ${bearSignals} ayı

MAKRO:
USD/TRY: ₺${macro.usdTry?.toFixed(2)} | BİST100: ${macro.bist100?.toLocaleString("tr-TR")} | Makro Skor: ${macro.macroScore}/100

SEKTÖR ROTASYONU:
${sectorLines}

3 paragraf yaz:
1. Bu hafta piyasada ne oldu — genel tablo (makro + sektör rotasyonu)
2. Portföy performansı — dikkat çeken hisseler, skor değişimleri (yükselen/düşen)
3. Önümüzdeki hafta ne dikkat edilmeli — riskler ve fırsatlar

Sadece metin döndür, JSON yok. Yatırım tavsiyesi verme.`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.AI_MODEL ?? "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error(`[weekly-report] Groq API error: ${response.status} ${response.statusText}`);
      return null;
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch (error) {
    console.error("[weekly-report] Failed to generate:", error);
    return null;
  }
}
