import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cacheGet } from "@/lib/redis";
import { getIstanbulToday } from "@/lib/date-utils";
import { generateSpecializedInsight } from "@/lib/ai/specialized";
import { buildPortfoyRiskPrompt } from "@/lib/ai/portfolio-prompts";
import { getCachedPortfolioInsight, savePortfolioInsight } from "@/lib/ai/portfolio-insight-cache";
import type { PortfoyRiskOutput } from "@/lib/ai/types";

function validatePortfoyRisk(parsed: Record<string, unknown>): PortfoyRiskOutput | null {
  if (typeof parsed.riskSummary !== "string") return null;
  if (!Array.isArray(parsed.scenarios) || parsed.scenarios.length === 0) return null;
  if (typeof parsed.drawdownAnalysis !== "string") return null;
  return {
    riskSummary: parsed.riskSummary,
    scenarios: (parsed.scenarios as { title?: string; probability?: string; impact?: string; estimatedLoss?: string; hedgeSuggestion?: string }[]).map(s => ({
      title: typeof s.title === "string" ? s.title : "",
      probability: (["LOW", "MEDIUM", "HIGH"].includes(s.probability as string) ? s.probability : "MEDIUM") as "LOW" | "MEDIUM" | "HIGH",
      impact: typeof s.impact === "string" ? s.impact : "",
      estimatedLoss: typeof s.estimatedLoss === "string" ? s.estimatedLoss : "",
      hedgeSuggestion: typeof s.hedgeSuggestion === "string" ? s.hedgeSuggestion : "",
    })),
    drawdownAnalysis: parsed.drawdownAnalysis,
    correlationWarning: typeof parsed.correlationWarning === "string" ? parsed.correlationWarning : "",
    riskAppetiteAdvice: typeof parsed.riskAppetiteAdvice === "string" ? parsed.riskAppetiteAdvice : "",
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const insightType = "portfoy-risk";
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
    const stressScenarios = d.stressTest?.scenarios
      ? (d.stressTest.scenarios as { scenario: string; portfolioImpact: number }[]).map(s => ({
          scenario: s.scenario,
          impact: s.portfolioImpact,
        }))
      : [];

    const correlationWarnings: string[] = [];
    if (d.correlations) {
      for (const c of d.correlations as { pair: string; correlation: number }[]) {
        if (c.correlation > 0.8) {
          correlationWarnings.push(`${c.pair}: ${c.correlation.toFixed(2)}`);
        }
      }
    }

    const prompt = buildPortfoyRiskPrompt({
      holdingCount: d.holdings?.length ?? 0,
      totalValue: d.metrics?.totalValue ?? null,
      portfolioBeta: d.metrics?.portfolioBeta ?? 1,
      diversificationScore: d.healthScore?.subScores?.find((s: { label: string }) => s.label === "Cesitlendirme")?.score ?? 50,
      sharpeRatio: d.extendedRiskMetrics?.sharpeRatio ?? null,
      sortinoRatio: d.extendedRiskMetrics?.sortinoRatio ?? null,
      volatility: d.extendedRiskMetrics?.volatility ?? null,
      maxDrawdown: d.drawdown?.maxDrawdown ?? null,
      currentDrawdown: d.drawdown?.currentDrawdown ?? null,
      var95: null,
      correlationWarnings,
      concentrationWarning: null,
      monteCarloWorstCase: d.monteCarlo?.projections?.p5 ?? null,
      stressScenarios,
    });

    const result = await generateSpecializedInsight(prompt.system, prompt.user, validatePortfoyRisk, { maxTokens: 1200 });
    if (!result) {
      return NextResponse.json({ error: "AI analizi uretilemedi" }, { status: 500 });
    }

    await savePortfolioInsight(userId, insightType, todayUTC, result as object);
    return NextResponse.json({ cached: false, data: result });
  } catch (error) {
    console.error("Portfoy risk error:", error);
    return NextResponse.json({ error: "AI analizi uretilemedi" }, { status: 500 });
  }
}
