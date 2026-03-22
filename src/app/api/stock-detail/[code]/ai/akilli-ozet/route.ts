import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { getHistoricalBars } from "@/lib/stock/yahoo";
import { calculateFullTechnicals } from "@/lib/stock/technicals";
import { calculateCompositeScore } from "@/lib/stock/scoring";
import { detectSignals } from "@/lib/stock/signals";
import { getFundamentalData, scoreFundamentals } from "@/lib/stock/fundamentals";
import { getMacroData } from "@/lib/stock/macro";
import { calculateRiskMetrics } from "@/lib/stock/risk";
import { analyzeSeasonality } from "@/lib/stock/seasonality";
import { generateSpecializedInsight } from "@/lib/ai/specialized";
import { buildAkilliOzetPrompt } from "@/lib/ai/specialized-prompts";
import type { AkilliOzetOutput } from "@/lib/ai/types";
import { getCachedInsight, saveInsight } from "@/lib/ai/insight-cache";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = new (YahooFinance as any)({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

function validateAkilliOzet(parsed: Record<string, unknown>): AkilliOzetOutput | null {
  if (typeof parsed.tldr !== "string") return null;
  if (!Array.isArray(parsed.bullets)) return null;
  if (!parsed.timeHorizon || typeof parsed.timeHorizon !== "object") return null;
  if (!Array.isArray(parsed.watchlist)) return null;
  const th = parsed.timeHorizon as Record<string, unknown>;
  return {
    tldr: parsed.tldr,
    bullets: (parsed.bullets as { icon?: string; text?: string; category?: string }[]).map(b => ({
      icon: typeof b.icon === "string" ? b.icon : "🟡",
      text: typeof b.text === "string" ? b.text : "",
      category: (["technical", "fundamental", "macro", "risk"].includes(b.category as string) ? b.category : "technical") as "technical" | "fundamental" | "macro" | "risk",
    })),
    timeHorizon: {
      shortTerm: typeof th.shortTerm === "string" ? th.shortTerm : "",
      mediumTerm: typeof th.mediumTerm === "string" ? th.mediumTerm : "",
      longTerm: typeof th.longTerm === "string" ? th.longTerm : "",
    },
    watchlist: (parsed.watchlist as unknown[]).filter((w): w is string => typeof w === "string"),
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const stockCode = code.toUpperCase();
  const insightType = "akilli-ozet";
  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

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

    // Generate AI
    const prompt = buildAkilliOzetPrompt({
      stockCode, price, changePercent,
      compositeScore: score, signals, riskMetrics,
      macroData, seasonality, fundamentalScore: fundScore,
    });

    console.log(`[akilli-ozet] Generating for ${stockCode}, prompt length: system=${prompt.system.length}, user=${prompt.user.length}`);
    const result = await generateSpecializedInsight(prompt.system, prompt.user, validateAkilliOzet);

    if (!result) {
      console.error(`[akilli-ozet] AI returned null for ${stockCode}`);
      return NextResponse.json({ error: "AI analizi uretilemedi" }, { status: 500 });
    }

    // Save cache (DB + Redis)
    await saveInsight(stockCode, insightType, todayUTC, result as object);

    return NextResponse.json({ cached: false, data: result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : "";
    console.error(`Akilli ozet error for ${stockCode}: ${msg}\n${stack}`);
    return NextResponse.json({ error: "AI analizi uretilemedi", detail: msg }, { status: 500 });
  }
}
