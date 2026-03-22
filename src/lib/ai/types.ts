import type { FullTechnicalData } from "@/lib/stock/technicals";
import type { CompositeScore } from "@/lib/stock/scoring";
import type { DetectedSignal } from "@/lib/stock/signals";
import type { SectorContext } from "@/lib/stock/sectors";
import type { FundamentalData, FundamentalScore } from "@/lib/stock/fundamentals";
import type { MacroData } from "@/lib/stock/macro";
import type { RiskMetrics } from "@/lib/stock/risk";
import type { CandlestickPattern } from "@/lib/stock/candlesticks";
import type { ChartPattern } from "@/lib/stock/chart-patterns";
import type { ExtraIndicators } from "@/lib/stock/extra-indicators";
import type { SignalChain } from "@/lib/stock/signal-chains";

export type AnalysisTimeframe = "daily" | "weekly" | "monthly";

export interface StockAnalysisInputV2 {
  stockCode: string;
  price: number | null;
  changePercent: number | null;
  volume: number | null;
  newsHeadlines: string[];
  date: string;
  timeframe?: AnalysisTimeframe;
  technicals: FullTechnicalData | null;
  compositeScore: CompositeScore | null;
  signals: DetectedSignal[];
  sectorContext: SectorContext | null;
  fundamentals: FundamentalData | null;
  fundamentalScore: FundamentalScore | null;
  macroData: MacroData | null;
  riskMetrics: RiskMetrics | null;
  // Motor derinleştirme katmanları
  candlestickPatterns?: CandlestickPattern[];
  chartPatterns?: ChartPattern[];
  extraIndicators?: ExtraIndicators | null;
  signalChains?: SignalChain[];
  seasonalLabel?: string | null;
  multiTimeframeAlignment?: string | null;
}

export interface StockAnalysisOutputV2 {
  reasoning?: string;
  counterArgument?: string;
  dataQualityNote?: string;
  summaryText: string;
  bullCase: string;
  bearCase: string;
  sentimentValue: number;
  confidence: string;
  verdictReason?: string;
}

export type StockAnalysisInput = StockAnalysisInputV2;
export type StockAnalysisOutput = StockAnalysisOutputV2;

// ---- Specialized AI Insight Types ----

export type InsightType =
  | "akilli-ozet"
  | "giris-cikis"
  | "teknik-yorum"
  | "sinyal-cozum"
  | "risk-senaryo"
  | "sektor-analiz"
  | "islem-kurulumu";

export type PortfolioInsightType =
  | "portfoy-ozet"
  | "portfoy-risk"
  | "portfoy-rebalans"
  | "portfoy-performans";

export interface AkilliOzetOutput {
  tldr: string;
  bullets: { icon: string; text: string; category: "technical" | "fundamental" | "macro" | "risk" }[];
  timeHorizon: { shortTerm: string; mediumTerm: string; longTerm: string };
  watchlist: string[];
}

export interface GirisCikisOutput {
  entryZones: { priceRange: string; reasoning: string; confluence: string[]; riskReward: string }[];
  exitTargets: { price: string; reasoning: string; type: "partial" | "full" }[];
  stopLoss: { price: string; reasoning: string; atrBased: string };
  tradeSetupType: string;
  setupQuality: "A" | "B" | "C";
}

export interface TeknikYorumOutput {
  patternNarrative: string;
  historicalContext: string;
  confluenceAnalysis: string;
  keyLevel: { price: number; type: string; significance: string };
  patternReliability: "HIGH" | "MEDIUM" | "LOW";
  actionableInsight: string;
}

export interface SinyalCozumOutput {
  hasConflict: boolean;
  conflictSummary: string;
  resolution: string;
  dominantSignal: { name: string; direction: "BULLISH" | "BEARISH"; whyTrust: string };
  ignoredSignals: { name: string; whyIgnore: string }[];
  netConclusion: string;
  confidenceInResolution: "HIGH" | "MEDIUM" | "LOW";
}

export interface RiskSenaryoOutput {
  scenarios: { title: string; probability: "LOW" | "MEDIUM" | "HIGH"; impact: string; estimatedLoss: string; hedgeSuggestion: string }[];
  worstCaseNarrative: string;
  riskAppetiteAdvice: string;
  currentRiskSummary: string;
}

export interface SektorAnalizOutput {
  positionSummary: string;
  competitiveAdvantage: string;
  valuationComparison: string;
  sectorOutlook: string;
  betterAlternative: string | null;
}

export interface IslemKurulumuOutput {
  setupDetected: boolean;
  setupName: string;
  setupType: "BREAKOUT" | "REVERSAL" | "TREND_CONTINUATION" | "MEAN_REVERSION";
  description: string;
  triggerCondition: string;
  invalidation: string;
  historicalWinRate: string;
  timeframe: string;
  confluenceScore: number;
  status: "ACTIVE" | "PENDING" | "EXPIRED";
}

// ---- Portfolio AI Insight Types ----

export interface PortfoyOzetOutput {
  tldr: string;
  bullets: { icon: string; text: string; category: "allocation" | "performance" | "risk" | "action" }[];
  healthAnalysis: string;
  topPriority: string;
  watchlist: string[];
}

export interface PortfoyRiskOutput {
  riskSummary: string;
  scenarios: { title: string; probability: "LOW" | "MEDIUM" | "HIGH"; impact: string; estimatedLoss: string; hedgeSuggestion: string }[];
  drawdownAnalysis: string;
  correlationWarning: string;
  riskAppetiteAdvice: string;
}

export interface PortfoyRebalansOutput {
  currentAssessment: string;
  actions: { stockCode: string; action: "ARTIR" | "AZALT" | "TUT" | "CIKAR"; reasoning: string; targetWeight: string }[];
  sectorAdvice: string;
  diversificationAdvice: string;
}

export interface PortfoyPerformansOutput {
  performanceSummary: string;
  drivers: { stockCode: string; contribution: string; explanation: string }[];
  benchmarkComparison: string;
  outlook: string;
}
