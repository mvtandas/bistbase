import { Sparkles, Radio, Shield, Briefcase, Mail } from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";

const features = [
  {
    icon: Sparkles,
    title: "AI Günlük Analiz",
    description:
      "Her sabah portföyündeki her hisse için yapay zeka destekli detaylı analiz raporu al.",
    span: "lg:col-span-2",
    visual: (
      <div className="mt-4 rounded-lg border border-border/20 bg-background/50 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-ai-primary" />
            <span className="text-xs font-medium text-foreground/70">AI Analiz</span>
          </div>
          <span className="text-[10px] text-muted-foreground">az önce</span>
        </div>
        <div className="h-1.5 bg-foreground/5 rounded-full w-full animate-[shimmer_2s_ease-in-out_infinite] bg-[length:200%_100%] bg-gradient-to-r from-foreground/5 via-foreground/10 to-foreground/5" />
        <div className="h-1.5 bg-foreground/5 rounded-full w-4/5" />
        <div className="h-1.5 bg-foreground/5 rounded-full w-3/5" />
      </div>
    ),
  },
  {
    icon: Radio,
    title: "Sinyal Takibi",
    description: "Al/Sat/Tut sinyalleri ve geçmiş performans takibi.",
    span: "",
    visual: (
      <div className="mt-4 flex flex-col gap-2">
        {[
          { label: "AL", color: "bg-gain/10 text-gain border-gain/20" },
          { label: "SAT", color: "bg-loss/10 text-loss border-loss/20" },
          { label: "TUT", color: "bg-muted text-muted-foreground border-border/20" },
        ].map((signal, i) => (
          <div
            key={signal.label}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold ${signal.color} animate-slide-up`}
            style={{ animationDelay: `${i * 100}ms`, animationFillMode: "both" }}
          >
            {signal.label}
            <span className="text-muted-foreground font-normal">— THYAO</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: Shield,
    title: "Risk Skorlama",
    description: "Portföyünün risk seviyesini tek bakışta gör.",
    span: "",
    visual: (
      <div className="mt-4 flex items-center justify-center">
        <svg width="100" height="60" viewBox="0 0 100 60">
          <path
            d="M 10 55 A 40 40 0 0 1 90 55"
            fill="none"
            stroke="oklch(1 0 0 / 0.06)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M 10 55 A 40 40 0 0 1 90 55"
            fill="none"
            stroke="oklch(0.673 0.182 276.935)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray="126"
            strokeDashoffset="34"
            className="animate-gauge-arc"
          />
          <text
            x="50"
            y="48"
            textAnchor="middle"
            className="fill-foreground text-lg font-bold"
            style={{ fontSize: "18px" }}
          >
            73
          </text>
          <text
            x="50"
            y="58"
            textAnchor="middle"
            className="fill-muted-foreground"
            style={{ fontSize: "8px" }}
          >
            /100
          </text>
        </svg>
      </div>
    ),
  },
  {
    icon: Briefcase,
    title: "Portföy Takibi",
    description: "Tüm BİST hisselerini tek yerden takip et, performans analizi yap.",
    span: "lg:col-span-2",
    visual: (
      <div className="mt-4 rounded-lg border border-border/20 bg-background/50 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/10 text-muted-foreground">
              <th className="text-left px-3 py-2 font-medium">Hisse</th>
              <th className="text-right px-3 py-2 font-medium">Fiyat</th>
              <th className="text-right px-3 py-2 font-medium">Değişim</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {[
              { code: "THYAO", price: "₺312.50", change: "+2.34%", positive: true },
              { code: "ASELS", price: "₺58.90", change: "+1.12%", positive: true },
              { code: "TUPRS", price: "₺178.20", change: "-0.87%", positive: false },
            ].map((row) => (
              <tr key={row.code} className="border-b border-border/5">
                <td className="px-3 py-2 font-semibold text-foreground/80">{row.code}</td>
                <td className="text-right px-3 py-2 text-muted-foreground">{row.price}</td>
                <td className={`text-right px-3 py-2 font-medium ${row.positive ? "text-gain" : "text-loss"}`}>
                  {row.change}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  },
  {
    icon: Mail,
    title: "Sabah Özeti",
    description:
      "Her sabah e-postanıza gelen kişiselleştirilmiş portföy özeti ile güne hazırlıklı başla.",
    span: "lg:col-span-3",
    visual: (
      <div className="mt-4 rounded-lg border border-border/20 bg-background/50 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-8 w-8 rounded-full bg-ai-primary/10 flex items-center justify-center">
            <Mail className="h-4 w-4 text-ai-primary" />
          </div>
          <div>
            <div className="text-xs font-medium text-foreground/80">Bistbase Sabah Özeti</div>
            <div className="text-[10px] text-muted-foreground">bugün, 08:30</div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Günaydın! Portföyündeki 3 hisseden 2&apos;si pozitif açıldı. THYAO güçlü yolcu
          trafiği verileriyle öne çıkıyor. Bugün dikkat edilmesi gereken seviyeler ve AI
          önerileri...
        </p>
      </div>
    ),
  },
];

export function FeaturesBento() {
  return (
    <section id="ozellikler" className="py-24 max-w-7xl mx-auto px-6">
      <ScrollReveal className="text-center mb-16">
        <p className="text-ai-primary text-sm font-medium tracking-wide uppercase mb-3">
          Özellikler
        </p>
        <h2 className="text-3xl lg:text-4xl font-bold text-foreground">
          Yatırım kararlarını güçlendir
        </h2>
        <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
          Yapay zeka destekli araçlarla BİST hisselerini analiz et, riskleri yönet,
          fırsatları yakala.
        </p>
      </ScrollReveal>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
        {features.map((feature, i) => (
          <ScrollReveal key={feature.title} delay={i * 80} className={feature.span}>
            <div className="bento-card p-6 h-full group">
              <div className="absolute inset-0 bg-gradient-to-br from-ai-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-9 w-9 rounded-lg bg-ai-primary/10 flex items-center justify-center">
                    <feature.icon className="h-4 w-4 text-ai-primary" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{feature.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
                {feature.visual}
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
