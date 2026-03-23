import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cacheGet } from "@/lib/redis";

export const maxDuration = 60;
import { getIstanbulToday } from "@/lib/date-utils";
import { generateSpecializedInsight } from "@/lib/ai/specialized";
import { buildPortfoyOzetPrompt } from "@/lib/ai/portfolio-prompts";
import { getCachedPortfolioInsight, savePortfolioInsight } from "@/lib/ai/portfolio-insight-cache";
import type { PortfoyOzetOutput } from "@/lib/ai/types";

function validatePortfoyOzet(parsed: Record<string, unknown>): PortfoyOzetOutput | null {
  if (typeof parsed.tldr !== "string") return null;
  if (!Array.isArray(parsed.bullets)) return null;
  if (typeof parsed.healthAnalysis !== "string") return null;
  if (typeof parsed.topPriority !== "string") return null;
  if (!Array.isArray(parsed.watchlist)) return null;
  return {
    tldr: parsed.tldr,
    bullets: (parsed.bullets as { icon?: string; text?: string; category?: string }[]).map(b => ({
      icon: typeof b.icon === "string" ? b.icon : "🟡",
      text: typeof b.text === "string" ? b.text : "",
      category: (["allocation", "performance", "risk", "action"].includes(b.category as string)
        ? b.category
        : "performance") as "allocation" | "performance" | "risk" | "action",
    })),
    healthAnalysis: parsed.healthAnalysis,
    topPriority: parsed.topPriority,
    watchlist: (parsed.watchlist as unknown[]).filter((w): w is string => typeof w === "string"),
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const insightType = "portfoy-ozet";
  const todayUTC = getIstanbulToday();

  try {
    // Cache check
    const cached = await getCachedPortfolioInsight(userId, insightType, todayUTC);
    if (cached) {
      return NextResponse.json({ cached: true, data: cached.data });
    }

    // Get portfolio data from monolithic endpoint's Redis cache
    const portfolioData = await cacheGet<Record<string, unknown>>(`portfolio:${userId}:daily`);
    if (!portfolioData) {
      return NextResponse.json({ error: "Portfoy verisi bulunamadi. Once dashboard'u acin." }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = portfolioData as any;
    const prompt = buildPortfoyOzetPrompt({
      totalValue: d.metrics?.totalValue ?? null,
      totalPnL: d.metrics?.totalPnL ?? null,
      totalPnLPercent: d.metrics?.totalPnLPercent ?? null,
      dailyChange: d.metrics?.dailyChange ?? 0,
      holdingCount: d.holdings?.length ?? 0,
      healthGrade: d.healthScore?.grade ?? "—",
      healthScore: d.healthScore?.totalScore ?? 0,
      compositeScore: d.portfolioCompositeScore ?? 0,
      verdictAction: d.portfolioVerdict?.action ?? "TUT",
      verdictConfidence: d.portfolioVerdict?.confidence ?? 0,
      alpha: d.equityCurveMeta?.alpha ?? null,
      sharpeRatio: d.extendedRiskMetrics?.sharpeRatio ?? null,
      diversificationScore: d.correlations ? 50 : 50,
      strongestHolding: d.strongestHolding ?? null,
      weakestHolding: d.weakestHolding ?? null,
      suggestions: d.suggestions ?? [],
      topHoldings: (d.holdings ?? []).slice(0, 5).map((h: Record<string, unknown>) => ({
        stockCode: h.stockCode as string,
        weight: h.weight as number,
        verdictAction: h.verdictAction as string | null,
      })),
    });

    const result = await generateSpecializedInsight(prompt.system, prompt.user, validatePortfoyOzet);
    if (!result) {
      return NextResponse.json({ error: "AI analizi uretilemedi" }, { status: 500 });
    }

    await savePortfolioInsight(userId, insightType, todayUTC, result as object);
    return NextResponse.json({ cached: false, data: result });
  } catch (error) {
    console.error("Portfoy ozet error:", error);
    return NextResponse.json({ error: "AI analizi uretilemedi" }, { status: 500 });
  }
}
