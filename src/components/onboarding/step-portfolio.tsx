"use client";

import { BarChart3, Bell, Shield, TrendingUp } from "lucide-react";

function MiniGauge() {
  const score = 74;
  const circumference = 2 * Math.PI * 45;
  const progress = (score / 100) * circumference * 0.75; // 270 degree arc

  return (
    <div className="relative w-28 h-28 flex items-center justify-center">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-[135deg]">
        {/* Background arc */}
        <circle
          cx="50" cy="50" r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${circumference * 0.75} ${circumference}`}
          className="text-white/5"
        />
        {/* Progress arc */}
        <circle
          cx="50" cy="50" r="45"
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          className="animate-gauge-arc"
          style={{ strokeDashoffset: 0 }}
        />
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--color-gain)" />
            <stop offset="50%" stopColor="var(--color-ai-primary)" />
            <stop offset="100%" stopColor="var(--color-ai-premium)" />
          </linearGradient>
        </defs>
      </svg>
      {/* Score text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-foreground tabular-nums">{score}</span>
        <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">Sağlık</span>
      </div>
    </div>
  );
}

function MiniSparkline() {
  const points = [30, 28, 35, 32, 38, 36, 42, 40, 45, 48, 44, 50, 52, 49, 55, 58, 54, 60, 62];
  const w = 160, h = 40;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const pathPoints = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((p - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-gain)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--color-gain)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pathPoints} ${w},${h}`} fill="url(#sparkFill)" />
      <polyline
        points={pathPoints}
        fill="none"
        stroke="var(--color-gain)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="300"
        className="animate-draw-line"
      />
    </svg>
  );
}

const FEATURES = [
  { icon: Shield, label: "Risk Analizi", color: "text-ai-primary", bg: "bg-ai-primary/10" },
  { icon: Bell, label: "Akıllı Uyarılar", color: "text-amber-400", bg: "bg-amber-400/10" },
  { icon: BarChart3, label: "Backtest", color: "text-ai-premium", bg: "bg-ai-premium/10" },
];

export function StepPortfolio() {
  return (
    <div className="flex flex-col items-center text-center space-y-8">
      {/* Text */}
      <div className="space-y-3 max-w-md">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
          Portföyünüz,
          <br />
          <span className="text-ai-primary">Tek Bakışta</span>
        </h1>
        <p className="text-muted-foreground text-base leading-relaxed">
          Portföy sağlık skoru, performans grafiği ve günlük AI uyarılarıyla
          <span className="text-foreground font-medium"> yatırımlarınızı anlık takip edin.</span>
        </p>
      </div>

      {/* Dashboard Preview - Glassmorphism Card */}
      <div className="w-full max-w-sm relative">
        <div className="absolute inset-0 bg-ai-primary/5 rounded-2xl blur-xl" />
        <div className="relative rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl overflow-hidden">
          {/* Header bar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/20">
            <TrendingUp className="h-3.5 w-3.5 text-gain" />
            <span className="text-xs font-semibold text-foreground">Portföy Özeti</span>
            <span className="ml-auto text-[10px] text-gain font-medium">+4.2%</span>
          </div>

          <div className="p-4 space-y-4">
            {/* Gauge + Sparkline Row */}
            <div className="flex items-center gap-4">
              <MiniGauge />
              <div className="flex-1 space-y-2">
                <div>
                  <div className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Toplam Değer</div>
                  <div className="text-lg font-bold text-foreground tabular-nums">₺142,850</div>
                </div>
                <MiniSparkline />
              </div>
            </div>

            {/* Mini Holdings */}
            <div className="flex gap-2">
              {["THYAO", "ASELS", "FROTO"].map((code, i) => (
                <div
                  key={code}
                  className="flex-1 text-center p-2 rounded-lg bg-white/[0.03] border border-border/10 animate-slide-up"
                  style={{ animationDelay: `${0.3 + i * 0.1}s`, animationFillMode: "both" }}
                >
                  <div className="text-[11px] font-bold text-foreground">{code}</div>
                  <div className={`text-[10px] font-medium ${i === 2 ? "text-loss" : "text-gain"}`}>
                    {i === 2 ? "-1.3%" : i === 0 ? "+3.7%" : "+2.1%"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Feature Pills */}
      <div className="flex flex-wrap justify-center gap-2">
        {FEATURES.map((f, i) => {
          const Icon = f.icon;
          return (
            <div
              key={f.label}
              className={`flex items-center gap-2 px-4 py-2 rounded-full ${f.bg} border border-border/10 animate-slide-up`}
              style={{ animationDelay: `${0.5 + i * 0.1}s`, animationFillMode: "both" }}
            >
              <Icon className={`h-3.5 w-3.5 ${f.color}`} />
              <span className="text-xs font-medium text-foreground">{f.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
