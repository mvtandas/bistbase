import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { getIstanbulToday } from "@/lib/date-utils";
import { getFundamentalData, scoreFundamentals } from "@/lib/stock/fundamentals";
import { getMacroData } from "@/lib/stock/macro";
import { calculateSectorContext } from "@/lib/stock/sectors";
import { getPeerComparison } from "@/lib/stock/peers";
import { generateSpecializedInsightWithSchema } from "@/lib/ai/specialized";
import { buildSektorAnalizPrompt } from "@/lib/ai/specialized-prompts";
import { SektorAnalizSchema } from "@/lib/ai/schemas";
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
  const insightType = "sektor-analiz";
  const todayUTC = getIstanbulToday();

  try {
    const cached = await getCachedInsight(stockCode, insightType, todayUTC);
    if (cached) {
      return NextResponse.json({ cached: true, data: cached.data });
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

    const result = await generateSpecializedInsightWithSchema(prompt.system, prompt.user, SektorAnalizSchema);

    if (!result) {
      return NextResponse.json({ error: "AI analizi uretilemedi" }, { status: 500 });
    }

    await saveInsight(stockCode, insightType, todayUTC, result as object, "daily", { promptVersion: getPromptVersion("sektor-analiz") });

    return NextResponse.json({ cached: false, data: result });
  } catch (error) {
    console.error(`Sektor analiz error for ${stockCode}:`, error);
    return NextResponse.json({ error: "AI analizi uretilemedi" }, { status: 500 });
  }
}
