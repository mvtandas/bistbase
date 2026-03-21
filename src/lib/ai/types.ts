import type { TechnicalSignals } from "@/lib/stock/technicals";

export interface StockAnalysisInput {
  stockCode: string;
  price: number | null;
  changePercent: number | null;
  volume: number | null;
  newsHeadlines: string[];
  date: string;
  technicals: TechnicalSignals | null;
}

export interface StockAnalysisOutput {
  summaryText: string;
  sentimentScore: string; // POSITIVE, NEGATIVE, NEUTRAL
}
