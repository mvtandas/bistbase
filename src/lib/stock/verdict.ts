/**
 * Bistbase Verdict Engine v2
 * TradingView-ilhamli 3 sutunlu oylama sistemi
 * Teknik (MA+Osilator) + Temel + Momentum&Akis → Karar
 */

import { detectVolatilityRegime, type VolatilityRegime } from "./scoring";

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════

export type VerdictAction = "GUCLU_AL" | "AL" | "TUT" | "SAT" | "GUCLU_SAT";

export interface VoteGroup {
  rating: number; // -1.0 → +1.0
  buy: number;
  sell: number;
  neutral: number;
}

export interface TechnicalPillar {
  rating: number;
  maRating: number;
  oscRating: number;
  maBuy: number;
  maSell: number;
  maNeutral: number;
  oscBuy: number;
  oscSell: number;
  oscNeutral: number;
}

export interface FundamentalPillar {
  rating: number;
  valuationRating: number;
  qualityRating: number;
  growthRating: number;
}

export interface FlowPillar {
  rating: number;
  signalRating: number;
  volumeRating: number;
  macroRating: number;
  mtfRating: number;
}

export interface Verdict {
  action: VerdictAction;
  actionLabel: string;
  score: number; // -1.0 → +1.0 (risk-adjusted)

  confidence: number; // 0-100
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW";
  confidenceLabel: string;

  technical: TechnicalPillar;
  fundamental: FundamentalPillar;
  flow: FlowPillar;

  weights: { technical: number; fundamental: number; flow: number };

  topReasons: string[];
  strongestBull: string;
  strongestBear: string;
  riskNote: string;

  summary: {
    totalBuy: number;
    totalSell: number;
    totalNeutral: number;
    interPillarAgreement: "STRONG" | "MODERATE" | "WEAK" | "CONFLICTING";
  };
}

// ═══════════════════════════════════════
// INPUT — client-side StockDetail verisi
// ═══════════════════════════════════════

export interface VerdictInput {
  price: number | null;
  technicals: Record<string, unknown> | null;
  extraIndicators: {
    vwap: number | null; priceVsVwap: string | null;
    williamsR: number | null; williamsSignal: string | null;
    parabolicSar: number | null; sarTrend: string | null;
    elderBullPower: number | null; elderBearPower: number | null;
    kama: number | null; priceVsKama: string | null;
    [k: string]: unknown;
  } | null;
  score: { technical: number; momentum: number; volume: number; volatility: number; sentiment: number; fundamental: number; macro: number; composite: number; label: string } | null;
  fundamentalScore: { valuationScore: number; profitabilityScore: number; growthScore: number; healthScore: number; fundamentalScore: number } | null;
  signals: { type: string; direction: "BULLISH" | "BEARISH" | "NEUTRAL"; strength: number; description: string }[];
  signalCombination: { totalBullish: number; totalBearish: number; confluenceType: string | null; conflicting: boolean } | null;
  signalAccuracy: Record<string, { rate: number; count: number }>;
  multiTimeframe: { weekly: { trend: string }; daily: { trend: string | null }; alignment: string } | null;
  macroData: { vix: number | null; bist100Change: number | null; usdTryChange: number | null; macroScore: number } | null;
  riskMetrics: { var95Daily: number | null; currentDrawdown: number | null; riskLevel: string | null; liquidityScore: number | null; stressTests: { estimatedLoss: number }[] } | null;
  sentimentValue?: number | null;
  signalBacktest?: { performances: { signalType: string; horizon1D: { winRate: number; profitFactor: number; sampleSize: number }; bestHorizon: string; confidenceScore: number; streaks: { maxConsecutiveLosses: number } }[] } | null;
}

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════

const ACTION_LABELS: Record<VerdictAction, string> = {
  GUCLU_AL: "Güçlü Al", AL: "Al", TUT: "Tut", SAT: "Sat", GUCLU_SAT: "Güçlü Sat",
};

function sign(n: number): number { return n > 0 ? 1 : n < 0 ? -1 : 0; }
function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

