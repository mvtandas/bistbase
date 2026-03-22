/**
 * Sinyal Zincirleri + Olgunluk
 * Ardışık sinyallerin bileşik gücü + sinyal yaşlanması
 */

import { prisma } from "@/lib/prisma";
import type { DetectedSignal } from "./signals";

export interface SignalChain {
  name: string;
  nameTr: string;
  direction: "BULLISH" | "BEARISH";
  strength: number;
  steps: string[];
  description: string;
}

// Tanımlı zincirler
const CHAIN_DEFS: {
  name: string; nameTr: string; direction: "BULLISH" | "BEARISH";
  strength: number; steps: { type: string; maxDaysAgo: number }[];
  description: string;
}[] = [
  {
    name: "BREAKOUT_CHAIN", nameTr: "Kırılım Zinciri", direction: "BULLISH", strength: 90,
    steps: [
      { type: "BOLLINGER_SQUEEZE", maxDaysAgo: 10 },
      { type: "VOLUME_ANOMALY", maxDaysAgo: 2 },
      { type: "RESISTANCE_BREAK", maxDaysAgo: 1 },
    ],
    description: "Bollinger sıkışması → hacim patlaması → direnç kırılımı. Güçlü yukarı kırılım zinciri.",
  },
  {
    name: "ACCUMULATION_CHAIN", nameTr: "Birikim Zinciri", direction: "BULLISH", strength: 85,
    steps: [
      { type: "OBV_BULLISH_DIVERGENCE", maxDaysAgo: 15 },
      { type: "CMF_ACCUMULATION", maxDaysAgo: 10 },
      { type: "RSI_OVERSOLD", maxDaysAgo: 5 },
    ],
    description: "OBV boğa diverjansı → CMF para girişi → RSI aşırı satım. Akıllı para birikimi tamamlanıyor.",
  },
  {
    name: "DISTRIBUTION_CHAIN", nameTr: "Dağıtım Zinciri", direction: "BEARISH", strength: 85,
    steps: [
      { type: "OBV_BEARISH_DIVERGENCE", maxDaysAgo: 15 },
      { type: "CMF_DISTRIBUTION", maxDaysAgo: 10 },
      { type: "RSI_OVERBOUGHT", maxDaysAgo: 5 },
    ],
    description: "OBV ayı diverjansı → CMF para çıkışı → RSI aşırı alım. Kurumsal dağıtım başlamış olabilir.",
  },
  {
    name: "TREND_REVERSAL_CHAIN", nameTr: "Trend Dönüşü Zinciri", direction: "BULLISH", strength: 88,
    steps: [
      { type: "RSI_BULLISH_DIVERGENCE", maxDaysAgo: 10 },
      { type: "MACD_BULLISH_CROSS", maxDaysAgo: 5 },
      { type: "MA_STRONG_BULLISH", maxDaysAgo: 3 },
    ],
    description: "RSI boğa diverjansı → MACD boğa kesişimi → MA güçlü hizalama. Kapsamlı trend dönüşü.",
  },
];

export async function detectSignalChains(
  stockCode: string,
  todaySignals: DetectedSignal[]
): Promise<SignalChain[]> {
  const fifteenDaysAgo = new Date();
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

  // Son 15 günün DB sinyalleri
  const recentDbSignals = await prisma.signal.findMany({
    where: { stockCode, date: { gte: fifteenDaysAgo } },
    select: { signalType: true, date: true },
  });

  // Bugünkü + geçmiş sinyalleri birleştir
  const allSignalTypes = new Map<string, number>(); // type → daysAgo
  const today = new Date();

  for (const s of recentDbSignals) {
    const daysAgo = Math.floor((today.getTime() - s.date.getTime()) / (1000 * 60 * 60 * 24));
    const existing = allSignalTypes.get(s.signalType);
    if (existing == null || daysAgo < existing) {
      allSignalTypes.set(s.signalType, daysAgo);
    }
  }

  // Bugünkü sinyaller = 0 gün
  for (const s of todaySignals) {
    allSignalTypes.set(s.type, 0);
  }

  // Zincirleri kontrol et
  const chains: SignalChain[] = [];

  for (const def of CHAIN_DEFS) {
    let allStepsFound = true;
    const foundSteps: string[] = [];

    let prevDaysAgo = Infinity; // Kronolojik sıra kontrolü: önceki adım daha eski olmalı
    for (const step of def.steps) {
      const daysAgo = allSignalTypes.get(step.type);
      if (daysAgo != null && daysAgo <= step.maxDaysAgo && daysAgo <= prevDaysAgo) {
        foundSteps.push(`${step.type} (${daysAgo}g önce)`);
        prevDaysAgo = daysAgo;
      } else {
        allStepsFound = false;
        break;
      }
    }

    if (allStepsFound) {
      chains.push({
        name: def.name,
        nameTr: def.nameTr,
        direction: def.direction,
        strength: def.strength,
        steps: foundSteps,
        description: def.description,
      });
    }
  }

  return chains;
}

// Sinyal olgunluk hesaplama
export function getSignalFreshness(daysOld: number): {
  label: "FRESH" | "RECENT" | "AGING" | "STALE";
  multiplier: number;
} {
  if (daysOld <= 1) return { label: "FRESH", multiplier: 1.0 };
  if (daysOld <= 3) return { label: "RECENT", multiplier: 0.85 };
  if (daysOld <= 7) return { label: "AGING", multiplier: 0.65 };
  return { label: "STALE", multiplier: 0.4 };
}
