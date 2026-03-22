import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { getFundamentalData, scoreFundamentals } from "@/lib/stock/fundamentals";
import { getMacroData } from "@/lib/stock/macro";
import { calculateSectorContext } from "@/lib/stock/sectors";
import { getPeerComparison } from "@/lib/stock/peers";
import { generateSpecializedInsight } from "@/lib/ai/specialized";
import { buildSektorAnalizPrompt } from "@/lib/ai/specialized-prompts";
import type { SektorAnalizOutput } from "@/lib/ai/types";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = new (YahooFinance as any)({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

function validateSektorAnaliz(parsed: Record<string, unknown>): SektorAnalizOutput | null {
  if (typeof parsed.positionSummary !== "string") return null;
  if (typeof parsed.competitiveAdvantage !== "string") return null;
  return {
    positionSummary: parsed.positionSummary,
    competitiveAdvantage: parsed.competitiveAdvantage,
    valuationComparison: typeof parsed.valuationComparison === "string" ? parsed.valuationComparison : "",
    sectorOutlook: typeof parsed.sectorOutlook === "string" ? parsed.sectorOutlook : "",
    betterAlternative: typeof parsed.betterAlternative === "string" ? parsed.betterAlternative : null,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const stockCode = code.toUpperCase();
  const insightType = "sektor-analiz";
  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

  try {
    const existing = await prisma.aiInsight.findUnique({
      where: { stockCode_date_insightType_timeframe: { stockCode, date: todayUTC, insightType, timeframe: "daily" } },
    });
    if (existing?.status === "COMPLETED") {
      return NextResponse.json({ cached: true, data: existing.resultJson });
    }

    const [quote, fundamentalData, macroData, peerComparison] = await Promise.all([
      yf.quote(`${stockCode}.IS`).catch(() => null),
      getFundamentalData(stockCode).catch(() => null),
      getMacroData().catch(() => null),
      getPeerComparison(stockCode).catch(() => null),
    ]);

    const price = quote?.regularMarketPrice ?? null;
    const changePercent = quote?.regularMarketChangePercent ?? null;
    const sectorContext = await calculateSectorContext(stockCode, changePercent ?? 0).catch(() => null);
    const fundamentalScore = safe(() => fundamentalData ? scoreFundamentals(fundamentalData) : null, null);

    const prompt = buildSektorAnalizPrompt({
      stockCode, price, changePercent,
      sectorContext, peerComparison, fundamentals: fundamentalData,
      fundamentalScore, macroData,
    });

    const result = await generateSpecializedInsight(prompt.system, prompt.user, validateSektorAnaliz);

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
    console.error(`Sektor analiz error for ${stockCode}:`, error);
    return NextResponse.json({ error: "AI analizi uretilemedi" }, { status: 500 });
  }
}