function groupRating(buy: number, sell: number, neutral: number): number {
  const total = buy + sell + neutral;
  return total > 0 ? (buy - sell) / total : 0;
}

function num(v: unknown): number | null {
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}
function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}
function bool(v: unknown): boolean {
  return v === true;
}

// ═══════════════════════════════════════
// PILLAR 1: TEKNIK
// ═══════════════════════════════════════

function castMAVotes(t: Record<string, unknown>, extra: VerdictInput["extraIndicators"], price: number): VoteGroup {
  let buy = 0, sell = 0, neutral = 0;

  const vote = (condition: boolean | null) => {
    if (condition === null) neutral++;
    else if (condition) buy++;
    else sell++;
  };

  // 1-3: SMA 20, 50, 200
  const ma20 = num(t.ma20); vote(ma20 != null ? price > ma20 : null);
  const ma50 = num(t.ma50); vote(ma50 != null ? price > ma50 : null);
  const ma200 = num(t.ma200); vote(ma200 != null ? price > ma200 : null);

  // 4-5: EMA 12, 26 (MACD bileşenleri — macdLine+macdSignal'den elde edilemez, ama
  // macdLine = ema12 - ema26. Eğer macdLine > 0 ise price ema12 > ema26 demektir.
  // Yaklaşım: macdLine > 0 → ema12 > ema26 → ikisi de bullish (2 oy), < 0 → 2 bearish
  const macdLine = num(t.macdLine);
  if (macdLine != null) {
    if (macdLine > 0) { buy += 2; } else if (macdLine < 0) { sell += 2; } else { neutral += 2; }
  } else { neutral += 2; }

  // 6: VWAP
  vote(extra?.priceVsVwap != null ? extra.priceVsVwap === "ABOVE" : null);

  // 7: KAMA
  vote(extra?.priceVsKama != null ? extra.priceVsKama === "ABOVE" : null);

  // 8: Ichimoku Cloud
  const ichimoku = t.ichimoku as { priceVsCloud?: string; tkCross?: string } | null;
  if (ichimoku?.priceVsCloud) {
    if (ichimoku.priceVsCloud === "ABOVE") buy++;
    else if (ichimoku.priceVsCloud === "BELOW") sell++;
    else neutral++; // INSIDE
  } else { neutral++; }

  // 9: Ichimoku TK Cross
  if (ichimoku?.tkCross) {
    if (ichimoku.tkCross === "BULLISH") buy++;
    else if (ichimoku.tkCross === "BEARISH") sell++;
    else neutral++;
  } else { neutral++; }

  // 10: Parabolic SAR
  vote(extra?.sarTrend != null ? extra.sarTrend === "BULLISH" : null);

  // 11: BB Middle (bbMiddle = ma20 zaten ama BB'nin orta bandı olarak)
  const bbMiddle = num(t.bbMiddle) ?? num(t.ma20);
  vote(bbMiddle != null ? price > bbMiddle : null);

  return { buy, sell, neutral, rating: groupRating(buy, sell, neutral) };
}

