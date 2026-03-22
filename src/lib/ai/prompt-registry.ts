/**
 * Prompt Versioning & A/B Testing Registry
 * Her prompt'un versiyon ID'si var, AiInsight tablosunda takip edilir.
 */

// Current prompt versions — her değişiklikte versiyon artır
export const PROMPT_VERSIONS = {
  "akilli-ozet": "v2.1",      // CoT + few-shot eklendi
  "giris-cikis": "v2.1",      // Supertrend + Pivot ekli, confluence kuralı
  "teknik-yorum": "v2.0",     // CoT eklendi
  "sinyal-cozum": "v2.0",     // Min sample kuralı
  "risk-senaryo": "v2.0",     // VaR/MaxDD dayanaklı
  "sektor-analiz": "v2.0",    // Metrik dayanaklı
  "islem-kurulumu": "v2.0",   // 3-confluence kuralı
  "main-analysis": "v2.1",    // CoT + forced debate + TCMB
} as const;

export type InsightType = keyof typeof PROMPT_VERSIONS;

export function getPromptVersion(insightType: string): string {
  return PROMPT_VERSIONS[insightType as InsightType] ?? "v1.0";
}
