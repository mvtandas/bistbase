import Parser from "rss-parser";

const parser = new Parser();

const GOOGLE_NEWS_RSS = "https://news.google.com/rss/search";
const KAP_API_BASE = "https://www.kap.org.tr/tr/api";

// Ana Plan: Google News RSS (güvenilir, her zaman çalışır)
async function getGoogleNews(stockCode: string): Promise<string[]> {
  try {
    const query = encodeURIComponent(`${stockCode} borsa hisse`);
    const url = `${GOOGLE_NEWS_RSS}?q=${query}&hl=tr&gl=TR&ceid=TR:tr`;
    const feed = await parser.parseURL(url);
    return feed.items.slice(0, 5).map((item) => item.title ?? "");
  } catch (error) {
    console.error(`Google News error for ${stockCode}:`, error);
    return [];
  }
}

// B Planı: KAP JSON API (site değiştiğinde tekrar denenebilir)
async function getKapDisclosures(stockCode: string): Promise<string[]> {
  try {
    const res = await fetch(
      `${KAP_API_BASE}/memberDisclosureQuery`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Referer: "https://www.kap.org.tr/tr/bildirim-sorgu",
          Accept: "application/json",
        },
        body: JSON.stringify({
          fromDate: getDateDaysAgo(3),
          toDate: getTodayStr(),
          stockCode: stockCode,
          disclosureClass: "FF",
        }),
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!res.ok) return [];

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data
      .slice(0, 5)
      .map((d: Record<string, unknown>) => (d.title as string) ?? "");
  } catch {
    return [];
  }
}

// KAP önce, başarısızsa Google News
export async function getStockNews(stockCode: string): Promise<string[]> {
  // KAP'ı dene
  const kapNews = await getKapDisclosures(stockCode);
  if (kapNews.length > 0) return kapNews;

  // Fallback: Google News
  return getGoogleNews(stockCode);
}

function getTodayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function getDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}