function castOscillatorVotes(t: Record<string, unknown>, extra: VerdictInput["extraIndicators"]): VoteGroup {
  let buy = 0, sell = 0, neutral = 0;

  // 1: RSI(14)
  const rsi = num(t.rsi14);
  const rsiBullDiv = bool(t.rsiBullishDivergence);
  const rsiBearDiv = bool(t.rsiBearishDivergence);
  if (rsi != null) {
    if (rsi < 30 || (rsi < 50 && rsiBullDiv)) buy++;
    else if (rsi > 70 || (rsi > 50 && rsiBearDiv)) sell++;
    else if (rsi >= 40 && rsi <= 60) neutral++;
    else if (rsi < 40) buy++; // 30-40 leaning bullish
    else sell++; // 60-70 leaning bearish
  } else { neutral++; }

  // 2: Stochastic %K
  const stochK = num(t.stochK);
  if (stochK != null) {
    if (stochK < 20) buy++;
    else if (stochK > 80) sell++;
    else neutral++;
  } else { neutral++; }

  // 3: MACD Histogram
  const hist = num(t.macdHistogram);
  const macdCross = str(t.macdCrossover);
  if (hist != null) {
    if (hist > 0 && macdCross === "BULLISH_CROSS") buy++;
    else if (hist < 0 && macdCross === "BEARISH_CROSS") sell++;
    else if (hist > 0) buy++;
    else if (hist < 0) sell++;
    else neutral++;
  } else { neutral++; }

  // 4: MACD Line vs Signal
  const macdL = num(t.macdLine);
  const macdS = num(t.macdSignal);
  if (macdL != null && macdS != null) {
    if (macdL > macdS) buy++;
    else if (macdL < macdS) sell++;
    else neutral++;
  } else { neutral++; }

  // 5: ADX + DI
  const adx = num(t.adx14);
  const plusDI = num(t.plusDI);
  const minusDI = num(t.minusDI);
  if (adx != null && plusDI != null && minusDI != null) {
    if (adx >= 25 && plusDI > minusDI) buy++;
    else if (adx >= 25 && minusDI > plusDI) sell++;
    else neutral++; // weak trend
  } else { neutral++; }

  // 6: Williams %R
  const wr = extra?.williamsR != null ? (extra.williamsR as number) : null;
  if (wr != null) {
    if (wr < -80) buy++;
    else if (wr > -20) sell++;
    else neutral++;
  } else { neutral++; }

  // 7: MFI(14)
  const mfi = num(t.mfi14);
  if (mfi != null) {
    if (mfi < 20) buy++;
    else if (mfi > 80) sell++;
    else neutral++;
  } else { neutral++; }

  // 8: CMF(20)
  const cmfSig = str(t.cmfSignal);
  if (cmfSig) {
    if (cmfSig === "ACCUMULATION") buy++;
    else if (cmfSig === "DISTRIBUTION") sell++;
    else neutral++;
  } else { neutral++; }

  // 9: BB %B
  const bbB = num(t.bbPercentB);
  if (bbB != null) {
    if (bbB < 0.2) buy++; // oversold
    else if (bbB > 0.8) sell++; // overbought
    else neutral++;
  } else { neutral++; }

  // 10: Elder Ray
  const elderBull = extra?.elderBullPower;
  if (elderBull != null) {
    if ((elderBull as number) > 0) buy++;
    else if ((elderBull as number) < 0) sell++;
    else neutral++;
  } else { neutral++; }

  // 11: OBV trend
  const obvTrend = str(t.obvTrend);
  if (obvTrend) {
    if (obvTrend === "RISING") buy++;
    else if (obvTrend === "FALLING") sell++;
    else neutral++;
  } else { neutral++; }

  return { buy, sell, neutral, rating: groupRating(buy, sell, neutral) };
}

function calculateTechnicalPillar(t: Record<string, unknown> | null, extra: VerdictInput["extraIndicators"], price: number | null): TechnicalPillar {
  if (!t || !price) {
    return { rating: 0, maRating: 0, oscRating: 0, maBuy: 0, maSell: 0, maNeutral: 0, oscBuy: 0, oscSell: 0, oscNeutral: 0 };
  }

  const ma = castMAVotes(t, extra, price);
  const osc = castOscillatorVotes(t, extra);

  return {
    rating: (ma.rating + osc.rating) / 2,
    maRating: ma.rating,
    oscRating: osc.rating,
    maBuy: ma.buy,
    maSell: ma.sell,
    maNeutral: ma.neutral,
    oscBuy: osc.buy,
    oscSell: osc.sell,
    oscNeutral: osc.neutral,
  };
}

// ═══════════════════════════════════════
// PILLAR 2: TEMEL
// ═══════════════════════════════════════

function scoreToRating(score: number): number {
  if (score >= 70) return 1;
  if (score >= 60) return 0.5;
  if (score >= 45) return 0;
  if (score >= 35) return -0.5;
  return -1;
}

