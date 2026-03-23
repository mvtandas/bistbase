import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { calculateFullTechnicals, type HistoricalBar } from "../src/lib/stock/technicals";
import { detectSignals } from "../src/lib/stock/signals";
import { detectCandlestickPatterns } from "../src/lib/stock/candlesticks";

const barsDir = join(process.cwd(), "data", "bars");

const missed = [
  // 2024
  { code: "BRSAN", entry: "2024-08-29", claimed: 45.84, reason: "TUT — 2↑2↓ eşit" },
  { code: "YKBNK", entry: "2024-03-18", claimed: 44.77, reason: "SAT verdikti" },
  { code: "ASTOR", entry: "2024-10-22", claimed: 35.22, reason: "TUT — 1↑1↓" },
  { code: "KCHOL", entry: "2024-03-06", claimed: 29.17, reason: "TUT — 1↑1↓" },
  // 2025
  { code: "TOASO", entry: "2025-04-17", claimed: 20.87, reason: "TUT — 2↑3↓ bearish baskın" },
  { code: "SKBNK", entry: "2025-06-19", claimed: 42.75, reason: "TUT — 0↑1↓ sinyal yok" },
  { code: "SELEC", entry: "2025-05-26", claimed: 34.41, reason: "TUT — 0↑0↓ sinyal yok" },
  { code: "PEKGY", entry: "2025-07-10", claimed: 390.42, reason: "TUT — 2↑0↓ düşük conf" },
];

console.log("═══ TÜM KAÇIRILAN TRADE'LER — DERİN ANALİZ ═══\n");

for (const m of missed) {
  const file = join(barsDir, m.code + ".json");
  if (!existsSync(file)) { console.log(m.code + ": veri yok\n"); continue; }
  const bars: HistoricalBar[] = JSON.parse(readFileSync(file, "utf-8"));
  const idx = bars.findIndex(b => b.date >= m.entry);
  if (idx < 50) continue;

  const window = bars.slice(0, idx + 1);
  const price = bars[idx].close;
  const tech = calculateFullTechnicals(window, price, bars[idx].volume);
  const signals = detectSignals(tech, price);
  const candles = detectCandlestickPatterns(window);

  const prev20 = idx >= 20 ? ((price - bars[idx - 20].close) / bars[idx - 20].close * 100) : 0;
  const prev5 = idx >= 5 ? ((price - bars[idx - 5].close) / bars[idx - 5].close * 100) : 0;
  const avgVol = bars.slice(idx - 20, idx).reduce((s, b) => s + b.volume, 0) / 20;
  const volRatio = bars[idx].volume / avgVol;

  const bull = signals.filter(s => s.direction === "BULLISH");
  const bear = signals.filter(s => s.direction === "BEARISH");

  console.log(`${m.code} (${m.entry}) — Rakip: +%${m.claimed.toFixed(0)} — ${m.reason}`);
  console.log(`  Fiyat: ₺${price.toFixed(2)} | 5G: ${prev5 >= 0 ? "+" : ""}%${prev5.toFixed(1)} | 20G: ${prev20 >= 0 ? "+" : ""}%${prev20.toFixed(1)} | Hacim: ${volRatio.toFixed(1)}x`);
  console.log(`  RSI: ${tech.rsi14?.toFixed(0)} | MACD hist: ${tech.macdHistogram?.toFixed(3)} | Stoch: ${tech.stochK?.toFixed(0)} | ADX: ${tech.adx14?.toFixed(0)}`);
  console.log(`  MA: ${tech.maAlignment} | Fiyat vs MA20: ${tech.ma20 && price > tech.ma20 ? "ÜSTÜNDE" : "ALTINDA"} | vs MA50: ${tech.ma50 && price > tech.ma50 ? "ÜSTÜNDE" : "ALTINDA"}`);
  if (bull.length > 0) console.log(`  Bullish: ${bull.map(s => s.type + "(" + s.strength + ")").join(", ")}`);
  if (bear.length > 0) console.log(`  Bearish: ${bear.map(s => s.type + "(" + s.strength + ")").join(", ")}`);
  if (candles.length > 0) console.log(`  Candle: ${candles.map(c => c.name + " " + c.direction).join(", ")}`);
  
  // Ortak pattern arayalım
  const patterns: string[] = [];
  if (tech.rsi14 && tech.rsi14 < 40) patterns.push("RSI düşük (<40)");
  if (tech.rsi14 && tech.rsi14 > 50 && tech.rsi14 < 65) patterns.push("RSI nötr-pozitif (50-65)");
  if (tech.stochK && tech.stochK < 30) patterns.push("Stoch oversold");
  if (volRatio > 1.3) patterns.push("Hacim yüksek");
  if (prev20 < -10) patterns.push("Son 20G sert düşüş");
  if (prev5 > 2) patterns.push("Son 5G toparlanma");
  if (tech.macdHistogram && tech.macdHistogram > 0) patterns.push("MACD pozitif");
  if (tech.maAlignment === "MIXED") patterns.push("MA karışık");
  if (bull.length > 0 && bear.length > 0) patterns.push("Çelişkili sinyaller");
  if (bull.length === 0 && bear.length === 0) patterns.push("HİÇ SİNYAL YOK");
  
  console.log(`  Pattern: ${patterns.join(" | ")}`);
  console.log();
}

// Ortak tema
console.log("═══ ORTAK TEMALAR ═══\n");
console.log("1. Çelişkili sinyaller (1↑1↓ veya 2↑2↓) → TUT verdikti → kaçırıyoruz");
console.log("2. Sinyal yok (sessiz piyasa) → teknik analiz görmüyor → kaçırıyoruz");
console.log("3. SAT yanlış pozitif → hisse yükselirken biz SAT veriyoruz");
console.log("4. Düşük confidence → AL eşiğini geçemiyor\n");
