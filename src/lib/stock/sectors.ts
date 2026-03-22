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
  // ═══ Bankacılık (XBANK) ═══
  GARAN: "XBANK", AKBNK: "XBANK", YKBNK: "XBANK", ISCTR: "XBANK",
  HALKB: "XBANK", VAKBN: "XBANK", TSKB: "XBANK", ALBRK: "XBANK",
  SKBNK: "XBANK", ISMEN: "XBANK", KLNMA: "XBANK", SEKFK: "XBANK",
  ISATR: "XBANK", VBTYZ: "XBANK", ISFIN: "XBANK",
  // ═══ Holding (XHOLD) ═══
  KCHOL: "XHOLD", SAHOL: "XHOLD", TAVHL: "XHOLD",
  DOHOL: "XHOLD", GLYHO: "XHOLD", AGHOL: "XHOLD", KLRHO: "XHOLD",
  ALARK: "XHOLD", AVHOL: "XHOLD", GSDHO: "XHOLD", NTHOL: "XHOLD",
  ATAKP: "XHOLD", BINHO: "XHOLD", INVEO: "XHOLD", MACKO: "XHOLD",
  OYYAT: "XHOLD", IHYAY: "XHOLD", EUHOL: "XHOLD", LRSHO: "XHOLD",
  IEYHO: "XHOLD",
  // ═══ Ulaştırma (XULAS) ═══
  THYAO: "XULAS", PGSUS: "XULAS", CLEBI: "XULAS", RYSAS: "XULAS",
  ULAS: "XULAS", BEYAZ: "XULAS", OYAYO: "XULAS",
  // ═══ Sınai (XUSIN) ═══
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
  // Sınai ek — üretim/makine/otomotiv/cam/çimento/demir-çelik
  ACSEL: "XUSIN", ARZUM: "XUSIN", ASTOR: "XUSIN", BMSTL: "XUSIN",
  BNTAS: "XUSIN", BRSAN: "XUSIN", BURCE: "XUSIN", CEMAS: "XUSIN",
  CMENT: "XUSIN", CUSAN: "XUSIN", CVKMD: "XUSIN", DIRIT: "XUSIN",
  FORMT: "XUSIN", GOLTS: "XUSIN", GOODY: "XUSIN", HATEK: "XUSIN",
  HKTM: "XUSIN", IMASM: "XUSIN", JANTS: "XUSIN", KAPLM: "XUSIN",
  KONYA: "XUSIN", KOPOL: "XUSIN", KRPLS: "XUSIN", MTRKS: "XUSIN",
  MTRYO: "XUSIN", ORCAY: "XUSIN", ORGE: "XUSIN", OSMEN: "XUSIN",
  OZBAL: "XUSIN", PARSN: "XUSIN", PENTA: "XUSIN", PENGD: "XUSIN",
  PRZMA: "XUSIN", SEKUR: "XUSIN", SNKRN: "XUSIN", SUMAS: "XUSIN",
  TUCLK: "XUSIN", USAK: "XUSIN", ZEDUR: "XUSIN",
  TTRAK: "XUSIN", GOKNR: "XUSIN", BSOKE: "XUSIN", ADANA: "XUSIN",
  AFYON: "XUSIN", CANTE: "XUSIN", CELHA: "XUSIN", CMBTN: "XUSIN",
  DOBUR: "XUSIN", DOKTA: "XUSIN", DMSAS: "XUSIN", EMKEL: "XUSIN",
  BFREN: "XUSIN", ARSAN: "XUSIN", ESEN: "XUSIN", ETILR: "XUSIN",
  SILVR: "XUSIN", SANFM: "XUSIN", TIRE: "XUSIN",
  // ═══ Gıda (XGIDA) ═══
  ULKER: "XGIDA", TATGD: "XGIDA", CCOLA: "XGIDA", AEFES: "XGIDA",
  BANVT: "XGIDA", KENT: "XGIDA", KNFRT: "XGIDA", FRIGO: "XGIDA",
  PNSUT: "XGIDA", TUKAS: "XGIDA", PETUN: "XGIDA", ULUUN: "XGIDA",
  BAKAN: "XGIDA", BERA: "XGIDA", ERSU: "XGIDA", KRTEK: "XGIDA",
  LUKSK: "XGIDA", MERKO: "XGIDA", PINSU: "XGIDA", SAMAT: "XGIDA",
  KERVT: "XGIDA", EKIZ: "XGIDA",
  // ═══ İletişim (XILTM) ═══
  TCELL: "XILTM", TTKOM: "XILTM", SMRTG: "XILTM",
  // ═══ Maden & Metal (XMANA) ═══
  KOZAL: "XMANA", KOZAA: "XMANA", KRDMD: "XMANA", ISDMR: "XMANA",
  DMRGD: "XMANA", KRVGD: "XMANA", MIATK: "XMANA", IZMDC: "XMANA",
  // ═══ Elektrik & Enerji (XELKT) ═══
  ENERY: "XELKT", AYEN: "XELKT", AKSEN: "XELKT",
  ENJSA: "XELKT", EUPWR: "XELKT", AKSA: "XELKT",
  AYGAZ: "XELKT", BASGZ: "XELKT", ODAS: "XELKT",
  AYDEM: "XELKT", PAMEL: "XELKT", IZENR: "XELKT",
  AHGAZ: "XELKT", AKFYE: "XELKT", AKENR: "XELKT", ALTNY: "XELKT",
  ENSRI: "XELKT", EUREN: "XELKT", GWIND: "XELKT", KCAER: "XELKT",
  MAGEN: "XELKT", NTGAZ: "XELKT", SURGY: "XELKT", ZOREN: "XELKT",
  CWENE: "XELKT", NATEN: "XELKT",
  // ═══ GYO (XGMYO) ═══
  EKGYO: "XGMYO", ISGYO: "XGMYO", TRGYO: "XGMYO",
  AKFGY: "XGMYO", PEKGY: "XGMYO", KGYO: "XGMYO",
  MRGYO: "XGMYO", NUGYO: "XGMYO", ALGYO: "XGMYO",
  AKSGY: "XGMYO", AKMGY: "XGMYO", OZGYO: "XGMYO",
  OZKGY: "XGMYO", RYGYO: "XGMYO", SNGYO: "XGMYO",
  TDGYO: "XGMYO", TSGYO: "XGMYO", VKGYO: "XGMYO",
  YGYO: "XGMYO", SRVGY: "XGMYO", ATAGY: "XGMYO",
  EYGYO: "XGMYO", GRNYO: "XGMYO", SEGYO: "XGMYO",
  YGGYO: "XGMYO", ZRGYO: "XGMYO",
  AVGYO: "XGMYO", DGGYO: "XGMYO", GCMYO: "XGMYO", MSGYO: "XGMYO",
  TORUNL: "XGMYO", VRGYO: "XGMYO", AHSGY: "XGMYO", AVPGY: "XGMYO",
  FZLGY: "XGMYO", UHRGY: "XGMYO", ARFYO: "XGMYO",
  // ═══ Sigorta (XSGRT) ═══
  AGESA: "XSGRT", ANSGR: "XSGRT", TURSG: "XSGRT", ANHYT: "XSGRT",
  AKGRT: "XSGRT", HDFGS: "XSGRT",
  // ═══ Turizm & Eğlence (XTRZM) ═══
  MPARK: "XTRZM", AYCES: "XTRZM", MAALT: "XTRZM", MEPET: "XTRZM",
  PLTUR: "XTRZM", ATATP: "XTRZM", METUR: "XTRZM",
  // ═══ Kimya (XKMYA) ═══
  HEKTS: "XKMYA", GUBRF: "XKMYA", SASA: "XKMYA", PETKM: "XKMYA",
  ALKIM: "XKMYA", DYOBY: "XKMYA", EPLAS: "XKMYA", POLTK: "XKMYA",
  AKCNS: "XKMYA", BMSCH: "XKMYA", ERBOS: "XKMYA", BAGFS: "XKMYA",
  // ═══ İnşaat (XINSA) ═══
  ENKAI: "XINSA", TKFEN: "XINSA", EDIP: "XINSA", KUYAS: "XINSA",
  // ═══ Tekstil (XTEKS) ═══
  MAVI: "XTEKS", YUNSA: "XTEKS", YATAS: "XTEKS", KLMSN: "XTEKS",
  DESA: "XTEKS", BOSSA: "XTEKS", MNDRS: "XTEKS", SKTAS: "XTEKS",
  BRMEN: "XTEKS", DERIM: "XTEKS", SUWEN: "XTEKS",
  // ═══ Bilişim (XBLSM) ═══
  LOGO: "XBLSM", NETAS: "XBLSM", KAREL: "XBLSM", INDES: "XBLSM",
  DGATE: "XBLSM", FONET: "XBLSM", KRONT: "XBLSM", IDEAS: "XBLSM",
  SMART: "XBLSM", LINK: "XBLSM", ARENA: "XBLSM",
  DGNMO: "XBLSM", EDATA: "XBLSM", HTTBT: "XBLSM", HUBVC: "XBLSM",
  MOBTL: "XBLSM", PCILT: "XBLSM", PSDTC: "XBLSM", SDTTR: "XBLSM",
  ARDYZ: "XBLSM", ITTFH: "XBLSM",
  // ═══ Ticaret (XTCRT) ═══
  BIMAS: "XTCRT", SOKM: "XTCRT", MGROS: "XTCRT", DOAS: "XTCRT",
  ADEL: "XTCRT", INTEM: "XTCRT", LKMNH: "XTCRT",
  AVOD: "XTCRT", CASA: "XTCRT", DAPGM: "XTCRT", DNISI: "XTCRT",
  GEDIK: "XTCRT", PKART: "XTCRT", RODRG: "XTCRT", GLBMD: "XTCRT",
  // ═══ Spor (XSPOR) ═══
  GSRAY: "XSPOR", BJKAS: "XSPOR", FENER: "XSPOR", TSPOR: "XSPOR",
  // ═══ Kağıt (XKAGT) ═══
  BAKAB: "XKAGT", KLKIM: "XKAGT", OLMIP: "XKAGT",
  // ═══ Hizmetler (XUHIZ) ═══
  OSTIM: "XUHIZ", OBASE: "XUHIZ", HEDEF: "XUHIZ", FADE: "XUHIZ",
  FLAP: "XUHIZ", LIDER: "XUHIZ", TEMPO: "XUHIZ", TEKTU: "XUHIZ",
  SERVE: "XUHIZ", ORMA: "XUHIZ", OTTO: "XUHIZ", OBAMS: "XUHIZ",
  // ═══ Ek atamalar (küçük/alt pazar) ═══
  // Gıda ek
  ADNAC: "XGIDA", SELGD: "XGIDA",
  // Enerji ek
  BALAT: "XELKT", DGKLB: "XELKT", EGPRO: "XELKT",
  // Holding ek
  DAGHL: "XHOLD", GOZDE: "XHOLD", GLRYH: "XHOLD",
  // Sınai ek
  BARMA: "XUSIN", DESPC: "XUSIN", GARFA: "XUSIN", GUSGR: "XUSIN",
  HURGZ: "XUSIN", KARYE: "XUSIN", KIMMR: "XUSIN", MAKTK: "XUSIN",
  MRSHL: "XUSIN", ROYAL: "XUSIN", SAYAS: "XUSIN", ULUSE: "XUSIN",
  IZFAS: "XUSIN", MEGAP: "XUSIN", MMCAS: "XUSIN", PNLSN: "XUSIN",
  VANGD: "XUSIN", RAYSG: "XUSIN", BRLSM: "XUSIN", BLCYT: "XUSIN",
  ALCAR: "XUSIN", EMPEL: "XUSIN", GRSEL: "XUSIN",
  // Finans ek
  GLCVY: "XBANK", GSDDE: "XBANK",
  // Teknoloji/bilişim ek
  GIPTA: "XBLSM", IHLGM: "XBLSM", INGRM: "XBLSM",
  // Ticaret ek
  GENTS: "XTCRT", BMELK: "XTCRT", FMIZP: "XTCRT", MERCN: "XTCRT",
  // Turizm ek
  // ESEN zaten XUSIN'de
  // GYO ek
  ARMDA: "XGMYO",
  // Maden ek
  ALKA: "XMANA",
  // Ulaştırma ek
  RTALB: "XULAS", DJIST: "XULAS",
  // Tekstil ek
  HALIT: "XTEKS",
  // Diğer — sınıflandırılamayan küçük şirketler XUSIN'e atanır
  BESUN: "XUSIN", ETYAT: "XUHIZ", GZNMI: "XUSIN", ISKPL: "XUSIN",
  KATMR: "XUSIN", KUVVA: "XBLSM", MEGMT: "XUSIN", ALVES: "XBLSM",
  ARTMS: "XBLSM", ATSYH: "XGIDA", DARDL: "XGIDA",
  KLSER: "XUSIN", KUTPO: "XUSIN", LILAK: "XBLSM", MAKIM: "XUSIN",
  MANAS: "XUSIN", SKYLP: "XBLSM", SNPAM: "XUSIN", SODSN: "XUSIN",
  TABGD: "XGIDA", TBORG: "XGIDA", TETMT: "XUSIN", TLMAN: "XUHIZ",
  TMPOL: "XUSIN", TNZTP: "XUHIZ", TRCAS: "XUSIN", TRILC: "XUSIN",
  TUREX: "XTCRT", UFUK: "XBLSM", VERTU: "XBLSM", VERUS: "XBLSM",
  YAPRK: "XKAGT", YKSLN: "XUSIN", RUBNS: "XBLSM", IHEVA: "XUSIN",
  KAYSE: "XUSIN", KFEIN: "XGIDA", HUNER: "XTRZM",
  OFSYM: "XTCRT", ONCSM: "XUSIN", RALYH: "XHOLD",
  DURDO: "XUSIN", EMNIS: "XSGRT",
  // ═══ Kalan hisseler (yeni eklenenler) ═══
  ACASE: "XUSIN", ACNKR: "XUSIN", ADBGR: "XBLSM", AGROT: "XGIDA",
  AKGUV: "XSGRT", AKSUE: "XELKT", ALCTL: "XBLSM", ALMAD: "XMANA",
  ANELE: "XELKT", ANGEN: "XBLSM", ARAT: "XUSIN", ATLAS: "XTCRT",
  BASCM: "XUSIN", BAYRK: "XUSIN", BIENY: "XELKT", BIGCH: "XBLSM",
  BORLS: "XUSIN", BRKVY: "XTCRT", BURVA: "XUSIN", CATES: "XUSIN",
  CEOEM: "XUSIN", CONSE: "XTCRT", COSMO: "XKMYA", CRDFA: "XBANK",
  DAGI: "XTEKS", DENGE: "XUHIZ", DERHL: "XHOLD", EGEPO: "XGIDA",
  EGOS: "XBLSM", EKOS: "XBLSM", EKSUN: "XGIDA", ELITE: "XTCRT",
  ENTRA: "XBLSM", ERCB: "XUSIN", EUYO: "XGMYO", EVREN: "XUSIN",
  GEDZA: "XUSIN", GRTRK: "XILTM", ICBCT: "XBANK", IHGZT: "XKAGT",
  ISGSY: "XBLSM", ISKUR: "XUHIZ", KZBGY: "XGMYO", LIDFA: "XBANK",
  MEGIP: "XBLSM", MIPAZ: "XTCRT", MNDTR: "XUSIN", NIBAS: "XUSIN",
  ODINE: "XBLSM", ONRYT: "XBLSM", OYAKC: "XUSIN", PRDGS: "XBLSM",
  REEDR: "XBLSM", SAFKR: "XUSIN", SELVA: "XGIDA", SNICA: "XUSIN",
  TACTR: "XUSIN", TATEN: "XELKT", TKURU: "XGIDA", TURGG: "XGIDA",
  VAKFN: "XBANK", VESBE: "XUSIN", YYLGD: "XGIDA",
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
