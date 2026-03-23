import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cacheGet, cacheSet } from "@/lib/redis";
import { ROUND_TRIP_COST } from "@/lib/stock/bist-constants";

// ═══ Types ═══

interface SignalTypePerformance {
  signalType: string;
  direction: string;
  totalCount: number;
  horizons: {
    "1D": HorizonDetail | null;
    "5D": HorizonDetail | null;
    "10D": HorizonDetail | null;
  };
  bestHorizon: "1D" | "5D" | "10D";
  netExpectancy: number; // komisyon sonrası beklenen getiri
  profitableAfterCosts: boolean;
  streaks: { maxWins: number; maxLosses: number };
}

interface HorizonDetail {
  winRate: number;
  avgWinPct: number;
  avgLossPct: number;
  profitFactor: number;
  grossExpectancy: number;
  netExpectancy: number; // komisyon düşülmüş
  sampleSize: number;
}

export interface SignalPerformanceResult {
  signals: SignalTypePerformance[];
  summary: {
    totalSignals: number;
    profitableSignalTypes: number;
    unprofitableSignalTypes: number;
    bestSignal: { type: string; direction: string; netExpectancy: number } | null;
    worstSignal: { type: string; direction: string; netExpectancy: number } | null;
    avgWinRate: number;
    avgProfitFactor: number;
    overallReadiness: "READY" | "NEEDS_WORK" | "NOT_READY";
    readinessReasons: string[];
  };
  dataSpanDays: number;
  generatedAt: string;
}

