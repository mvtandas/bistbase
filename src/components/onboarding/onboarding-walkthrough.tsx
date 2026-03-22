"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { StepWelcome } from "./step-welcome";
import { StepPortfolio } from "./step-portfolio";
import { StepAnalysis } from "./step-analysis";
import { StockSearch } from "./stock-search";

const STEPS = [
  { id: "welcome", component: StepWelcome },
  { id: "portfolio", component: StepPortfolio },
  { id: "analysis", component: StepAnalysis },
  { id: "stocks", component: StockSearch },
] as const;

const STEP_LABELS = ["Hoş Geldin", "Portföy", "Analiz", "Hisse Seç"];

export function OnboardingWalkthrough() {
  const [currentStep, setCurrentStep] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  const goNext = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
      setAnimKey((k) => k + 1);
    }
  }, [currentStep]);

  const goBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
      setAnimKey((k) => k + 1);
    }
  }, [currentStep]);

  const skipToStocks = useCallback(() => {
    setCurrentStep(STEPS.length - 1);
    setAnimKey((k) => k + 1);
  }, []);

  const isInfoStep = currentStep < STEPS.length - 1;
  const StepComponent = STEPS[currentStep].component;

  return (
    <div className="w-full max-w-lg mx-auto space-y-8">
      {/* Progress Indicator */}
      <div className="flex flex-col items-center gap-3">
        {/* Dots */}
        <div className="flex items-center gap-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-2 rounded-full transition-all duration-500 ease-out",
                i === currentStep
                  ? "w-10 bg-gradient-to-r from-ai-primary to-ai-premium shadow-[0_0_12px_2px] shadow-ai-primary/30"
                  : i < currentStep
                    ? "w-2 bg-ai-primary/50"
                    : "w-2 bg-border/50"
              )}
            />
          ))}
        </div>
        {/* Step Label */}
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground/50 font-medium">
          {STEP_LABELS[currentStep]}
        </span>
      </div>

      {/* Step Content */}
      <div key={animKey} className="animate-step-enter">
        <StepComponent />
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        {/* Back / Skip */}
        <div>
          {currentStep > 0 && isInfoStep && (
            <button
              onClick={goBack}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Geri
            </button>
          )}
          {currentStep === 0 && (
            <button
              onClick={skipToStocks}
              className="text-sm text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              Atla
            </button>
          )}
        </div>

        {/* Continue Button */}
        <div>
          {isInfoStep && (
            <Button
              onClick={goNext}
              className="h-11 px-6 bg-gradient-to-r from-ai-primary to-ai-premium hover:from-ai-primary/90 hover:to-ai-premium/90 text-white shadow-lg shadow-ai-primary/20 transition-all hover:shadow-xl hover:shadow-ai-primary/30 hover:scale-[1.02] active:scale-[0.98]"
            >
              Devam Et
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Step counter */}
      {isInfoStep && (
        <div className="text-center">
          <span className="text-[11px] text-muted-foreground/30">
            {currentStep + 1} / {STEPS.length}
          </span>
        </div>
      )}
    </div>
  );
}
