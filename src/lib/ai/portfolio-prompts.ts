/**
 * Portfolio-level AI prompt builders
 * Follows the same pattern as specialized-prompts.ts
 */

function fmt(v: number | null | undefined, d = 2): string {
  return v != null ? v.toFixed(d) : "—";
}

// ═══════════════════════════════════════════════════════════
// 1. PORTFOY OZET
// ═══════════════════════════════════════════════════════════

export interface PortfoyOzetInput {
  totalValue: number | null;
  totalPnL: number | null;
  totalPnLPercent: number | null;
  dailyChange: number;
  holdingCount: number;
  healthGrade: string;
  healthScore: number;
  compositeScore: number;
  verdictAction: string;
  verdictConfidence: number;
  alpha: number | null;
  sharpeRatio: number | null;
  diversificationScore: number;
  strongestHolding: { code: string; reason: string } | null;
  weakestHolding: { code: string; reason: string } | null;
  suggestions: { type: string; message: string }[];
  topHoldings: { stockCode: string; weight: number; verdictAction: string | null }[];
}

export function buildPortfoyOzetPrompt(input: PortfoyOzetInput): { system: string; user: string } {
  const holdingsSummary = input.topHoldings
    .slice(0, 5)
    .map(h => `${h.stockCode} (%${fmt(h.weight, 1)} agirlik, karar: ${h.verdictAction ?? "—"})`)
    .join(", ");

  const suggestionsStr = input.suggestions.length > 0
    ? input.suggestions.map(s => s.message).join("; ")
    : "Uyari yok";

  return {
    system: `Sen kidemli bir BIST portfoy analistisin. Portfoy duzeyinde yonetici brifingleri hazirlarsin. Ciktin SADECE JSON formatinda olmali. Turkce yaz. Kisa ve oz ol.`,
    user: `PORTFOY DURUMU:
- Toplam Deger: ${input.totalValue != null ? `₺${input.totalValue.toLocaleString("tr-TR")}` : "Bilinmiyor"}
- Toplam K/Z: ${input.totalPnL != null ? `₺${input.totalPnL.toLocaleString("tr-TR")} (%${fmt(input.totalPnLPercent)})` : "Bilinmiyor"}
- Gunluk Degisim: %${fmt(input.dailyChange)}
- Hisse Sayisi: ${input.holdingCount}
- Saglik Notu: ${input.healthGrade} (${input.healthScore}/100)
- Kompozit Skor: ${input.compositeScore}/100
- AI Karar: ${input.verdictAction} (%${input.verdictConfidence} guven)
- Alpha (BIST100'e gore): ${input.alpha != null ? `%${fmt(input.alpha)}` : "—"}
- Sharpe Orani: ${fmt(input.sharpeRatio)}
- Cesitlendirme Skoru: ${input.diversificationScore}/100
- En Guclu: ${input.strongestHolding ? `${input.strongestHolding.code} (${input.strongestHolding.reason})` : "—"}
- En Zayif: ${input.weakestHolding ? `${input.weakestHolding.code} (${input.weakestHolding.reason})` : "—"}
- Ust Holdingleri: ${holdingsSummary}
- Uyarilar: ${suggestionsStr}

GOREV: Portfoy yonetici brifing olustur.
1. "tldr": Tek cumle, portfoyun genel durumu ve one cikan aksiyon (max 30 kelime)
2. "bullets": 5-6 madde. Her madde: {"icon": "🟢"/"🔴"/"🟡", "text": "...", "category": "allocation"/"performance"/"risk"/"action"}
3. "healthAnalysis": 2 cumle, saglik notu ve alt skorlara dayali degerlendirme
4. "topPriority": En acil yapilmasi gereken tek aksiyonu yaz (1 cumle)
5. "watchlist": 2-3 izlenmesi gereken portfoy duzeyinde tetikleyici

JSON:
{"tldr":"...","bullets":[...],"healthAnalysis":"...","topPriority":"...","watchlist":[...]}`,
  };
}

// ═══════════════════════════════════════════════════════════
// 2. PORTFOY RISK
// ═══════════════════════════════════════════════════════════

export interface PortfoyRiskInput {
  holdingCount: number;
  totalValue: number | null;
  portfolioBeta: number;
  diversificationScore: number;
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  volatility: number | null;
  maxDrawdown: number | null;
  currentDrawdown: number | null;
  var95: number | null;
  correlationWarnings: string[];
  concentrationWarning: string | null;
  monteCarloWorstCase: number | null;
  stressScenarios: { scenario: string; impact: number }[];
}

