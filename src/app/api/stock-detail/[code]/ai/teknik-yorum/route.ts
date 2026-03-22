import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { getHistoricalBars } from "@/lib/stock/yahoo";
import { calculateFullTechnicals } from "@/lib/stock/technicals";
import { detectSignals } from "@/lib/stock/signals";
import { detectCandlestickPatterns } from "@/lib/stock/candlesticks";
import { detectChartPatterns } from "@/lib/stock/chart-patterns";
import { detectSignalChains } from "@/lib/stock/signal-chains";
import { analyzeSignalCombinations } from "@/lib/stock/signal-combinations";
import { analyzeMultiTimeframe } from "@/lib/stock/multi-timeframe";
import { generateSpecializedInsight } from "@/lib/ai/specialized";
import { buildTeknikYorumPrompt } from "@/lib/ai/specialized-prompts";
import type { TeknikYorumOutput } from "@/lib/ai/types";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = new (YahooFinance as any)({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

function validateTeknikYorum(parsed: Record<string, unknown>): TeknikYorumOutput | null {
  if (typeof parsed.patternNarrative !== "string") return null;
  if (typeof parsed.historicalContext !== "string") return null;
  if (typeof parsed.confluenceAnalysis !== "string") return null;
  if (!parsed.keyLevel || typeof parsed.keyLevel !== "object") return null;
  const kl = parsed.keyLevel as Record<string, unknown>;
  return {
    patternNarrative: parsed.patternNarrative,
    historicalContext: parsed.historicalContext,
    confluenceAnalysis: parsed.confluenceAnalysis,
    keyLevel: {
      price: typeof kl.price === "number" ? kl.price : 0,
      type: typeof kl.type === "string" ? kl.type : "support",
      significance: typeof kl.significance === "string" ? kl.significance : "",
    },
    patternReliability: (["HIGH", "MEDIUM", "LOW"].includes(parsed.patternReliability as string) ? parsed.patternReliability : "MEDIUM") as "HIGH" | "MEDIUM" | "LOW",
    actionableInsight: typeof parsed.actionableInsight === "string" ? parsed.actionableInsight : "",
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const stockCode = code.toUpperCase();
  const insightType = "teknik-yorum";
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
    const signalChains = await detectSignalChains(stockCode, signals).catch(() => []);
    const signalCombination = safe(() => analyzeSignalCombinations(signals), null);
    const multiTimeframe = await analyzeMultiTimeframe(stockCode, bars, technicals).catch(() => null);

    const prompt = buildTeknikYorumPrompt({
      stockCode, price, candlestickPatterns, chartPatterns,
      technicals, signalChains, signalCombination, multiTimeframe,
    });

    const result = await generateSpecializedInsight(prompt.system, prompt.user, validateTeknikYorum, { maxTokens: 1200 });

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
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`Teknik yorum error for ${stockCode}: ${msg}`);
    return NextResponse.json({ error: "AI analizi uretilemedi", detail: msg }, { status: 500 });
  }
}
