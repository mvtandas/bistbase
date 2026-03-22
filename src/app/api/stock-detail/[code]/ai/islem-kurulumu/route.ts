import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { getHistoricalBars } from "@/lib/stock/yahoo";
import { calculateFullTechnicals } from "@/lib/stock/technicals";
import { detectSignals } from "@/lib/stock/signals";
import { detectCandlestickPatterns } from "@/lib/stock/candlesticks";
import { detectChartPatterns } from "@/lib/stock/chart-patterns";
import { calculateExtraIndicators } from "@/lib/stock/extra-indicators";
import { detectSignalChains } from "@/lib/stock/signal-chains";
import { analyzeMultiTimeframe } from "@/lib/stock/multi-timeframe";
import { generateSpecializedInsight } from "@/lib/ai/specialized";
import { buildIslemKurulumuPrompt } from "@/lib/ai/specialized-prompts";
import type { IslemKurulumuOutput } from "@/lib/ai/types";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = new (YahooFinance as any)({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

function validateIslemKurulumu(parsed: Record<string, unknown>): IslemKurulumuOutput | null {
  if (typeof parsed.setupDetected !== "boolean") return null;
  return {
    setupDetected: parsed.setupDetected,
    setupName: typeof parsed.setupName === "string" ? parsed.setupName : "",
    setupType: (["BREAKOUT", "REVERSAL", "TREND_CONTINUATION", "MEAN_REVERSION"].includes(parsed.setupType as string) ? parsed.setupType : "BREAKOUT") as "BREAKOUT" | "REVERSAL" | "TREND_CONTINUATION" | "MEAN_REVERSION",
    description: typeof parsed.description === "string" ? parsed.description : "",
    triggerCondition: typeof parsed.triggerCondition === "string" ? parsed.triggerCondition : "",
    invalidation: typeof parsed.invalidation === "string" ? parsed.invalidation : "",
    historicalWinRate: typeof parsed.historicalWinRate === "string" ? parsed.historicalWinRate : "",
    timeframe: typeof parsed.timeframe === "string" ? parsed.timeframe : "",
    confluenceScore: typeof parsed.confluenceScore === "number" ? Math.min(10, Math.max(0, parsed.confluenceScore)) : 0,
    status: (["ACTIVE", "PENDING", "EXPIRED"].includes(parsed.status as string) ? parsed.status : "PENDING") as "ACTIVE" | "PENDING" | "EXPIRED",
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const stockCode = code.toUpperCase();
  const insightType = "islem-kurulumu";
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
    const candlestickPatterns = safe(() => detectCandlestickPatterns(bars), []);
    const chartPatterns = safe(() => detectChartPatterns(bars), []);
    const extraIndicators = safe(() => calculateExtraIndicators(bars, technicals?.bbUpper, technicals?.bbLower), null);
    const signalChains = await detectSignalChains(stockCode, signals).catch(() => []);
    const multiTimeframe = await analyzeMultiTimeframe(stockCode, bars, technicals).catch(() => null);

    const prompt = buildIslemKurulumuPrompt({
      stockCode, price, chartPatterns, candlestickPatterns,
      signalChains, technicals, extraIndicators, multiTimeframe, signals,
    });

    const result = await generateSpecializedInsight(prompt.system, prompt.user, validateIslemKurulumu);

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
    console.error(`Islem kurulumu error for ${stockCode}:`, error);
    return NextResponse.json({ error: "AI analizi uretilemedi" }, { status: 500 });
  }
}
