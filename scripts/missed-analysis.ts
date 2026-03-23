import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { calculateFullTechnicals, type HistoricalBar } from "../src/lib/stock/technicals";
import { detectSignals } from "../src/lib/stock/signals";
import { detectCandlestickPatterns } from "../src/lib/stock/candlesticks";
import { detectChartPatterns } from "../src/lib/stock/chart-patterns";

const barsDir = join(process.cwd(), "data", "bars");

const missed = [
  { code: "SASA",  entry: "2025-08-08", claimed: 35.10, reason: "2 bearish sinyal" },
  { code: "TOASO", entry: "2025-04-17", claimed: 20.87, reason: "3 bearish > 2 bullish" },
  { code: "SKBNK", entry: "2025-06-19", claimed: 42.75, reason: "sinyal yok" },
  { code: "SELEC", entry: "2025-05-26", claimed: 34.41, reason: "sinyal yok" },
  { code: "PEKGY", entry: "2025-07-10", claimed: 390.42, reason: "düşük confidence" },
];

console.log("═══ KAÇIRILAN TRADE'LER — NEDEN KAÇIRDIK? ═══\n");

for (const m of missed) {
  const file = join(barsDir, m.code + ".json");
  if (!existsSync(file)) continue;
  const bars: HistoricalBar[] = JSON.parse(readFileSync(file, "utf-8"));
  const idx = bars.findIndex(b => b.date >= m.entry);
  if (idx < 50) continue;

  const window = bars.slice(0, idx + 1);
  const price = bars[idx].close;
  const tech = calculateFullTechnicals(window, price, bars[idx].volume);
  const signals = detectSignals(tech, price);
  const candles = detectCandlestickPatterns(window);
  const charts = detectChartPatterns(window);

  // Giriş öncesi 20 gün performans
  const prev20 = idx >= 20 ? ((price - bars[idx - 20].close) / bars[idx - 20].close * 100) : 0;
  // Hacim anomalisi
  const avgVol20 = bars.slice(idx - 20, idx).reduce((s, b) => s + b.volume, 0) / 20;
  const volRatio = bars[idx].volume / avgVol20;
  
  // RSI, MACD, MA durumu
  console.log(`${m.code} (${m.entry}) — Rakip: +%${m.claimed.toFixed(0)}`);
  console.log(`  Fiyat: ₺${price.toFixed(2)} | Son 20g: ${prev20 >= 0 ? "+" : ""}%${prev20.toFixed(1)} | Hacim ratio: ${volRatio.toFixed(1)}x`);
  console.log(`  RSI: ${tech.rsi14?.toFixed(0) ?? "?"} | MACD: ${tech.macdHistogram?.toFixed(3) ?? "?"} | MA align: ${tech.maAlignment}`);
  console.log(`  ADX: ${tech.adx14?.toFixed(0) ?? "?"} | BB%B: ${tech.bbPercentB?.toFixed(2) ?? "?"} | Stoch: ${tech.stochK?.toFixed(0) ?? "?"}`);
  console.log(`  Fiyat vs MA20: ${tech.ma20 ? (price > tech.ma20 ? "ÜSTÜNDE" : "ALTINDA") : "?"} | vs MA50: ${tech.ma50 ? (price > tech.ma50 ? "ÜSTÜNDE" : "ALTINDA") : "?"}`);
  
  const bull = signals.filter(s => s.direction === "BULLISH");
  const bear = signals.filter(s => s.direction === "BEARISH");
  console.log(`  Sinyaller: ${bull.length}↑ ${bear.length}↓`);
  if (bull.length > 0) console.log(`    Bullish: ${bull.map(s => s.type + "(" + s.strength + ")").join(", ")}`);
  if (bear.length > 0) console.log(`    Bearish: ${bear.map(s => s.type + "(" + s.strength + ")").join(", ")}`);
  if (candles.length > 0) console.log(`    Candle: ${candles.map(c => c.name + " " + c.direction).join(", ")}`);
  if (charts.length > 0) console.log(`    Chart: ${charts.map(c => c.name + " " + c.direction).join(", ")}`);
  
  // Birkaç gün sonra ne oldu?
  const after5 = idx + 5 < bars.length ? ((bars[idx + 5].close - price) / price * 100).toFixed(1) : "?";
  const after10 = idx + 10 < bars.length ? ((bars[idx + 10].close - price) / price * 100).toFixed(1) : "?";
  console.log(`  Sonrası: 5G: ${after5}% | 10G: ${after10}%`);
  console.log();
}
