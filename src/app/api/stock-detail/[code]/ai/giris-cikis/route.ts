import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { getHistoricalBars } from "@/lib/stock/yahoo";
import { calculateFullTechnicals } from "@/lib/stock/technicals";
import { calculateExtraIndicators } from "@/lib/stock/extra-indicators";
import { generateSpecializedInsight } from "@/lib/ai/specialized";
import { buildGirisCikisPrompt } from "@/lib/ai/specialized-prompts";
import type { GirisCikisOutput } from "@/lib/ai/types";
import { getCachedInsight, saveInsight } from "@/lib/ai/insight-cache";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = new (YahooFinance as any)({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

function validateGirisCikis(parsed: Record<string, unknown>): GirisCikisOutput | null {
  if (!Array.isArray(parsed.entryZones)) return null;
  if (!Array.isArray(parsed.exitTargets)) return null;
  if (!parsed.stopLoss || typeof parsed.stopLoss !== "object") return null;
  const sl = parsed.stopLoss as Record<string, unknown>;
  return {
    entryZones: (parsed.entryZones as { priceRange?: string; reasoning?: string; confluence?: string[]; riskReward?: string }[]).map(e => ({
      priceRange: typeof e.priceRange === "string" ? e.priceRange : "",
      reasoning: typeof e.reasoning === "string" ? e.reasoning : "",
      confluence: Array.isArray(e.confluence) ? e.confluence.filter((c): c is string => typeof c === "string") : [],
      riskReward: typeof e.riskReward === "string" ? e.riskReward : "",
    })),
    exitTargets: (parsed.exitTargets as { price?: string; reasoning?: string; type?: string }[]).map(e => ({
      price: typeof e.price === "string" ? e.price : "",
      reasoning: typeof e.reasoning === "string" ? e.reasoning : "",
      type: (e.type === "partial" || e.type === "full" ? e.type : "full") as "partial" | "full",
    })),
    stopLoss: {
      price: typeof sl.price === "string" ? sl.price : "",
      reasoning: typeof sl.reasoning === "string" ? sl.reasoning : "",
      atrBased: typeof sl.atrBased === "string" ? sl.atrBased : "",
    },
    tradeSetupType: typeof parsed.tradeSetupType === "string" ? parsed.tradeSetupType : "",
    setupQuality: (["A", "B", "C"].includes(parsed.setupQuality as string) ? parsed.setupQuality : "C") as "A" | "B" | "C",
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const stockCode = code.toUpperCase();
  const insightType = "giris-cikis";
  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

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
    const result = await generateSpecializedInsight(prompt.system, prompt.user, validateGirisCikis);

    if (!result) {
      return NextResponse.json({ error: "AI analizi uretilemedi" }, { status: 500 });
    }

    await saveInsight(stockCode, insightType, todayUTC, result as object);

    return NextResponse.json({ cached: false, data: result });
  } catch (error) {
    console.error(`Giris-cikis error for ${stockCode}:`, error);
    return NextResponse.json({ error: "AI analizi uretilemedi" }, { status: 500 });
  }
}
