import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { getHistoricalBars } from "@/lib/stock/yahoo";
import { getIstanbulToday } from "@/lib/date-utils";
import { calculateFullTechnicals } from "@/lib/stock/technicals";
import { detectSignals } from "@/lib/stock/signals";
import { detectCandlestickPatterns } from "@/lib/stock/candlesticks";
import { detectChartPatterns } from "@/lib/stock/chart-patterns";
import { calculateExtraIndicators } from "@/lib/stock/extra-indicators";
import { detectSignalChains } from "@/lib/stock/signal-chains";
import { analyzeMultiTimeframe } from "@/lib/stock/multi-timeframe";
import { generateSpecializedInsightWithSchema } from "@/lib/ai/specialized";
import { buildIslemKurulumuPrompt } from "@/lib/ai/specialized-prompts";
import { IslemKurulumuSchema } from "@/lib/ai/schemas";
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
  const insightType = "islem-kurulumu";
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

    const result = await generateSpecializedInsightWithSchema(prompt.system, prompt.user, IslemKurulumuSchema);

    if (!result) {
      return NextResponse.json({ error: "AI analizi uretilemedi" }, { status: 500 });
    }

    await saveInsight(stockCode, insightType, todayUTC, result as object, "daily", { promptVersion: getPromptVersion("islem-kurulumu") });

    return NextResponse.json({ cached: false, data: result });
  } catch (error) {
    console.error(`Islem kurulumu error for ${stockCode}:`, error);
    return NextResponse.json({ error: "AI analizi uretilemedi" }, { status: 500 });
  }
}
