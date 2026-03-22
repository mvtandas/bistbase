export interface StockDetail {
  code: string;
  name: string;
  price: number | null;
  changePercent: number | null;
  volume: number | null;
  financials: Record<string, number | string | null>;
  fundamentalScore: { valuationScore: number; profitabilityScore: number; growthScore: number; healthScore: number; fundamentalScore: number } | null;
  technicals: Record<string, unknown> | null;
  score: { technical: number; momentum: number; volume: number; volatility: number; sentiment: number; fundamental: number; macro: number; composite: number; label: string; labelTr: string } | null;
  signals: { type: string; direction: "BULLISH" | "BEARISH" | "NEUTRAL"; strength: number; description: string }[];
  sectorContext: { sectorName: string; sectorChange: number; relativeStrength: number; bist100Change: number; outperforming: boolean } | null;
  riskMetrics: { beta: number | null; sharpeRatio: number | null; maxDrawdown: number | null; maxDrawdownDays: number | null; var95Daily: number | null; var95Weekly: number | null; annualVolatility: number | null; riskLevel: string | null; riskLevelTr: string; cvar95Daily: number | null; currentDrawdown: number | null; stressTests: { name: string; estimatedLoss: number }[]; liquidityScore: number | null; liquidityLevel: string | null } | null;
  macroData: { usdTry: number | null; usdTryChange: number | null; bist100: number | null; bist100Change: number | null; dxy: number | null; dxyChange: number | null; vix: number | null; macroScore: number; macroLabel: string; tcmbPolicyRate: number | null; tcmbInflation: number | null; tcmbRealRate: number | null; tcmbReserves: number | null } | null;
  peerComparison: { sectorName: string; currentStock: string; peers: { code: string; name: string; price: number | null; changePercent: number | null; peRatio: number | null; marketCap: number | null }[]; rankByChange: number | null; rankByPE: number | null; totalPeers: number } | null;
  scoreTrend: { scores: { date: string; score: number }[]; direction: string | null; dailyChange: number | null; momentum: string | null } | null;
  signalAccuracy: Record<string, { rate: number; count: number }>;
  signalChains: { name: string; nameTr: string; direction: "BULLISH" | "BEARISH"; strength: number; steps: string[]; description: string }[];
  multiTimeframe: { weekly: { trend: string; rsi: number | null; maAlignment: string | null }; daily: { trend: string | null; rsi: number | null; maAlignment: string | null }; alignment: string; alignmentTr: string; signalBonus: number } | null;
  signalCombination: { totalBullish: number; totalBearish: number; confluenceType: string | null; confluenceLabel: string; conflicting: boolean; strengthBoost: number } | null;
  seasonality: { currentMonth: number; currentMonthName: string; monthlyAvgReturn: number | null; monthlyWinRate: number | null; isHistoricallyStrong: boolean; seasonalLabel: string; monthlyReturns: { month: number; name: string; avgReturn: number; dataPoints: number }[] } | null;
  candlestickPatterns: { name: string; nameTr: string; type: string; direction: string; strength: number; description: string }[];
  chartPatterns: { name: string; nameTr: string; type: string; direction: string; strength: number; description: string }[];
  extraIndicators: { vwap: number | null; priceVsVwap: string | null; williamsR: number | null; williamsSignal: string | null; parabolicSar: number | null; sarTrend: string | null; keltnerUpper: number | null; keltnerLower: number | null; ttmSqueeze: boolean; elderBullPower: number | null; elderBearPower: number | null; kama: number | null; priceVsKama: string | null; supertrend: number | null; supertrendDirection: string | null; pivotPoints: { classic: { pp: number; s1: number; s2: number; s3: number; r1: number; r2: number; r3: number }; fibonacci: { pp: number; s1: number; s2: number; s3: number; r1: number; r2: number; r3: number } } | null; nearestPivot: { level: string; price: number; distance: number } | null } | null;
  volatilityRegime: { currentVol: number; shortTermVol: number; mediumTermVol: number; longTermVol: number; regime: string; regimeTr: string; volExpanding: boolean; volContracting: boolean; regimeShiftSignal: string | null } | null;
  turkishSeasonality: { dayOfWeek: { name: string; effect: string; description: string }; monthEffect: { name: string; effect: string; description: string }; specialPeriod: string | null; specialPeriodEffect: string | null; tcmbDecisionProximity: boolean; overallBias: string; description: string } | null;
  indexInclusion: { stockCode: string; currentIndices: string[]; recentChange: { type: string; index: string; date: string } | null; effect: string; description: string } | null;
  bankMetrics: { stockCode: string; isBankStock: boolean; nim: number | null; costToIncome: number | null; riskAssessment: string | null; description: string } | null;
  reitMetrics: { stockCode: string; isREIT: boolean; pToNav: number | null; navDiscount: number | null; riskAssessment: string | null; description: string } | null;
  economicCalendar: { events: { date: string; title: string; type: string; importance: string }[]; nextCritical: { date: string; title: string; type: string; importance: string } | null; daysToNextCritical: number | null; volatilityWarning: boolean } | null;
  searchInterest: { stockCode: string; currentInterest: number | null; changePercent: number | null; isSpike: boolean; trend: string | null; description: string } | null;
  kapFinancials: { stockCode: string; period: string; revenue: number | null; netIncome: number | null; totalAssets: number | null; totalEquity: number | null; fetchedAt: string } | null;
  priceHistory: { date: string; close: number }[];
  chartBars: { date: string; open: number; high: number; low: number; close: number; volume: number }[];
  chartOverlays: {
    ma20: { date: string; value: number }[];
    ma50: { date: string; value: number }[];
    ma200: { date: string; value: number }[];
    bbUpper: { date: string; value: number }[];
    bbLower: { date: string; value: number }[];
    support: number | null;
    resistance: number | null;
  };
  recentSignals: { id: string; date: string; type: string; direction: string; strength: number; description: string; wasAccurate: boolean | null; outcomePercent1D: number | null }[];
  signalBacktest: {
    stockCode: string | null;
    performances: {
      signalType: string; signalDirection: string;
      horizon1D: { winRate: number; avgWinPct: number; avgLossPct: number; profitFactor: number; sampleSize: number };
      horizon5D: { winRate: number; avgWinPct: number; avgLossPct: number; profitFactor: number; sampleSize: number };
      horizon10D: { winRate: number; avgWinPct: number; avgLossPct: number; profitFactor: number; sampleSize: number };
      bestHorizon: string;
      bestOutcome: { percent: number; date: string } | null;
      worstOutcome: { percent: number; date: string } | null;
      streaks: { maxConsecutiveWins: number; maxConsecutiveLosses: number; currentStreak: number; currentStreakType: string };
      regimePerformance: { bullMarket: { winRate: number; avgReturn: number; count: number } | null; bearMarket: { winRate: number; avgReturn: number; count: number } | null; neutral: { winRate: number; avgReturn: number; count: number } | null };
      confidence: string; confidenceScore: number;
      recentOutcomes: { date: string; outcome1D: number | null; outcome5D: number | null; wasAccurate: boolean | null }[];
      summaryTr: string;
    }[];
    generatedAt: string; totalSignalsAnalyzed: number; dataSpanDays: number;
  } | null;
}

export interface Summary {
  id: string; date: string; closePrice: number | null; changePercent: number | null;
  aiSummaryText: string | null; sentimentScore: string | null;
  bullCase?: string | null; bearCase?: string | null; compositeScore?: number | null; confidence?: string | null;
  verdictReason?: string | null;
}

export type Period = "today" | "week" | "month";
export type ContentTab = "summary" | "technical" | "fundamental" | "risk";

export const PERIOD_LABELS: Record<Period, string> = { today: "Bugün", week: "Haftalık", month: "Aylık" };
export const TAB_LABELS: Record<ContentTab, string> = { summary: "Özet", technical: "Teknik", fundamental: "Temel", risk: "Risk" };