// ═══ Route ═══

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const days = parseInt(request.nextUrl.searchParams.get("days") ?? "180", 10);
  const scope = request.nextUrl.searchParams.get("scope") ?? "portfolio";

  // ═══ Scope: backtest raporu varsa oradan oku ═══
  if (scope !== "portfolio") {
    const cacheKey = `signal-performance:${scope}`;
    const cached = await cacheGet<SignalPerformanceResult>(cacheKey);
    if (cached) return NextResponse.json(cached);

    try {
      const report = await prisma.backtestReport.findFirst({
        where: { scope },
        orderBy: { createdAt: "desc" },
      });

      if (!report) {
        return NextResponse.json({ error: `'${scope}' scope için backtest raporu bulunamadı. Önce lokal backtest çalıştırıp import edin.` }, { status: 404 });
      }

      const sp = report.signalPerformance as Record<string, Record<string, { winRate: number; avgWin: number; avgLoss: number; profitFactor: number; grossExpectancy: number; netExpectancy: number; count: number }>>;
      const vp = report.verdictPerformance as Record<string, Record<string, { winRate: number; avgReturn: number; count: number }>>;

      // Build signal performances from report
      const signals: SignalTypePerformance[] = [];
      for (const [key, horizons] of Object.entries(sp)) {
        const [signalType, direction] = key.split("|");
        // Find best horizon by net expectancy (min 20 samples)
        let bestH: "1D" | "5D" | "10D" = "10D";
        let bestExp = -Infinity;
        for (const [h, stats] of Object.entries(horizons)) {
          if ((h === "1D" || h === "5D" || h === "10D") && stats.count >= 20 && stats.netExpectancy > bestExp) {
            bestExp = stats.netExpectancy;
            bestH = h as "1D" | "5D" | "10D";
          }
        }

        const h1D = horizons["1D"] ?? null;
        const h5D = horizons["5D"] ?? null;
        const h10D = horizons["10D"] ?? null;

        signals.push({
          signalType,
          direction,
          totalCount: Object.values(horizons).reduce((s, h) => Math.max(s, h.count), 0),
          horizons: {
            "1D": h1D ? { winRate: h1D.winRate, avgWinPct: h1D.avgWin, avgLossPct: h1D.avgLoss, profitFactor: h1D.profitFactor, grossExpectancy: h1D.grossExpectancy, netExpectancy: h1D.netExpectancy, sampleSize: h1D.count } : null,
            "5D": h5D ? { winRate: h5D.winRate, avgWinPct: h5D.avgWin, avgLossPct: h5D.avgLoss, profitFactor: h5D.profitFactor, grossExpectancy: h5D.grossExpectancy, netExpectancy: h5D.netExpectancy, sampleSize: h5D.count } : null,
            "10D": h10D ? { winRate: h10D.winRate, avgWinPct: h10D.avgWin, avgLossPct: h10D.avgLoss, profitFactor: h10D.profitFactor, grossExpectancy: h10D.grossExpectancy, netExpectancy: h10D.netExpectancy, sampleSize: h10D.count } : null,
          },
          bestHorizon: bestH,
          netExpectancy: bestExp === -Infinity ? 0 : Math.round(bestExp * 100) / 100,
          profitableAfterCosts: bestExp > 0,
          streaks: { maxWins: 0, maxLosses: 0 },
        });
      }

      signals.sort((a, b) => b.netExpectancy - a.netExpectancy);
      const profitable = signals.filter(s => s.profitableAfterCosts);

      // Ortalama profit factor hesapla (en az 20 örneklemli sinyal tiplerinden)
      const withPF = signals.filter(s => {
        const h = s.horizons[s.bestHorizon];
        return h && h.sampleSize >= 20 && h.profitFactor > 0;
      });
      const avgProfitFactor = withPF.length > 0
        ? withPF.reduce((sum, s) => sum + (s.horizons[s.bestHorizon]?.profitFactor ?? 0), 0) / withPF.length
        : 0;

      // Verdikt data for readiness
      const alVerdict = vp["AL"]?.["20D"];
      const satVerdict = vp["SAT"]?.["20D"];
      const gucluAlVerdict = vp["GUCLU_AL"]?.["20D"];

      const readinessReasons: string[] = [];
      readinessReasons.push(`${report.totalSignals.toLocaleString()} sinyal, ${report.totalStocks} hisse üzerinden test edildi`);
      if (report.avgWinRate) readinessReasons.push(`Ortalama win rate: %${report.avgWinRate.toFixed(1)}`);
      if (alVerdict) readinessReasons.push(`AL verdikt: %${alVerdict.winRate.toFixed(1)} WR (${alVerdict.count} karar)`);
      if (satVerdict) readinessReasons.push(`SAT verdikt: %${satVerdict.winRate.toFixed(1)} WR (${satVerdict.count} karar)`);
      readinessReasons.push(`${profitable.length}/${signals.length} sinyal tipi komisyon sonrası kârlı`);

      const avgWR = report.avgWinRate ?? 0;
      let readiness: "READY" | "NEEDS_WORK" | "NOT_READY" = "NOT_READY";
      if (avgWR >= 55 && profitable.length / signals.length >= 0.5) readiness = "READY";
      else if (avgWR >= 48 || profitable.length / signals.length >= 0.4) readiness = "NEEDS_WORK";

      const result: SignalPerformanceResult = {
        signals,
        summary: {
          totalSignals: report.totalSignals,
          profitableSignalTypes: profitable.length,
          unprofitableSignalTypes: signals.length - profitable.length,
          bestSignal: signals[0] ? { type: signals[0].signalType, direction: signals[0].direction, netExpectancy: signals[0].netExpectancy } : null,
          worstSignal: signals.length > 0 ? { type: signals[signals.length - 1].signalType, direction: signals[signals.length - 1].direction, netExpectancy: signals[signals.length - 1].netExpectancy } : null,
          avgWinRate: report.avgWinRate ?? 0,
          avgProfitFactor: Math.round(avgProfitFactor * 100) / 100,
          overallReadiness: readiness,
          readinessReasons,
        },
        dataSpanDays: report.periodDays ?? 1260,
        generatedAt: report.createdAt.toISOString(),
      };

      await cacheSet(cacheKey, result, 86400); // 24 saat cache
      return NextResponse.json(result);
    } catch (error) {
      console.error("Backtest report fetch failed:", error);
      return NextResponse.json({ error: "Backtest raporu okunamadı" }, { status: 500 });
    }
  }

  // ═══ Scope: portfolio (mevcut davranış) ═══
  const cacheKey = `signal-performance:portfolio:${days}`;

  const cached = await cacheGet<SignalPerformanceResult>(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const signals = await prisma.signal.findMany({
      where: {
        date: { gte: cutoff },
        signalDirection: { in: ["BULLISH", "BEARISH"] },
      },
      select: {
        signalType: true,
        signalDirection: true,
        strength: true,
        wasAccurate: true,
        outcomePercent1D: true,
        outcomePercent5D: true,
        outcomePercent10D: true,
        date: true,
      },
      orderBy: { date: "asc" },
    });

    // Group by type + direction
    const groups = new Map<string, typeof signals>();
    for (const s of signals) {
      const key = `${s.signalType}|${s.signalDirection}`;
      const g = groups.get(key) ?? [];
      g.push(s);
      groups.set(key, g);
    }

    const performances: SignalTypePerformance[] = [];

    for (const [key, group] of groups) {
      const [signalType, direction] = key.split("|");

      const h1D = calcHorizon(group, "outcomePercent1D", direction);
      const h5D = calcHorizon(group, "outcomePercent5D", direction);
      const h10D = calcHorizon(group, "outcomePercent10D", direction);

      // Best horizon by net expectancy
      const horizons = { "1D": h1D, "5D": h5D, "10D": h10D } as const;
      let bestHorizon: "1D" | "5D" | "10D" = "5D";
      let bestExp = -Infinity;
      for (const [h, data] of Object.entries(horizons) as ["1D" | "5D" | "10D", HorizonDetail | null][]) {
        if (data && data.netExpectancy > bestExp && data.sampleSize >= 3) {
          bestExp = data.netExpectancy;
          bestHorizon = h;
        }
      }

      const netExpectancy = horizons[bestHorizon]?.netExpectancy ?? 0;

      // Streaks
      const sorted = [...group].filter(s => s.wasAccurate != null).sort((a, b) => a.date.getTime() - b.date.getTime());
      let maxW = 0, maxL = 0, cW = 0, cL = 0;
      for (const s of sorted) {
        if (s.wasAccurate) { cW++; cL = 0; maxW = Math.max(maxW, cW); }
        else { cL++; cW = 0; maxL = Math.max(maxL, cL); }
      }

      performances.push({
        signalType,
        direction,
        totalCount: group.length,
        horizons: { "1D": h1D, "5D": h5D, "10D": h10D },
        bestHorizon,
        netExpectancy: round2(netExpectancy),
        profitableAfterCosts: netExpectancy > 0,
        streaks: { maxWins: maxW, maxLosses: maxL },
      });
    }

    // Sort by net expectancy descending
    performances.sort((a, b) => b.netExpectancy - a.netExpectancy);

    // Summary
    const profitable = performances.filter(p => p.profitableAfterCosts);
    const withData = performances.filter(p => {
      const h = p.horizons[p.bestHorizon];
      return h && h.sampleSize >= 5;
    });

    const avgWinRate = withData.length > 0
      ? withData.reduce((s, p) => s + (p.horizons[p.bestHorizon]?.winRate ?? 0), 0) / withData.length
      : 0;
    const avgPF = withData.length > 0
      ? withData.reduce((s, p) => s + (p.horizons[p.bestHorizon]?.profitFactor ?? 0), 0) / withData.length
      : 0;

    // ═══ Verdikt verisini de çek (readiness assessment için) ═══
    const verdictSummaries = await prisma.dailySummary.findMany({
      where: {
        date: { gte: cutoff },
        verdictAction: { not: null },
        verdictAccurate: { not: null },
        timeframe: "daily",
        status: "COMPLETED",
      },
      select: {
        verdictAction: true,
        verdictAccurate: true,
        verdictConfidence: true,
        outcomePercent20D: true,
      },
    });

    const verdictTotal = verdictSummaries.length;
    const verdictAccurate = verdictSummaries.filter(v => v.verdictAccurate === true).length;
    const verdictWinRate = verdictTotal > 0 ? (verdictAccurate / verdictTotal) * 100 : 0;

    // Verdikt bazlı profit factor (AL/SAT kararları için)
    const buyVerdicts = verdictSummaries.filter(v => v.verdictAction === "AL" || v.verdictAction === "GUCLU_AL");
    const sellVerdicts = verdictSummaries.filter(v => v.verdictAction === "SAT" || v.verdictAction === "GUCLU_SAT");
    const buyWins = buyVerdicts.filter(v => (v.outcomePercent20D ?? 0) > 0);
    const sellWins = sellVerdicts.filter(v => (v.outcomePercent20D ?? 0) < 0);
    const totalVerdictWins = buyWins.length + sellWins.length;
    const totalVerdictTrades = buyVerdicts.length + sellVerdicts.length;
    const verdictTradeWR = totalVerdictTrades > 0 ? (totalVerdictWins / totalVerdictTrades) * 100 : 0;

    // Güven kalibrasyonu
    const highConf = verdictSummaries.filter(v => (v.verdictConfidence ?? 0) >= 65);
    const highConfAccurate = highConf.filter(v => v.verdictAccurate === true);
    const highConfWR = highConf.length >= 3 ? (highConfAccurate.length / highConf.length) * 100 : 0;

    // Sinyal outcome verisi var mı kontrolü
    const signalsWithOutcome = signals.filter(s => s.outcomePercent1D != null || s.outcomePercent5D != null).length;
    const hasSignalOutcomes = signalsWithOutcome > 10;

    // Readiness assessment — hem sinyal hem verdikt verisi kullan
    const readinessReasons: string[] = [];
    let readiness: "READY" | "NEEDS_WORK" | "NOT_READY" = "NOT_READY";

    // Sinyal outcome durumu
    if (!hasSignalOutcomes) {
      readinessReasons.push(`Sinyal outcome takibi: ${signalsWithOutcome}/${signals.length} sinyal izleniyor — track-signals cron'u henüz yakalamamış`);
    } else if (avgWinRate >= 55) {
      readinessReasons.push(`Sinyal win rate %${avgWinRate.toFixed(1)} — iyi`);
    } else if (avgWinRate >= 45) {
      readinessReasons.push(`Sinyal win rate %${avgWinRate.toFixed(1)} — geliştirilmeli`);
    } else {
      readinessReasons.push(`Sinyal win rate %${avgWinRate.toFixed(1)} — düşük`);
    }

    // Verdikt performansı
    if (verdictTotal >= 20) {
      readinessReasons.push(`Verdikt isabet: %${verdictWinRate.toFixed(1)} (${verdictTotal} karar)`);
      if (verdictTradeWR > 0) {
        readinessReasons.push(`AL/SAT win rate: %${verdictTradeWR.toFixed(1)} (${totalVerdictTrades} işlem kararı)`);
      }
    } else {
      readinessReasons.push(`Verdikt verisi yetersiz: ${verdictTotal} karar (min. 20 gerekli)`);
    }

    // Güven kalibrasyonu
    if (highConf.length >= 5) {
      if (highConfWR >= 55) {
        readinessReasons.push(`Yüksek güvenli kararlar %${highConfWR.toFixed(0)} isabetli — kalibrasyon iyi`);
      } else {
        readinessReasons.push(`Yüksek güvenli kararlar %${highConfWR.toFixed(0)} isabetli — kalibrasyon zayıf`);
      }
    }

    // Karar: AL/SAT win rate oto trading için en kritik metrik (TUT dahil değil)
    // verdictTradeWR = sadece AL/GUCLU_AL/SAT/GUCLU_SAT kararlarının isabeti
    const primaryWR = verdictTradeWR; // Oto trading kararları
    const hasStrongVerdicts = totalVerdictTrades >= 20 && primaryWR >= 55;
    const hasDecentVerdicts = totalVerdictTrades >= 10 && primaryWR >= 50;
    const hasGoodCalibration = highConfWR >= 55;

    if (hasSignalOutcomes && avgWinRate >= 55 && avgPF >= 1.3 && hasStrongVerdicts) {
      readiness = "READY";
    } else if (hasStrongVerdicts && hasGoodCalibration) {
      // AL/SAT isabeti güçlü + kalibrasyon iyi → NEEDS_WORK (sinyal outcome bekliyor)
      readiness = "NEEDS_WORK";
      if (!hasSignalOutcomes) {
        readinessReasons.push("AL/SAT kararları güçlü — sinyal outcome takibi tamamlandığında tam değerlendirme yapılacak");
      }
    } else if (hasDecentVerdicts) {
      readiness = "NEEDS_WORK";
    }

    const result: SignalPerformanceResult = {
      signals: performances,
      summary: {
        totalSignals: signals.length,
        profitableSignalTypes: profitable.length,
        unprofitableSignalTypes: performances.length - profitable.length,
        bestSignal: performances[0] ? { type: performances[0].signalType, direction: performances[0].direction, netExpectancy: performances[0].netExpectancy } : null,
        worstSignal: performances.length > 0 ? { type: performances[performances.length - 1].signalType, direction: performances[performances.length - 1].direction, netExpectancy: performances[performances.length - 1].netExpectancy } : null,
        avgWinRate: round2(avgWinRate),
        avgProfitFactor: round2(avgPF),
        overallReadiness: readiness,
        readinessReasons,
      },
      dataSpanDays: days,
      generatedAt: new Date().toISOString(),
    };

    await cacheSet(cacheKey, result, 3600);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Signal performance failed:", error);
    return NextResponse.json({ error: "Signal performance hesaplanamadı" }, { status: 500 });
  }
}

