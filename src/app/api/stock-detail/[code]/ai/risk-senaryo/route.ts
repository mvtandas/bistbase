import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { getHistoricalBars } from "@/lib/stock/yahoo";
import { getFundamentalData } from "@/lib/stock/fundamentals";
import { getMacroData } from "@/lib/stock/macro";
import { calculateRiskMetrics } from "@/lib/stock/risk";
import { calculateSectorContext } from "@/lib/stock/sectors";
import { generateSpecializedInsight } from "@/lib/ai/specialized";
import { buildRiskSenaryoPrompt } from "@/lib/ai/specialized-prompts";
import type { RiskSenaryoOutput } from "@/lib/ai/types";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = new (YahooFinance as any)({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

function validateRiskSenaryo(parsed: Record<string, unknown>): RiskSenaryoOutput | null {
  if (!Array.isArray(parsed.scenarios) || parsed.scenarios.length === 0) return null;
  if (typeof parsed.worstCaseNarrative !== "string") return null;
  return {
    scenarios: (parsed.scenarios as { title?: string; probability?: string; impact?: string; estimatedLoss?: string; hedgeSuggestion?: string }[]).map(s => ({
      title: typeof s.title === "string" ? s.title : "",
      probability: (["LOW", "MEDIUM", "HIGH"].includes(s.probability as string) ? s.probability : "MEDIUM") as "LOW" | "MEDIUM" | "HIGH",
      impact: typeof s.impact === "string" ? s.impact : "",
      estimatedLoss: typeof s.estimatedLoss === "string" ? s.estimatedLoss : "",
      hedgeSuggestion: typeof s.hedgeSuggestion === "string" ? s.hedgeSuggestion : "",
    })),
    worstCaseNarrative: parsed.worstCaseNarrative,
    riskAppetiteAdvice: typeof parsed.riskAppetiteAdvice === "string" ? parsed.riskAppetiteAdvice : "",
    currentRiskSummary: typeof parsed.currentRiskSummary === "string" ? parsed.currentRiskSummary : "",
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const stockCode = code.toUpperCase();
  const insightType = "risk-senaryo";
  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

  try {
    const existing = await prisma.aiInsight.findUnique({
      where: { stockCode_date_insightType_timeframe: { stockCode, date: todayUTC, insightType, timeframe: "daily" } },
    });
    if (existing?.status === "COMPLETED") {
      return NextResponse.json({ cached: true, data: existing.resultJson });
    }

    const [bars, quote, fundamentalData, macroData] = await Promise.all([
      getHistoricalBars(stockCode, 220).catch(() => []),
      yf.quote(`${stockCode}.IS`).catch(() => null),
      getFundamentalData(stockCode).catch(() => null),
      getMacroData().catch(() => null),
    ]);

    if (bars.length < 5) {
      return NextResponse.json({ error: "Yeterli veri yok" }, { status: 404 });
    }

    const price = quote?.regularMarketPrice ?? bars[bars.length - 1]?.close ?? null;
    const changePercent = quote?.regularMarketChangePercent ?? null;
    const riskMetrics = safe(() => bars.length > 10 ? calculateRiskMetrics(bars, fundamentalData?.beta ?? null) : null, null);
    const sectorContext = await calculateSectorContext(stockCode, changePercent ?? 0).catch(() => null);

    const prompt = buildRiskSenaryoPrompt({
      stockCode, price, riskMetrics, macroData, fundamentals: fundamentalData, sectorContext,
    });

    const result = await generateSpecializedInsight(prompt.system, prompt.user, validateRiskSenaryo, { maxTokens: 1200 });

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
    console.error(`Risk senaryo error for ${stockCode}:`, error);
    return NextResponse.json({ error: "AI analizi uretilemedi" }, { status: 500 });
  }
}
