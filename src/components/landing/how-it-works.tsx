"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { UserPlus, FolderPlus, Sparkles } from "lucide-react";

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
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10% 0px" });
  const headerRef = useRef<HTMLDivElement>(null);
  const isHeaderInView = useInView(headerRef, { once: true, margin: "-10% 0px" });

  return (
    <section id="nasil-calisir" className="py-24 max-w-5xl mx-auto px-6">
      <motion.div
        ref={headerRef}
        className="text-center mb-16"
        initial={{ opacity: 0, y: 30 }}
        animate={isHeaderInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <p className="text-ai-primary text-sm font-medium tracking-wide uppercase mb-3">
          Nasıl Çalışır
        </p>
        <h2 className="text-3xl lg:text-4xl font-bold text-foreground">
          3 adımda başla
        </h2>
      </motion.div>

      {/* Desktop - Horizontal */}
      <div ref={ref} className="hidden lg:grid grid-cols-3 gap-8 relative">
        {/* Animated connecting line */}
        <motion.div
          className="absolute top-6 left-[16.67%] right-[16.67%] h-px bg-gradient-to-r from-ai-primary/50 via-ai-primary/20 to-ai-primary/50"
          initial={{ scaleX: 0 }}
          animate={isInView ? { scaleX: 1 } : {}}
          transition={{ duration: 1, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{ originX: 0 }}
        />

        {steps.map((step, i) => (
          <motion.div
            key={step.title}
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{
              duration: 0.6,
              delay: 0.2 + i * 0.2,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
          >
            <div className="flex flex-col items-center text-center relative group">
              <motion.div
                className="h-12 w-12 rounded-full bg-ai-primary/10 border border-ai-primary/30 flex items-center justify-center text-ai-primary font-bold text-lg mb-6 relative z-10 bg-background"
                whileHover={{
                  scale: 1.1,
                  boxShadow: "0 0 25px -5px oklch(0.673 0.182 276.935 / 0.3)",
                }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                {step.number}
              </motion.div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Mobile - Vertical */}
      <div className="lg:hidden space-y-8">
        {steps.map((step, i) => (
          <motion.div
            key={step.title}
            initial={{ opacity: 0, x: -20 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{
              duration: 0.5,
              delay: i * 0.15,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
          >
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
          </motion.div>
        ))}
      </div>
    </section>
  );
}
