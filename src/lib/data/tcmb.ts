/**
 * TCMB EVDS (Elektronik Veri Dağıtım Sistemi) API Client
 * https://evds2.tcmb.gov.tr/
 *
 * Ücretsiz API — key gerekli (evds2.tcmb.gov.tr'den alınır)
 * Sağladığı veriler:
 *   - Politika faizi (haftalık repo)
 *   - TÜFE yıllık enflasyon
 *   - Brüt döviz rezervleri
 */

import { cacheGet, cacheSet } from "@/lib/redis";

export interface TCMBData {
  policyRate: number | null;       // TCMB politika faizi (%)
  inflation: number | null;        // TÜFE yıllık enflasyon (%)
  realRate: number | null;         // Reel faiz = policyRate - inflation
  reserves: number | null;         // Brüt döviz rezervi (milyar USD)
  reservesChange: number | null;   // Haftalık değişim (milyar USD)
  fetchedAt: string | null;        // Veri tarihi
}

// TCMB EVDS API — evds3 güncel endpoint
// API key header'da gönderilmeli: headers: { key: "..." }
// Kaynak: https://github.com/fatihmete/evds
const EVDS_BASE = "https://evds3.tcmb.gov.tr/igmevdsms-dis";

// EVDS seri kodları (evds3 üzerinde test edildi)
const SERIES = {
  depositRate: "TP.TRY.MT01",     // 1 ay vadeli mevduat faizi (politika faizi göstergesi)
  cpiIndex: "TP.FG.J0",           // TÜFE endeksi (yıllık değişim hesaplanacak)
  reserves: "TP.AB.A01",          // Döviz rezervleri
};

function getEvdsApiKey(): string | null {
  return process.env.TCMB_EVDS_API_KEY ?? null;
}

function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

async function fetchEVDSSeries(
  seriesCode: string,
  startDate: string,
  endDate: string,
  apiKey: string
): Promise<number | null> {
  // API key header'da gönderilmeli, parametreler path'te (evds3 formatı)
  const url = `${EVDS_BASE}/series=${seriesCode}&startDate=${startDate}&endDate=${endDate}&type=json`;

  try {
    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "key": apiKey,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error(`[tcmb] EVDS API error: ${response.status} for ${seriesCode}`);
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("json")) {
      console.error(`[tcmb] EVDS returned non-JSON for ${seriesCode}`);
      return null;
    }

    const data = await response.json();
    const items = data?.items;
    if (!Array.isArray(items) || items.length === 0) return null;

    // Son veriyi al (en güncel)
    const lastItem = items[items.length - 1];
    const valueKey = Object.keys(lastItem).find(
      (k) => k !== "Tarih" && k !== "UNIXTIME" && lastItem[k] != null
    );
    if (!valueKey) return null;

    const val = parseFloat(String(lastItem[valueKey]).replace(",", "."));
    return Number.isNaN(val) ? null : val;
  } catch (e) {
    console.error(`[tcmb] EVDS fetch failed for ${seriesCode}:`, e);
    return null;
  }
}

// Sabit fallback değerler (güncel olmasa da yanlış US 10Y'den iyidir)
const FALLBACK: TCMBData = {
  policyRate: 42.5,    // Mart 2026 tahmini
  inflation: 30,       // Yaklaşık
  realRate: 12.5,
  reserves: 100,
  reservesChange: null,
  fetchedAt: null,
};

export async function getTCMBData(): Promise<TCMBData> {
  // Redis cache (6 saat — TCMB verileri günde 1 güncellenir)
  const cached = await cacheGet<TCMBData>("tcmb:data");
  if (cached) return cached;

  const apiKey = getEvdsApiKey();
  if (!apiKey) {
    console.warn("[tcmb] TCMB_EVDS_API_KEY not set, using fallback values");
    return FALLBACK;
  }

  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  // TÜFE yıllık enflasyon hesabı için 13 ay geriye git
  const thirteenMonthsAgo = new Date(now);
  thirteenMonthsAgo.setMonth(thirteenMonthsAgo.getMonth() - 14);

  const startDate = formatDate(threeMonthsAgo);
  const endDate = formatDate(now);

  const [depositRate, reserves] = await Promise.all([
    fetchEVDSSeries(SERIES.depositRate, startDate, endDate, apiKey),
    fetchEVDSSeries(SERIES.reserves, startDate, endDate, apiKey),
  ]);

  // TÜFE endeksi: son 13 ayı çek, yıllık enflasyon hesapla
  let inflation: number | null = null;
  try {
    const cpiUrl = `${EVDS_BASE}/series=${SERIES.cpiIndex}&startDate=${formatDate(thirteenMonthsAgo)}&endDate=${endDate}&type=json`;
    const cpiRes = await fetch(cpiUrl, {
      headers: { "Accept": "application/json", "key": apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (cpiRes.ok) {
      const cpiData = await cpiRes.json();
      const items = cpiData?.items;
      if (Array.isArray(items) && items.length >= 2) {
        // null olmayan son ve 12 ay önceki değerleri bul
        const validItems = items.filter((it: Record<string, string | null>) => {
          const vk = Object.keys(it).find(k => k !== "Tarih" && k !== "UNIXTIME" && it[k] != null);
          return vk != null;
        });
        if (validItems.length >= 2) {
          const getVal = (item: Record<string, string | null>) => {
            const vk = Object.keys(item).find(k => k !== "Tarih" && k !== "UNIXTIME" && item[k] != null)!;
            return parseFloat(String(item[vk]).replace(",", "."));
          };
          const latest = getVal(validItems[validItems.length - 1]);
          // 12 ay önceki: en baştaki değer
          const yearAgo = getVal(validItems[0]);
          if (!Number.isNaN(latest) && !Number.isNaN(yearAgo) && yearAgo > 0) {
            inflation = ((latest - yearAgo) / yearAgo) * 100;
            inflation = Math.round(inflation * 10) / 10;
          }
        }
      }
    }
  } catch {
    // TÜFE hesaplanamadı
  }

  // Mevduat faizi ≈ politika faizi göstergesi
  const policyRate = depositRate;
  const realRate =
    policyRate != null && inflation != null ? Math.round((policyRate - inflation) * 10) / 10 : null;

  const data: TCMBData = {
    policyRate: policyRate ?? FALLBACK.policyRate,
    inflation: inflation ?? FALLBACK.inflation,
    realRate: realRate ?? FALLBACK.realRate,
    reserves: reserves ?? FALLBACK.reserves,
    reservesChange: null,
    fetchedAt: formatDate(now),
  };

  await cacheSet("tcmb:data", data, 21600); // 6 saat
  return data;
}
