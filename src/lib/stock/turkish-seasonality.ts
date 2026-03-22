/**
 * Türkiye'ye Özel Mevsimsellik Etkileri
 * Akademik literatürde belgelenmiş anomaliler
 */

export interface TurkishSeasonalityData {
  dayOfWeek: { name: string; effect: "POSITIVE" | "NEGATIVE" | "NEUTRAL"; description: string };
  monthEffect: { name: string; effect: "POSITIVE" | "NEGATIVE" | "NEUTRAL"; description: string };
  specialPeriod: string | null;  // "RAMAZAN", "YILSONU", "BILANÇO_SEZONU", "VERGİ_DÖNEMİ", null
  specialPeriodEffect: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | null;
  tcmbDecisionProximity: boolean;  // TCMB faiz kararı yakın mı (±3 gün)
  overallBias: "BULLISH" | "BEARISH" | "NEUTRAL";
  description: string;
}

export function calculateTurkishSeasonality(date?: Date): TurkishSeasonalityData {
  const d = date ?? new Date();
  const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon...
  const month = d.getMonth();   // 0=Jan
  const dayOfMonth = d.getDate();

  // Day of week effects (BİST akademik çalışmalar)
  // Monday effect: Pazartesi negatif, Cuma pozitif
  const dayEffects = [
    { name: "Pazar", effect: "NEUTRAL" as const, description: "Borsa kapalı" },
    { name: "Pazartesi", effect: "NEGATIVE" as const, description: "Pazartesi etkisi: Hafta sonu belirsizliği sonrası satış baskısı" },
    { name: "Salı", effect: "NEUTRAL" as const, description: "Genelde nötr gün" },
    { name: "Çarşamba", effect: "NEUTRAL" as const, description: "Hafta ortası, nötr" },
    { name: "Perşembe", effect: "NEUTRAL" as const, description: "Genelde nötr" },
    { name: "Cuma", effect: "POSITIVE" as const, description: "Cuma rallisi: Hafta sonu öncesi alım eğilimi" },
    { name: "Cumartesi", effect: "NEUTRAL" as const, description: "Borsa kapalı" },
  ];

  // Month effects (Ocak etkisi, yaz durgunluğu, yılsonu rallisi)
  const monthEffects = [
    { name: "Ocak", effect: "POSITIVE" as const, description: "Ocak etkisi: Yeni yıl alımları, portföy yenileme" },
    { name: "Şubat", effect: "NEUTRAL" as const, description: "Nötr dönem" },
    { name: "Mart", effect: "NEUTRAL" as const, description: "Q1 bilanço beklentileri" },
    { name: "Nisan", effect: "POSITIVE" as const, description: "Bilanço sezonu: Güçlü şirketlerin sonuçları" },
    { name: "Mayıs", effect: "NEGATIVE" as const, description: "Sell in May: Yaz öncesi kâr realizasyonu" },
    { name: "Haziran", effect: "NEGATIVE" as const, description: "Yaz durgunluğu başlangıcı" },
    { name: "Temmuz", effect: "NEGATIVE" as const, description: "Düşük hacim dönemi" },
    { name: "Ağustos", effect: "NEGATIVE" as const, description: "En düşük hacim, yaz tatili" },
    { name: "Eylül", effect: "NEUTRAL" as const, description: "Piyasa yeniden canlanma" },
    { name: "Ekim", effect: "POSITIVE" as const, description: "Q3 bilanço sezonu, yabancı girişi" },
    { name: "Kasım", effect: "POSITIVE" as const, description: "Yılsonu rallisi hazırlığı" },
    { name: "Aralık", effect: "POSITIVE" as const, description: "Yılsonu rallisi, window dressing" },
  ];

  // Special periods
  let specialPeriod: string | null = null;
  let specialPeriodEffect: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | null = null;

  // Bilanço sezonu (Mart-Nisan, Temmuz-Ağustos, Ekim-Kasım)
  if ((month === 2 && dayOfMonth >= 15) || month === 3) {
    specialPeriod = "BILANÇO_SEZONU";
    specialPeriodEffect = "NEUTRAL";
  } else if ((month === 9 && dayOfMonth >= 15) || month === 10) {
    specialPeriod = "BILANÇO_SEZONU";
    specialPeriodEffect = "NEUTRAL";
  }

  // Yılsonu window dressing (Aralık son 2 hafta)
  if (month === 11 && dayOfMonth >= 15) {
    specialPeriod = "YILSONU";
    specialPeriodEffect = "POSITIVE";
  }

  // Vergi dönemi (Çeyrek sonları)
  if ((month === 2 || month === 5 || month === 8 || month === 11) && dayOfMonth >= 25) {
    specialPeriod = "VERGİ_DÖNEMİ";
    specialPeriodEffect = "NEGATIVE";
  }

  // TCMB faiz kararı yakınlığı (her ayın 3. perşembesi civarı)
  // Basit yaklaşım: ayın 18-22'si arası
  const tcmbDecisionProximity = dayOfMonth >= 18 && dayOfMonth <= 22;

  // Overall bias
  const dayEffect = dayEffects[dayOfWeek];
  const monthEffect = monthEffects[month];

  const scores = { POSITIVE: 1, NEGATIVE: -1, NEUTRAL: 0 };
  const total = scores[dayEffect.effect] + scores[monthEffect.effect] + (specialPeriodEffect ? scores[specialPeriodEffect] : 0);
  const overallBias = total > 0 ? "BULLISH" as const : total < 0 ? "BEARISH" as const : "NEUTRAL" as const;

  const parts: string[] = [];
  if (dayEffect.effect !== "NEUTRAL") parts.push(dayEffect.description);
  if (monthEffect.effect !== "NEUTRAL") parts.push(monthEffect.description);
  if (specialPeriod) parts.push(`Özel dönem: ${specialPeriod}`);
  if (tcmbDecisionProximity) parts.push("TCMB faiz kararı yakın — volatilite artabilir");

  return {
    dayOfWeek: dayEffect,
    monthEffect,
    specialPeriod,
    specialPeriodEffect,
    tcmbDecisionProximity,
    overallBias,
    description: parts.length > 0 ? parts.join(". ") + "." : "Mevsimsel etki tespit edilmedi.",
  };
}
