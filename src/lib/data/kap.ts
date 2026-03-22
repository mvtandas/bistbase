/**
 * KAP (Kamuyu Aydinlatma Platformu) Finansal Tablo Entegrasyonu
 * Resmi BIST finansal tablolarini ceker.
 * KAP API: https://www.kap.org.tr/tr/api/
 *
 * KAP dogrudan yapilandirilmis mali tablo verisi donmuyor;
 * bildirim meta verileri doner. Parser, bildirim baslik ve
 * ozetlerinden donem bilgisi ve varsa mali rakamlari cikarir.
 */

import { cacheGet, cacheSet } from "@/lib/redis";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KAPFinancialSummary {
  stockCode: string;
  period: string; // "2025/Q3" gibi
  revenue: number | null; // Gelir (TL)
  netIncome: number | null; // Net kar (TL)
  totalAssets: number | null;
  totalEquity: number | null;
  totalDebt: number | null;
  operatingProfit: number | null;
  ebitda: number | null;
  fetchedAt: string;
}

interface KAPDisclosure {
  disclosureIndex?: string;
  title?: string;
  summary?: string;
  publishDate?: string;
  disclosureClass?: string;
  disclosureType?: string;
  subject?: string;
  ruleTypeTerm?: string;
  relatedStocks?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KAP_API_BASE = "https://www.kap.org.tr/tr/api";

const KAP_HEADERS = {
  "Content-Type": "application/json",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Referer: "https://www.kap.org.tr/tr/bildirim-sorgu",
  Accept: "application/json",
} as const;

const CACHE_TTL_SECONDS = 86_400; // 24 saat

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getKAPFinancials(
  stockCode: string,
): Promise<KAPFinancialSummary | null> {
  const cacheKey = `kap:financials:${stockCode}`;
  const cached = await cacheGet<KAPFinancialSummary>(cacheKey);
  if (cached) return cached;

  try {
    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const response = await fetch(`${KAP_API_BASE}/memberDisclosureQuery`, {
      method: "POST",
      headers: KAP_HEADERS,
      body: JSON.stringify({
        fromDate: formatKAPDate(oneYearAgo),
        toDate: formatKAPDate(now),
        stockCode,
        disclosureClass: "FR", // Financial Reports (Finansal Raporlar)
      }),
      signal: AbortSignal.timeout(30_000), // KAP yavaş olabiliyor
    });

    if (!response.ok) return null;

    const data: unknown = await response.json();
    if (!Array.isArray(data)) return null;

    const result = parseKAPResponse(data as KAPDisclosure[], stockCode);
    if (result) {
      await cacheSet(cacheKey, result, CACHE_TTL_SECONDS);
    }
    return result;
  } catch (e) {
    // KAP Türkiye dışından erişilemeyebilir — production'da (Vercel TR) çalışacak
    console.warn(`[kap] Financial fetch failed for ${stockCode}: ${(e as Error).message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * KAP API tarih formatina cevirir (YYYY-MM-DD).
 * Mevcut kap-rss.ts ile ayni format kullanilir.
 */
function formatKAPDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * KAP bildirim listesinden en guncel finansal tablo bildirimini bulur
 * ve baslik/ozetinden cikarabilecegi mali verileri doner.
 *
 * KAP API yapilandirilmis bilanso verisi donmuyor; bildirim basliklarinda
 * donem bilgisi ve bazen ozet rakamlar yer alir. Ornegin:
 *   "THYAO - 2024/12 Donemsel Finansal Tablo ve Dipnotlar"
 *   "SASA - 2024/9 Donemsel Finansal Tablo"
 */
function parseKAPResponse(
  disclosures: KAPDisclosure[],
  stockCode: string,
): KAPFinancialSummary | null {
  if (!disclosures.length) return null;

  // En yeni bildirimi bul (genelde ilk sirada gelir ama siralayalim)
  const sorted = [...disclosures].sort((a, b) => {
    const dateA = a.publishDate ?? "";
    const dateB = b.publishDate ?? "";
    return dateB.localeCompare(dateA);
  });

  const latest = sorted[0];
  const title = latest.title ?? latest.subject ?? "";

  // Donem bilgisini cikar: "2024/12", "2024/9", "2024/6", "2024/3"
  const period = extractPeriod(title, latest.publishDate);

  // Baslik veya ozetteki rakamlari cikar (varsa)
  const summary = latest.summary ?? "";
  const combinedText = `${title} ${summary}`;
  const financials = extractFinancialFigures(combinedText);

  return {
    stockCode,
    period,
    revenue: financials.revenue,
    netIncome: financials.netIncome,
    totalAssets: financials.totalAssets,
    totalEquity: financials.totalEquity,
    totalDebt: financials.totalDebt,
    operatingProfit: financials.operatingProfit,
    ebitda: financials.ebitda,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Bildirim basligindan donem bilgisini cikarir.
 * Ornek basliklar:
 *   "2024/12 Donemsel Finansal Tablo"  -> "2024/Q4"
 *   "2024/9 Donemsel Finansal Tablo"   -> "2024/Q3"
 *   "2024/06 ..."                      -> "2024/Q2"
 */
function extractPeriod(title: string, publishDate?: string): string {
  // Basliktan YYYY/M veya YYYY/MM formatini ara
  const periodMatch = title.match(/(\d{4})\s*\/\s*(\d{1,2})/);
  if (periodMatch) {
    const year = periodMatch[1];
    const month = parseInt(periodMatch[2], 10);
    const quarter = monthToQuarter(month);
    return `${year}/Q${quarter}`;
  }

  // Baslikta bulunamazsa publishDate'ten tahmin et
  if (publishDate) {
    try {
      const d = new Date(publishDate);
      if (!isNaN(d.getTime())) {
        // Yayim tarihi genelde bir onceki ceyregin raporudur
        const reportQuarter = d.getMonth() < 3 ? 4 : Math.ceil(d.getMonth() / 3) - 1 || 4;
        const reportYear =
          reportQuarter === 4 && d.getMonth() < 3
            ? d.getFullYear() - 1
            : d.getFullYear();
        return `${reportYear}/Q${reportQuarter}`;
      }
    } catch {
      // ignore
    }
  }

  return "unknown";
}

function monthToQuarter(month: number): number {
  if (month <= 3) return 1;
  if (month <= 6) return 2;
  if (month <= 9) return 3;
  return 4;
}

/**
 * Metin icerisindeki finansal rakamlari cikarir.
 *
 * KAP bildirim ozetlerinde bazen su turde ifadeler olur:
 *   "Net donem kari: 1.234.567.890 TL"
 *   "Hasilat: 5,2 milyar TL"
 *
 * Cogu bildirimde bu rakamlar bulunmaz — bu durumda null doneriz.
 */
function extractFinancialFigures(text: string): {
  revenue: number | null;
  netIncome: number | null;
  totalAssets: number | null;
  totalEquity: number | null;
  totalDebt: number | null;
  operatingProfit: number | null;
  ebitda: number | null;
} {
  const result = {
    revenue: null as number | null,
    netIncome: null as number | null,
    totalAssets: null as number | null,
    totalEquity: null as number | null,
    totalDebt: null as number | null,
    operatingProfit: null as number | null,
    ebitda: null as number | null,
  };

  // "Hasilat" / "Net satis" / "Gelir" -> revenue
  result.revenue = matchTurkishFinancialValue(
    text,
    /(?:has[ıi]lat|net\s+sat[ıi][sş](?:lar)?|gelir)\s*[:=]?\s*/i,
  );

  // "Net kar" / "Net donem kari" -> netIncome
  result.netIncome = matchTurkishFinancialValue(
    text,
    /(?:net\s+(?:d[oö]nem\s+)?k[aâ]r[ıi]?|net\s+gelir)\s*[:=]?\s*/i,
  );

  // "Toplam varlik" / "Aktif toplami" -> totalAssets
  result.totalAssets = matchTurkishFinancialValue(
    text,
    /(?:toplam\s+varl[ıi]k(?:lar)?|aktif\s+toplam[ıi]?)\s*[:=]?\s*/i,
  );

  // "Ozkaynak" / "Ozsermeye" -> totalEquity
  result.totalEquity = matchTurkishFinancialValue(
    text,
    /(?:[oö]z(?:\s*)?kaynak(?:lar)?|[oö]z(?:\s*)?sermaye)\s*[:=]?\s*/i,
  );

  // "Toplam borc" / "Finansal borclar" -> totalDebt
  result.totalDebt = matchTurkishFinancialValue(
    text,
    /(?:toplam\s+bor[cç](?:lar)?|finansal\s+bor[cç](?:lar)?)\s*[:=]?\s*/i,
  );

  // "Faaliyet kari" / "Esas faaliyet kari" -> operatingProfit
  result.operatingProfit = matchTurkishFinancialValue(
    text,
    /(?:(?:esas\s+)?faaliyet\s+k[aâ]r[ıi]?)\s*[:=]?\s*/i,
  );

  // "FAVOK" / "EBITDA" -> ebitda
  result.ebitda = matchTurkishFinancialValue(
    text,
    /(?:fav[oö]k|ebitda)\s*[:=]?\s*/i,
  );

  return result;
}

/**
 * Turkce finansal ifadelerden rakam cikarir.
 * Desteklenen formatlar:
 *   "1.234.567.890"       -> 1234567890
 *   "1.234.567.890 TL"    -> 1234567890
 *   "5,2 milyar"          -> 5200000000
 *   "123,45 milyon"       -> 123450000
 *   "1,5 trilyon"         -> 1500000000000
 */
function matchTurkishFinancialValue(
  text: string,
  labelPattern: RegExp,
): number | null {
  // Etiket + rakami yakala
  const combined = new RegExp(
    labelPattern.source +
      // Rakam kismi: ya Turkce binlik ayracli ya da ondalikli + carpan
      String.raw`([\d.,]+)\s*(?:(trilyon|milyar|milyon|bin))?\s*(?:TL|tl)?`,
    "i",
  );

  const match = text.match(combined);
  if (!match) return null;

  const rawNumber = match[1];
  const multiplierWord = match[2]?.toLowerCase();

  // Turkce formatli sayiyi parse et
  // "1.234.567,89" -> 1234567.89
  let numStr = rawNumber.replace(/\./g, "").replace(",", ".");
  const value = parseFloat(numStr);
  if (isNaN(value)) return null;

  const multiplier = getMultiplier(multiplierWord);
  return Math.round(value * multiplier);
}

function getMultiplier(word?: string): number {
  switch (word) {
    case "trilyon":
      return 1_000_000_000_000;
    case "milyar":
      return 1_000_000_000;
    case "milyon":
      return 1_000_000;
    case "bin":
      return 1_000;
    default:
      return 1;
  }
}
