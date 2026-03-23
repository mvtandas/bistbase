/**
 * BIST Market Hours Helper
 * Piyasa saatine göre dinamik cache TTL ve market state tespiti.
 * BIST sürekli işlem: 10:00-18:00 İstanbul, Pazartesi-Cuma.
 */

interface MarketState {
  isOpen: boolean;
  isWeekend: boolean;
  istanbulHour: number;
  istanbulDay: number; // 0=Sun, 6=Sat
}

/** İstanbul timezone'unda mevcut piyasa durumunu döner */
export function getMarketState(): MarketState {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Istanbul",
    hour: "numeric",
    hour12: false,
    weekday: "short",
  }).formatToParts(now);

  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";
  const dayStr = parts.find((p) => p.type === "weekday")?.value ?? "";

  const hour = parseInt(hourStr, 10);
  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const day = dayMap[dayStr] ?? 0;
  const isWeekend = day === 0 || day === 6;
  const isOpen = !isWeekend && hour >= 10 && hour < 18;

  return { isOpen, isWeekend, istanbulHour: hour, istanbulDay: day };
}

/** Piyasa saatine göre quote cache TTL (saniye) */
export function getQuoteTTL(): number {
  const { isOpen, isWeekend } = getMarketState();
  if (isOpen) return 30;        // Piyasa açık: 30 saniye
  if (isWeekend) return 3600;   // Hafta sonu: 1 saat
  return 1800;                  // Piyasa kapalı (hafta içi): 30 dakika
}

/** Piyasa saatine göre günlük bar cache TTL (saniye) */
export function getBarsTTL(): number {
  const { isOpen, isWeekend } = getMarketState();
  if (isOpen) return 300;       // Piyasa açık: 5 dakika
  if (isWeekend) return 21600;  // Hafta sonu: 6 saat
  return 3600;                  // Piyasa kapalı: 1 saat
}

/** Piyasa saatine göre haftalık/aylık bar cache TTL (saniye) */
export function getIntervalBarsTTL(): number {
  const { isOpen, isWeekend } = getMarketState();
  if (isOpen) return 900;       // Piyasa açık: 15 dakika
  if (isWeekend) return 21600;  // Hafta sonu: 6 saat
  return 3600;                  // Piyasa kapalı: 1 saat
}

/** Frontend polling interval (milisaniye) */
export function getPollingInterval(): number {
  const { isOpen } = getMarketState();
  return isOpen ? 30_000 : 5 * 60_000; // 30sn veya 5dk
}
