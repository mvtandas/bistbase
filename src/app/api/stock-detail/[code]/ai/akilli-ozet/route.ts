import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { getHistoricalBars } from "@/lib/stock/yahoo";
import { getIstanbulToday } from "@/lib/date-utils";
import { calculateFullTechnicals } from "@/lib/stock/technicals";
import { calculateCompositeScore } from "@/lib/stock/scoring";
import { detectSignals } from "@/lib/stock/signals";
import { getFundamentalData, scoreFundamentals } from "@/lib/stock/fundamentals";
import { getMacroData } from "@/lib/stock/macro";
import { calculateRiskMetrics } from "@/lib/stock/risk";
import { analyzeSeasonality } from "@/lib/stock/seasonality";
import { getInsiderSummary } from "@/lib/stock/insider-tracking";
import { generateSpecializedInsightWithSchema } from "@/lib/ai/specialized";
import { buildAkilliOzetPrompt } from "@/lib/ai/specialized-prompts";
import { AkilliOzetSchema } from "@/lib/ai/schemas";
import { getCachedInsight, saveInsight } from "@/lib/ai/insight-cache";
import { getPromptVersion } from "@/lib/ai/prompt-registry";

export const maxDuration = 60;

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
  const insightType = "akilli-ozet";
  const todayUTC = getIstanbulToday();

  try {
    // Cache check (Redis → DB)
    const cached = await getCachedInsight(stockCode, insightType, todayUTC);
    if (cached) {
      return NextResponse.json({ cached: true, data: cached.data });
    }

    // Fetch data
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
    const volume = quote?.regularMarketVolume ?? null;
    const changePercent = quote?.regularMarketChangePercent ?? null;

    const technicals = safe(() => calculateFullTechnicals(bars, price, volume, "daily"), null);
    const signals = safe(() => technicals && price ? detectSignals(technicals, price) : [], []);
    const fundScore = safe(() => fundamentalData ? scoreFundamentals(fundamentalData) : null, null);
    const score = safe(() => technicals && price ? calculateCompositeScore(technicals, price, 0, fundScore, macroData, null, "daily") : null, null);
    const riskMetrics = safe(() => bars.length > 10 ? calculateRiskMetrics(bars, fundamentalData?.beta ?? null) : null, null);
    const seasonality = safe(() => bars.length > 12 ? analyzeSeasonality(bars) : null, null);

    // Fetch insider data
    const insiderSummary = await getInsiderSummary(stockCode).catch(() => null);

    // Generate AI
    const prompt = buildAkilliOzetPrompt({
      stockCode, price, changePercent,
      compositeScore: score, signals, riskMetrics,
      macroData, seasonality, fundamentalScore: fundScore,
    });

    // Append insider info to user prompt
    if (insiderSummary && (insiderSummary.recentBuys > 0 || insiderSummary.recentSells > 0)) {
      const dirLabel = insiderSummary.netDirection === "NET_BUY" ? "NET ALIM" : insiderSummary.netDirection === "NET_SELL" ? "NET SATIM" : "NÖTR";
      prompt.user += `\n\nİÇ SAHIP İŞLEMLERİ (Son 30 gün): ${insiderSummary.recentBuys} alım, ${insiderSummary.recentSells} satım → ${dirLabel} (sinyal gücü: ${insiderSummary.signalStrength}/10)`;
    }

    console.log(`[akilli-ozet] Generating for ${stockCode}, prompt length: system=${prompt.system.length}, user=${prompt.user.length}`);
    const result = await generateSpecializedInsightWithSchema(prompt.system, prompt.user, AkilliOzetSchema);

    if (!result) {
      console.error(`[akilli-ozet] AI returned null for ${stockCode}`);
      return NextResponse.json({ error: "AI analizi uretilemedi" }, { status: 500 });
    }

    // Save cache (DB + Redis)
    await saveInsight(stockCode, insightType, todayUTC, result as object, "daily", { promptVersion: getPromptVersion("akilli-ozet") });

    return NextResponse.json({ cached: false, data: result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : "";
    console.error(`Akilli ozet error for ${stockCode}: ${msg}\n${stack}`);
    return NextResponse.json({ error: "AI analizi uretilemedi", detail: msg }, { status: 500 });
  }
}
