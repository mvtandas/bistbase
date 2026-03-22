"use client";

import { useRef, useState, type MouseEvent } from "react";
import { motion, useInView } from "framer-motion";
import { Sparkles, TrendingUp, Shield, Target, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function SpotlightCard({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-5% 0px" });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouse = (e: MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <motion.div
      ref={ref}
      className={`relative rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm overflow-hidden group ${className}`}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      onMouseMove={handleMouse}
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(400px circle at ${mousePos.x}px ${mousePos.y}px, oklch(0.673 0.182 276.935 / 0.06), transparent 60%)`,
        }}
      />
      {children}
    </motion.div>
  );
}

export function LiveDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10% 0px" });

  return (
    <section className="py-24 max-w-7xl mx-auto px-6">
      <motion.div
        ref={ref}
        className="text-center mb-12"
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <p className="text-ai-primary text-sm font-medium tracking-wide uppercase mb-3">
          Canlı Demo
        </p>
        <h2 className="text-3xl lg:text-4xl font-bold text-foreground">
          Gerçek AI analizi örneği
        </h2>
        <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
          THYAO için üretilmiş yapay zeka analizinin nasıl göründüğünü keşfet.
        </p>
      </motion.div>

      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* ═══ Main AI Analysis Card (spans 2 cols) ═══ */}
          <SpotlightCard className="lg:col-span-2 lg:row-span-2" delay={0.1}>
            <div className="p-6 relative">
              {/* Glow */}
              <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-ai-primary/5 blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between mb-4 relative">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-ai-primary/10 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-ai-primary" />
                  </div>
                  <div>
                    <span className="text-lg font-bold text-foreground">THYAO</span>
                    <span className="text-sm text-muted-foreground ml-2">Türk Hava Yolları</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-semibold text-foreground font-mono">₺312.50</span>
                  <Badge className="bg-gain/10 text-gain border-gain/20 hover:bg-gain/10">
                    +2.34%
                  </Badge>
                </div>
              </div>

              {/* Sparkline */}
              <svg viewBox="0 0 400 80" className="w-full h-20 mb-4">
                <defs>
                  <linearGradient id="demoGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.765 0.177 163.223)" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="oklch(0.765 0.177 163.223)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polygon
                  points="0,65 30,60 60,58 90,55 120,50 150,52 180,45 210,40 240,42 270,35 300,30 330,25 360,20 390,15 400,12 400,80 0,80"
                  fill="url(#demoGrad)"
                  className="animate-fade-in"
                />
                <polyline
                  points="0,65 30,60 60,58 90,55 120,50 150,52 180,45 210,40 240,42 270,35 300,30 330,25 360,20 390,15 400,12"
                  fill="none"
                  stroke="oklch(0.765 0.177 163.223)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="600"
                  strokeDashoffset="600"
                  className="demo-sparkline-draw"
                />
              </svg>

              {/* AI Analysis text */}
              <div className="border-l-2 border-ai-primary/20 pl-4 space-y-2 mb-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  THYAO, güçlü yolcu trafiği verileri ve artan kargo gelirlerinin etkisiyle
                  günü pozitif kapattı. Hisse, sektör ortalamasının üzerinde bir performans
                  sergileyerek yatırımcı ilgisini yüksek tutmaya devam ediyor.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  KAP&apos;ta paylaşılan üç aylık trafik istatistikleri, yolcu sayısında
                  yıllık bazda %18 artışa işaret ediyor.
                </p>
              </div>

              {/* Metrics row */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[
                  { label: "Duyarlılık", value: "Pozitif", color: "text-gain" },
                  { label: "Güven", value: "%78", color: "text-foreground font-mono" },
                  { label: "Skor", value: "73/100", color: "text-ai-primary font-mono" },
                  { label: "Sinyal", value: "AL", color: "text-gain font-semibold" },
                ].map((m) => (
                  <div key={m.label} className="bg-secondary/50 rounded-lg px-3 py-2 text-center hover:bg-secondary/70 transition-colors">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{m.label}</div>
                    <div className={`text-sm font-semibold ${m.color} mt-0.5`}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-border/20">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-ai-primary" />
                  <span className="text-xs text-muted-foreground">AI Analiz — 23 Mar 2026</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">Güncelleme:</span>
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gain opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-gain" />
                  </span>
                  <span className="text-[10px] text-gain font-medium">Canlı</span>
                </div>
              </div>
            </div>
          </SpotlightCard>

          {/* ═══ Technical Indicators Card ═══ */}
          <SpotlightCard delay={0.2}>
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-7 w-7 rounded-lg bg-ai-primary/10 flex items-center justify-center">
                  <BarChart3 className="h-3.5 w-3.5 text-ai-primary" />
                </div>
                <span className="text-xs font-semibold text-foreground">Teknik Göstergeler</span>
              </div>
              <div className="space-y-3">
                {[
                  { name: "RSI (14)", value: "62.4", status: "Nötr", statusColor: "text-muted-foreground" },
                  { name: "MACD", value: "Pozitif", status: "Al", statusColor: "text-gain" },
                  { name: "Bollinger", value: "Üst bant", status: "Dikkat", statusColor: "text-yellow-400" },
                  { name: "SMA 50", value: "₺298.20", status: "Üstünde", statusColor: "text-gain" },
                ].map((ind) => (
                  <div key={ind.name} className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-foreground/70">{ind.name}</span>
                      <span className="text-[10px] text-muted-foreground ml-1.5">{ind.value}</span>
                    </div>
                    <span className={`text-[10px] font-medium ${ind.statusColor}`}>{ind.status}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-border/15">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Genel Teknik Sinyal</span>
                  <span className="text-[10px] font-semibold text-gain bg-gain/10 px-1.5 py-0.5 rounded">Güçlü Al</span>
                </div>
              </div>
            </div>
          </SpotlightCard>

          {/* ═══ Risk & Score Card ═══ */}
          <SpotlightCard delay={0.3}>
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-7 w-7 rounded-lg bg-ai-primary/10 flex items-center justify-center">
                  <Shield className="h-3.5 w-3.5 text-ai-primary" />
                </div>
                <span className="text-xs font-semibold text-foreground">Risk Analizi</span>
              </div>

              {/* Gauge */}
              <div className="flex justify-center mb-3">
                <svg width="120" height="70" viewBox="0 0 120 70">
                  <path d="M 15 65 A 45 45 0 0 1 105 65" fill="none" stroke="oklch(1 0 0 / 0.06)" strokeWidth="8" strokeLinecap="round" />
                  <path
                    d="M 15 65 A 45 45 0 0 1 105 65"
                    fill="none"
                    stroke="oklch(0.673 0.182 276.935)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray="141"
                    strokeDashoffset="38"
                    className="animate-gauge-arc"
                  />
                  <text x="60" y="56" textAnchor="middle" className="fill-foreground" style={{ fontSize: "20px", fontWeight: 700 }}>73</text>
                  <text x="60" y="67" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: "9px" }}>/100</text>
                </svg>
              </div>

              <div className="space-y-2">
                {[
                  { label: "Volatilite", value: "Düşük", color: "text-gain" },
                  { label: "Beta", value: "0.85", color: "text-foreground font-mono" },
                  { label: "Maks. Düşüş", value: "-4.2%", color: "text-loss" },
                ].map((r) => (
                  <div key={r.label} className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">{r.label}</span>
                    <span className={`text-[10px] font-medium ${r.color}`}>{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </SpotlightCard>

          {/* ═══ Support/Resistance Levels ═══ */}
          <SpotlightCard delay={0.35}>
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-7 w-7 rounded-lg bg-ai-primary/10 flex items-center justify-center">
                  <Target className="h-3.5 w-3.5 text-ai-primary" />
                </div>
                <span className="text-xs font-semibold text-foreground">Destek / Direnç</span>
              </div>

              <div className="space-y-2.5">
                {[
                  { label: "Direnç 2", price: "₺325.00", type: "resistance" },
                  { label: "Direnç 1", price: "₺318.40", type: "resistance" },
                  { label: "Güncel", price: "₺312.50", type: "current" },
                  { label: "Destek 1", price: "₺305.20", type: "support" },
                  { label: "Destek 2", price: "₺298.00", type: "support" },
                ].map((level) => (
                  <div key={level.label} className="flex items-center justify-between">
                    <span className={`text-[10px] ${level.type === "current" ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                      {level.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-px bg-border/30 relative">
                        {level.type === "current" && (
                          <div className="absolute inset-0 bg-ai-primary/50" />
                        )}
                      </div>
                      <span className={`text-[10px] font-mono ${
                        level.type === "resistance" ? "text-loss" :
                        level.type === "support" ? "text-gain" :
                        "text-ai-primary font-semibold"
                      }`}>
                        {level.price}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SpotlightCard>

          {/* ═══ Sector & Comparison ═══ */}
          <SpotlightCard delay={0.4}>
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-7 w-7 rounded-lg bg-ai-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-3.5 w-3.5 text-ai-primary" />
                </div>
                <span className="text-xs font-semibold text-foreground">Sektör Karşılaştırma</span>
              </div>

              <div className="space-y-3">
                {[
                  { name: "THYAO", val: "+2.34%", bar: 85, pos: true, highlight: true },
                  { name: "PGSUS", val: "+1.87%", bar: 70, pos: true, highlight: false },
                  { name: "Havacılık Ort.", val: "+1.52%", bar: 58, pos: true, highlight: false },
                  { name: "BIST 100", val: "+0.45%", bar: 30, pos: true, highlight: false },
                ].map((item) => (
                  <div key={item.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] ${item.highlight ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                        {item.name}
                      </span>
                      <span className={`text-[10px] font-mono font-medium ${item.pos ? "text-gain" : "text-loss"}`}>
                        {item.val}
                      </span>
                    </div>
                    <div className="w-full h-1 bg-foreground/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.highlight ? "bg-gradient-to-r from-ai-primary to-violet-400" : "bg-foreground/10"}`}
                        style={{ width: `${item.bar}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SpotlightCard>

          {/* ═══ Volume & Momentum ═══ */}
          <SpotlightCard delay={0.45}>
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-7 w-7 rounded-lg bg-ai-primary/10 flex items-center justify-center">
                  <BarChart3 className="h-3.5 w-3.5 text-ai-primary" />
                </div>
                <span className="text-xs font-semibold text-foreground">Hacim & Momentum</span>
              </div>

              {/* Mini bar chart */}
              <div className="flex items-end gap-1 h-16 mb-3">
                {[35, 50, 42, 65, 55, 78, 60, 85, 72, 90, 68, 95].map((h, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-sm ${i >= 10 ? "bg-gradient-to-t from-ai-primary to-violet-400" : "bg-foreground/10"}`}
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>

              <div className="space-y-2">
                {[
                  { label: "Günlük Hacim", value: "24.5M", color: "text-foreground font-mono" },
                  { label: "Ort. Hacim (20g)", value: "18.2M", color: "text-muted-foreground font-mono" },
                  { label: "Hacim Değişimi", value: "+34.6%", color: "text-gain font-mono" },
                  { label: "Momentum", value: "Güçlü", color: "text-gain" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">{item.label}</span>
                    <span className={`text-[10px] font-medium ${item.color}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </SpotlightCard>
        </div>
      </div>
    </section>
  );
}
