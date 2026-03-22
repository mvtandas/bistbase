/**
 * Zod schemas for all AI insight outputs.
 * Replaces manual validate* functions in route files.
 * Types are derived via z.infer<> — single source of truth.
 */
import { z } from "zod";

// ─── Helpers ────────────────────────────────────────
const str = z.string().catch("");
const strRequired = z.string().min(1);
const confidence = z.enum(["HIGH", "MEDIUM", "LOW"]).catch("MEDIUM");

// ─── Main Analysis Output ───────────────────────────
export const StockAnalysisOutputSchema = z.object({
  reasoning: str.optional(),
  counterArgument: str.optional(),
  dataQualityNote: str.optional(),
  summaryText: strRequired,
  bullCase: str,
  bearCase: str,
  sentimentValue: z.number().min(-100).max(100),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  verdictReason: str.optional(),
});

// ─── Akıllı Özet ────────────────────────────────────
export const AkilliOzetSchema = z.object({
  tldr: strRequired,
  bullets: z.array(z.object({
    icon: str.catch("🟡"),
    text: str,
    category: z.enum(["technical", "fundamental", "macro", "risk"]).catch("technical"),
  })),
  timeHorizon: z.object({
    shortTerm: str,
    mediumTerm: str,
    longTerm: str,
  }),
  watchlist: z.array(z.string()).catch([]),
});

// ─── Giriş-Çıkış Noktaları ─────────────────────────
export const GirisCikisSchema = z.object({
  entryZones: z.array(z.object({
    priceRange: str,
    reasoning: str,
    confluence: z.array(z.string()).catch([]),
    riskReward: str,
  })),
  exitTargets: z.array(z.object({
    price: str,
    reasoning: str,
    type: z.enum(["partial", "full"]).catch("full"),
  })),
  stopLoss: z.object({
    price: str,
    reasoning: str,
    atrBased: str,
  }),
  tradeSetupType: str,
  setupQuality: z.enum(["A", "B", "C"]).catch("C"),
});

// ─── Teknik Yorum ───────────────────────────────────
export const TeknikYorumSchema = z.object({
  patternNarrative: strRequired,
  historicalContext: str,
  confluenceAnalysis: str,
  keyLevel: z.object({
    price: z.number().catch(0),
    type: str,
    significance: str,
  }),
  patternReliability: confidence,
  actionableInsight: str,
});

// ─── Sinyal Çözüm ──────────────────────────────────
export const SinyalCozumSchema = z.object({
  hasConflict: z.boolean(),
  conflictSummary: str,
  resolution: str,
  dominantSignal: z.object({
    name: str,
    direction: z.enum(["BULLISH", "BEARISH"]).catch("BULLISH"),
    whyTrust: str,
  }),
  ignoredSignals: z.array(z.object({
    name: str,
    whyIgnore: str,
  })).catch([]),
  netConclusion: str,
  confidenceInResolution: confidence,
});

// ─── Risk Senaryo ───────────────────────────────────
export const RiskSenaryoSchema = z.object({
  scenarios: z.array(z.object({
    title: str,
    probability: confidence,
    impact: str,
    estimatedLoss: str,
    hedgeSuggestion: str,
  })),
  worstCaseNarrative: str,
  riskAppetiteAdvice: str,
  currentRiskSummary: str,
});

// ─── Sektör Analiz ──────────────────────────────────
export const SektorAnalizSchema = z.object({
  positionSummary: strRequired,
  competitiveAdvantage: str,
  valuationComparison: str,
  sectorOutlook: str,
  betterAlternative: z.string().nullable().catch(null),
});

// ─── İşlem Kurulumu ─────────────────────────────────
export const IslemKurulumuSchema = z.object({
  setupDetected: z.boolean(),
  setupName: str,
  setupType: z.enum(["BREAKOUT", "REVERSAL", "TREND_CONTINUATION", "MEAN_REVERSION"]).catch("BREAKOUT"),
  description: str,
  triggerCondition: str,
  invalidation: str,
  historicalWinRate: str,
  timeframe: str,
  confluenceScore: z.number().min(0).max(10).catch(0),
  status: z.enum(["ACTIVE", "PENDING", "EXPIRED"]).catch("PENDING"),
});

// ─── Schema registry (for prompt versioning & A/B testing) ──
export const INSIGHT_SCHEMAS = {
  "akilli-ozet": AkilliOzetSchema,
  "giris-cikis": GirisCikisSchema,
  "teknik-yorum": TeknikYorumSchema,
  "sinyal-cozum": SinyalCozumSchema,
  "risk-senaryo": RiskSenaryoSchema,
  "sektor-analiz": SektorAnalizSchema,
  "islem-kurulumu": IslemKurulumuSchema,
} as const;

// ─── Derived Types ──────────────────────────────────
export type AkilliOzetOutput = z.infer<typeof AkilliOzetSchema>;
export type GirisCikisOutput = z.infer<typeof GirisCikisSchema>;
export type TeknikYorumOutput = z.infer<typeof TeknikYorumSchema>;
export type SinyalCozumOutput = z.infer<typeof SinyalCozumSchema>;
export type RiskSenaryoOutput = z.infer<typeof RiskSenaryoSchema>;
export type SektorAnalizOutput = z.infer<typeof SektorAnalizSchema>;
export type IslemKurulumuOutput = z.infer<typeof IslemKurulumuSchema>;
export type StockAnalysisOutput = z.infer<typeof StockAnalysisOutputSchema>;
