/**
 * Bistbase Stress Test Engine
 * Öntanımlı senaryolarla portföy stres testi
 */

import { STOCK_SECTOR_MAP } from "./sectors";

export interface StressScenario {
  id: string;
  name: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  estimatedImpact: number;    // portföy değer değişimi %
  holdingImpacts: {
    stockCode: string;
    impact: number;           // %
  }[];
}

export interface StressTestResult {
  scenarios: StressScenario[];
  mostVulnerable: string;      // en çok etkilenen senaryo adı
  portfolioResilience: number; // 0-100 dayanıklılık skoru
}

// Sektör bazlı senaryo etki çarpanları
const SECTOR_SENSITIVITY: Record<string, Record<string, number>> = {
  // "senaryo_id" → { "sektör" → çarpan }
  bist_10_drop: {
    XBANK: 1.3, XUSIN: 1.0, XHOLD: 1.1, XULAS: 0.9,
    XILTM: 0.8, XGIDA: 0.7, XMANA: 1.0, XELKT: 0.6, XTRZM: 1.1,
  },
  bist_20_drop: {
    XBANK: 1.4, XUSIN: 1.1, XHOLD: 1.2, XULAS: 0.9,
    XILTM: 0.8, XGIDA: 0.7, XMANA: 1.0, XELKT: 0.6, XTRZM: 1.2,
  },
  usd_15_rise: {
    XBANK: 0.8, XUSIN: 1.2, XHOLD: 0.9, XULAS: 1.3,
    XILTM: 0.7, XGIDA: 1.1, XMANA: 1.0, XELKT: 0.9, XTRZM: 0.6,
  },
  interest_hike: {
    XBANK: 0.5, XUSIN: 1.1, XHOLD: 1.0, XULAS: 0.9,
    XILTM: 0.8, XGIDA: 0.7, XMANA: 0.8, XELKT: 0.6, XTRZM: 0.9,
  },
  global_crisis: {
    XBANK: 1.5, XUSIN: 1.3, XHOLD: 1.4, XULAS: 1.0,
    XILTM: 0.9, XGIDA: 0.6, XMANA: 1.1, XELKT: 0.7, XTRZM: 1.5,
  },
};

const SCENARIOS_DEF = [
  {
    id: "bist_10_drop",
    name: "BİST100 %10 Düşüş",
    description: "Endekste %10'luk bir düzeltme senaryosu",
    baseImpact: -10,
    severity: "MEDIUM" as const,
  },
  {
    id: "bist_20_drop",
    name: "BİST100 %20 Düşüş",
    description: "Ciddi bir piyasa çöküşü senaryosu",
    baseImpact: -20,
    severity: "HIGH" as const,
  },
  {
    id: "usd_15_rise",
    name: "Dolar %15 Yükseliş",
    description: "TL'de sert değer kaybı senaryosu",
    baseImpact: -8,
    severity: "MEDIUM" as const,
  },
  {
    id: "interest_hike",
    name: "Faiz 500bp Artış",
    description: "Merkez Bankası sert faiz artışı senaryosu",
    baseImpact: -12,
    severity: "HIGH" as const,
  },
  {
    id: "global_crisis",
    name: "Küresel Kriz",
    description: "2008 tipi küresel finansal kriz senaryosu",
    baseImpact: -30,
    severity: "EXTREME" as const,
  },
];

/**
 * Stres testi senaryolarını hesapla
 */
export function calculateStressTest(
  holdings: { stockCode: string; weight: number; beta: number | null }[],
): StressTestResult {
  if (holdings.length === 0) {
    return { scenarios: [], mostVulnerable: "", portfolioResilience: 50 };
  }

  const scenarios: StressScenario[] = [];

  for (const scenDef of SCENARIOS_DEF) {
    const sensitivity = SECTOR_SENSITIVITY[scenDef.id] ?? {};

    const holdingImpacts: StressScenario["holdingImpacts"] = [];
    let weightedImpact = 0;

    for (const h of holdings) {
      const sector = STOCK_SECTOR_MAP[h.stockCode] ?? "DIGER";
      const sectorMult = sensitivity[sector] ?? 1.0;
      const betaMult = h.beta != null ? Math.max(0.5, h.beta) : 1.0;

      // Hisse etkisi = baz etki × sektör çarpanı × beta çarpanı
      const impact = scenDef.baseImpact * sectorMult * betaMult;
      const roundedImpact = Math.round(impact * 100) / 100;

      holdingImpacts.push({ stockCode: h.stockCode, impact: roundedImpact });
      weightedImpact += roundedImpact * (h.weight / 100);
    }

    scenarios.push({
      id: scenDef.id,
      name: scenDef.name,
      description: scenDef.description,
      severity: scenDef.severity,
      estimatedImpact: Math.round(weightedImpact * 100) / 100,
      holdingImpacts,
    });
  }

  // En kötü senaryo
  const worst = scenarios.reduce((w, s) => s.estimatedImpact < w.estimatedImpact ? s : w, scenarios[0]);

  // Portföy dayanıklılık skoru (0-100)
  // BİST %20 düşüşte portföy ne kadar az etkileniyor?
  const bist20 = scenarios.find(s => s.id === "bist_20_drop");
  const avgImpact = scenarios.reduce((sum, s) => sum + Math.abs(s.estimatedImpact), 0) / scenarios.length;
  // Daha az etkilenen = daha dayanıklı
  const resilience = Math.min(100, Math.max(0, Math.round(100 - avgImpact * 2.5)));

  return {
    scenarios,
    mostVulnerable: worst?.name ?? "",
    portfolioResilience: resilience,
  };
}
