/**
 * Signal Filtering & Debouncing
 * Sahte sinyalleri ve whipsaw'ları filtreler
 */

import { prisma } from "@/lib/prisma";
import type { DetectedSignal } from "./signals";

/** Aynı sinyal tipi + hisse için minimum bekleme süresi (gün) */
const SIGNAL_COOLDOWN_DAYS = 5;

/** Minimum günlük ortalama hacim (TL) — bunun altındaki hisseler sinyal üretmez */
const MIN_AVG_VOLUME_TL = 500_000;

/** Minimum sinyal gücü eşiği — düşük güçteki sinyaller filtrelenir */
const MIN_SIGNAL_STRENGTH = 40;

/**
 * BIST100 5Y backtest sonuçlarına göre zararlı sinyaller.
 * Tüm horizon'larda komisyon sonrası negatif expectancy.
 * Key: "SIGNAL_TYPE|DIRECTION"
 */
export const BLACKLISTED_SIGNALS = new Set([
  // Bearish sinyaller — BIST'te yükselen piyasa bias'ı yüzünden çalışmıyor
  "CANDLE_THREE_BLACK_CROWS|BEARISH",     // %43.7 WR, -0.66% net
  "CHART_HEAD_SHOULDERS|BEARISH",          // %46.9 WR, -0.68% net
  "DEATH_CROSS|BEARISH",                   // %49.0 WR, -0.59% net
  "CANDLE_SHOOTING_STAR|BEARISH",          // %49.2 WR, -0.58% net
  "CANDLE_HANGING_MAN|BEARISH",            // %50.8 WR, -0.58% net
  "CHART_DESCENDING_TRIANGLE|BEARISH",     // %49.1 WR, -0.56% net
  "CHART_DOUBLE_TOP|BEARISH",              // %47.8 WR, -0.56% net
  "STRONG_DOWNTREND|BEARISH",              // %48.6 WR, -0.54% net
  "CANDLE_DARK_CLOUD|BEARISH",             // %48.3 WR, -0.52% net
  "CMF_DISTRIBUTION|BEARISH",              // %49.4 WR, -0.52% net (45K sinyal, çok gürültülü)
  "MA_STRONG_BEARISH|BEARISH",             // %48.9 WR, -0.50% net
  "CANDLE_EVENING_STAR|BEARISH",           // %48.3 WR, -0.50% net
  "CANDLE_TWEEZER_TOP|BEARISH",            // %49.9 WR, -0.47% net
  "MACD_BEARISH_CROSS|BEARISH",            // %48.3 WR, -0.45% net
  "CHART_SYMMETRICAL_TRIANGLE|BEARISH",    // %50.4 WR, -0.45% net
  "CANDLE_BEARISH_ENGULFING|BEARISH",      // %48.6 WR, -0.44% net
  "CHART_BEAR_FLAG|BEARISH",               // %53.3 WR, -0.41% net (PF < 1)
  "CANDLE_BEARISH_HARAMI|BEARISH",         // %50.0 WR, -0.39% net
  "CANDLE_GRAVESTONE_DOJI|BEARISH",        // %47.2 WR, -0.27% net
  "CANDLE_BEARISH_MARUBOZU|BEARISH",       // %50.5 WR, -0.23% net
  // v2 backtest'te kalan zararlılar
  "STOCH_OVERBOUGHT|BEARISH",              // %46.6 WR, -0.76% net (20K sinyal, çok gürültülü)
  "MFI_OVERBOUGHT|BEARISH",                // %47.0 WR, -0.78% net
  "RSI_OVERBOUGHT|BEARISH",                // %47.1 WR, -0.74% net
  "RSI_BEARISH_DIVERGENCE|BEARISH",        // %45.9 WR, -0.74% net
  "OBV_BEARISH_DIVERGENCE|BEARISH",        // %47.6 WR, -0.76% net
  "CHART_RISING_WEDGE|BEARISH",            // %46.8 WR, -0.72% net
  // v4 backtest — kalan zayıf sinyaller (<50% WR, ortalamayı çekiyor)
  "CANDLE_THREE_INSIDE_DOWN|BEARISH",      // %44.3 WR, en kötü kalan sinyal
  "BB_LOWER_BREAK|BEARISH",               // %47.2 WR
  "VOLUME_ANOMALY|BULLISH",               // %47.7 WR (bullish ama zayıf — noise)
  "CANDLE_HAMMER|BULLISH",                // %49.1 WR (klasik ama BIST'te çalışmıyor)
]);

