"use client";

import { useRef } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import { EmailCta } from "./email-cta";

export function FinalCta() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10% 0px" });
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const bgScale = useTransform(scrollYProgress, [0, 0.5], [0.8, 1]);
  const bgOpacity = useTransform(scrollYProgress, [0, 0.3], [0, 1]);

  return (
    <section ref={ref} className="py-24 relative overflow-hidden">
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-ai-primary/10 via-background to-ai-premium/10 -z-10"
        style={{ scale: bgScale, opacity: bgOpacity }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.673_0.182_276.935/0.06),transparent_70%)] -z-10" />

      <div className="max-w-2xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
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
        </motion.div>
      </div>
    </section>
  );
}