export function buildPortfoyRiskPrompt(input: PortfoyRiskInput): { system: string; user: string } {
  const stressStr = input.stressScenarios.length > 0
    ? input.stressScenarios.map(s => `${s.scenario}: %${fmt(s.impact)}`).join("; ")
    : "Stres testi verisi yok";

  const corrStr = input.correlationWarnings.length > 0
    ? input.correlationWarnings.join("; ")
    : "Yuksek korelasyon uyarisi yok";

  return {
    system: `Sen BIST portfoy risk analisti uzmanisin. Portfoylerin risk profilini degerlendirirsin. Ciktin SADECE JSON formatinda olmali. Turkce yaz.`,
    user: `PORTFOY RISK VERILERI:
- Hisse Sayisi: ${input.holdingCount}
- Toplam Deger: ${input.totalValue != null ? `₺${input.totalValue.toLocaleString("tr-TR")}` : "—"}
- Portfoy Beta: ${fmt(input.portfolioBeta)}
- Cesitlendirme: ${input.diversificationScore}/100
- Sharpe: ${fmt(input.sharpeRatio)} | Sortino: ${fmt(input.sortinoRatio)}
- Yillik Volatilite: ${fmt(input.volatility)}%
- Mevcut Drawdown: %${fmt(input.currentDrawdown)} | Max Drawdown: %${fmt(input.maxDrawdown)}
- VaR (95%): %${fmt(input.var95)}
- Monte Carlo En Kotu: ${input.monteCarloWorstCase != null ? `%${fmt(input.monteCarloWorstCase)}` : "—"}
- Korelasyon Uyarilari: ${corrStr}
- Konsantrasyon: ${input.concentrationWarning ?? "Uyari yok"}
- Stres Testleri: ${stressStr}

GOREV: Portfoy risk degerlendirmesi olustur.
1. "riskSummary": 2-3 cumle, portfoyun genel risk profili
2. "scenarios": 3 senaryo. Her biri: {"title": "...", "probability": "LOW"/"MEDIUM"/"HIGH", "impact": "...", "estimatedLoss": "...", "hedgeSuggestion": "..."}
3. "drawdownAnalysis": Drawdown durumu ve toparlanma beklentisi (2 cumle)
4. "correlationWarning": Korelasyon riskleri ve oneriler (1-2 cumle)
5. "riskAppetiteAdvice": Bu portfoy hangi risk istahina uygun? (1 cumle)

JSON:
{"riskSummary":"...","scenarios":[...],"drawdownAnalysis":"...","correlationWarning":"...","riskAppetiteAdvice":"..."}`,
  };
}

// ═══════════════════════════════════════════════════════════
// 3. PORTFOY REBALANS
// ═══════════════════════════════════════════════════════════

export interface PortfoyRebalansInput {
  holdings: {
    stockCode: string;
    weight: number;
    verdictAction: string | null;
    compositeScore: number | null;
    changePercent: number | null;
    pnlPercent: number | null;
  }[];
  sectorAllocation: { sector: string; sectorName: string; weight: number }[];
  diversificationScore: number;
  suggestions: { type: string; severity: string; message: string }[];
}

export function buildPortfoyRebalansPrompt(input: PortfoyRebalansInput): { system: string; user: string } {
  const holdingsStr = input.holdings
    .map(h => `${h.stockCode}: agirlik=%${fmt(h.weight, 1)}, skor=${h.compositeScore ?? "—"}, karar=${h.verdictAction ?? "—"}, K/Z=%${fmt(h.pnlPercent)}`)
    .join("\n");

  const sectorStr = input.sectorAllocation
    .map(s => `${s.sectorName}: %${fmt(s.weight, 1)}`)
    .join(", ");

  const suggestionsStr = input.suggestions.length > 0
    ? input.suggestions.map(s => `[${s.severity}] ${s.message}`).join("\n")
    : "Sistem onerisi yok";

  return {
    system: `Sen BIST portfoy stratejistisin. Portfoy yeniden dengeleme tavsiyeleri verirsin. Ciktin SADECE JSON formatinda olmali. Turkce yaz. Somut ve aksiyona yonelik ol.`,
    user: `PORTFOY POZISYONLARI:
${holdingsStr}

SEKTOR DAGILIMI: ${sectorStr}
CESITLENDIRME SKORU: ${input.diversificationScore}/100

SISTEM UYARILARI:
${suggestionsStr}

GOREV: Rebalans stratejisi olustur.
1. "currentAssessment": Mevcut portfoy yapisinin 2 cumlelik degerlendirmesi
2. "actions": Her hisse icin aksiyon. {"stockCode": "...", "action": "ARTIR"/"AZALT"/"TUT"/"CIKAR", "reasoning": "...", "targetWeight": "%X"}
3. "sectorAdvice": Sektor dagilimi hakkinda 1-2 cumle oneri
4. "diversificationAdvice": Cesitlendirme iyilestirme onerisi (1 cumle)

JSON:
{"currentAssessment":"...","actions":[...],"sectorAdvice":"...","diversificationAdvice":"..."}`,
  };
}