interface FilterOptions {
  stockCode: string;
  date: Date;
  avgVolumeTL: number | null; // günlük ort. hacim × fiyat
}

/**
 * Sinyalleri filtreler:
 * 1. Cooldown: Son N günde aynı sinyal ateşlenmişse atla
 * 2. Likidite: Düşük hacimli hisselerde sinyal üretme
 * 3. Strength: Minimum güç eşiği altındaki sinyaller
 */
export async function filterSignals(
  signals: DetectedSignal[],
  options: FilterOptions,
): Promise<{ filtered: DetectedSignal[]; removed: { signal: DetectedSignal; reason: string }[] }> {
  const filtered: DetectedSignal[] = [];
  const removed: { signal: DetectedSignal; reason: string }[] = [];

  // 1. Likidite filtresi (tüm sinyalleri etkiler)
  if (options.avgVolumeTL != null && options.avgVolumeTL < MIN_AVG_VOLUME_TL) {
    // Düşük likidite — sadece çok güçlü sinyalleri geçir
    for (const s of signals) {
      if (s.strength >= 75) {
        filtered.push(s);
      } else {
        removed.push({ signal: s, reason: `Düşük likidite (hacim: ₺${Math.round(options.avgVolumeTL).toLocaleString()})` });
      }
    }
    return { filtered, removed };
  }

  // 2. Son N günde aynı sinyal ateşlenmiş mi? (debouncing)
  const cooldownCutoff = new Date(options.date);
  cooldownCutoff.setDate(cooldownCutoff.getDate() - SIGNAL_COOLDOWN_DAYS);

  const recentSignals = await prisma.signal.findMany({
    where: {
      stockCode: options.stockCode,
      date: { gte: cooldownCutoff, lt: options.date },
    },
    select: {
      signalType: true,
      signalDirection: true,
      date: true,
    },
  });

  const recentSet = new Set(recentSignals.map(s => `${s.signalType}|${s.signalDirection}`));

  for (const signal of signals) {
    // 3. Blacklist kontrolü (BIST100 5Y backtest sonuçlarına göre)
    const blacklistKey = `${signal.type}|${signal.direction}`;
    if (BLACKLISTED_SIGNALS.has(blacklistKey)) {
      removed.push({ signal, reason: `Blacklist: BIST100 backtest'te zararlı sinyal` });
      continue;
    }

    // 4. Minimum strength filtresi
    if (signal.strength < MIN_SIGNAL_STRENGTH) {
      removed.push({ signal, reason: `Düşük sinyal gücü (${signal.strength} < ${MIN_SIGNAL_STRENGTH})` });
      continue;
    }

    // 4. Cooldown kontrolü — NEUTRAL sinyalleri cooldown'dan muaf
    const key = `${signal.type}|${signal.direction}`;
    if (signal.direction !== "NEUTRAL" && recentSet.has(key)) {
      // Çok güçlü sinyaller cooldown'ı bypass edebilir
      if (signal.strength >= 85) {
        filtered.push(signal);
      } else {
        removed.push({ signal, reason: `Cooldown: Son ${SIGNAL_COOLDOWN_DAYS} günde aynı sinyal ateşlendi` });
      }
      continue;
    }

    filtered.push(signal);
  }

  return { filtered, removed };
}
