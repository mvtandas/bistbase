import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { calculateFullTechnicals, type HistoricalBar } from "../src/lib/stock/technicals";
import { detectSignals } from "../src/lib/stock/signals";
import { calculateCompositeScore } from "../src/lib/stock/scoring";
import { calculateVerdict, type VerdictInput } from "../src/lib/stock/verdict";
import { calculateExtraIndicators } from "../src/lib/stock/extra-indicators";

const barsDir = join(process.cwd(), "data", "bars");

interface Trade { code: string; entry: string; exit: string; claimed: number; pkg: string; }

const trades: Trade[] = [
  { pkg: "Basic", code: "ASELS", entry: "2025-02-19", exit: "2025-03-14", claimed: 39.74 },
  { pkg: "Basic", code: "SASA", entry: "2025-08-08", exit: "2025-09-01", claimed: 35.10 },
  { pkg: "Basic", code: "ISCTR", entry: "2025-06-26", exit: "2025-07-21", claimed: 27.40 },
  { pkg: "Basic", code: "TOASO", entry: "2025-04-17", exit: "2025-05-08", claimed: 20.87 },
  { pkg: "Pro", code: "TKFEN", entry: "2025-03-11", exit: "2025-04-02", claimed: 65.34 },
  { pkg: "Pro", code: "SKBNK", entry: "2025-06-19", exit: "2025-07-04", claimed: 42.75 },
  { pkg: "Pro", code: "SELEC", entry: "2025-05-26", exit: "2025-06-26", claimed: 34.41 },
  { pkg: "ProPlus", code: "PEKGY", entry: "2025-07-10", exit: "2025-08-21", claimed: 390.42 },
  { pkg: "ProPlus", code: "KLRHO", entry: "2025-05-15", exit: "2025-06-11", claimed: 94.82 },
];

console.log("═══ BİZİM SİSTEM AYNI TARİHLERDE NE DERDİ? ═══\n");

for (const t of trades) {
  const file = join(barsDir, t.code + ".json");
  if (!existsSync(file)) { console.log(t.code + ": veri yok\n"); continue; }
  
  const bars: HistoricalBar[] = JSON.parse(readFileSync(file, "utf-8"));
  const entryIdx = bars.findIndex(b => b.date >= t.entry);
  
  if (entryIdx < 200) { console.log(t.code + ": yetersiz geçmiş veri\n"); continue; }
  
  const window = bars.slice(0, entryIdx + 1);
  const price = bars[entryIdx].close;
  
  try {
    const tech = calculateFullTechnicals(window, price, bars[entryIdx].volume);
    const sigs = detectSignals(tech, price);
    const extra = calculateExtraIndicators(window, tech?.bbUpper, tech?.bbLower);
    const score = calculateCompositeScore(tech, price, 0, null, null);
    const verdict = calculateVerdict({
      price, technicals: tech as unknown as Record<string, unknown>,
      extraIndicators: extra as unknown as VerdictInput["extraIndicators"],
      score, fundamentalScore: null, signals: sigs, signalCombination: null,
      signalAccuracy: {}, multiTimeframe: null, macroData: null,
      riskMetrics: null, sentimentValue: 0,
    });
    
    const bullish = sigs.filter(s => s.direction === "BULLISH").length;
    const bearish = sigs.filter(s => s.direction === "BEARISH").length;
    const caught = verdict.action === "GUCLU_AL" || verdict.action === "AL";
    
    console.log(
      t.code.padEnd(7) + t.entry + " | Verdikt: " + verdict.action.padEnd(10) + 
      " Conf: " + verdict.confidence + 
      " | Sinyal: " + bullish + "↑ " + bearish + "↓" +
      " | Rakip: +" + t.claimed.toFixed(0) + "%" +
      " | " + (caught ? "✓ YAKALARDIK" : "✗ KAÇIRIRDIK")
    );
  } catch (e) {
    console.log(t.code + ": hata - " + (e as Error).message?.slice(0, 50));
  }
}
