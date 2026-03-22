/**
 * Bistbase Peer Comparison
 * Aynı sektördeki hisseleri karşılaştır
 * "GARAN mı alsam AKBNK mi?" sorusuna veri sağlar
 */

import YahooFinance from "yahoo-finance2";
import { STOCK_SECTOR_MAP } from "./sectors";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = new (YahooFinance as any)({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

// Sektör bazlı hisse grupları
const SECTOR_STOCKS: Record<string, string[]> = {
  XBANK: ["GARAN", "AKBNK", "YKBNK", "ISCTR", "HALKB", "VAKBN"],
  XUSIN: ["EREGL", "TOASO", "FROTO", "SISE", "TUPRS", "ASELS", "PETKM", "SASA"],
  XHOLD: ["KCHOL", "SAHOL", "TAVHL"],
  XULAS: ["THYAO", "PGSUS"],
  XGIDA: ["BIMAS", "ULKER"],
  XILTM: ["TCELL", "TTKOM"],
  XMANA: ["KOZAL", "KOZAA"],
};

export interface PeerStock {
  code: string;
  name: string;
  price: number | null;
  changePercent: number | null;
  peRatio: number | null;
  pbRatio: number | null;
  marketCap: number | null;
  dividendYield: number | null;
}

export interface PeerComparison {
  sectorCode: string;
  sectorName: string;
  currentStock: string;
  peers: PeerStock[];
  // Sıralama pozisyonları
  rankByChange: number | null;  // Günlük değişimde kaçıncı
  rankByPE: number | null;      // F/K'da kaçıncı (düşük = iyi)
  totalPeers: number;
}

export async function getPeerComparison(stockCode: string): Promise<PeerComparison | null> {
  const sectorCode = STOCK_SECTOR_MAP[stockCode.toUpperCase()];
  if (!sectorCode) return null;

  const peerCodes = SECTOR_STOCKS[sectorCode];
  if (!peerCodes || peerCodes.length < 2) return null;

  const sectorNames: Record<string, string> = {
    XBANK: "Bankacılık", XUSIN: "Sınai", XHOLD: "Holding",
    XULAS: "Ulaştırma", XGIDA: "Gıda", XILTM: "İletişim", XMANA: "Maden",
  };

  const peers: PeerStock[] = [];

  await Promise.all(
    peerCodes.map(async (code) => {
      try {
        const quote = await yf.quote(`${code}.IS`);
        peers.push({
          code,
          name: quote?.shortName ?? code,
          price: quote?.regularMarketPrice ?? null,
          changePercent: quote?.regularMarketChangePercent ?? null,
          peRatio: quote?.trailingPE ?? null,
          pbRatio: quote?.priceToBook ?? null,
          marketCap: quote?.marketCap ?? null,
          dividendYield: quote?.dividendYield ? quote.dividendYield * 100 : null,
        });
      } catch {
        // skip failed
      }
    })
  );

  if (peers.length < 2) return null;

  // Sırala
  const byChange = [...peers]
    .filter((p) => p.changePercent != null)
    .sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0));
  const byPE = [...peers]
    .filter((p) => p.peRatio != null && p.peRatio > 0)
    .sort((a, b) => (a.peRatio ?? 999) - (b.peRatio ?? 999));

  const rankByChange = byChange.findIndex((p) => p.code === stockCode) + 1 || null;
  const rankByPE = byPE.findIndex((p) => p.code === stockCode) + 1 || null;

  return {
    sectorCode,
    sectorName: sectorNames[sectorCode] ?? sectorCode,
    currentStock: stockCode,
    peers: peers.sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0)),
    rankByChange,
    rankByPE,
    totalPeers: peers.length,
  };
}
