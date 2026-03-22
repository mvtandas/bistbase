/**
 * Google Trends Entegrasyonu — Arama İlgisi Takibi
 *
 * Yaklaşım: Google Trends Trending RSS feed'inden Türkiye'deki
 * trending aramalarda hisse adı geçiyor mu kontrol et.
 *
 * Bu yaklaşım güvenilir çünkü:
 * - RSS feed public ve rate limit yok
 * - Trending'de hisse adı geçiyorsa = anormal perakende ilgisi
 * - Unofficial API'ye bağımlılık yok
 */

import { cacheGet, cacheSet } from "@/lib/redis";

export interface SearchInterestData {
  stockCode: string;
  currentInterest: number | null;
  weekAgoInterest: number | null;
  changePercent: number | null;
  isSpike: boolean;
  trend: "RISING" | "FALLING" | "STABLE" | null;
  description: string;
}

const CACHE_TTL = 6 * 60 * 60; // 6 saat
const TRENDING_RSS_URL = "https://trends.google.com/trending/rss?geo=TR";

function neutralResult(stockCode: string): SearchInterestData {
  return {
    stockCode,
    currentInterest: null,
    weekAgoInterest: null,
    changePercent: null,
    isSpike: false,
    trend: null,
    description: "Arama ilgisi verisi şu anda mevcut değil.",
  };
}

export async function getSearchInterest(stockCode: string): Promise<SearchInterestData> {
  const cacheKey = `search-interest:${stockCode}`;
  const cached = await cacheGet<SearchInterestData>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(TRENDING_RSS_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Bistbase/1.0)" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const neutral = neutralResult(stockCode);
      await cacheSet(cacheKey, neutral, CACHE_TTL);
      return neutral;
    }

    const xml = await res.text();

    // Hisse kodu veya adı trending'de geçiyor mu?
    const code = stockCode.toUpperCase();
    const isInTrending = xml.includes(code) || xml.includes(`${code} hisse`) || xml.includes(`${code} borsa`);

    // Traffic hacmini çek (varsa)
    let traffic = 0;
    if (isInTrending) {
      const trafficMatch = xml.match(new RegExp(`${code}[\\s\\S]*?<ht:approx_traffic>(\\d+)`));
      traffic = trafficMatch ? parseInt(trafficMatch[1], 10) : 100;
    }

    // Trending'de varsa = spike (anormal ilgi)
    const result: SearchInterestData = {
      stockCode,
      currentInterest: isInTrending ? Math.min(100, 50 + Math.round(traffic / 10)) : 30,
      weekAgoInterest: 30, // baseline
      changePercent: isInTrending ? Math.round((traffic / 30) * 100) / 100 : 0,
      isSpike: isInTrending,
      trend: isInTrending ? "RISING" : "STABLE",
      description: isInTrending
        ? `${stockCode} Google Türkiye trending aramalarında! Perakende yatırımcı ilgisi yüksek — FOMO riski.`
        : `${stockCode} için arama ilgisi normal seviyede.`,
    };

    await cacheSet(cacheKey, result, CACHE_TTL);
    return result;
  } catch (e) {
    console.warn("[search-interest] Trends RSS fetch failed:", (e as Error).message);
    const neutral = neutralResult(stockCode);
    await cacheSet(cacheKey, neutral, CACHE_TTL);
    return neutral;
  }
}
