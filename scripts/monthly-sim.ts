/**
 * Aylık portföy simülasyonu
 * Her ayın başında GUCLU_AL/AL verilen BIST30 hisselerinden top 5 seç, ay sonunda ölç
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { calculateFullTechnicals, type HistoricalBar } from "../src/lib/stock/technicals";
import { detectSignals } from "../src/lib/stock/signals";
import { calculateCompositeScore } from "../src/lib/stock/scoring";
import { calculateVerdict, type VerdictInput } from "../src/lib/stock/verdict";
import { calculateExtraIndicators } from "../src/lib/stock/extra-indicators";
import { BIST30 } from "../src/lib/constants";

const barsDir = join(process.cwd(), "data", "bars");
const macro = JSON.parse(readFileSync(join(process.cwd(), "data", "macro.json"), "utf-8"));
const bistBars: HistoricalBar[] = macro.bist100 || [];

const months = [
  { label: "Nis 2024", start: "2024-04-01", end: "2024-04-30" },
  { label: "May 2024", start: "2024-05-01", end: "2024-05-31" },
  { label: "Haz 2024", start: "2024-06-01", end: "2024-06-28" },
  { label: "Tem 2024", start: "2024-07-01", end: "2024-07-31" },
  { label: "Ağu 2024", start: "2024-08-01", end: "2024-08-30" },
  { label: "Eyl 2024", start: "2024-09-01", end: "2024-09-30" },
  { label: "Eki 2024", start: "2024-10-01", end: "2024-10-31" },
  { label: "Kas 2024", start: "2024-11-01", end: "2024-11-29" },
  { label: "Ara 2024", start: "2024-12-01", end: "2024-12-31" },
  { label: "Oca 2025", start: "2025-01-02", end: "2025-01-31" },
  { label: "Şub 2025", start: "2025-02-03", end: "2025-02-28" },
  { label: "Mar 2025", start: "2025-03-03", end: "2025-03-31" },
  { label: "Nis 2025", start: "2025-04-01", end: "2025-04-30" },
  { label: "May 2025", start: "2025-05-01", end: "2025-05-30" },
  { label: "Haz 2025", start: "2025-06-02", end: "2025-06-30" },
  { label: "Tem 2025", start: "2025-07-01", end: "2025-07-31" },
  { label: "Ağu 2025", start: "2025-08-01", end: "2025-08-29" },
  { label: "Eyl 2025", start: "2025-09-01", end: "2025-09-30" },
  { label: "Eki 2025", start: "2025-10-01", end: "2025-10-31" },
  { label: "Kas 2025", start: "2025-11-03", end: "2025-11-28" },
  { label: "Ara 2025", start: "2025-12-01", end: "2025-12-31" },
  { label: "Oca 2026", start: "2026-01-02", end: "2026-01-30" },
  { label: "Şub 2026", start: "2026-02-02", end: "2026-02-27" },
];

const stocks = [...new Set(BIST30)];

console.log("═══ AYLIK SİMÜLASYON: BIST30 — GÜÇLÜ AL PORTFÖY ═══");
console.log("Strateji: Her ayın başında GUCLU_AL/AL verilen hisselerden top 5 (confidence sırası)");
console.log();

let cumPortfolio = 100, cumBist = 100;
let winMonths = 0, totalMonths = 0;

for (const month of months) {
  const picks: { code: string; ret: number; action: string; confidence: number }[] = [];

  for (const code of stocks) {
    const barFile = join(barsDir, `${code}.json`);
    if (!existsSync(barFile)) continue;
    const bars: HistoricalBar[] = JSON.parse(readFileSync(barFile, "utf-8"));

    const startIdx = bars.findIndex(b => b.date >= month.start);
    if (startIdx < 200) continue;

    const window = bars.slice(0, startIdx + 1);
    const price = bars[startIdx].close;

    try {
      const tech = calculateFullTechnicals(window, price, bars[startIdx].volume);
      const sigs = detectSignals(tech, price);
      const extra = calculateExtraIndicators(window, tech?.bbUpper, tech?.bbLower);
      const score = calculateCompositeScore(tech, price, 0, null, null);
      const verdict = calculateVerdict({
        price,
        technicals: tech as unknown as Record<string, unknown>,
        extraIndicators: extra as unknown as VerdictInput["extraIndicators"],
        score,
        fundamentalScore: null,
        signals: sigs,
        signalCombination: null,
        signalAccuracy: {},
        multiTimeframe: null,
        macroData: null,
        riskMetrics: null,
        sentimentValue: 0,
      });

      if (verdict.action === "GUCLU_AL" || verdict.action === "AL") {
        const endBar = bars.filter(b => b.date <= month.end).pop();
        if (endBar) {
          const ret = ((endBar.close - price) / price) * 100;
          picks.push({ code, ret, action: verdict.action, confidence: verdict.confidence });
        }
      }
    } catch { /* skip */ }
  }

  picks.sort((a, b) => b.confidence - a.confidence);
  const top5 = picks.slice(0, 5);
  const avgRet = top5.length > 0 ? top5.reduce((s, p) => s + p.ret, 0) / top5.length : 0;

  const bs = bistBars.find(b => b.date >= month.start);
  const be = bistBars.filter(b => b.date <= month.end).pop();
  const bistRet = bs && be ? ((be.close - bs.close) / bs.close * 100) : 0;

  cumPortfolio *= (1 + avgRet / 100);
  cumBist *= (1 + bistRet / 100);
  totalMonths++;
  if (avgRet > bistRet) winMonths++;

  const alpha = avgRet - bistRet;
  const codes = top5.map(p => `${p.code}(${p.ret > 0 ? "+" : ""}${p.ret.toFixed(0)}%)`).join(", ");
  const alphaColor = alpha >= 0 ? "\x1b[32m" : "\x1b[31m";

  console.log(
    `${month.label.padEnd(10)} BIST: ${("%" + bistRet.toFixed(1)).padStart(7)} | Portföy: ${("%" + avgRet.toFixed(1)).padStart(7)} | ${alphaColor}Alpha: ${alpha >= 0 ? "+" : ""}%${alpha.toFixed(1)}\x1b[0m | ${codes}`
  );
}

console.log("─".repeat(90));
console.log();
console.log(`Kümülatif Portföy: \x1b[1m%${(cumPortfolio - 100).toFixed(1)}\x1b[0m`);
console.log(`Kümülatif BIST100: %${(cumBist - 100).toFixed(1)}`);
console.log(`Toplam Alpha: \x1b[32m\x1b[1m+%${(cumPortfolio - cumBist).toFixed(1)}\x1b[0m`);
console.log(`BIST'i yendiği ay: ${winMonths}/${totalMonths}`);