function calculateFundamentalPillar(fs: VerdictInput["fundamentalScore"]): FundamentalPillar {
  if (!fs) return { rating: 0, valuationRating: 0, qualityRating: 0, growthRating: 0 };

  const valuationRating = scoreToRating(fs.valuationScore);
  const qualityScore = fs.profitabilityScore * 0.6 + fs.healthScore * 0.4;
  const qualityRating = scoreToRating(qualityScore);
  const growthRating = scoreToRating(fs.growthScore);

  const rating = valuationRating * 0.35 + qualityRating * 0.35 + growthRating * 0.30;

  return { rating: clamp(rating, -1, 1), valuationRating, qualityRating, growthRating };
}

// ═══════════════════════════════════════
// PILLAR 3: MOMENTUM & AKIS
// ═══════════════════════════════════════

function calculateFlowPillar(input: VerdictInput): FlowPillar {
  // Signal rating
  let bullWeight = 0, bearWeight = 0;
  for (const s of input.signals) {
    if (s.direction === "BULLISH") bullWeight += s.strength;
    else if (s.direction === "BEARISH") bearWeight += s.strength;
  }
  const totalSigWeight = bullWeight + bearWeight;
  const signalRating = totalSigWeight > 0 ? clamp((bullWeight - bearWeight) / totalSigWeight, -1, 1) : 0;

  // Volume rating
  const volumeRating = input.score ? clamp((input.score.volume - 50) / 50, -1, 1) : 0;

  // Macro rating
  const macroRating = input.macroData ? clamp((input.macroData.macroScore - 50) / 50, -1, 1) : 0;

  // MTF rating
  let mtfRating = 0;
  if (input.multiTimeframe) {
    const { alignment, weekly } = input.multiTimeframe;
    const weeklyBullish = weekly.trend === "STRONG_UP" || weekly.trend === "UP";
    const weeklyBearish = weekly.trend === "STRONG_DOWN" || weekly.trend === "DOWN";
    const dir = weeklyBullish ? 1 : weeklyBearish ? -1 : 0;

    if (alignment === "STRONG_ALIGNED") mtfRating = dir * 0.8;
    else if (alignment === "ALIGNED") mtfRating = dir * 0.4;
    else if (alignment === "CONFLICTING") mtfRating = -0.3;
    // MIXED → 0
  }

  const rating = signalRating * 0.40 + volumeRating * 0.20 + macroRating * 0.15 + mtfRating * 0.25;

  return { rating: clamp(rating, -1, 1), signalRating, volumeRating, macroRating, mtfRating };
}

// ═══════════════════════════════════════
// DYNAMIC WEIGHTS
// ═══════════════════════════════════════

interface PillarWeights { technical: number; fundamental: number; flow: number }

const REGIME_PILLAR_WEIGHTS: Record<VolatilityRegime, PillarWeights> = {
  LOW:    { technical: 0.35, fundamental: 0.40, flow: 0.25 },
  NORMAL: { technical: 0.40, fundamental: 0.30, flow: 0.30 },
  HIGH:   { technical: 0.40, fundamental: 0.20, flow: 0.40 },
  CRISIS: { technical: 0.30, fundamental: 0.15, flow: 0.55 },
};

function getPillarWeights(macroData: VerdictInput["macroData"], hasFundamentals: boolean): PillarWeights {
  const regime = detectVolatilityRegime(macroData as Parameters<typeof detectVolatilityRegime>[0]);
  const w = { ...REGIME_PILLAR_WEIGHTS[regime] };

  // Temel veri yoksa ağırlığını diğerlerine dağıt
  if (!hasFundamentals) {
    const redistrib = w.fundamental / 2;
    w.technical += redistrib;
    w.flow += redistrib;
    w.fundamental = 0;
  }

  return w;
}

// ═══════════════════════════════════════
// RISK ADJUSTMENT
// ═══════════════════════════════════════

