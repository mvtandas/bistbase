import { EmailCta } from "./email-cta";
import { ScrollReveal } from "./scroll-reveal";

export function FinalCta() {
  return (
    <section className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-ai-primary/10 via-background to-ai-premium/10 -z-10" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.673_0.182_276.935/0.06),transparent_70%)] -z-10" />

      <div className="max-w-2xl mx-auto px-6 text-center">
        <ScrollReveal>
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground">
            Hemen başla, borsayı yapay zeka ile takip et
          </h2>
          <p className="mt-4 text-muted-foreground">
            Ücretsiz kayıt ol, portföyünü oluştur, her sabah AI analizini al.
          </p>
          <div className="mt-8 max-w-md mx-auto">
            <EmailCta />
          </div>
          <p className="mt-3 text-xs text-muted-foreground/60">
            Kredi kartı gerekmez. İstediğin zaman iptal et.
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
