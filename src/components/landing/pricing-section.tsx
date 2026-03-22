import { Check, Sparkles } from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";
import Link from "next/link";

const features = [
  "Sınırsız portföy",
  "Günlük AI analiz",
  "Sinyal takibi (AL/SAT/TUT)",
  "Risk skorlama",
  "Teknik göstergeler",
  "Sabah e-posta özeti",
  "Sektör analizi",
];

export function PricingSection() {
  return (
    <section id="fiyatlandirma" className="py-24 max-w-3xl mx-auto px-6">
      <ScrollReveal className="text-center mb-12">
        <p className="text-ai-primary text-sm font-medium tracking-wide uppercase mb-3">
          Fiyatlandırma
        </p>
        <h2 className="text-3xl lg:text-4xl font-bold text-foreground">
          Beta sürecinde tamamen ücretsiz
        </h2>
        <p className="mt-4 text-muted-foreground max-w-lg mx-auto">
          Tüm özellikler şu an ücretsiz. Kayıt ol, hemen kullanmaya başla.
        </p>
      </ScrollReveal>

      <ScrollReveal>
        <div className="relative rounded-2xl border border-ai-primary/30 bg-ai-primary/5 p-8 text-center">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 bg-ai-primary text-white text-xs font-medium px-3 py-1 rounded-full">
            <Sparkles className="h-3 w-3" />
            Beta
          </div>

          <div className="flex items-baseline justify-center gap-1 mt-4">
            <span className="text-5xl font-bold text-foreground font-mono">₺0</span>
            <span className="text-sm text-muted-foreground">/ay</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Tüm Pro özellikler dahil
          </p>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-w-md mx-auto">
            {features.map((feature) => (
              <div key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-ai-primary shrink-0" />
                {feature}
              </div>
            ))}
          </div>

          <Link
            href="/login"
            className="mt-8 inline-flex items-center justify-center rounded-lg bg-ai-primary hover:bg-ai-primary/90 text-white text-sm font-medium h-11 px-8 transition-colors"
          >
            Ücretsiz Başla
          </Link>
        </div>
      </ScrollReveal>
    </section>
  );
}
