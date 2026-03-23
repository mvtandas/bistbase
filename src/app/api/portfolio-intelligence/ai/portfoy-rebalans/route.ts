import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cacheGet } from "@/lib/redis";

export const maxDuration = 60;
import { getIstanbulToday } from "@/lib/date-utils";
import { generateSpecializedInsight } from "@/lib/ai/specialized";
import { buildPortfoyRebalansPrompt } from "@/lib/ai/portfolio-prompts";
import { getCachedPortfolioInsight, savePortfolioInsight } from "@/lib/ai/portfolio-insight-cache";
import type { PortfoyRebalansOutput } from "@/lib/ai/types";

function validatePortfoyRebalans(parsed: Record<string, unknown>): PortfoyRebalansOutput | null {
  if (typeof parsed.currentAssessment !== "string") return null;
  if (!Array.isArray(parsed.actions)) return null;
  if (typeof parsed.sectorAdvice !== "string") return null;
  if (typeof parsed.diversificationAdvice !== "string") return null;
  return {
    currentAssessment: parsed.currentAssessment,
    actions: (parsed.actions as { stockCode?: string; action?: string; reasoning?: string; targetWeight?: string }[]).map(a => ({
      stockCode: typeof a.stockCode === "string" ? a.stockCode : "",
      action: (["ARTIR", "AZALT", "TUT", "CIKAR"].includes(a.action as string) ? a.action : "TUT") as "ARTIR" | "AZALT" | "TUT" | "CIKAR",
      reasoning: typeof a.reasoning === "string" ? a.reasoning : "",
      targetWeight: typeof a.targetWeight === "string" ? a.targetWeight : "",
    })),
    sectorAdvice: parsed.sectorAdvice,
    diversificationAdvice: parsed.diversificationAdvice,
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const insightType = "portfoy-rebalans";
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

    const prompt = buildPortfoyRebalansPrompt({
      holdings: (d.holdings ?? []).map((h: Record<string, unknown>) => ({
        stockCode: h.stockCode as string,
        weight: h.weight as number,
        verdictAction: h.verdictAction as string | null,
        compositeScore: h.compositeScore as number | null,
        changePercent: h.changePercent as number | null,
        pnlPercent: h.pnlPercent as number | null,
      })),
      sectorAllocation: d.sectorAllocation ?? [],
      diversificationScore: d.healthScore?.subScores?.find((s: { label: string }) => s.label === "Cesitlendirme")?.score ?? 50,
      suggestions: d.suggestions ?? [],
    });

    const result = await generateSpecializedInsight(prompt.system, prompt.user, validatePortfoyRebalans, { maxTokens: 1200 });
    if (!result) {
      return NextResponse.json({ error: "AI analizi uretilemedi" }, { status: 500 });
    }

    await savePortfolioInsight(userId, insightType, todayUTC, result as object);
    return NextResponse.json({ cached: false, data: result });
  } catch (error) {
    console.error("Portfoy rebalans error:", error);
    return NextResponse.json({ error: "AI analizi uretilemedi" }, { status: 500 });
  }
}