function applyRiskAdjustment(rawScore: number, risk: VerdictInput["riskMetrics"]): number {
  if (!risk) return rawScore;

  let penalty = 0;
  const dd = Math.abs(risk.currentDrawdown ?? 0);
  if (dd > 20) penalty += 0.10;
  else if (dd > 10) penalty += 0.05;

  const varD = Math.abs(risk.var95Daily ?? 0);
  if (varD > 5) penalty += 0.10;
  else if (varD > 3) penalty += 0.05;

  if (risk.riskLevel === "VERY_HIGH") penalty += 0.10;
  else if (risk.riskLevel === "HIGH") penalty += 0.05;

  if ((risk.liquidityScore ?? 100) < 30) penalty += 0.05;

  penalty = Math.min(penalty, 0.35);

  if (rawScore > 0) return rawScore * (1 - penalty);
  return rawScore * (1 + penalty * 0.5);
}

// ═══════════════════════════════════════
// VERDICT THRESHOLDS
// ═══════════════════════════════════════

function scoreToAction(score: number): VerdictAction {
  if (score >= 0.50) return "GUCLU_AL";
  if (score >= 0.15) return "AL";
  if (score > -0.15) return "TUT";
  if (score > -0.50) return "SAT";
  return "GUCLU_SAT";
}

// ═══════════════════════════════════════
// CONFIDENCE
// ═══════════════════════════════════════

function calculateConfidence(
  tech: TechnicalPillar,
  fund: FundamentalPillar,
  flow: FlowPillar,
  adjustedScore: number,
  input: VerdictInput,
): number {
  let conf = 50;

  // A. Inter-pillar agreement
  const signs = [sign(tech.rating), sign(fund.rating), sign(flow.rating)];
  const nonZero = signs.filter(s => s !== 0);
  if (nonZero.length >= 3 && new Set(nonZero).size === 1) conf += 25;
  else if (nonZero.length >= 2) {
    const counts = { pos: nonZero.filter(s => s > 0).length, neg: nonZero.filter(s => s < 0).length };
    if (counts.pos >= 2 || counts.neg >= 2) conf += 10;
    else conf -= 15;
  } else {
    conf -= 5; // insufficient data
  }

  // B. MA vs Oscillator agreement
  const maSign = sign(tech.maRating);
  const oscSign = sign(tech.oscRating);
  if (maSign !== 0 && oscSign !== 0) {
    if (maSign === oscSign) conf += 5;
    else conf -= 12;
  }

  // C. Signal accuracy — enhanced with backtest data
  if (input.signalBacktest?.performances?.length) {
    const activePerfs = input.signals
      .map(s => input.signalBacktest!.performances.find(p => p.signalType === s.type))
      .filter((p): p is NonNullable<typeof p> => p != null && p.horizon1D.sampleSize >= 3);

    if (activePerfs.length > 0) {
      const avgWinRate = activePerfs.reduce((sum, p) => sum + p.horizon1D.winRate, 0) / activePerfs.length;
      const avgPF = activePerfs.reduce((sum, p) => sum + p.horizon1D.profitFactor, 0) / activePerfs.length;
      const avgSample = activePerfs.reduce((sum, p) => sum + p.horizon1D.sampleSize, 0) / activePerfs.length;
      const maxLossStreak = Math.max(...activePerfs.map(p => p.streaks.maxConsecutiveLosses));

      if (avgWinRate >= 70 && avgPF >= 2.0) conf += 15;
      else if (avgWinRate >= 60 && avgPF >= 1.5) conf += 10;
      else if (avgWinRate >= 55) conf += 5;
      else if (avgWinRate < 45) conf -= 8;
      else if (avgWinRate < 35) conf -= 15;

      if (avgSample >= 15) conf += 5;
      if (maxLossStreak >= 5) conf -= 5;
    }
  } else {
    // Fallback: basit accuracy
    const accValues: number[] = [];
    for (const s of input.signals) {
      const acc = input.signalAccuracy[s.type];
      if (acc && acc.count >= 3) accValues.push(acc.rate);
    }
    if (accValues.length > 0) {
      const avgAcc = accValues.reduce((a, b) => a + b, 0) / accValues.length;
      if (avgAcc >= 70) conf += 8;
      else if (avgAcc < 50) conf -= 5;
    }
  }

  // D. Multi-timeframe
  if (input.multiTimeframe) {
    const al = input.multiTimeframe.alignment;
    if (al === "STRONG_ALIGNED") conf += 10;
    else if (al === "ALIGNED") conf += 5;
    else if (al === "CONFLICTING") conf -= 10;
    else conf -= 3;
  } else { conf -= 5; }

  // E. Signal combination
  if (input.signalCombination) {
    if (input.signalCombination.conflicting) conf -= 10;
    const ct = input.signalCombination.confluenceType;
    if (ct === "STRONG_BULLISH" || ct === "STRONG_BEARISH") conf += 7;
  }

  // F. Verdict strength
  const dist = Math.abs(adjustedScore);
  if (dist > 0.6) conf += 8;
  else if (dist < 0.10) conf -= 10;

  // G. Data availability
  if (!input.fundamentalScore) conf -= 8;
  if (!input.multiTimeframe) conf -= 5;
  if (!input.macroData) conf -= 3;
  if (!input.extraIndicators) conf -= 3;

  return clamp(conf, 5, 95);
}

