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
  summaryText: string;
  bullCase: string;
  bearCase: string;
  sentimentValue: number;
  confidence: string;
  verdictReason?: string;
}

export type StockAnalysisInput = StockAnalysisInputV2;
export type StockAnalysisOutput = StockAnalysisOutputV2;
