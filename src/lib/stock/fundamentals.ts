/**
 * Bistbase Fundamental Analysis Engine
 * Temel analiz — şirketin finansal sağlığı
 * Yahoo Finance'den çekilir, kod ile skorlanır.
 */

import YahooFinance from "yahoo-finance2";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = new (YahooFinance as any)({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

export interface FundamentalData {
  // Değerleme
  peRatio: number | null;          // Fiyat/Kazanç (TTM)
  forwardPE: number | null;        // İleriye Dönük F/K
  pegRatio: number | null;         // F/K / Büyüme (PEG)
  pbRatio: number | null;          // Piyasa Değeri / Defter Değeri
  evToEbitda: number | null;       // FD/FAVÖK
  marketCap: number | null;

  // Karlılık
  roe: number | null;              // Özsermaye Karlılığı (%)
  roa: number | null;              // Aktif Karlılığı (%)
  profitMargin: number | null;     // Net Kar Marjı (%)
  operatingMargin: number | null;  // Faaliyet Kar Marjı (%)
  grossMargin: number | null;      // Brüt Kar Marjı (%)

  // Büyüme
  revenueGrowth: number | null;    // Gelir Büyümesi (%)
  earningsGrowth: number | null;   // Kazanç Büyümesi (%)

  // Nakit Akışı
  freeCashFlowYield: number | null; // Serbest Nakit Akış Verimi (%)
  operatingCashFlow: number | null; // Faaliyet Nakit Akışı

  // Borçluluk
  debtToEquity: number | null;     // Borç/Özsermaye
  currentRatio: number | null;     // Cari Oran
  interestCoverage: number | null; // Faiz Karşılama Oranı

  // Temettü
  dividendYield: number | null;    // Temettü Verimi (%)

  // Risk
  beta: number | null;             // Piyasaya göre oynaklık

  // 52 hafta
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;

  // Takvim
  earningsDate: string | null;       // Sonraki bilanço tarihi
  exDividendDate: string | null;     // Temettü hak ediş tarihi
  daysToEarnings: number | null;     // Bilançoya kaç gün
  fromFiftyTwoHigh: number | null; // Zirveden % uzaklık
  fromFiftyTwoLow: number | null;  // Dipten % uzaklık
}

export interface FundamentalScore {
  valuationScore: number;     // 0-100
  profitabilityScore: number; // 0-100
  growthScore: number;        // 0-100
  healthScore: number;        // 0-100 (borçluluk + likidite)
  fundamentalScore: number;   // 0-100 composite
}

function parseDate(val: unknown): string | null {
  if (!val) return null;
  try {
    const d = new Date(val as string | number);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split("T")[0];
  } catch { return null; }
}

function calcDaysTo(val: unknown): number | null {
  const dateStr = parseDate(val);
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const now = new Date();
  const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : null;
}

export async function getFundamentalData(stockCode: string): Promise<FundamentalData | null> {
  const symbol = `${stockCode.toUpperCase()}.IS`;

  try {
    // quoteSummary gives us detailed financial data
    let summary: Record<string, unknown> | null = null;
    try {
      summary = await yf.quoteSummary(symbol, {
        modules: ["financialData", "defaultKeyStatistics", "summaryDetail", "cashflowStatementHistory"],
      });
    } catch {
      // quoteSummary might fail, fallback to quote
    }

    const quote = await yf.quote(symbol).catch(() => null);
    if (!quote && !summary) return null;

    const fd = (summary as Record<string, Record<string, unknown>>)?.financialData ?? {};
    const ks = (summary as Record<string, Record<string, unknown>>)?.defaultKeyStatistics ?? {};
    const sd = (summary as Record<string, Record<string, unknown>>)?.summaryDetail ?? {};
    const cf = (summary as Record<string, Record<string, unknown>>)?.cashflowStatementHistory ?? {};

    const price = (quote?.regularMarketPrice as number) ?? null;
    const high52 = (quote?.fiftyTwoWeekHigh as number) ?? (sd.fiftyTwoWeekHigh as number) ?? null;
    const low52 = (quote?.fiftyTwoWeekLow as number) ?? (sd.fiftyTwoWeekLow as number) ?? null;
    const mktCap = (quote?.marketCap as number) ?? null;

    // Forward P/E & PEG
    const forwardPE = (quote?.forwardPE as number) ?? (ks.forwardPE as number) ?? null;
    const pegRatio = (ks.pegRatio as number) ?? null;

    // Free Cash Flow from cashflow statement
    let freeCashFlowYield: number | null = null;
    let operatingCashFlow: number | null = null;
    try {
      const statements = (cf.cashflowStatements as Array<Record<string, unknown>>) ?? [];
      if (statements.length > 0) {
        const latest = statements[0];
        const ocf = (latest.totalCashFromOperatingActivities as number) ?? null;
        const capex = Math.abs((latest.capitalExpenditures as number) ?? 0);
        operatingCashFlow = ocf;
        if (ocf != null && mktCap && mktCap > 0) {
          const fcf = ocf - capex;
          freeCashFlowYield = (fcf / mktCap) * 100;
        }
      }
    } catch { /* cashflow data may not be available */ }

    // Interest coverage (EBIT / interest expense)
    let interestCoverage: number | null = null;
    const ebit = (fd.ebitda as number) ?? null; // approximate EBIT from EBITDA
    // Yahoo doesn't provide interest expense directly, so we skip if unavailable

    return {
      peRatio: (quote?.trailingPE as number) ?? (sd.trailingPE as number) ?? null,
      forwardPE,
      pegRatio,
      pbRatio: (quote?.priceToBook as number) ?? (ks.priceToBook as number) ?? null,
      evToEbitda: (ks.enterpriseToEbitda as number) ?? null,
      marketCap: mktCap,
      roe: (fd.returnOnEquity as number) != null ? (fd.returnOnEquity as number) * 100 : null,
      roa: (fd.returnOnAssets as number) != null ? (fd.returnOnAssets as number) * 100 : null,
      profitMargin: (fd.profitMargins as number) != null ? (fd.profitMargins as number) * 100 : null,
      operatingMargin: (fd.operatingMargins as number) != null ? (fd.operatingMargins as number) * 100 : null,
      grossMargin: (fd.grossMargins as number) != null ? (fd.grossMargins as number) * 100 : null,
      revenueGrowth: (fd.revenueGrowth as number) != null ? (fd.revenueGrowth as number) * 100 : null,
      earningsGrowth: (fd.earningsGrowth as number) != null ? (fd.earningsGrowth as number) * 100 : null,
      freeCashFlowYield,
      operatingCashFlow,
      debtToEquity: (fd.debtToEquity as number) ?? null,
      currentRatio: (fd.currentRatio as number) ?? null,
      interestCoverage,
      dividendYield: (sd.dividendYield as number) != null ? (sd.dividendYield as number) * 100 : null,
      beta: (ks.beta as number) ?? (quote?.beta as number) ?? null,
      fiftyTwoWeekHigh: high52,
      fiftyTwoWeekLow: low52,
      fromFiftyTwoHigh: price && high52 ? ((price - high52) / high52) * 100 : null,
      fromFiftyTwoLow: price && low52 ? ((price - low52) / low52) * 100 : null,
      earningsDate: parseDate(quote?.earningsTimestamp ?? ks.nextFiscalYearEnd),
      exDividendDate: parseDate(sd.exDividendDate),
      daysToEarnings: calcDaysTo(quote?.earningsTimestamp ?? ks.nextFiscalYearEnd),
    };
  } catch (error) {
    console.error(`Fundamental data error for ${stockCode}:`, error);
    return null;
  }
}

// ════════════════════════════════════════
// FUNDAMENTAL SCORING
// ════════════════════════════════════════

function clamp(v: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

function scoreValuation(f: FundamentalData): number {
  let score = 50;

  // P/E: düşük = iyi (BIST ortalaması ~8-12)
  if (f.peRatio != null) {
    if (f.peRatio < 0) score -= 15;           // Zarar eden
    else if (f.peRatio < 5) score += 20;      // Çok ucuz
    else if (f.peRatio < 10) score += 15;     // Ucuz
    else if (f.peRatio < 15) score += 5;      // Makul
    else if (f.peRatio < 25) score -= 5;      // Pahalı
    else score -= 15;                          // Çok pahalı
  }

  // Forward P/E — ileriye dönük: TTM'den daha önemli
  if (f.forwardPE != null) {
    if (f.forwardPE > 0 && f.forwardPE < 8) score += 8;
    else if (f.forwardPE > 0 && f.forwardPE < 15) score += 3;
    else if (f.forwardPE > 30) score -= 8;
    // Forward PE < trailing PE → kazanç büyümesi bekleniyor
    if (f.peRatio != null && f.peRatio > 0 && f.forwardPE > 0 && f.forwardPE < f.peRatio * 0.85) {
      score += 5; // Analistler %15+ kazanç büyümesi bekliyor
    }
  }

  // PEG — büyümeye göre değerleme (1.0 = makul, <1 = ucuz, >2 = pahalı)
  if (f.pegRatio != null) {
    if (f.pegRatio > 0 && f.pegRatio < 0.8) score += 10;
    else if (f.pegRatio > 0 && f.pegRatio < 1.2) score += 5;
    else if (f.pegRatio > 2) score -= 8;
    else if (f.pegRatio < 0) score -= 5; // Negatif büyüme
  }

  // P/B: düşük = iyi
  if (f.pbRatio != null) {
    if (f.pbRatio < 1) score += 10;           // Defter değerinin altında
    else if (f.pbRatio < 2) score += 5;
    else if (f.pbRatio > 5) score -= 10;
  }

  // FD/FAVÖK
  if (f.evToEbitda != null) {
    if (f.evToEbitda < 5) score += 10;
    else if (f.evToEbitda < 10) score += 5;
    else if (f.evToEbitda > 20) score -= 10;
  }

  // FCF Yield — serbest nakit akış verimi (en güvenilir değerleme metriği)
  if (f.freeCashFlowYield != null) {
    if (f.freeCashFlowYield > 10) score += 12;     // Çok güçlü nakit üretimi
    else if (f.freeCashFlowYield > 5) score += 8;
    else if (f.freeCashFlowYield > 2) score += 3;
    else if (f.freeCashFlowYield < -5) score -= 10; // Nakit yakıyor
    else if (f.freeCashFlowYield < 0) score -= 5;
  }

  // 52 hafta pozisyonu — dipten yükselmiş ama zirvede değil = iyi
  if (f.fromFiftyTwoHigh != null) {
    if (f.fromFiftyTwoHigh > -10) score -= 5;    // Zirveye çok yakın
    else if (f.fromFiftyTwoHigh < -30) score += 5; // İndirimli
  }

  return clamp(score);
}

function scoreProfitability(f: FundamentalData): number {
  let score = 50;

  // ROE: Türkiye'de %20+ enflasyon nedeniyle eşikler yükseltildi
  if (f.roe != null) {
    if (f.roe > 30) score += 20;    // Enflasyon üstü güçlü getiri
    else if (f.roe > 20) score += 10;
    else if (f.roe > 10) score += 5;
    else if (f.roe < 0) score -= 20;
    else score -= 5;
  }

  if (f.profitMargin != null) {
    if (f.profitMargin > 20) score += 10;
    else if (f.profitMargin > 10) score += 5;
    else if (f.profitMargin < 0) score -= 15;
  }

  if (f.operatingMargin != null) {
    if (f.operatingMargin > 20) score += 5;
    else if (f.operatingMargin < 0) score -= 10;
  }

  return clamp(score);
}

function scoreGrowth(f: FundamentalData): number {
  let score = 50;

  if (f.revenueGrowth != null) {
    if (f.revenueGrowth > 30) score += 20;
    else if (f.revenueGrowth > 15) score += 10;
    else if (f.revenueGrowth > 5) score += 5;
    else if (f.revenueGrowth < -10) score -= 15;
    else if (f.revenueGrowth < 0) score -= 5;
  }

  if (f.earningsGrowth != null) {
    if (f.earningsGrowth > 30) score += 15;
    else if (f.earningsGrowth > 10) score += 8;
    else if (f.earningsGrowth < -20) score -= 15;
    else if (f.earningsGrowth < 0) score -= 5;
  }

  return clamp(score);
}

function scoreHealth(f: FundamentalData): number {
  let score = 50;

  // Borç/Özsermaye: sektöre göre farklı eşikler ideal ama genel BIST ortalamasına göre ayarlı
  if (f.debtToEquity != null) {
    if (f.debtToEquity < 50) score += 15;       // Güçlü bilanço
    else if (f.debtToEquity < 100) score += 5;   // Makul
    else if (f.debtToEquity > 200) score -= 15;  // Çok yüksek (bankalar hariç)
    else if (f.debtToEquity > 150) score -= 5;
  }

  // Cari oran: > 1.5 iyi
  if (f.currentRatio != null) {
    if (f.currentRatio > 2) score += 10;
    else if (f.currentRatio > 1.5) score += 5;
    else if (f.currentRatio < 0.8) score -= 20;
    else if (f.currentRatio < 1) score -= 15;
  }

  // Faiz karşılama oranı — borç ödeme gücü
  if (f.interestCoverage != null) {
    if (f.interestCoverage > 5) score += 8;
    else if (f.interestCoverage > 2) score += 3;
    else if (f.interestCoverage < 1) score -= 12; // Faiz bile ödeyemiyor
    else if (f.interestCoverage < 1.5) score -= 5;
  }

  // Nakit akışı sağlığı — operasyonel nakit pozitif mi?
  if (f.operatingCashFlow != null) {
    if (f.operatingCashFlow > 0) score += 5;
    else score -= 8; // Negatif operasyonel nakit akışı = tehlike
  }

  // Temettü bonusu
  if (f.dividendYield != null && f.dividendYield > 3) {
    score += 5;
  }

  return clamp(score);
}

export function scoreFundamentals(f: FundamentalData): FundamentalScore {
  const valuationScore = scoreValuation(f);
  const profitabilityScore = scoreProfitability(f);
  const growthScore = scoreGrowth(f);
  const healthScore = scoreHealth(f);

  const fundamentalScore = Math.round(
    valuationScore * 0.30 +
    profitabilityScore * 0.30 +
    growthScore * 0.20 +
    healthScore * 0.20
  );

  return {
    valuationScore,
    profitabilityScore,
    growthScore,
    healthScore,
    fundamentalScore: clamp(fundamentalScore),
  };
}