// ═══════════════════════════════════════
// INTER-PILLAR AGREEMENT
// ═══════════════════════════════════════

function getInterPillarAgreement(
  tech: TechnicalPillar, fund: FundamentalPillar, flow: FlowPillar,
): "STRONG" | "MODERATE" | "WEAK" | "CONFLICTING" {
  const signs = [sign(tech.rating), sign(fund.rating), sign(flow.rating)];
  const nonZero = signs.filter(s => s !== 0);

  if (nonZero.length >= 3 && new Set(nonZero).size === 1) return "STRONG";
  if (nonZero.length >= 2) {
    const hasPos = nonZero.some(s => s > 0);
    const hasNeg = nonZero.some(s => s < 0);
    if (hasPos && hasNeg) return "CONFLICTING";
    return "MODERATE";
  }
  return "WEAK";
}

// ═══════════════════════════════════════
// REASON GENERATION
// ═══════════════════════════════════════

function generateReasons(
  tech: TechnicalPillar, fund: FundamentalPillar, flow: FlowPillar,
  agreement: string, input: VerdictInput,
): string[] {
  const reasons: string[] = [];
  const maTotal = tech.maBuy + tech.maSell + tech.maNeutral;
  const oscTotal = tech.oscBuy + tech.oscSell + tech.oscNeutral;

  // MA summary
  if (maTotal > 0) {
    reasons.push(`${maTotal} MA'dan ${tech.maBuy}'${tech.maBuy > 1 ? "i" : "i"} yukarı, ${tech.maSell}'${tech.maSell > 1 ? "i" : "i"} aşağı`);
  }

  // Oscillator summary
  if (oscTotal > 0) {
    const oscVerdict = tech.oscBuy > tech.oscSell ? "AL" : tech.oscSell > tech.oscBuy ? "SAT" : "NÖTR";
    reasons.push(`${oscTotal} osilatörün ${tech.oscBuy > tech.oscSell ? tech.oscBuy : tech.oscSell}'${tech.oscBuy > tech.oscSell ? "i" : "i"} ${oscVerdict} gösteriyor`);
  }

  // Inter-pillar
  if (agreement === "STRONG") {
    reasons.push("Teknik, temel ve momentum arasında güçlü uyum");
  } else if (agreement === "CONFLICTING") {
    const techDir = tech.rating > 0 ? "al" : tech.rating < 0 ? "sat" : "nötr";
    const fundDir = fund.rating > 0 ? "olumlu" : fund.rating < 0 ? "zayıf" : "nötr";
    reasons.push(`Teknik ${techDir} gösterirken temel veriler ${fundDir} — çakışma var`);
  }

  // Fundamental highlight
  if (input.fundamentalScore) {
    const fs = input.fundamentalScore.fundamentalScore;
    if (fs >= 70) reasons.push(`Temel analiz güçlü (${fs}/100)`);
    else if (fs < 35) reasons.push(`Temel analiz zayıf (${fs}/100)`);
  }

  return reasons.slice(0, 4);
}

