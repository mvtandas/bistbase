"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

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
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10% 0px" });
  const headerRef = useRef<HTMLDivElement>(null);
  const isHeaderInView = useInView(headerRef, { once: true, margin: "-10% 0px" });

  return (
    <section className="py-24 max-w-7xl mx-auto px-6">
      <motion.div
        ref={headerRef}
        className="text-center mb-16"
        initial={{ opacity: 0, y: 30 }}
        animate={isHeaderInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <p className="text-ai-primary text-sm font-medium tracking-wide uppercase mb-3">
          Kullanıcılar
        </p>
        <h2 className="text-3xl lg:text-4xl font-bold text-foreground">
          Yatırımcılar ne diyor?
        </h2>
      </motion.div>

      {/* Desktop */}
      <div ref={ref} className="hidden md:grid grid-cols-3 gap-6">
        {testimonials.map((t, i) => (
          <motion.div
            key={t.name}
            initial={{ opacity: 0, y: 40 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{
              duration: 0.6,
              delay: i * 0.12,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
          >
            <div className="bento-card p-6 h-full group">
              {/* Quote mark */}
              <svg className="w-8 h-8 text-ai-primary/20 mb-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
              </svg>
              <p className="text-sm text-muted-foreground leading-relaxed italic group-hover:text-foreground/70 transition-colors duration-300">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="flex items-center gap-3 mt-6">
                <div
                  className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold ${t.color} transition-transform duration-300 group-hover:scale-110`}
                >
                  {t.initials}
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Mobile - Horizontal scroll */}
      <div className="md:hidden flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 -mx-6 px-6 scrollbar-none">
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
