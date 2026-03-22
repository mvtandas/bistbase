import { cacheGet, cacheSet } from "@/lib/redis";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InsiderTransaction {
  stockCode: string;
  personName: string;
  personTitle: string;
  transactionType: "BUY" | "SELL";
  amount: number;
  price: number;
  date: string;
}

export interface InsiderSummary {
  stockCode: string;
  recentBuys: number; // Last 30 days buy count
  recentSells: number; // Last 30 days sell count
  netDirection: "NET_BUY" | "NET_SELL" | "NEUTRAL";
  signalStrength: number; // 0-10
  lastTransaction: InsiderTransaction | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KAP_API_BASE = "https://www.kap.org.tr/tr/api";
const CACHE_TTL = 6 * 60 * 60; // 6 hours in seconds

const KAP_HEADERS = {
  "Content-Type": "application/json",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Referer: "https://www.kap.org.tr/tr/bildirim-sorgu",
  Accept: "application/json",
} as const;

// Keywords used to identify insider transaction disclosures on KAP
const INSIDER_KEYWORDS = [
  "İçeriden Öğrenen",
  "Yönetici İşlemleri",
  "Pay Alım",
  "Pay Satım",
  "Yönetim Kurulu Üyesi",
  "Genel Müdür",
];

const BUY_KEYWORDS = ["alım", "alış", "alma", "buy"];
const SELL_KEYWORDS = ["satım", "satış", "sell"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTodayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function getDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

function neutralSummary(stockCode: string): InsiderSummary {
  return {
    stockCode,
    recentBuys: 0,
    recentSells: 0,
    netDirection: "NEUTRAL",
    signalStrength: 0,
    lastTransaction: null,
  };
}

/**
 * Determine transaction type from disclosure title / summary text.
 */
function detectTransactionType(text: string): "BUY" | "SELL" | null {
  const lower = text.toLocaleLowerCase("tr-TR");
  if (BUY_KEYWORDS.some((kw) => lower.includes(kw))) return "BUY";
  if (SELL_KEYWORDS.some((kw) => lower.includes(kw))) return "SELL";
  return null;
}

/**
 * Check if a disclosure title relates to insider transactions.
 */
function isInsiderDisclosure(title: string): boolean {
  const lower = title.toLocaleLowerCase("tr-TR");
  return INSIDER_KEYWORDS.some((kw) => lower.includes(kw.toLocaleLowerCase("tr-TR")));
}

/**
 * Parse a single KAP disclosure record into an InsiderTransaction (best-effort).
 */
function parseDisclosure(
  stockCode: string,
  record: Record<string, unknown>,
): InsiderTransaction | null {
  const title = (record.title as string) ?? (record.disclosureTitle as string) ?? "";
  if (!isInsiderDisclosure(title)) return null;

  const txType = detectTransactionType(title);
  if (!txType) return null;

  // Extract what we can — KAP responses vary in structure
  const personName =
    (record.notifierName as string) ??
    (record.relatedPerson as string) ??
    "Bilinmiyor";
  const personTitle =
    (record.notifierTitle as string) ??
    (record.position as string) ??
    "Yönetici";
  const amount = Number(record.amount ?? record.quantity ?? 0);
  const price = Number(record.price ?? record.unitPrice ?? 0);
  const date =
    (record.publishDate as string) ??
    (record.disclosureDate as string) ??
    getTodayStr();

  return {
    stockCode,
    personName,
    personTitle,
    transactionType: txType,
    amount,
    price,
    date,
  };
}

/**
 * Calculate signal strength (0–10) from parsed insider transactions.
 *
 * Logic:
 *  - Base score from net buy/sell count ratio (max 8 from count alone)
 *  - Large transactions (amount > median) get extra weight
 *  - Capped at 10
 */
function calculateSignalStrength(transactions: InsiderTransaction[]): number {
  if (transactions.length === 0) return 0;

  const buys = transactions.filter((t) => t.transactionType === "BUY");
  const sells = transactions.filter((t) => t.transactionType === "SELL");

  const buyCount = buys.length;
  const sellCount = sells.length;
  const total = buyCount + sellCount;
  if (total === 0) return 0;

  // Ratio-based score: how dominant is the majority direction (0–8)
  const dominantCount = Math.max(buyCount, sellCount);
  const ratioScore = (dominantCount / total) * 8;

  // Volume bonus: sum of amounts on the dominant side vs total (0–2)
  const buyVolume = buys.reduce((s, t) => s + t.amount, 0);
  const sellVolume = sells.reduce((s, t) => s + t.amount, 0);
  const totalVolume = buyVolume + sellVolume;

  let volumeBonus = 0;
  if (totalVolume > 0) {
    const dominantVolume = buyCount >= sellCount ? buyVolume : sellVolume;
    volumeBonus = (dominantVolume / totalVolume) * 2;
  }

  return Math.min(10, Math.round(ratioScore + volumeBonus));
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Fetch insider transaction summary for a given stock from KAP.
 * Results are cached in Redis for 6 hours.
 */
export async function getInsiderSummary(
  stockCode: string,
): Promise<InsiderSummary> {
  const cacheKey = `insider:${stockCode}`;

  // 1. Try cache
  const cached = await cacheGet<InsiderSummary>(cacheKey);
  if (cached) return cached;

  // 2. Fetch from KAP
  let transactions: InsiderTransaction[] = [];

  try {
    const res = await fetch(`${KAP_API_BASE}/memberDisclosureQuery`, {
      method: "POST",
      headers: KAP_HEADERS,
      body: JSON.stringify({
        fromDate: getDateDaysAgo(30),
        toDate: getTodayStr(),
        stockCode,
        // ODA = Özel Durum Açıklaması — broad class that includes insider tx
        disclosureClass: "ODA",
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        for (const record of data) {
          const tx = parseDisclosure(stockCode, record as Record<string, unknown>);
          if (tx) transactions.push(tx);
        }
      }
    }
  } catch (err) {
    console.error(`[insider-tracking] KAP fetch failed for ${stockCode}:`, err);
    // Fall through — we will return a neutral summary
  }

  // 3. Build summary
  if (transactions.length === 0) {
    const summary = neutralSummary(stockCode);
    await cacheSet(cacheKey, summary, CACHE_TTL);
    return summary;
  }

  // Sort by date descending
  transactions.sort((a, b) => b.date.localeCompare(a.date));

  const recentBuys = transactions.filter((t) => t.transactionType === "BUY").length;
  const recentSells = transactions.filter((t) => t.transactionType === "SELL").length;

  const netDirection: InsiderSummary["netDirection"] =
    recentBuys > recentSells
      ? "NET_BUY"
      : recentSells > recentBuys
        ? "NET_SELL"
        : "NEUTRAL";

  const signalStrength = calculateSignalStrength(transactions);

  const summary: InsiderSummary = {
    stockCode,
    recentBuys,
    recentSells,
    netDirection,
    signalStrength,
    lastTransaction: transactions[0] ?? null,
  };

  await cacheSet(cacheKey, summary, CACHE_TTL);
  return summary;
}
