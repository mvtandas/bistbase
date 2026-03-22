import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cacheGet } from "@/lib/redis";
import { getIstanbulToday } from "@/lib/date-utils";
import { generateSpecializedInsight } from "@/lib/ai/specialized";
import { buildPortfoyPerformansPrompt } from "@/lib/ai/portfolio-prompts";
import { getCachedPortfolioInsight, savePortfolioInsight } from "@/lib/ai/portfolio-insight-cache";
import type { PortfoyPerformansOutput } from "@/lib/ai/types";

function validatePortfoyPerformans(parsed: Record<string, unknown>): PortfoyPerformansOutput | null {
  if (typeof parsed.performanceSummary !== "string") return null;
  if (!Array.isArray(parsed.drivers)) return null;
  if (typeof parsed.benchmarkComparison !== "string") return null;
  if (typeof parsed.outlook !== "string") return null;
  return {
    performanceSummary: parsed.performanceSummary,
    drivers: (parsed.drivers as { stockCode?: string; contribution?: string; explanation?: string }[]).map(d => ({
      stockCode: typeof d.stockCode === "string" ? d.stockCode : "",
      contribution: typeof d.contribution === "string" ? d.contribution : "",
      explanation: typeof d.explanation === "string" ? d.explanation : "",
    })),
    benchmarkComparison: parsed.benchmarkComparison,
    outlook: parsed.outlook,
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const insightType = "portfoy-performans";
  const todayUTC = getIstanbulToday();

  try {
    const cached = await getCachedPortfolioInsight(userId, insightType, todayUTC);
    if (cached) {
      return NextResponse.json({ cached: true, data: cached.data });
    }

    const portfolioData = await cacheGet<Record<string, unknown>>(`portfolio:${userId}:daily`);
    if (!portfolioData) {
      return NextResponse.json({ error: "Portfoy verisi bulunamadi. Once dashboard'u acin." }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = portfolioData as any;

    const prompt = buildPortfoyPerformansPrompt({
      holdings: (d.holdings ?? []).map((h: Record<string, unknown>) => ({
        stockCode: h.stockCode as string,
        weight: h.weight as number,
        changePercent: h.changePercent as number | null,
        pnlPercent: h.pnlPercent as number | null,
      })),
      totalReturn: d.equityCurveMeta?.totalReturn ?? null,
      bist100Return: d.equityCurveMeta?.bist100TotalReturn ?? null,
      alpha: d.equityCurveMeta?.alpha ?? null,
      benchmarkComparison: d.benchmarkComparison ?? [],
      attribution: d.attribution ?? null,
      riskContributions: d.riskContributions ?? [],
    });

    const result = await generateSpecializedInsight(prompt.system, prompt.user, validatePortfoyPerformans, { maxTokens: 1200 });
    if (!result) {
      return NextResponse.json({ error: "AI analizi uretilemedi" }, { status: 500 });
    }

    await savePortfolioInsight(userId, insightType, todayUTC, result as object);
    return NextResponse.json({ cached: false, data: result });
  } catch (error) {
    console.error("Portfoy performans error:", error);
    return NextResponse.json({ error: "AI analizi uretilemedi" }, { status: 500 });
  }
}
