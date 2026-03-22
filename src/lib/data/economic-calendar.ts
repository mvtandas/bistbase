/**
 * Ekonomik Takvim — Türkiye'ye özel önemli tarihler
 * TCMB faiz kararları, TÜFE açıklamaları, bilanço sezonları
 */

export interface EconomicEvent {
  date: string; // YYYY-MM-DD
  title: string; // Türkçe başlık
  type:
    | "TCMB_FAIZ"
    | "TUFE"
    | "UFE"
    | "GSYİH"
    | "BILANCO"
    | "TEMETTÜ"
    | "OTHER";
  importance: "HIGH" | "MEDIUM" | "LOW";
  expectedImpact: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "UNCERTAIN";
  description: string;
}

export interface UpcomingEvents {
  events: EconomicEvent[];
  nextCritical: EconomicEvent | null; // En yakın yüksek önemli event
  daysToNextCritical: number | null;
  volatilityWarning: boolean; // Yaklaşan event volatilite yaratabilir
}

// ---------------------------------------------------------------------------
// 2026 Statik Takvim Verileri
// ---------------------------------------------------------------------------

/** TCMB Para Politikası Kurulu faiz kararı tarihleri (2026) */
const TCMB_FAIZ_TARIHLERI_2026 = [
  "2026-01-23",
  "2026-02-20",
  "2026-03-20",
  "2026-04-17",
  "2026-05-22",
  "2026-06-19",
  "2026-07-17",
  "2026-08-21",
  "2026-09-18",
  "2026-10-16",
  "2026-11-20",
  "2026-12-18",
] as const;

/** TÜFE (Tüketici Fiyat Endeksi) açıklama tarihleri — her ayın 3'ü */
const TUFE_TARIHLERI_2026 = [
  "2026-01-03",
  "2026-02-03",
  "2026-03-03",
  "2026-04-03",
  "2026-05-03",
  "2026-06-03",
  "2026-07-03",
  "2026-08-03",
  "2026-09-03",
  "2026-10-03",
  "2026-11-03",
  "2026-12-03",
] as const;

function buildStaticEvents(): EconomicEvent[] {
  const events: EconomicEvent[] = [];

  for (const date of TCMB_FAIZ_TARIHLERI_2026) {
    events.push({
      date,
      title: "TCMB Faiz Kararı",
      type: "TCMB_FAIZ",
      importance: "HIGH",
      expectedImpact: "UNCERTAIN",
      description:
        "Merkez Bankası Para Politikası Kurulu faiz kararı açıklaması. Piyasalarda yüksek volatilite beklenir.",
    });
  }

  for (const date of TUFE_TARIHLERI_2026) {
    events.push({
      date,
      title: "TÜFE Verisi Açıklaması",
      type: "TUFE",
      importance: "HIGH",
      expectedImpact: "UNCERTAIN",
      description:
        "TÜİK aylık tüketici fiyat endeksi açıklaması. Enflasyon beklentilerini doğrudan etkiler.",
    });
  }

  return events;
}

const ALL_EVENTS = buildStaticEvents();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Belirtilen gün sayısı içindeki yaklaşan ekonomik olayları döndürür.
 *
 * @param daysAhead - Kaç gün ileriye bakılacağı (varsayılan 7)
 */
export function getUpcomingEvents(daysAhead = 7): UpcomingEvents {
  const now = new Date();
  // Saat/dakika farkını yok saymak için gün başına normalize et
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const horizonMs = daysAhead * 24 * 60 * 60 * 1000;
  const thresholdDate = new Date(today.getTime() + horizonMs);

  // Belirtilen pencere içindeki eventleri filtrele
  const upcoming = ALL_EVENTS.filter((ev) => {
    const evDate = parseDate(ev.date);
    return evDate >= today && evDate <= thresholdDate;
  }).sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime());

  // En yakın HIGH importance event
  const nextCritical =
    upcoming.find((ev) => ev.importance === "HIGH") ?? null;

  let daysToNextCritical: number | null = null;
  if (nextCritical) {
    const diff = parseDate(nextCritical.date).getTime() - today.getTime();
    daysToNextCritical = Math.round(diff / (24 * 60 * 60 * 1000));
  }

  // 3 gün içinde HIGH importance event varsa volatilite uyarısı
  const threeDay = 3 * 24 * 60 * 60 * 1000;
  const volatilityWarning = ALL_EVENTS.some((ev) => {
    if (ev.importance !== "HIGH") return false;
    const evDate = parseDate(ev.date);
    const diff = evDate.getTime() - today.getTime();
    return diff >= 0 && diff <= threeDay;
  });

  return {
    events: upcoming,
    nextCritical,
    daysToNextCritical,
    volatilityWarning,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}
