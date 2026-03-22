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
  XSGRT: { symbol: "XSGRT.IS", name: "Sigorta" },
  XKMYA: { symbol: "XKMYA.IS", name: "Kimya" },
  XINSA: { symbol: "XINSA.IS", name: "İnşaat" },
  XGMYO: { symbol: "XGMYO.IS", name: "GYO" },
  XTEKS: { symbol: "XTEKS.IS", name: "Tekstil" },
  XKAGT: { symbol: "XKAGT.IS", name: "Kağıt" },
  XSPOR: { symbol: "XSPOR.IS", name: "Spor" },
  XUHIZ: { symbol: "XUHIZ.IS", name: "Hizmetler" },
  XBLSM: { symbol: "XBLSM.IS", name: "Bilişim" },
  XTCRT: { symbol: "XTCRT.IS", name: "Ticaret" },
};

export const STOCK_SECTOR_MAP: Record<string, string> = {
  // Bankacılık
  GARAN: "XBANK", AKBNK: "XBANK", YKBNK: "XBANK", ISCTR: "XBANK",
  HALKB: "XBANK", VAKBN: "XBANK", TSKB: "XBANK", ALBRK: "XBANK",
  SKBNK: "XBANK", ISMEN: "XBANK",
  // Holding
  KCHOL: "XHOLD", SAHOL: "XHOLD", TAVHL: "XHOLD",
  DOHOL: "XHOLD", GLYHO: "XHOLD", AGHOL: "XHOLD", KLRHO: "XHOLD",
  ALARK: "XHOLD", AVHOL: "XHOLD", GSDHO: "XHOLD", NTHOL: "XHOLD",
  // Ulaştırma
  THYAO: "XULAS", PGSUS: "XULAS", CLEBI: "XULAS", RYSAS: "XULAS",
  // Sınai
  EREGL: "XUSIN", TOASO: "XUSIN", FROTO: "XUSIN", SISE: "XUSIN",
  TUPRS: "XUSIN", ASELS: "XUSIN", ARCLK: "XUSIN", OTKAR: "XUSIN",
  VESTL: "XUSIN", BRISA: "XUSIN", KORDS: "XUSIN", EGEEN: "XUSIN",
  CIMSA: "XUSIN", BUCIM: "XUSIN", GESAN: "XUSIN",
  PRKME: "XUSIN", SANEL: "XUSIN", TMSN: "XUSIN",
  KONTR: "XUSIN", QUAGR: "XUSIN", ALFAS: "XUSIN",
  SELEC: "XUSIN", POLHO: "XUSIN", BIOEN: "XUSIN", BRYAT: "XUSIN",
  RGYAS: "XUSIN", TGSAS: "XUSIN", PAPIL: "XUSIN",
  IPEKE: "XUSIN", KMPUR: "XUSIN", KTLEV: "XUSIN",
  GENIL: "XUSIN", YEOTK: "XUSIN", KARSN: "XUSIN",
  ECILC: "XUSIN", ASUZU: "XUSIN", DITAS: "XUSIN",
  IZOCM: "XUSIN", NUHCM: "XUSIN", BTCIM: "XUSIN",
  // Gıda
  ULKER: "XGIDA", TATGD: "XGIDA", CCOLA: "XGIDA", AEFES: "XGIDA",
  BANVT: "XGIDA", KENT: "XGIDA", KNFRT: "XGIDA", FRIGO: "XGIDA",
  PNSUT: "XGIDA", TUKAS: "XGIDA", PETUN: "XGIDA", ULUUN: "XGIDA",
  // İletişim
  TCELL: "XILTM", TTKOM: "XILTM", SMRTG: "XILTM",
  // Maden & Metal
  KOZAL: "XMANA", KOZAA: "XMANA", KRDMD: "XMANA", ISDMR: "XMANA",
  // Elektrik & Enerji
  ENERY: "XELKT", AYEN: "XELKT", AKSEN: "XELKT",
  ENJSA: "XELKT", EUPWR: "XELKT", AKSA: "XELKT",
  AYGAZ: "XELKT", BASGZ: "XELKT", ODAS: "XELKT",
  AYDEM: "XELKT", PAMEL: "XELKT", IZENR: "XELKT",
  // GYO
  EKGYO: "XGMYO", ISGYO: "XGMYO", TRGYO: "XGMYO",
  AKFGY: "XGMYO", PEKGY: "XGMYO", KGYO: "XGMYO",
  MRGYO: "XGMYO", NUGYO: "XGMYO", ALGYO: "XGMYO",
  AKSGY: "XGMYO", AKMGY: "XGMYO", OZGYO: "XGMYO",
  OZKGY: "XGMYO", RYGYO: "XGMYO", SNGYO: "XGMYO",
  TDGYO: "XGMYO", TSGYO: "XGMYO", VKGYO: "XGMYO",
  YGYO: "XGMYO", SRVGY: "XGMYO", ATAGY: "XGMYO",
  EYGYO: "XGMYO", GRNYO: "XGMYO", SEGYO: "XGMYO",
  YGGYO: "XGMYO", ZRGYO: "XGMYO",
  // Sigorta
  AGESA: "XSGRT", ANSGR: "XSGRT", TURSG: "XSGRT", ANHYT: "XSGRT",
  // Turizm & Eğlence
  MPARK: "XTRZM",
  // Kimya
  HEKTS: "XKMYA", GUBRF: "XKMYA", SASA: "XKMYA", PETKM: "XKMYA",
  ALKIM: "XKMYA", DYOBY: "XKMYA", EPLAS: "XKMYA", POLTK: "XKMYA",
  // İnşaat
  ENKAI: "XINSA", TKFEN: "XINSA",
  // Tekstil
  MAVI: "XTEKS", YUNSA: "XTEKS", YATAS: "XTEKS", KLMSN: "XTEKS",
  DESA: "XTEKS", BOSSA: "XTEKS", MNDRS: "XTEKS", SKTAS: "XTEKS",
  // Bilişim
  LOGO: "XBLSM", NETAS: "XBLSM", KAREL: "XBLSM", INDES: "XBLSM",
  DGATE: "XBLSM", FONET: "XBLSM", KRONT: "XBLSM", IDEAS: "XBLSM",
  SMART: "XBLSM", LINK: "XBLSM", ARENA: "XBLSM",
  // Ticaret
  BIMAS: "XTCRT", SOKM: "XTCRT", MGROS: "XTCRT", DOAS: "XTCRT",
  ADEL: "XTCRT", INTEM: "XTCRT", LKMNH: "XTCRT",
  // Spor
  GSRAY: "XSPOR", BJKAS: "XSPOR", FENER: "XSPOR", TSPOR: "XSPOR",
  // Kağıt
  BAKAB: "XKAGT", KLKIM: "XKAGT",
  // Hizmetler
  OSTIM: "XUHIZ", OBASE: "XUHIZ",
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
