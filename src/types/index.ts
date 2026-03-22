import type { Plan } from "@/generated/prisma/enums";

export interface StockQuote {
  code: string;
  name: string;
  price: number | null;
  changePercent: number | null;
  volume: number | null;
}

export interface StockSearchResult {
  code: string;
  name: string;
}

export interface DailySummaryData {
  id: string;
  stockCode: string;
  date: string;
  closePrice: number | null;
  changePercent: number | null;
  aiSummaryText: string | null;
  sentimentScore: string | null;
  status: string;
  // v2
  compositeScore: number | null;
  bullCase: string | null;
  bearCase: string | null;
  confidence: string | null;
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      plan: Plan;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    plan: Plan;
  }
}
