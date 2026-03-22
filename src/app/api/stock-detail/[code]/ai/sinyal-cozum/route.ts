import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { getHistoricalBars } from "@/lib/stock/yahoo";
import { calculateFullTechnicals } from "@/lib/stock/technicals";
import { detectSignals } from "@/lib/stock/signals";
import { analyzeSignalCombinations } from "@/lib/stock/signal-combinations";
import { analyzeMultiTimeframe } from "@/lib/stock/multi-timeframe";
import { calculateBacktest } from "@/lib/stock/backtest";
import { generateSpecializedInsight } from "@/lib/ai/specialized";
import { buildSinyalCozumPrompt } from "@/lib/ai/specialized-prompts";
import type { SinyalCozumOutput } from "@/lib/ai/types";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = new (YahooFinance as any)({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

function validateSinyalCozum(parsed: Record<string, unknown>): SinyalCozumOutput | null {
  if (typeof parsed.hasConflict !== "boolean") return null;
  if (typeof parsed.conflictSummary !== "string") return null;
  if (typeof parsed.resolution !== "string") return null;
  if (!parsed.dominantSignal || typeof parsed.dominantSignal !== "object") return null;
  const ds = parsed.dominantSignal as Record<string, unknown>;
  return {
    hasConflict: parsed.hasConflict,
    conflictSummary: parsed.conflictSummary,
    resolution: parsed.resolution,
    dominantSignal: {
      name: typeof ds.name === "string" ? ds.name : "",
      direction: (ds.direction === "BULLISH" || ds.direction === "BEARISH" ? ds.direction : "BULLISH") as "BULLISH" | "BEARISH",
      whyTrust: typeof ds.whyTrust === "string" ? ds.whyTrust : "",
    },
    ignoredSignals: Array.isArray(parsed.ignoredSignals)
      ? (parsed.ignoredSignals as { name?: string; whyIgnore?: string }[]).map(s => ({
          name: typeof s.name === "string" ? s.name : "",
          whyIgnore: typeof s.whyIgnore === "string" ? s.whyIgnore : "",
        }))
      : [],
    netConclusion: typeof parsed.netConclusion === "string" ? parsed.netConclusion : "",
    confidenceInResolution: (["HIGH", "MEDIUM", "LOW"].includes(parsed.confidenceInResolution as string) ? parsed.confidenceInResolution : "MEDIUM") as "HIGH" | "MEDIUM" | "LOW",
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const stockCode = code.toUpperCase();
  const insightType = "sinyal-cozum";
  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

  try {
    const existing = await prisma.aiInsight.findUnique({
      where: { stockCode_date_insightType_timeframe: { stockCode, date: todayUTC, insightType, timeframe: "daily" } },
    });
    if (existing?.status === "COMPLETED") {
      return NextResponse.json({ cached: true, data: existing.resultJson });
    }

    const [bars, quote] = await Promise.all([
      getHistoricalBars(stockCode, 220).catch(() => []),
      yf.quote(`${stockCode}.IS`).catch(() => null),
    ]);

    if (bars.length < 5) {
      return NextResponse.json({ error: "Yeterli veri yok" }, { status: 404 });
    }

    const price = quote?.regularMarketPrice ?? bars[bars.length - 1]?.close ?? null;
    const volume = quote?.regularMarketVolume ?? null;
    const technicals = safe(() => calculateFullTechnicals(bars, price, volume, "daily"), null);
    const signals = safe(() => technicals && price ? detectSignals(technicals, price) : [], []);
    const signalCombination = safe(() => analyzeSignalCombinations(signals), null);
    const multiTimeframe = await analyzeMultiTimeframe(stockCode, bars, technicals).catch(() => null);
    const signalBacktest = await calculateBacktest(stockCode).catch(() => null);

    // Only generate if there's actual conflict
    const hasConflict = signalCombination?.conflicting || (signalCombination && signalCombination.totalBullish > 0 && signalCombination.totalBearish > 0);
    if (!hasConflict) {
      const noConflictResult: SinyalCozumOutput = {
        hasConflict: false,
        conflictSummary: "Sinyaller arasinda belirgin catisma yok.",
        resolution: "Sinyaller genel olarak ayni yonu isaret ediyor.",
        dominantSignal: { name: "", direction: "BULLISH", whyTrust: "" },
        ignoredSignals: [],
        netConclusion: "Sinyaller uyumlu, catisma analizi gerekmiyor.",
        confidenceInResolution: "HIGH",
      };
      return NextResponse.json({ cached: false, data: noConflictResult });
    }

    const prompt = buildSinyalCozumPrompt({
      stockCode, price, signals, signalBacktest, multiTimeframe, signalCombination,
    });

    const result = await generateSpecializedInsight(prompt.system, prompt.user, validateSinyalCozum);

    if (!result) {
      return NextResponse.json({ error: "AI analizi uretilemedi" }, { status: 500 });
    }

    await prisma.aiInsight.upsert({
      where: { stockCode_date_insightType_timeframe: { stockCode, date: todayUTC, insightType, timeframe: "daily" } },
      create: { stockCode, date: todayUTC, insightType, timeframe: "daily", resultJson: result as object, status: "COMPLETED" },
      update: { resultJson: result as object, status: "COMPLETED" },
    });

    return NextResponse.json({ cached: false, data: result });
  } catch (error) {
    console.error(`Sinyal cozum error for ${stockCode}:`, error);
    return NextResponse.json({ error: "AI analizi uretilemedi" }, { status: 500 });
  }
}