// ═══════════════════════════════════════════════════════════
// 4. PORTFOY PERFORMANS
// ═══════════════════════════════════════════════════════════

export interface PortfoyPerformansInput {
  holdings: {
    stockCode: string;
    weight: number;
    changePercent: number | null;
    pnlPercent: number | null;
  }[];
  totalReturn: number | null;
  bist100Return: number | null;
  alpha: number | null;
  benchmarkComparison: { period: string; portfolioReturn: number; bist100Return: number; alpha: number }[];
  attribution: {
    totalExcessReturn: number;
    allocationEffect: number;
    selectionEffect: number;
    sectorDetails: { sectorName: string; allocationContrib: number; selectionContrib: number }[];
  } | null;
  riskContributions: { stockCode: string; riskPercent: number; isOverweight: boolean }[];
}

export function buildPortfoyPerformansPrompt(input: PortfoyPerformansInput): { system: string; user: string } {
  const holdingsStr = input.holdings
    .slice(0, 8)
    .map(h => `${h.stockCode}: agirlik=%${fmt(h.weight, 1)}, degisim=%${fmt(h.changePercent)}, K/Z=%${fmt(h.pnlPercent)}`)
    .join(", ");

  const benchStr = input.benchmarkComparison
    .map(b => `${b.period}: Portfoy %${fmt(b.portfolioReturn)}, BIST100 %${fmt(b.bist100Return)}, Alpha %${fmt(b.alpha)}`)
    .join("; ");

  const attrStr = input.attribution
    ? `Toplam Alfa: %${fmt(input.attribution.totalExcessReturn)}, Sektor Agirlik Etkisi: %${fmt(input.attribution.allocationEffect)}, Hisse Secimi Etkisi: %${fmt(input.attribution.selectionEffect)}`
    : "Attribution verisi yok";

  const riskStr = input.riskContributions
    .slice(0, 5)
    .map(r => `${r.stockCode}: risk katki=%${fmt(r.riskPercent)}${r.isOverweight ? " (fazla agirlik)" : ""}`)
    .join(", ");

  return {
    system: `Sen BIST portfoy performans analistisin. Portfoy getirilerini yorumlar ve ileri bakis sunarsin. Ciktin SADECE JSON formatinda olmali. Turkce yaz.`,
    user: `PERFORMANS VERILERI:
- Toplam Getiri: ${input.totalReturn != null ? `%${fmt(input.totalReturn)}` : "—"}
- BIST100 Getiri: ${input.bist100Return != null ? `%${fmt(input.bist100Return)}` : "—"}
- Alpha: ${input.alpha != null ? `%${fmt(input.alpha)}` : "—"}
- Holdingleri: ${holdingsStr}
- Benchmark Karsilastirma: ${benchStr || "—"}
- Attribution: ${attrStr}
- Risk Katkilari: ${riskStr || "—"}

GOREV: Performans degerlendirmesi olustur.
1. "performanceSummary": 2-3 cumle, portfoyun getiri performansini ozetle
2. "drivers": En etkili 3-4 hisse. {"stockCode": "...", "contribution": "+/- etkisi", "explanation": "neden etkili"}
3. "benchmarkComparison": BIST100'e gore performans yorumu (2 cumle)
4. "outlook": Onumuzdeki donem icin beklenti ve dikkat edilecekler (2 cumle)

JSON:
{"performanceSummary":"...","drivers":[...],"benchmarkComparison":"...","outlook":"..."}`,
  };
}
