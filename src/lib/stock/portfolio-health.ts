/**
 * Bistbase Portfolio Health Score
 * Portföy sağlık skoru — 0-100 arası bileşik skor + harf notu
 */

import type { ExtendedRiskMetrics } from "./portfolio-risk-extended";

export interface HealthSubScore {
  label: string;
  score: number;     // 0-100
  weight: number;    // 0-1
  description: string;
}

export interface PortfolioHealthScore {
  totalScore: number;         // 0-100
  grade: string;              // A+, A, B+, B, C+, C, D, F
  gradeLabel: string;         // Türkçe etiket
  subScores: HealthSubScore[];
}

function toGrade(score: number): { grade: string; gradeLabel: string } {
  if (score >= 90) return { grade: "A+", gradeLabel: "Mükemmel" };
  if (score >= 80) return { grade: "A", gradeLabel: "Çok İyi" };
  if (score >= 70) return { grade: "B+", gradeLabel: "İyi" };
  if (score >= 60) return { grade: "B", gradeLabel: "Orta Üstü" };
  if (score >= 50) return { grade: "C+", gradeLabel: "Orta" };
  if (score >= 40) return { grade: "C", gradeLabel: "Zayıf" };
  if (score >= 30) return { grade: "D", gradeLabel: "Kötü" };
  return { grade: "F", gradeLabel: "Çok Kötü" };
}

/**
 * Portföy sağlık skoru hesapla
 */
export function calculatePortfolioHealthScore(params: {
  diversificationScore: number;     // 0-100 (mevcut analyzePortfolioRisk'ten)
  riskMetrics: ExtendedRiskMetrics | null;
  alpha: number | null;             // benchmark alpha %
  maxWeight: number;                // en büyük hisse ağırlığı %
  holdingCount: number;
  positiveVerdictRatio: number;     // pozitif verdict'li hisse oranı (0-1)
}): PortfolioHealthScore {
  const { diversificationScore, riskMetrics, alpha, maxWeight, holdingCount, positiveVerdictRatio } = params;

  // 1. Diversification Score (20%)
  const divScore = Math.min(100, Math.max(0, diversificationScore));

  // 2. Risk-Adjusted Return (25%) — Sharpe/Sortino bazlı
  let riskAdjScore = 50; // default
  if (riskMetrics) {
    const sharpe = riskMetrics.sharpeRatio;
    // Sharpe: < -0.5 → 0, 0 → 40, 0.5 → 60, 1.0 → 75, 1.5+ → 90, 2.0+ → 100
    if (sharpe >= 2.0) riskAdjScore = 100;
    else if (sharpe >= 1.5) riskAdjScore = 90;
    else if (sharpe >= 1.0) riskAdjScore = 75;
    else if (sharpe >= 0.5) riskAdjScore = 60;
    else if (sharpe >= 0) riskAdjScore = 40;
    else if (sharpe >= -0.5) riskAdjScore = 20;
    else riskAdjScore = 0;

    // Sortino bonus (max +10)
    if (riskMetrics.sortinoRatio > 1.5) riskAdjScore = Math.min(100, riskAdjScore + 10);
    else if (riskMetrics.sortinoRatio > 1.0) riskAdjScore = Math.min(100, riskAdjScore + 5);
  }

  // 3. Alpha Performance (20%) — benchmark'a göre
  let alphaScore = 50;
  if (alpha != null) {
    // Alpha: < -10 → 0, -5 → 20, 0 → 50, +5 → 75, +10 → 90, +15+ → 100
    if (alpha >= 15) alphaScore = 100;
    else if (alpha >= 10) alphaScore = 90;
    else if (alpha >= 5) alphaScore = 75;
    else if (alpha >= 0) alphaScore = 50;
    else if (alpha >= -5) alphaScore = 30;
    else if (alpha >= -10) alphaScore = 15;
    else alphaScore = 0;
  }

  // 4. Concentration Risk (15%) — düşük konsantrasyon = yüksek skor
  let concScore = 50;
  if (holdingCount >= 1) {
    // maxWeight: %100 (tek hisse) → 0, %50 → 30, %30 → 60, %20 → 80, %10 → 100
    if (maxWeight <= 10) concScore = 100;
    else if (maxWeight <= 20) concScore = 80;
    else if (maxWeight <= 30) concScore = 60;
    else if (maxWeight <= 40) concScore = 40;
    else if (maxWeight <= 50) concScore = 25;
    else concScore = 10;

    // Holding count bonus
    if (holdingCount >= 10) concScore = Math.min(100, concScore + 10);
    else if (holdingCount >= 5) concScore = Math.min(100, concScore + 5);
    else if (holdingCount <= 2) concScore = Math.max(0, concScore - 15);
  }

  // 5. Signal Alignment (20%) — pozitif verdict oranı
  // 0% → 10, 25% → 30, 50% → 50, 75% → 75, 100% → 95
  const signalScore = Math.round(10 + positiveVerdictRatio * 85);

  const subScores: HealthSubScore[] = [
    { label: "Çeşitlendirme", score: Math.round(divScore), weight: 0.20, description: "Hisse ve sektör dağılımı kalitesi" },
    { label: "Risk-Getiri", score: Math.round(riskAdjScore), weight: 0.25, description: "Sharpe ve Sortino oranları" },
    { label: "Alpha", score: Math.round(alphaScore), weight: 0.20, description: "BİST100 karşısında performans" },
    { label: "Konsantrasyon", score: Math.round(concScore), weight: 0.15, description: "Portföy ağırlık dengesi" },
    { label: "Sinyal Uyumu", score: Math.round(signalScore), weight: 0.20, description: "AI karar yönü uyumu" },
  ];

  const totalScore = Math.round(
    subScores.reduce((sum, s) => sum + s.score * s.weight, 0)
  );

  const { grade, gradeLabel } = toGrade(totalScore);

  return { totalScore, grade, gradeLabel, subScores };
}
