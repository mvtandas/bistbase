import { ScrollReveal } from "./scroll-reveal";

const stats = [
  { value: "500+", label: "Hisse Analizi / Gün" },
  { value: "10,000+", label: "AI Rapor Üretildi" },
  { value: "150+", label: "BİST Hissesi Kapsamı" },
  { value: "Her gün", label: "Güncelleniyor" },
];

export function SocialProof() {
  return (
    <section className="py-20 max-w-5xl mx-auto px-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
        {stats.map((stat, i) => (
          <ScrollReveal key={stat.label} delay={i * 100}>
            <div className="text-center lg:border-r lg:last:border-r-0 border-border/30">
              <div className="text-3xl sm:text-4xl font-bold text-foreground font-mono">
                {stat.value}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">{stat.label}</div>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
