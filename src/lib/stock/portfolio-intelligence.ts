/**
 * Bistbase Portfolio Intelligence Engine
 * Portföy seviyesinde zeka — bireysel verdict'lerin ağırlıklı sentezi
 */

import { STOCK_SECTOR_MAP, SECTOR_INDICES } from "./sectors";

// ═══ Types ═══

export type VerdictAction = "GUCLU_AL" | "AL" | "TUT" | "SAT" | "GUCLU_SAT";

const ACTION_LABELS: Record<VerdictAction, string> = {
  GUCLU_AL: "Güçlü Al", AL: "Al", TUT: "Tut", SAT: "Sat", GUCLU_SAT: "Güçlü Sat",
};

export interface HoldingInput {
  stockCode: string;
  quantity: number | null;
  avgCost: number | null;
  price: number | null;
  changePercent: number | null;
  compositeScore: number | null;
  verdictAction: VerdictAction | null;
  verdictScore: number | null; // -1 to +1
  verdictConfidence: number | null; // 0-100
  beta: number | null;
}

export interface EnrichedHolding {
  stockCode: string;
  price: number | null;
  changePercent: number | null;
  compositeScore: number | null;
  verdictAction: VerdictAction | null;
  verdictActionLabel: string | null;
  verdictScore: number | null;
  weight: number;
  value: number | null;
  cost: number | null;
  pnl: number | null;
  pnlPercent: number | null;
  quantity: number | null;
  sectorCode: string | null;
}

export interface RebalanceSuggestion {
  type: "SECTOR_CONCENTRATION" | "SINGLE_STOCK" | "SELL_VERDICT" | "HIGH_CORRELATION" | "LOW_DIVERSIFICATION";
  severity: "HIGH" | "MEDIUM" | "LOW";
  message: string;
}

export interface PortfolioIntelligence {
  portfolioVerdict: {
    action: VerdictAction;
    actionLabel: string;
    score: number;
    confidence: number;
    confidenceLabel: string;
  };
  portfolioCompositeScore: number;

  holdings: EnrichedHolding[];

  metrics: {
    totalValue: number | null;
    totalCost: number | null;
    totalPnL: number | null;
    totalPnLPercent: number | null;
    dailyChange: number;
    portfolioBeta: number | null;
  };

  allocation: { stockCode: string; weight: number; value: number | null }[];
  sectorAllocation: { sector: string; sectorName: string; weight: number; stocks: string[] }[];

  suggestions: RebalanceSuggestion[];

  strongestHolding: { code: string; reason: string } | null;
  weakestHolding: { code: string; reason: string } | null;

  hasPositionData: boolean;
}

// ═══ Weight Calculation ═══

function calculateWeights(holdings: HoldingInput[]): Map<string, number> {
  const withValue = holdings.filter(h => h.quantity != null && h.quantity > 0 && h.price != null && h.price > 0);

  if (withValue.length > 0) {
    // Value-weighted
    const totalValue = withValue.reduce((sum, h) => sum + h.quantity! * h.price!, 0);
    const weights = new Map<string, number>();
    const remainingCount = holdings.length - withValue.length;
    const remainingWeight = remainingCount > 0 ? 0.05 * remainingCount : 0; // %5 each for unweighted

    for (const h of holdings) {
      if (h.quantity != null && h.quantity > 0 && h.price != null) {
        weights.set(h.stockCode, ((h.quantity * h.price) / totalValue) * (1 - remainingWeight));
      } else {
        weights.set(h.stockCode, remainingWeight / Math.max(1, remainingCount));
      }
    }
    return weights;
  }

  // Equal weight
  const w = 1 / holdings.length;
  return new Map(holdings.map(h => [h.stockCode, w]));
}

// ═══ Verdict Aggregation ═══

function scoreToAction(score: number): VerdictAction {
  if (score >= 0.50) return "GUCLU_AL";
  if (score >= 0.15) return "AL";
  if (score > -0.15) return "TUT";
  if (score > -0.50) return "SAT";
  return "GUCLU_SAT";
}

