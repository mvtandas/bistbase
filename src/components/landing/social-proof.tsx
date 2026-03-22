"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { AnimatedCounter } from "./animated-counter";

const stats = [
  { value: "500+", label: "Hisse Analizi / Gün" },
  { value: "10.000+", label: "AI Rapor Üretildi" },
  { value: "150+", label: "BİST Hissesi Kapsamı" },
  { value: "Her gün", label: "Güncelleniyor", isText: true },
];

export function SocialProof() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10% 0px" });

  return (
    <section className="py-20 max-w-5xl mx-auto px-6">
      <div ref={ref} className="grid grid-cols-2 lg:grid-cols-4 gap-8">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{
              duration: 0.6,
              delay: i * 0.12,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
          >
            <div className="text-center lg:border-r lg:last:border-r-0 border-border/30 group">
              <div className="text-3xl sm:text-4xl font-bold text-foreground font-mono">
                {stat.isText ? (
                  <span>{stat.value}</span>
                ) : (
                  <AnimatedCounter value={stat.value} />
                )}
              </div>
              <div className="mt-2 text-sm text-muted-foreground group-hover:text-foreground/70 transition-colors">
                {stat.label}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
