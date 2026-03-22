import { UserPlus, FolderPlus, Sparkles } from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";

const steps = [
  {
    icon: UserPlus,
    number: "1",
    title: "Kayıt Ol",
    description: "E-posta ile 30 saniyede kayıt ol. Şifre yok, sadece magic link.",
  },
  {
    icon: FolderPlus,
    number: "2",
    title: "Portföyünü Ekle",
    description: "BİST hisselerini seç, portföyünü oluştur. İstediğin kadar hisse ekle.",
  },
  {
    icon: Sparkles,
    number: "3",
    title: "Analiz Al",
    description: "Her gün AI destekli analizlerini oku. Sinyalleri, riskleri ve fırsatları gör.",
  },
];

export function HowItWorks() {
  return (
    <section id="nasil-calisir" className="py-24 max-w-5xl mx-auto px-6">
      <ScrollReveal className="text-center mb-16">
        <p className="text-ai-primary text-sm font-medium tracking-wide uppercase mb-3">
          Nasıl Çalışır
        </p>
        <h2 className="text-3xl lg:text-4xl font-bold text-foreground">
          3 adımda başla
        </h2>
      </ScrollReveal>

      {/* Desktop - Horizontal */}
      <div className="hidden lg:grid grid-cols-3 gap-8 relative">
        {/* Connecting line */}
        <div className="absolute top-6 left-[16.67%] right-[16.67%] h-px bg-gradient-to-r from-ai-primary/50 via-ai-primary/20 to-ai-primary/50" />

        {steps.map((step, i) => (
          <ScrollReveal key={step.title} delay={i * 150}>
            <div className="flex flex-col items-center text-center relative">
              <div className="h-12 w-12 rounded-full bg-ai-primary/10 border border-ai-primary/30 flex items-center justify-center text-ai-primary font-bold text-lg mb-6 relative z-10 bg-background">
                {step.number}
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </div>
          </ScrollReveal>
        ))}
      </div>

      {/* Mobile - Vertical */}
      <div className="lg:hidden space-y-8">
        {steps.map((step, i) => (
          <ScrollReveal key={step.title} delay={i * 100}>
            <div className="flex gap-5">
              <div className="flex flex-col items-center">
                <div className="h-10 w-10 rounded-full bg-ai-primary/10 border border-ai-primary/30 flex items-center justify-center text-ai-primary font-bold shrink-0">
                  {step.number}
                </div>
                {i < steps.length - 1 && (
                  <div className="w-px flex-1 bg-ai-primary/20 mt-3" />
                )}
              </div>
              <div className="pb-8">
                <h3 className="text-base font-semibold text-foreground mb-1">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
