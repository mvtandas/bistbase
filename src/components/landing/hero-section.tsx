"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { GridBackground } from "./grid-background";
import { EmailCta } from "./email-cta";
import { TextReveal, SplitText } from "./text-reveal";

function useMousePosition() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const handler = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handler, { passive: true });
    return () => window.removeEventListener("mousemove", handler);
  }, []);
  return pos;
}

function FloatingCards() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouse = useMousePosition();
  const [tilt, setTilt] = useState({ rotateX: 3, rotateY: -5 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const rotateY = ((mouse.x - centerX) / (rect.width / 2)) * 8;
    const rotateX = -((mouse.y - centerY) / (rect.height / 2)) * 6;
    setTilt({ rotateX, rotateY });
  }, [mouse.x, mouse.y]);

  return (
    <div ref={containerRef} className="flex-1 relative w-full max-w-lg lg:max-w-xl">
      <motion.div
        className="relative w-full aspect-square"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        style={{
          perspective: 1200,
        }}
      >
        <div
          className="w-full h-full transition-transform duration-300 ease-out"
          style={{
            transform: `perspective(1200px) rotateY(${tilt.rotateY}deg) rotateX(${tilt.rotateX}deg)`,
            transformStyle: "preserve-3d",
          }}
        >
          {/* ═══ BACK LAYER: Dashboard skeleton ═══ */}
          <motion.div
            className="absolute inset-0 rounded-2xl border border-border/20 bg-card/40 backdrop-blur-sm p-6"
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            style={{ transform: "translateZ(-20px)" }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="h-3 w-3 rounded-full bg-loss/50" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/50" />
              <div className="h-3 w-3 rounded-full bg-gain/50" />
            </div>
            <div className="space-y-3">
              <div className="h-2 bg-foreground/5 rounded-full w-3/4" />
              <div className="h-2 bg-foreground/5 rounded-full w-1/2" />
              <div className="mt-6 grid grid-cols-3 gap-3">
                <div className="h-16 bg-foreground/[0.03] rounded-lg" />
                <div className="h-16 bg-foreground/[0.03] rounded-lg" />
                <div className="h-16 bg-foreground/[0.03] rounded-lg" />
              </div>
              <div className="h-24 bg-foreground/[0.03] rounded-lg mt-4" />
            </div>
          </motion.div>

          {/* ═══ MID LAYER: AI Analysis card (center, enriched) ═══ */}
          <motion.div
            className="absolute top-[14%] left-[8%] w-[84%] rounded-2xl border border-ai-primary/20 bg-card/60 backdrop-blur-md p-5 shadow-2xl"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            style={{ transform: "translateZ(40px)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">THYAO</span>
                <span className="text-xs text-muted-foreground">Türk Hava Yolları</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-foreground/80">₺312.50</span>
                <span className="text-xs font-medium text-gain bg-gain/10 px-2 py-0.5 rounded-md">
                  +2.34%
                </span>
              </div>
            </div>
            <svg viewBox="0 0 200 50" className="w-full h-12 mb-3">
              <defs>
                <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.765 0.177 163.223)" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="oklch(0.765 0.177 163.223)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon
                points="0,42 20,37 40,39 60,30 80,33 100,24 120,27 140,18 160,21 180,12 200,9 200,50 0,50"
                fill="url(#sparkGrad)"
              />
              <polyline
                points="0,42 20,37 40,39 60,30 80,33 100,24 120,27 140,18 160,21 180,12 200,9"
                fill="none"
                stroke="oklch(0.765 0.177 163.223)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="hero-sparkline"
              />
            </svg>
            {/* AI analysis text lines */}
            <div className="space-y-1.5 mb-3">
              <div className="h-1.5 bg-foreground/10 rounded-full w-full shimmer-line" />
              <div className="h-1.5 bg-foreground/10 rounded-full w-4/5" />
              <div className="h-1.5 bg-foreground/10 rounded-full w-3/5" />
            </div>
            {/* Metrics row inside card */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-background/30 rounded-md px-2 py-1.5 text-center">
                <div className="text-[8px] text-muted-foreground uppercase tracking-wide">Duyarlılık</div>
                <div className="text-[10px] font-semibold text-gain mt-0.5">Pozitif</div>
              </div>
              <div className="bg-background/30 rounded-md px-2 py-1.5 text-center">
                <div className="text-[8px] text-muted-foreground uppercase tracking-wide">Güven</div>
                <div className="text-[10px] font-semibold text-foreground font-mono mt-0.5">%78</div>
              </div>
              <div className="bg-background/30 rounded-md px-2 py-1.5 text-center">
                <div className="text-[8px] text-muted-foreground uppercase tracking-wide">Sinyal</div>
                <div className="text-[10px] font-semibold text-gain mt-0.5">AL</div>
              </div>
            </div>
          </motion.div>

          {/* ═══ LOWER-CENTER: Portfolio summary card ═══ */}
          <motion.div
            className="absolute bottom-[10%] left-[15%] w-[70%] rounded-xl border border-border/25 bg-card/50 backdrop-blur-md p-4 shadow-xl"
            animate={{ y: [0, -7, 0] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
            style={{ transform: "translateZ(50px)" }}
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] font-medium text-foreground/70">Portföy Özeti</span>
              <span className="text-[9px] text-muted-foreground">bugün</span>
            </div>
            <div className="space-y-1.5">
              {[
                { code: "THYAO", price: "₺312.50", pnl: "+2.34%", pos: true },
                { code: "ASELS", price: "₺58.90", pnl: "+1.12%", pos: true },
                { code: "TUPRS", price: "₺178.20", pnl: "-0.87%", pos: false },
              ].map((row) => (
                <div key={row.code} className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-foreground/70 font-mono">{row.code}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-muted-foreground font-mono">{row.price}</span>
                    <span className={`text-[9px] font-mono font-medium ${row.pos ? "text-gain" : "text-loss"}`}>
                      {row.pnl}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2.5 pt-2 border-t border-border/15 flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground">Toplam Değer</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold font-mono text-foreground">₺42.850</span>
                <span className="text-[9px] font-mono font-medium text-gain bg-gain/10 px-1 py-0.5 rounded">+1.8%</span>
              </div>
            </div>
          </motion.div>

          {/* ═══ TOP-LEFT: Risk Skoru ═══ */}
          <motion.div
            className="absolute top-[-2%] left-[-4%] rounded-xl border border-ai-primary/20 bg-card/70 backdrop-blur-md px-3 py-2.5 shadow-xl"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
            style={{ transform: "translateZ(50px)" }}
          >
            <div className="flex items-center gap-2.5">
              <svg width="32" height="32" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="12" fill="none" stroke="oklch(1 0 0 / 0.06)" strokeWidth="3" />
                <circle
                  cx="16" cy="16" r="12"
                  fill="none"
                  stroke="oklch(0.673 0.182 276.935)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="75.4"
                  strokeDashoffset="20"
                  transform="rotate(-90 16 16)"
                  className="animate-gauge-arc"
                />
                <text x="16" y="18" textAnchor="middle" className="fill-foreground" style={{ fontSize: "9px", fontWeight: 700 }}>73</text>
              </svg>
              <div>
                <span className="text-[10px] text-muted-foreground block">Risk Skoru</span>
                <span className="text-xs font-semibold text-ai-primary">Düşük</span>
              </div>
            </div>
          </motion.div>

          {/* ═══ TOP-RIGHT: Notification toast ═══ */}
          <motion.div
            className="absolute top-[-3%] right-[5%] rounded-lg border border-gain/15 bg-card/60 backdrop-blur-md px-3 py-2 shadow-lg"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: [0, 1, 1, 0], x: [20, 0, 0, -10] }}
            transition={{ duration: 4, repeat: Infinity, repeatDelay: 3, ease: "easeInOut", delay: 2 }}
            style={{ transform: "translateZ(70px)" }}
          >
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-full bg-gain/15 flex items-center justify-center">
                <svg className="h-3 w-3 text-gain" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <span className="text-[10px] text-foreground/70 font-medium">ASELS analizi hazır</span>
            </div>
          </motion.div>

          {/* ═══ LEFT-MID: AL Signal (between THYAO & portfolio) ═══ */}
          <motion.div
            className="absolute top-[55%] left-[-4%] rounded-xl border border-gain/20 bg-card/70 backdrop-blur-md px-4 py-3 shadow-2xl"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            style={{ transform: "translateZ(60px)" }}
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gain/10 flex items-center justify-center">
                <svg className="h-4 w-4 text-gain" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="22,7 13.5,15.5 8.5,10.5 2,17" />
                  <polyline points="16,7 22,7 22,13" />
                </svg>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Sinyal</span>
                <span className="text-sm font-semibold text-gain">AL — THYAO</span>
              </div>
            </div>
          </motion.div>

          {/* ═══ RIGHT-MID: Sabah Özeti (between THYAO & portfolio) ═══ */}
          <motion.div
            className="absolute top-[56%] right-[-6%] rounded-lg border border-ai-premium/15 bg-card/60 backdrop-blur-md px-3 py-2.5 shadow-lg"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 1.8 }}
            style={{ transform: "translateZ(48px)" }}
          >
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-ai-premium/10 flex items-center justify-center">
                <svg className="h-3.5 w-3.5 text-ai-premium" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </div>
              <div>
                <span className="text-[9px] text-muted-foreground">Sabah Özeti</span>
                <span className="text-[10px] font-medium text-foreground/80 block">3 hisse analiz edildi</span>
              </div>
            </div>
          </motion.div>

          {/* ═══ RIGHT-UPPER: Daily update badge ═══ */}
          <motion.div
            className="absolute top-[10%] right-[-5%] rounded-lg border border-border/25 bg-card/60 backdrop-blur-md px-2.5 py-1.5 shadow-lg"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            style={{ transform: "translateZ(35px)" }}
          >
            <div className="flex items-center gap-1.5">
              <div className="h-4 w-4 rounded-full bg-gain/10 flex items-center justify-center">
                <svg className="h-2.5 w-2.5 text-gain" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <span className="text-[9px] text-foreground/60 font-medium">Güncel</span>
            </div>
          </motion.div>

          {/* ═══ BOTTOM-LEFT: Sentiment tags ═══ */}
          <motion.div
            className="absolute bottom-[2%] left-[0%] flex gap-1.5"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 2.5 }}
            style={{ transform: "translateZ(55px)" }}
          >
            {[
              { label: "Pozitif", color: "bg-gain/10 text-gain border-gain/15" },
              { label: "Güçlü", color: "bg-ai-primary/10 text-ai-primary border-ai-primary/15" },
            ].map((tag) => (
              <span
                key={tag.label}
                className={`text-[9px] font-medium px-1.5 py-0.5 rounded border ${tag.color}`}
              >
                {tag.label}
              </span>
            ))}
          </motion.div>

          {/* ═══ BOTTOM-RIGHT: AI Confidence ═══ */}
          <motion.div
            className="absolute bottom-[6%] right-[0%] rounded-xl border border-border/30 bg-card/70 backdrop-blur-md px-3.5 py-2.5 shadow-xl"
            animate={{ y: [0, -7, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
            style={{ transform: "translateZ(45px)" }}
          >
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-ai-primary/10 flex items-center justify-center">
                <svg className="h-3.5 w-3.5 text-ai-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">AI Güven</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-16 h-1.5 bg-foreground/10 rounded-full overflow-hidden">
                    <div className="h-full w-[78%] bg-gradient-to-r from-ai-primary to-violet-400 rounded-full" />
                  </div>
                  <span className="text-[10px] font-mono font-semibold text-foreground">%78</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ═══ BOTTOM-RIGHT: Yükseliş tag ═══ */}
          <motion.div
            className="absolute bottom-[2%] right-[2%] flex gap-1.5"
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
            style={{ transform: "translateZ(52px)" }}
          >
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded border bg-gain/10 text-gain border-gain/15">
              Yükseliş Trendi
            </span>
          </motion.div>

          {/* ═══ LEFT-LOWER: Live users ═══ */}
          <motion.div
            className="absolute top-[48%] left-[-1%] rounded-full border border-border/20 bg-card/60 backdrop-blur-md px-2.5 py-1.5 shadow-md"
            animate={{ y: [0, -3, 0], scale: [1, 1.02, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            style={{ transform: "translateZ(42px)" }}
          >
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gain opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-gain" />
              </span>
              <span className="text-[9px] text-foreground/60 font-medium">248 aktif</span>
            </div>
          </motion.div>

          {/* ═══ LEFT-UPPER: SAT signal ═══ */}
          <motion.div
            className="absolute top-[30%] left-[-3%] rounded-md border border-loss/15 bg-card/50 backdrop-blur-md px-2 py-1 shadow-md"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 3 }}
            style={{ transform: "translateZ(28px)" }}
          >
            <div className="flex items-center gap-1.5">
              <svg className="h-2.5 w-2.5 text-loss" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="22,17 13.5,8.5 8.5,13.5 2,7" />
                <polyline points="16,17 22,17 22,11" />
              </svg>
              <span className="text-[9px] font-semibold text-loss">SAT</span>
              <span className="text-[9px] text-muted-foreground">SAHOL</span>
            </div>
          </motion.div>

          {/* ═══ RIGHT-MID-UPPER: TUT signal ═══ */}
          <motion.div
            className="absolute top-[32%] right-[-3%] rounded-md border border-border/20 bg-card/50 backdrop-blur-md px-2 py-1 shadow-md"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut", delay: 2.2 }}
            style={{ transform: "translateZ(32px)" }}
          >
            <div className="flex items-center gap-1.5">
              <svg className="h-2.5 w-2.5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span className="text-[9px] font-semibold text-muted-foreground">TUT</span>
              <span className="text-[9px] text-muted-foreground/70">EREGL</span>
            </div>
          </motion.div>

          {/* ═══ TOP-CENTER: Sparkles AI badge ═══ */}
          <motion.div
            className="absolute top-[4%] left-[38%] rounded-full border border-ai-primary/15 bg-ai-primary/5 backdrop-blur-md px-2.5 py-1 shadow-md"
            animate={{ y: [0, -5, 0], rotate: [0, 2, 0, -2, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
            style={{ transform: "translateZ(65px)" }}
          >
            <div className="flex items-center gap-1.5">
              <svg className="h-3 w-3 text-ai-primary" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41L12 0Z" />
              </svg>
              <span className="text-[9px] font-medium text-ai-primary">AI Analiz</span>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section ref={sectionRef} className="relative min-h-screen flex items-center pt-16 overflow-hidden">
      <motion.div style={{ y: bgY }} className="absolute inset-0 -z-10">
        <GridBackground />
      </motion.div>

      <motion.div style={{ opacity }} className="max-w-7xl mx-auto px-6 w-full py-20 lg:py-0">
        <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-20">
          {/* Left column - Text */}
          <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left">
            <motion.div
              className="inline-flex items-center gap-2 rounded-full border border-ai-primary/20 bg-ai-primary/5 px-4 py-1.5 text-sm text-ai-primary mb-8"
              initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ai-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-ai-primary" />
              </span>
              Yapay Zeka Destekli Analiz
            </motion.div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]">
              <TextReveal delay={0.1}>Borsanın gürültüsünü kapat,</TextReveal>{" "}
              <span className="bg-gradient-to-r from-ai-primary via-violet-400 to-ai-primary bg-[length:200%_auto] bg-clip-text text-transparent inline-block">
                <SplitText delay={0.6}>sinyali yakala.</SplitText>
              </span>
            </h1>

            <motion.p
              className="mt-6 text-lg lg:text-xl text-muted-foreground max-w-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              BİST hisselerini yapay zeka ile günlük analiz et. Her sabah portföyünün
              özetini al, trendin yönünü gör.
            </motion.p>

            <motion.div
              className="mt-8 w-full max-w-md"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.0, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <EmailCta />
            </motion.div>

            <motion.p
              className="mt-3 text-xs text-muted-foreground/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 1.2 }}
            >
              Ücretsiz başla — Kredi kartı gerekmez
            </motion.p>
          </div>

          {/* Right column - Floating cards with 3D tilt */}
          <FloatingCards />
        </div>
      </motion.div>
    </section>
  );
}
