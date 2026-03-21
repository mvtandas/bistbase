export interface StockAnalysisInput {
  stockCode: string;
  price: number | null;
  changePercent: number | null;
  volume: number | null;
  newsHeadlines: string[];
  date: string;
}

export interface StockAnalysisOutput {
  summaryText: string;
  sentimentScore: string; // POSITIVE, NEGATIVE, NEUTRAL
}