function calculatePortfolioVerdict(
  holdings: HoldingInput[],
  weights: Map<string, number>,
  diversificationScore: number,
): PortfolioIntelligence["portfolioVerdict"] {
  const withVerdict = holdings.filter(h => h.verdictScore != null);
  if (withVerdict.length === 0) {
    return { action: "TUT", actionLabel: "Tut", score: 0, confidence: 30, confidenceLabel: "Düşük" };
  }

  // Weighted average verdict score
  let weightedScore = 0;
  let weightSum = 0;
  for (const h of withVerdict) {
    const w = weights.get(h.stockCode) ?? 0;
    weightedScore += h.verdictScore! * w;
    weightSum += w;
  }
  const score = weightSum > 0 ? weightedScore / weightSum : 0;
  const action = scoreToAction(score);

  // Confidence
  let confidence = 50;

  // Inter-stock agreement
  const signs = withVerdict.map(h => Math.sign(h.verdictScore!));
  const uniqueSigns = new Set(signs.filter(s => s !== 0));
  if (uniqueSigns.size === 1 && signs.filter(s => s !== 0).length >= 2) {
    confidence += 20; // All agree
  } else if (uniqueSigns.size > 1) {
    confidence -= 15; // Mixed
  }

  // Average individual confidence
  const avgConf = withVerdict.reduce((sum, h) => sum + (h.verdictConfidence ?? 50), 0) / withVerdict.length;
  if (avgConf >= 65) confidence += 10;
  else if (avgConf < 40) confidence -= 10;

  // Diversification bonus
  if (diversificationScore >= 70) confidence += 5;
  else if (diversificationScore < 30) confidence -= 5;

  // Verdict strength
  if (Math.abs(score) > 0.4) confidence += 5;
  else if (Math.abs(score) < 0.1) confidence -= 8;

  confidence = Math.max(5, Math.min(95, confidence));
  const confidenceLabel = confidence >= 70 ? "Yüksek" : confidence >= 45 ? "Orta" : "Düşük";

  return { action, actionLabel: ACTION_LABELS[action], score: Math.round(score * 100) / 100, confidence, confidenceLabel };
}

// ═══ Rebalancing Suggestions ═══

function generateSuggestions(
  holdings: EnrichedHolding[],
  sectorAllocation: PortfolioIntelligence["sectorAllocation"],
  correlations?: { pair: [string, string]; correlation: number }[],
): RebalanceSuggestion[] {
  const suggestions: RebalanceSuggestion[] = [];

  // Sector concentration
  for (const sa of sectorAllocation) {
    if (sa.weight >= 50) {
      suggestions.push({
        type: "SECTOR_CONCENTRATION",
        severity: "HIGH",
        message: `${sa.sectorName} sektörü portföyün %${Math.round(sa.weight)}'ini oluşturuyor — yoğunlaşma riski yüksek, farklı sektörlerden hisse ekleyin.`,
      });
    } else if (sa.weight >= 35) {
      suggestions.push({
        type: "SECTOR_CONCENTRATION",
        severity: "LOW",
        message: `${sa.sectorName} sektörü portföyün %${Math.round(sa.weight)}'inde — dikkatli olun.`,
      });
    }
  }

  // Single stock dominance
  for (const h of holdings) {
    if (h.weight > 40) {
      suggestions.push({
        type: "SINGLE_STOCK",
        severity: "HIGH",
        message: `${h.stockCode} portföyün %${Math.round(h.weight)}'ini oluşturuyor — riski dağıtmayı düşünün.`,
      });
    }
  }

  // Sell verdict at high weight
  for (const h of holdings) {
    if ((h.verdictAction === "SAT" || h.verdictAction === "GUCLU_SAT") && h.weight > 15) {
      suggestions.push({
        type: "SELL_VERDICT",
        severity: "HIGH",
        message: `${h.stockCode} "${h.verdictActionLabel}" gösteriyor ama portföyün %${Math.round(h.weight)}'i — değerlendirin.`,
      });
    }
  }

  // High correlation pairs
  if (correlations) {
    for (const c of correlations) {
      if (Math.abs(c.correlation) > 0.8) {
        const w1 = holdings.find(h => h.stockCode === c.pair[0])?.weight ?? 0;
        const w2 = holdings.find(h => h.stockCode === c.pair[1])?.weight ?? 0;
        if (w1 > 10 && w2 > 10) {
          suggestions.push({
            type: "HIGH_CORRELATION",
            severity: "MEDIUM",
            message: `${c.pair[0]} ve ${c.pair[1]} birlikte hareket ediyor (korelasyon: ${c.correlation}) — çeşitlendirme etkisi düşük.`,
          });
        }
      }
    }
  }

  // Low diversification
  if (holdings.length < 3) {
    suggestions.push({
      type: "LOW_DIVERSIFICATION",
      severity: "MEDIUM",
      message: `Portföyde sadece ${holdings.length} hisse var — en az 3-5 farklı sektörden hisse önerilir.`,
    });
  }

  return suggestions.sort((a, b) => {
    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return order[a.severity] - order[b.severity];
  });
}