function findStrongestSignal(
  signals: VerdictInput["signals"], direction: "BULLISH" | "BEARISH",
): string {
  const filtered = signals.filter(s => s.direction === direction);
  if (filtered.length === 0) return direction === "BULLISH" ? "Belirgin boğa sinyali yok" : "Belirgin ayı sinyali yok";
  const strongest = filtered.reduce((a, b) => a.strength > b.strength ? a : b);
  return strongest.description;
}

function generateRiskNote(risk: VerdictInput["riskMetrics"]): string {
  if (!risk) return "Risk verisi mevcut değil.";
  const parts: string[] = [];

  const dd = Math.abs(risk.currentDrawdown ?? 0);
  if (dd > 15) parts.push(`zirveden %${dd.toFixed(0)} düşüşte`);

  const varD = Math.abs(risk.var95Daily ?? 0);
  if (varD > 4) parts.push(`günlük kayıp riski %${varD.toFixed(1)}`);

  if (risk.riskLevel === "VERY_HIGH") parts.push("risk seviyesi çok yüksek");
  else if (risk.riskLevel === "HIGH") parts.push("risk seviyesi yüksek");

  if ((risk.liquidityScore ?? 100) < 30) parts.push("düşük likidite");

  const maxStress = risk.stressTests.reduce((max, t) => Math.max(max, Math.abs(t.estimatedLoss)), 0);
  if (maxStress > 30) parts.push(`kriz senaryosunda %${maxStress.toFixed(0)} kayıp riski`);

  if (parts.length === 0) return "Normal risk seviyesinde.";
  return `Dikkat: ${parts.join(", ")}.`;
}

// ═══════════════════════════════════════
// MAIN
// ═══════════════════════════════════════

export function calculateVerdict(input: VerdictInput): Verdict {
  // 1. Three pillars
  const technical = calculateTechnicalPillar(input.technicals, input.extraIndicators, input.price);
  const fundamental = calculateFundamentalPillar(input.fundamentalScore);
  const flow = calculateFlowPillar(input);

  // 2. Dynamic weights
  const weights = getPillarWeights(input.macroData, !!input.fundamentalScore);

  // 3. Raw score
  const rawScore = technical.rating * weights.technical
    + fundamental.rating * weights.fundamental
    + flow.rating * weights.flow;

  // 4. Risk adjustment
  const adjustedScore = applyRiskAdjustment(rawScore, input.riskMetrics);
  const score = clamp(adjustedScore, -1, 1);

  // 5. Action
  const action = scoreToAction(score);

  // 6. Confidence
  const confidence = calculateConfidence(technical, fundamental, flow, score, input);
  const confidenceLevel = confidence >= 70 ? "HIGH" as const : confidence >= 45 ? "MEDIUM" as const : "LOW" as const;
  const confidenceLabel = confidenceLevel === "HIGH" ? "Yüksek" : confidenceLevel === "LOW" ? "Düşük" : "Orta";

  // 7. Agreement
  const interPillarAgreement = getInterPillarAgreement(technical, fundamental, flow);

  // 8. Reasons
  const topReasons = generateReasons(technical, fundamental, flow, interPillarAgreement, input);
  const strongestBull = findStrongestSignal(input.signals, "BULLISH");
  const strongestBear = findStrongestSignal(input.signals, "BEARISH");
  const riskNote = generateRiskNote(input.riskMetrics);

  return {
    action,
    actionLabel: ACTION_LABELS[action],
    score,
    confidence,
    confidenceLevel,
    confidenceLabel,
    technical,
    fundamental,
    flow,
    weights,
    topReasons,
    strongestBull,
    strongestBear,
    riskNote,
    summary: {
      totalBuy: technical.maBuy + technical.oscBuy,
      totalSell: technical.maSell + technical.oscSell,
      totalNeutral: technical.maNeutral + technical.oscNeutral,
      interPillarAgreement,
    },
  };
}
