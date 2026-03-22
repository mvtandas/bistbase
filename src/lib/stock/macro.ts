/**
 * Bistbase Macro Layer
 * Makroekonomik veriler — piyasa rüzgarı
 */

import YahooFinance from "yahoo-finance2";
import { cacheGet, cacheSet } from "@/lib/redis";
import { getTCMBData, type TCMBData } from "@/lib/data/tcmb";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = new (YahooFinance as any)({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

export interface MacroData {
  // Döviz
  usdTry: number | null;
  usdTryChange: number | null;
  eurTry: number | null;
  eurTryChange: number | null;

  // Global
  dxy: number | null;        // Dolar Endeksi
  dxyChange: number | null;

  // BİST 100
  bist100: number | null;
  bist100Change: number | null;

  // Altın
  goldUsd: number | null;
  goldUsdChange: number | null;

  // TCMB Verileri (US 10Y proxy yerine gerçek Türk verileri)
  turkey10Y: number | null;     // Geriye uyumluluk: artık TCMB politika faizi
  turkey10YChange: number | null;

  // TCMB Detay
  tcmbPolicyRate: number | null;   // TCMB politika faizi (%)
  tcmbInflation: number | null;    // TÜFE yıllık enflasyon (%)
  tcmbRealRate: number | null;     // Reel faiz (politika faizi - enflasyon)
  tcmbReserves: number | null;     // Brüt döviz rezervi (milyar $)

  // VIX — Küresel korku endeksi
  vix: number | null;
  vixChange: number | null;

  // Makro skor
  macroScore: number;  // 0-100
  macroLabel: string;
}

const MACRO_SYMBOLS = {
  usdTry: "USDTRY=X",
  eurTry: "EURTRY=X",
  dxy: "DX-Y.NYB",
  bist100: "XU100.IS",
  goldUsd: "GC=F",
  turkey10Y: "^TNX",  // US 10Y proxy (TR 10Y yok Yahoo'da, US 10Y EM'leri etkiler)
  vix: "^VIX",        // Korku endeksi — yükselirse EM'lerden para çıkar
};

// Cache — günde 1 kez
let macroCache: { data: MacroData; fetchedAt: number } | null = null;

async function fetchQuote(symbol: string): Promise<{
  price: number | null;
  changePercent: number | null;
}> {
  try {
    const q = await yf.quote(symbol);
    return {
      price: q?.regularMarketPrice ?? null,
      changePercent: q?.regularMarketChangePercent ?? null,
    };
  } catch {
    return { price: null, changePercent: null };
  }
}

export async function getMacroData(): Promise<MacroData> {
  // Redis cache first (1 hour TTL)
  const redisCached = await cacheGet<MacroData>("macro:data");
  if (redisCached) return redisCached;

  // In-memory fallback
  if (macroCache && Date.now() - macroCache.fetchedAt < 3600_000) {
    return macroCache.data;
  }

  const [usdTry, eurTry, dxy, bist100, gold, turkey10Y, vix, tcmb] = await Promise.all([
    fetchQuote(MACRO_SYMBOLS.usdTry),
    fetchQuote(MACRO_SYMBOLS.eurTry),
    fetchQuote(MACRO_SYMBOLS.dxy),
    fetchQuote(MACRO_SYMBOLS.bist100),
    fetchQuote(MACRO_SYMBOLS.goldUsd),
    fetchQuote(MACRO_SYMBOLS.turkey10Y),
    fetchQuote(MACRO_SYMBOLS.vix),
    getTCMBData(),
  ]);

  // Makro skor hesaplama (0-100)
  // Gürültü azaltma: mutlak seviyeler + yönsel değişim birlikte değerlendirilir
  let score = 50;

  // ── TL Gücü (ağırlık: yüksek) ──
  // Hem yön hem hız önemli
  if (usdTry.changePercent != null) {
    if (usdTry.changePercent < -1) score += 12;       // TL sert güçleniyor
    else if (usdTry.changePercent < -0.3) score += 6;  // TL hafif güçleniyor
    else if (usdTry.changePercent > 2) score -= 18;    // TL çöküşü — kriz sinyali
    else if (usdTry.changePercent > 1) score -= 12;    // TL sert zayıflıyor
    else if (usdTry.changePercent > 0.5) score -= 5;   // TL hafif zayıflıyor
    // -0.3 ile +0.5 arası = normal gürültü, skor değişmez
  }

  // ── DXY — Dolar Endeksi (EM'ler için ters ilişki — ağırlık artırıldı) ──
  if (dxy.changePercent != null) {
    if (dxy.changePercent < -0.8) score += 12;  // Dolar sert zayıflıyor = EM'lere çok iyi
    else if (dxy.changePercent < -0.5) score += 8;
    else if (dxy.changePercent < -0.2) score += 4;
    else if (dxy.changePercent > 1.5) score -= 25; // Dolar sert güçleniyor = EM çıkışları
    else if (dxy.changePercent > 0.8) score -= 15;
    else if (dxy.changePercent > 0.3) score -= 7;
  }

  // ── BİST 100 — Piyasa Momentum ──
  if (bist100.changePercent != null) {
    if (bist100.changePercent > 2) score += 12;
    else if (bist100.changePercent > 1) score += 8;
    else if (bist100.changePercent > 0) score += 3;
    else if (bist100.changePercent < -2) score -= 12;
    else if (bist100.changePercent < -1) score -= 8;
    else if (bist100.changePercent < 0) score -= 3;
  }

  // ── VIX — Korku Endeksi (seviye + yön birlikte) ──
  if (vix.price != null) {
    const vixFalling = vix.changePercent != null && vix.changePercent < -3;
    const vixRising = vix.changePercent != null && vix.changePercent > 5;

    // Seviye bazlı (asıl sinyal) — yön ile modifiye edilir
    if (vix.price < 13) score += 10;
    else if (vix.price < 18) score += 5;
    else if (vix.price > 35) {
      // VIX 35+ ama düşüyorsa → panik azalıyor, cezayı hafiflet
      score -= vixFalling ? 8 : 15;
    }
    else if (vix.price > 28) {
      score -= vixFalling ? 5 : 10;
    }
    else if (vix.price > 22) {
      score -= vixFalling ? 0 : 3;
    }

    // Yön bazlı (ani değişim sinyali)
    if (vix.changePercent != null) {
      if (vix.changePercent > 20) score -= 8;     // VIX spike = ani panik
      else if (vixRising) score -= 3;
      else if (vix.changePercent < -15) score += 5; // VIX çöküşü = güçlü rahatlama
      else if (vixFalling) score += 2;
    }
  }

  // ── TCMB Reel Faiz (US 10Y proxy YERİNE gerçek Türk verileri) ──
  // Pozitif reel faiz = TL'ye güven = hisse için olumlu (yabancı girişi)
  // Negatif reel faiz = TL'den kaçış = hisse için olumsuz
  if (tcmb.realRate != null) {
    if (tcmb.realRate > 15) score += 10;       // Çok yüksek reel faiz = TL çekici
    else if (tcmb.realRate > 5) score += 6;    // Pozitif reel faiz = olumlu
    else if (tcmb.realRate > 0) score += 2;    // Hafif pozitif
    else if (tcmb.realRate < -10) score -= 10; // Derin negatif reel = TL krizi
    else if (tcmb.realRate < -5) score -= 6;   // Negatif reel
    else if (tcmb.realRate < 0) score -= 2;    // Hafif negatif
  }

  // Döviz rezervi değişimi (varsa)
  if (tcmb.reserves != null && tcmb.reserves < 70) {
    score -= 5; // Düşük rezerv = kırılganlık
  }

  // US 10Y — artık sadece küçük EM sentiment göstergesi (ağırlığı çok düşürüldü)
  if (turkey10Y.price != null) {
    if (turkey10Y.price > 5) score -= 2;
    else if (turkey10Y.price < 3.5) score += 2;
  }

  // ── Altın — Güvenli liman talebi (yükseliyorsa risk algısı artıyor) ──
  if (gold.changePercent != null) {
    if (gold.changePercent > 2) score -= 3;  // Riskten kaçış
    else if (gold.changePercent < -1) score += 2; // Risk iştahı
  }

  score = Math.max(0, Math.min(100, score));

  const macroLabel =
    score >= 65 ? "Olumlu Makro Ortam" :
    score >= 45 ? "Nötr Makro Ortam" :
    "Olumsuz Makro Ortam";

  const data: MacroData = {
    usdTry: usdTry.price,
    usdTryChange: usdTry.changePercent,
    eurTry: eurTry.price,
    eurTryChange: eurTry.changePercent,
    dxy: dxy.price,
    dxyChange: dxy.changePercent,
    bist100: bist100.price,
    bist100Change: bist100.changePercent,
    goldUsd: gold.price,
    goldUsdChange: gold.changePercent,
    // Geriye uyumluluk: turkey10Y artık TCMB politika faizini gösteriyor
    turkey10Y: tcmb.policyRate ?? turkey10Y.price,
    turkey10YChange: turkey10Y.changePercent,
    // TCMB detay verileri (tcmb.ts'den)
    tcmbPolicyRate: tcmb.policyRate ?? null,
    tcmbInflation: tcmb.inflation ?? null,
    tcmbRealRate: tcmb.realRate ?? null,
    tcmbReserves: tcmb.reserves ?? null,
    vix: vix.price,
    vixChange: vix.changePercent,
    macroScore: score,
    macroLabel,
  };

  macroCache = { data, fetchedAt: Date.now() };
  await cacheSet("macro:data", data, 3600); // 1 hour
  return data;
}
