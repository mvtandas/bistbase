/**
 * BIST Endeks Değişikliği Etkisi
 * Endekse giriş/çıkış otomatik alım/satım baskısı yaratır (ETF + endeks fonları)
 */

import { cacheGet, cacheSet } from "@/lib/redis";
import { BIST30, BIST50, BIST100 } from "@/lib/constants";

export interface IndexInclusionData {
  stockCode: string;
  currentIndices: string[];        // ["BIST30", "BIST50", "BIST100"]
  recentChange: {
    type: "INCLUSION" | "EXCLUSION";
    index: string;
    date: string;
  } | null;
  effect: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  description: string;
}

const CACHE_KEY_PREFIX = "index-inclusion";
const CACHE_TTL = 60 * 60 * 24; // 24 hours — index lists rarely change

/**
 * Hissenin hangi BIST endekslerinde yer aldığını döndürür.
 * Endeks üyeliği, ETF ve endeks fonlarının otomatik alım/satım
 * baskısı nedeniyle fiyat üzerinde etkili olabilir.
 */
export async function getIndexInclusionData(stockCode: string): Promise<IndexInclusionData> {
  const upperCode = stockCode.toUpperCase();
  const cacheKey = `${CACHE_KEY_PREFIX}:${upperCode}`;

  // Try cache first
  const cached = await cacheGet<IndexInclusionData>(cacheKey);
  if (cached) return cached;

  // Determine which indices the stock belongs to
  const currentIndices: string[] = [];

  if (BIST30.includes(upperCode)) {
    currentIndices.push("BIST30");
  }
  if (BIST50.includes(upperCode)) {
    currentIndices.push("BIST50");
  }
  if (BIST100.includes(upperCode)) {
    currentIndices.push("BIST100");
  }

  // No historical index change data available yet
  const recentChange = null;

  // Determine effect based on index membership
  let effect: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  let description: string;

  if (currentIndices.includes("BIST30")) {
    effect = "POSITIVE";
    description =
      `${upperCode}, BIST30 endeksinde yer almaktadır. ` +
      "BIST30 hisseleri en yüksek likiditeye sahiptir ve ETF/endeks fonlarının sürekli alım baskısı altındadır. " +
      "Bu durum fiyat stabilitesini ve kurumsal yatırımcı ilgisini artırır.";
  } else if (currentIndices.includes("BIST50")) {
    effect = "POSITIVE";
    description =
      `${upperCode}, BIST50 endeksinde yer almaktadır. ` +
      "BIST50 hisseleri yüksek likiditeye sahiptir ve endeks fonlarının alım havuzundadır. " +
      "BIST30'a yükselme potansiyeli ek bir katalizör olabilir.";
  } else if (currentIndices.includes("BIST100")) {
    effect = "NEUTRAL";
    description =
      `${upperCode}, BIST100 endeksinde yer almaktadır. ` +
      "BIST100 üyeliği temel bir kurumsal yatırımcı erişimi sağlar. " +
      "BIST50'ye yükselme potansiyeli pozitif bir gelişme olabilir.";
  } else {
    effect = "NEGATIVE";
    description =
      `${upperCode}, ana endekslerde (BIST30/50/100) yer almamaktadır. ` +
      "Endeks dışı hisseler ETF ve endeks fonu alım baskısından yararlanamaz. " +
      "Düşük kurumsal ilgi ve likidite riski söz konusu olabilir.";
  }

  const result: IndexInclusionData = {
    stockCode: upperCode,
    currentIndices,
    recentChange,
    effect,
    description,
  };

  // Cache the result
  await cacheSet(cacheKey, result, CACHE_TTL);

  return result;
}
