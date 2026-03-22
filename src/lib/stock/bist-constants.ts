/**
 * BIST (Borsa İstanbul) Gerçek İşlem Parametreleri
 * Backtesting simülasyonunda kullanılacak sabitler
 */

// ═══════════════════════════════════════
// KOMİSYON & VERGİ
// ═══════════════════════════════════════

/** Komisyon oranı — büyük banka aracı kurumları ortalaması (~1.88 binde) */
export const COMMISSION_RATE = 0.00188;

/** BSMV (Banka ve Sigorta Muameleleri Vergisi) — komisyon üzerine %5 */
export const BSMV_RATE = 0.05;

/** Efektif maliyet (tek yön) = komisyon × (1 + BSMV) ≈ %0.1974 */
export const EFFECTIVE_COST_PER_SIDE = COMMISSION_RATE * (1 + BSMV_RATE);

/** Round-trip maliyet (alış + satış) ≈ %0.395 */
export const ROUND_TRIP_COST = EFFECTIVE_COST_PER_SIDE * 2;

/** Temettü stopaj oranı: %10 */
export const DIVIDEND_TAX_RATE = 0.10;

// ═══════════════════════════════════════
// İŞLEM KURALLARI
// ═══════════════════════════════════════

/** Günlük fiyat limiti (tavan/taban): ±%10 */
export const DAILY_PRICE_LIMIT = 0.10;

/** Minimum lot: 1 adet hisse */
export const MIN_LOT = 1;

/** Takas süresi: T+2 iş günü */
export const SETTLEMENT_DAYS = 2;

/** Tek hissede maksimum portföy ağırlığı */
export const MAX_POSITION_WEIGHT = 0.25;

// ═══════════════════════════════════════
// FİYAT ADIMLARI (Tick Size)
// ═══════════════════════════════════════

/** [eşik fiyat, adım büyüklüğü] — BİST Kasım 2023 tablosu */
const TICK_SIZES: [number, number][] = [
  [1000, 1.00],   // 1000+ TL
  [500,  0.50],   // 500-999.99 TL
  [250,  0.25],   // 250-499.99 TL
  [100,  0.10],   // 100-249.99 TL
  [50,   0.05],   // 50-99.99 TL
  [20,   0.02],   // 20-49.99 TL
  [0,    0.01],   // 0-19.99 TL
];

/** Verilen fiyata göre minimum fiyat adımını döndür */
export function getTickSize(price: number): number {
  for (const [threshold, tick] of TICK_SIZES) {
    if (price >= threshold) return tick;
  }
  return 0.01;
}

/** Fiyatı en yakın geçerli tick'e yuvarla */
export function roundToTick(price: number): number {
  const tick = getTickSize(price);
  return Math.round(price / tick) * tick;
}

/** İşlem tutarı üzerinden komisyon + BSMV hesapla (TL) */
export function calculateCommission(tradeValue: number): number {
  return tradeValue * EFFECTIVE_COST_PER_SIDE;
}

/** Verilen sermaye ve fiyatla alınabilecek tam lot sayısı (komisyon düşülmüş) */
export function calculateLots(capital: number, price: number): number {
  const netCapital = capital / (1 + EFFECTIVE_COST_PER_SIDE);
  return Math.floor(netCapital / price);
}

/** Fiyat değişiminin tavan/taban limiti içinde olup olmadığını kontrol et */
export function isWithinPriceLimit(oldPrice: number, newPrice: number): boolean {
  const changeRatio = Math.abs((newPrice - oldPrice) / oldPrice);
  return changeRatio <= DAILY_PRICE_LIMIT;
}

/** Fiyatı tavan/taban limitine sınırla */
export function clampToLimit(basePrice: number, targetPrice: number): number {
  const upper = basePrice * (1 + DAILY_PRICE_LIMIT);
  const lower = basePrice * (1 - DAILY_PRICE_LIMIT);
  return Math.max(lower, Math.min(upper, targetPrice));
}
