/**
 * BİST Sektör Haritalama
 * Hisse → Sektör endeksi eşleştirmesi
 */

import YahooFinance from "yahoo-finance2";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = new (YahooFinance as any)({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

export const SECTOR_INDICES: Record<string, { symbol: string; name: string }> = {
  XBANK: { symbol: "XBANK.IS", name: "Bankacılık" },
  XUSIN: { symbol: "XUSIN.IS", name: "Sınai" },
  XHOLD: { symbol: "XHOLD.IS", name: "Holding" },
  XELKT: { symbol: "XELKT.IS", name: "Elektrik" },
  XULAS: { symbol: "XULAS.IS", name: "Ulaştırma" },
  XGIDA: { symbol: "XGIDA.IS", name: "Gıda" },
  XILTM: { symbol: "XILTM.IS", name: "İletişim" },
  XMANA: { symbol: "XMANA.IS", name: "Maden & Metal" },
  XTRZM: { symbol: "XTRZM.IS", name: "Turizm" },
};

export const STOCK_SECTOR_MAP: Record<string, string> = {
  // Bankacılık
  GARAN: "XBANK", AKBNK: "XBANK", YKBNK: "XBANK", ISCTR: "XBANK",
  HALKB: "XBANK", VAKBN: "XBANK", TSKB: "XBANK", ALBRK: "XBANK",
  // Holding
  KCHOL: "XHOLD", SAHOL: "XHOLD", TAVHL: "XHOLD",
  // Ulaştırma
  THYAO: "XULAS", PGSUS: "XULAS", CLEBI: "XULAS",
  // Sınai
  EREGL: "XUSIN", TOASO: "XUSIN", FROTO: "XUSIN", SISE: "XUSIN",
  TUPRS: "XUSIN", ASELS: "XUSIN", PETKM: "XUSIN", SASA: "XUSIN",
  // Gıda
  BIMAS: "XGIDA", ULKER: "XGIDA", TATGD: "XGIDA",
  // İletişim
  TCELL: "XILTM", TTKOM: "XILTM",
  // Maden & Metal
  KOZAL: "XMANA", KOZAA: "XMANA",
  // Elektrik
  ENERY: "XELKT", AYEN: "XELKT",
  // GYO / Diğer
  EKGYO: "XUSIN", HEKTS: "XUSIN",
};

export interface SectorContext {
  sectorCode: string;
  sectorName: string;
  sectorChange: number;
  stockChange: number;
  relativeStrength: number;
  bist100Change: number;
  vsBist100: number;
  outperforming: boolean;
}

// Cache: günde 1 kez çekilir
const sectorCache = new Map<string, { price: number | null; changePercent: number | null; fetchedAt: number }>();

async function fetchSectorQuote(symbol: string): Promise<{ price: number | null; changePercent: number | null }> {
  const cached = sectorCache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt < 3600_000) {
    return { price: cached.price, changePercent: cached.changePercent };
  }
  try {
    const quote = await yf.quote(symbol);
    const result = {
      price: quote?.regularMarketPrice ?? null,
      changePercent: quote?.regularMarketChangePercent ?? null,
    };
    sectorCache.set(symbol, { ...result, fetchedAt: Date.now() });
    return result;
  } catch {
    return { price: null, changePercent: null };
  }
}

export function getStockSector(stockCode: string): string | null {
  return STOCK_SECTOR_MAP[stockCode.toUpperCase()] ?? null;
}

export async function calculateSectorContext(
  stockCode: string,
  stockChange: number
): Promise<SectorContext | null> {
  const sectorCode = getStockSector(stockCode);
  if (!sectorCode) return null;

  const sectorInfo = SECTOR_INDICES[sectorCode];
  if (!sectorInfo) return null;

  const [sectorQuote, bist100Quote] = await Promise.all([
    fetchSectorQuote(sectorInfo.symbol),
    fetchSectorQuote("XU100.IS"),
  ]);

  const sectorChange = sectorQuote.changePercent ?? 0;
  const bist100Change = bist100Quote.changePercent ?? 0;
  const relativeStrength = stockChange - sectorChange;
  const vsBist100 = stockChange - bist100Change;

  return {
    sectorCode,
    sectorName: sectorInfo.name,
    sectorChange,
    stockChange,
    relativeStrength,
    bist100Change,
    vsBist100,
    outperforming: relativeStrength > 0,
  };
}