// ═══ Main Engine ═══

export function analyzePortfolioIntelligence(
  inputs: HoldingInput[],
  correlations?: { pair: [string, string]; correlation: number }[],
  diversificationScore = 50,
): PortfolioIntelligence {
  if (inputs.length === 0) {
    return {
      portfolioVerdict: { action: "TUT", actionLabel: "Tut", score: 0, confidence: 0, confidenceLabel: "Düşük" },
      portfolioCompositeScore: 0,
      holdings: [],
      metrics: { totalValue: null, totalCost: null, totalPnL: null, totalPnLPercent: null, dailyChange: 0, portfolioBeta: null },
      allocation: [],
      sectorAllocation: [],
      suggestions: [],
      strongestHolding: null,
      weakestHolding: null,
      hasPositionData: false,
    };
  }

  const weights = calculateWeights(inputs);
  const hasPositionData = inputs.some(h => h.quantity != null && h.quantity > 0);

  // Enrich holdings
  const holdings: EnrichedHolding[] = inputs.map(h => {
    const w = weights.get(h.stockCode) ?? 0;
    const value = h.quantity != null && h.price != null ? h.quantity * h.price : null;
    const cost = h.quantity != null && h.avgCost != null ? h.quantity * h.avgCost : null;
    const pnl = value != null && cost != null ? value - cost : null;
    const pnlPercent = cost != null && cost > 0 && pnl != null ? (pnl / cost) * 100 : null;

    return {
      stockCode: h.stockCode,
      price: h.price,
      changePercent: h.changePercent,
      compositeScore: h.compositeScore,
      verdictAction: h.verdictAction,
      verdictActionLabel: h.verdictAction ? ACTION_LABELS[h.verdictAction] : null,
      verdictScore: h.verdictScore,
      weight: Math.round(w * 1000) / 10, // % with 1 decimal
      value: value != null ? Math.round(value) : null,
      cost: cost != null ? Math.round(cost) : null,
      pnl: pnl != null ? Math.round(pnl) : null,
      pnlPercent: pnlPercent != null ? Math.round(pnlPercent * 100) / 100 : null,
      quantity: h.quantity,
      sectorCode: STOCK_SECTOR_MAP[h.stockCode] ?? null,
    };
  });

  // Metrics
  const totalValue = hasPositionData ? holdings.reduce((s, h) => s + (h.value ?? 0), 0) : null;
  const totalCost = hasPositionData ? holdings.reduce((s, h) => s + (h.cost ?? 0), 0) : null;
  const totalPnL = totalValue != null && totalCost != null && totalCost > 0 ? totalValue - totalCost : null;
  const totalPnLPercent = totalPnL != null && totalCost != null && totalCost > 0 ? (totalPnL / totalCost) * 100 : null;

  let dailyChange = 0;
  let weightSum = 0;
  for (const h of holdings) {
    if (h.changePercent != null) {
      dailyChange += h.changePercent * (h.weight / 100);
      weightSum += h.weight / 100;
    }
  }
  dailyChange = weightSum > 0 ? Math.round((dailyChange / weightSum) * 100) / 100 : 0;

  let portfolioBeta: number | null = null;
  const betaInputs = inputs.filter(h => h.beta != null);
  if (betaInputs.length > 0) {
    let wBeta = 0, wSum = 0;
    for (const h of betaInputs) {
      const w = weights.get(h.stockCode) ?? 0;
      wBeta += h.beta! * w;
      wSum += w;
    }
    portfolioBeta = wSum > 0 ? Math.round((wBeta / wSum) * 100) / 100 : null;
  }

  // Composite score (weighted)
  let portfolioCompositeScore = 50;
  const scoreInputs = inputs.filter(h => h.compositeScore != null);
  if (scoreInputs.length > 0) {
    let wScore = 0, wSum2 = 0;
    for (const h of scoreInputs) {
      const w = weights.get(h.stockCode) ?? 0;
      wScore += h.compositeScore! * w;
      wSum2 += w;
    }
    portfolioCompositeScore = wSum2 > 0 ? Math.round(wScore / wSum2) : 50;
  }

  // Allocation
  const allocation = holdings.map(h => ({ stockCode: h.stockCode, weight: h.weight, value: h.value }))
    .sort((a, b) => b.weight - a.weight);

  // Sector allocation (weighted)
  const sectorMap = new Map<string, { weight: number; stocks: string[] }>();
  for (const h of holdings) {
    const sector = h.sectorCode ?? "DIGER";
    const existing = sectorMap.get(sector) ?? { weight: 0, stocks: [] };
    existing.weight += h.weight;
    existing.stocks.push(h.stockCode);
    sectorMap.set(sector, existing);
  }
  const sectorAllocation = Array.from(sectorMap.entries())
    .map(([sector, data]) => ({
      sector,
      sectorName: SECTOR_INDICES[sector]?.name ?? "Diğer",
      weight: Math.round(data.weight * 10) / 10,
      stocks: data.stocks,
    }))
    .sort((a, b) => b.weight - a.weight);

  // Portfolio verdict
  const portfolioVerdict = calculatePortfolioVerdict(inputs, weights, diversificationScore);

  // Strongest / weakest
  const withVerdicts = holdings.filter(h => h.verdictScore != null);
  const sorted = [...withVerdicts].sort((a, b) => (b.verdictScore ?? 0) - (a.verdictScore ?? 0));
  const strongestHolding = sorted.length > 0
    ? { code: sorted[0].stockCode, reason: `${sorted[0].verdictActionLabel} — skor ${sorted[0].compositeScore ?? "—"}/100` }
    : null;
  const weakestHolding = sorted.length > 1
    ? { code: sorted[sorted.length - 1].stockCode, reason: `${sorted[sorted.length - 1].verdictActionLabel} — skor ${sorted[sorted.length - 1].compositeScore ?? "—"}/100` }
    : null;

  // Suggestions
  const suggestions = generateSuggestions(holdings, sectorAllocation, correlations);

  return {
    portfolioVerdict,
    portfolioCompositeScore,
    holdings,
    metrics: {
      totalValue: totalValue != null ? Math.round(totalValue) : null,
      totalCost: totalCost != null ? Math.round(totalCost) : null,
      totalPnL: totalPnL != null ? Math.round(totalPnL) : null,
      totalPnLPercent: totalPnLPercent != null ? Math.round(totalPnLPercent * 100) / 100 : null,
      dailyChange,
      portfolioBeta,
    },
    allocation,
    sectorAllocation,
    suggestions,
    strongestHolding,
    weakestHolding,
    hasPositionData,
  };
}
