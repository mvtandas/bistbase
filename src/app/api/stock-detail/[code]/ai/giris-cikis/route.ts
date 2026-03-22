import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { getHistoricalBars } from "@/lib/stock/yahoo";
import { getIstanbulToday } from "@/lib/date-utils";
import { calculateFullTechnicals } from "@/lib/stock/technicals";
import { calculateExtraIndicators } from "@/lib/stock/extra-indicators";
import { generateSpecializedInsightWithSchema } from "@/lib/ai/specialized";
import { buildGirisCikisPrompt } from "@/lib/ai/specialized-prompts";
import { GirisCikisSchema } from "@/lib/ai/schemas";
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
  const insightType = "giris-cikis";
  const todayUTC = getIstanbulToday();

  try {
    const cached = await getCachedInsight(stockCode, insightType, todayUTC);
    if (cached) {
      return NextResponse.json({ cached: true, data: cached.data });
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
    const extraIndicators = safe(() => calculateExtraIndicators(bars, technicals?.bbUpper, technicals?.bbLower), null);

    const prompt = buildGirisCikisPrompt({ stockCode, price, technicals, extraIndicators });
    const result = await generateSpecializedInsightWithSchema(prompt.system, prompt.user, GirisCikisSchema);

    if (!result) {
      return NextResponse.json({ error: "AI analizi uretilemedi" }, { status: 500 });
    }

    await saveInsight(stockCode, insightType, todayUTC, result as object, "daily", { promptVersion: getPromptVersion("giris-cikis") });

    return NextResponse.json({ cached: false, data: result });
  } catch (error) {
    console.error(`Giris-cikis error for ${stockCode}:`, error);
    return NextResponse.json({ error: "AI analizi uretilemedi" }, { status: 500 });
  }
}
