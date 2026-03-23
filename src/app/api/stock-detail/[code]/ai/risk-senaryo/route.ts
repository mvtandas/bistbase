import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { getHistoricalBars } from "@/lib/stock/yahoo";
import { getIstanbulToday } from "@/lib/date-utils";
import { getFundamentalData } from "@/lib/stock/fundamentals";

export const maxDuration = 60;
import { getMacroData } from "@/lib/stock/macro";
import { calculateRiskMetrics } from "@/lib/stock/risk";
import { calculateSectorContext } from "@/lib/stock/sectors";
import { generateSpecializedInsightWithSchema } from "@/lib/ai/specialized";
import { buildRiskSenaryoPrompt } from "@/lib/ai/specialized-prompts";
import { RiskSenaryoSchema } from "@/lib/ai/schemas";
import { getCachedInsight, saveInsight } from "@/lib/ai/insight-cache";
import { getPromptVersion } from "@/lib/ai/prompt-registry";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = new (YahooFinance as any)({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}


export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const stockCode = code.toUpperCase();
  const insightType = "risk-senaryo";
  const todayUTC = getIstanbulToday();

  try {
    const cached = await getCachedInsight(stockCode, insightType, todayUTC);
    if (cached) {
      return NextResponse.json({ cached: true, data: cached.data });
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

    const result = await generateSpecializedInsightWithSchema(prompt.system, prompt.user, RiskSenaryoSchema, { maxTokens: 1200 });

    if (!result) {
      return NextResponse.json({ error: "AI analizi uretilemedi" }, { status: 500 });
    }

    await saveInsight(stockCode, insightType, todayUTC, result as object, "daily", { promptVersion: getPromptVersion("risk-senaryo") });

    return NextResponse.json({ cached: false, data: result });
  } catch (error) {
    console.error(`Risk senaryo error for ${stockCode}:`, error);
    return NextResponse.json({ error: "AI analizi uretilemedi" }, { status: 500 });
  }
}
