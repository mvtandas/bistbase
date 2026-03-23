"use client";

import { useState, useEffect } from "react";

/**
 * Piyasa saatine göre dinamik polling interval döner.
 * BIST açıkken (10:00-18:00 İstanbul, hafta içi) 30 saniye,
 * kapalıyken 5 dakika.
 */
export function useMarketPollingInterval(): number {
  const [interval, setInterval_] = useState(5 * 60 * 1000);

  useEffect(() => {
    function update() {
      const now = new Date();
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Europe/Istanbul",
        hour: "numeric",
        hour12: false,
        weekday: "short",
      }).formatToParts(now);
      const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
      const day = parts.find((p) => p.type === "weekday")?.value ?? "";
      const isWeekend = day === "Sat" || day === "Sun";
      const isOpen = !isWeekend && hour >= 10 && hour < 18;
      setInterval_(isOpen ? 30_000 : 5 * 60_000);
    }
    update();
    const id = window.setInterval(update, 60_000);
    return () => window.clearInterval(id);
  }, []);

  return interval;
}
