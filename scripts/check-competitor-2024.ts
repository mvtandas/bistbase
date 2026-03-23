import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { calculateFullTechnicals, type HistoricalBar } from "../src/lib/stock/technicals";
import { detectSignals } from "../src/lib/stock/signals";
import { calculateCompositeScore } from "../src/lib/stock/scoring";
import { calculateVerdict, type VerdictInput } from "../src/lib/stock/verdict";
import { calculateExtraIndicators } from "../src/lib/stock/extra-indicators";

const barsDir = join(process.cwd(), "data", "bars");

interface Trade { pkg: string; code: string; entry: string; exit: string; claimed: number; }

const trades: Trade[] = [
  // Basic 2024
  { pkg: "Basic", code: "BRSAN", entry: "2024-08-29", exit: "2024-09-17", claimed: 45.84 },
  { pkg: "Basic", code: "YKBNK", entry: "2024-03-18", exit: "2024-04-22", claimed: 44.77 },
  { pkg: "Basic", code: "AKBNK", entry: "2024-03-19", exit: "2024-04-25", claimed: 41.66 },
  { pkg: "Basic", code: "ASTOR", entry: "2024-10-22", exit: "2024-11-22", claimed: 35.22 },
  { pkg: "Basic", code: "KCHOL", entry: "2024-03-06", exit: "2024-04-08", claimed: 29.17 },
  { pkg: "Basic", code: "GARAN", entry: "2024-06-11", exit: "2024-07-19", claimed: 27.75 },
  // Pro Plus 2024
  { pkg: "ProPlus", code: "FONET", entry: "2024-02-05", exit: "2024-03-08", claimed: 359.57 },
  { pkg: "ProPlus", code: "YGYO", entry: "2024-04-24", exit: "2024-05-10", claimed: 100.73 },
  { pkg: "ProPlus", code: "MEGAP", entry: "2024-04-29", exit: "2024-05-13", claimed: 45.95 },
  // Gold 2024
  { pkg: "Gold", code: "IHLAS", entry: "2024-11-06", exit: "2024-12-04", claimed: 241.74 },
  { pkg: "Gold", code: "USAK", entry: "2024-07-08", exit: "2024-07-26", claimed: 130.60 },
  { pkg: "Gold", code: "ANHYT", entry: "2024-05-21", exit: "2024-06-10", claimed: 37.99 },
];

console.log("═══ RAKİP 2024 YILDIZLARI — DOĞRULAMA + BİZİM VERDİKT ═══\n");

let caught = 0, missed = 0, noData = 0;

for (const t of trades) {
  const file = join(barsDir, t.code + ".json");
  if (!existsSync(file)) {
    console.log(`${t.pkg.padEnd(9)} ${t.code.padEnd(7)} — veri yok`);
    noData++;
    continue;
  }
  
  const bars: HistoricalBar[] = JSON.parse(readFileSync(file, "utf-8"));
  const entryBar = bars.find(b => b.date >= t.entry);
  const exitBar = bars.filter(b => b.date <= t.exit).pop();
  
  if (!entryBar || !exitBar) {
    console.log(`${t.pkg.padEnd(9)} ${t.code.padEnd(7)} — tarih bulunamadı`);
    noData++;
    continue;
  }
  
  const realReturn = ((exitBar.close - entryBar.close) / entryBar.close * 100);
  const match = Math.abs(realReturn - t.claimed) < 5 ? "✓" : "✗ FARKLI";
  
  // Bizim verdikt
  const entryIdx = bars.findIndex(b => b.date >= t.entry);
  let verdict = "?";
  let conf = 0;
  let bullish = 0, bearish = 0;
  
  if (entryIdx >= 200) {
    const window = bars.slice(0, entryIdx + 1);
    const price = bars[entryIdx].close;
    try {
      const tech = calculateFullTechnicals(window, price, bars[entryIdx].volume);
      const sigs = detectSignals(tech, price);
      const extra = calculateExtraIndicators(window, tech?.bbUpper, tech?.bbLower);
      const score = calculateCompositeScore(tech, price, 0, null, null);
      const v = calculateVerdict({
        price, technicals: tech as unknown as Record<string, unknown>,
        extraIndicators: extra as unknown as VerdictInput["extraIndicators"],
        score, fundamentalScore: null, signals: sigs, signalCombination: null,
        signalAccuracy: {}, multiTimeframe: null, macroData: null,
        riskMetrics: null, sentimentValue: 0,
      });
      verdict = v.action;
      conf = v.confidence;
      bullish = sigs.filter(s => s.direction === "BULLISH").length;
      bearish = sigs.filter(s => s.direction === "BEARISH").length;
    } catch {}
  }
  
  const isCaught = verdict === "GUCLU_AL" || verdict === "AL";
  if (isCaught) caught++; else missed++;
  
  console.log(
    `${t.pkg.padEnd(9)} ${t.code.padEnd(7)} Rakip: %${t.claimed.toFixed(0).padStart(4)} | Gerçek: %${realReturn.toFixed(0).padStart(4)} ${match} | Verdikt: ${verdict.padEnd(10)} ${isCaught ? "✓ YAKALARDIK" : "✗ KAÇIRIRDIK"} | ${bullish}↑${bearish}↓ conf:${conf}`
  );
}

console.log(`\n═══ ÖZET ═══`);
console.log(`Yakaladık: ${caught}/${caught + missed} (%${(caught/(caught+missed)*100).toFixed(0)})`);
console.log(`Kaçırdık: ${missed}/${caught + missed}`);
console.log(`Veri yok: ${noData}`);
