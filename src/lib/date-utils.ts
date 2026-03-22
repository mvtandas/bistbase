/**
 * Timezone-safe tarih yardımcıları
 * BİST borsa saatlerine göre her zaman İstanbul timezone'u kullanır.
 * PostgreSQL DATE kolonları + pg driver timezone kayması sorununu çözer.
 */

/** İstanbul timezone'unda bugünün UTC gece yarısını döner */
export function getIstanbulToday(): Date {
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // "2026-03-23"
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** İstanbul timezone'unda dünün UTC gece yarısını döner */
export function getIstanbulYesterday(): Date {
  const d = getIstanbulToday();
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

/** Verilen bir Date'i İstanbul timezone'unda gün başlangıcına normalize eder */
export function toIstanbulDateUTC(date: Date): Date {
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Bir günlük range query için { gte, lt } döner.
 * PostgreSQL DATE kolonu + timezone kaymasına karşı güvenli.
 */
export function dayRange(day: Date) {
  const next = new Date(day);
  next.setUTCDate(next.getUTCDate() + 1);
  return { gte: day, lt: next };
}
