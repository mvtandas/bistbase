import { ScrollReveal } from "./scroll-reveal";

const testimonials = [
  {
    quote:
      "Sabah özetleri sayesinde piyasaya hakim başlıyorum, karar almam çok kolaylaştı.",
    name: "Ahmet Y.",
    role: "Bireysel Yatırımcı",
    initials: "AY",
    color: "bg-ai-primary/10 text-ai-primary",
  },
  {
    quote:
      "BİST'teki tüm hisselerimi tek yerden takip ediyorum. AI analizleri gerçekten isabetli.",
    name: "Elif K.",
    role: "Portföy Yöneticisi",
    initials: "EK",
    color: "bg-gain/10 text-gain",
  },
  {
    quote:
      "Teknik göstergeleri kendim inceliyordum ama Bistbase zamandan inanılmaz tasarruf ettiriyor.",
    name: "Murat S.",
    role: "Trader",
    initials: "MS",
    color: "bg-ai-premium/10 text-ai-premium",
  },
];

export function Testimonials() {
  return (
    <section className="py-24 max-w-7xl mx-auto px-6">
      <ScrollReveal className="text-center mb-16">
        <p className="text-ai-primary text-sm font-medium tracking-wide uppercase mb-3">
          Kullanıcılar
        </p>
        <h2 className="text-3xl lg:text-4xl font-bold text-foreground">
          Yatırımcılar ne diyor?
        </h2>
      </ScrollReveal>

      {/* Desktop */}
      <div className="hidden md:grid grid-cols-3 gap-6">
        {testimonials.map((t, i) => (
          <ScrollReveal key={t.name} delay={i * 100}>
            <div className="bento-card p-6 h-full">
              <p className="text-sm text-muted-foreground leading-relaxed italic">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="flex items-center gap-3 mt-6">
                <div
                  className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold ${t.color}`}
                >
                  {t.initials}
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>

      {/* Mobile - Horizontal scroll */}
      <div className="md:hidden flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 -mx-6 px-6">
        {testimonials.map((t) => (
          <div
            key={t.name}
            className="snap-center min-w-[280px] bento-card p-6 shrink-0"
          >
            <p className="text-sm text-muted-foreground leading-relaxed italic">
              &ldquo;{t.quote}&rdquo;
            </p>
            <div className="flex items-center gap-3 mt-6">
              <div
                className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold ${t.color}`}
              >
                {t.initials}
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