// ═══ Helpers ═══

function calcHorizon(
  signals: Array<{ outcomePercent1D: number | null; outcomePercent5D: number | null; outcomePercent10D: number | null; signalDirection: string }>,
  field: "outcomePercent1D" | "outcomePercent5D" | "outcomePercent10D",
  direction: string,
): HorizonDetail | null {
  const valid = signals
    .filter(s => s[field] != null)
    .map(s => ({ outcome: s[field] as number, direction: s.signalDirection }));

  if (valid.length < 2) return null;

  const wins: number[] = [];
  const losses: number[] = [];

  for (const v of valid) {
    const isWin = v.direction === "BEARISH" ? v.outcome < 0 : v.outcome > 0;
    if (isWin) wins.push(Math.abs(v.outcome));
    else losses.push(Math.abs(v.outcome));
  }

  const winRate = (wins.length / valid.length) * 100;
  const avgWinPct = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const avgLossPct = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;

  const grossWins = wins.reduce((a, b) => a + b, 0);
  const grossLosses = losses.reduce((a, b) => a + b, 0);
  const profitFactor = grossLosses > 0 ? Math.min(grossWins / grossLosses, 99) : (grossWins > 0 ? 99 : 0);

  const grossExpectancy = (winRate / 100) * avgWinPct - ((100 - winRate) / 100) * avgLossPct;
  const netExpectancy = grossExpectancy - (ROUND_TRIP_COST * 100); // komisyon düş

  return {
    winRate: round2(winRate),
    avgWinPct: round2(avgWinPct),
    avgLossPct: round2(avgLossPct),
    profitFactor: round2(profitFactor),
    grossExpectancy: round2(grossExpectancy),
    netExpectancy: round2(netExpectancy),
    sampleSize: valid.length,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
