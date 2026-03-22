"use client";

import { Activity, BarChart3, Brain, LineChart, Search, ShieldAlert, Zap } from "lucide-react";

function MiniCandlestick() {
  const candles = [
    { o: 35, c: 42, h: 45, l: 32, up: true },
    { o: 42, c: 38, h: 44, l: 36, up: false },
    { o: 38, c: 44, h: 47, l: 37, up: true },
    { o: 44, c: 40, h: 46, l: 38, up: false },
    { o: 40, c: 48, h: 50, l: 39, up: true },
    { o: 48, c: 52, h: 55, l: 46, up: true },
    { o: 52, c: 49, h: 54, l: 47, up: false },
    { o: 49, c: 56, h: 58, l: 48, up: true },
    { o: 56, c: 53, h: 58, l: 51, up: false },
    { o: 53, c: 60, h: 62, l: 52, up: true },
  ];

  const w = 200, h = 60;
  const candleWidth = 10;
  const gap = (w - candles.length * candleWidth) / (candles.length + 1);
  const min = 30, max = 65;
  const range = max - min;
  const scale = (v: number) => h - ((v - min) / range) * (h - 4) - 2;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16">
      {candles.map((c, i) => {
        const x = gap + i * (candleWidth + gap);
        const bodyTop = scale(Math.max(c.o, c.c));
        const bodyBottom = scale(Math.min(c.o, c.c));
        const bodyH = Math.max(bodyBottom - bodyTop, 1);
        const wickTop = scale(c.h);
        const wickBottom = scale(c.l);
        const color = c.up ? "var(--color-gain)" : "var(--color-loss)";
        return (
          <g key={i} className="animate-slide-up" style={{ animationDelay: `${0.3 + i * 0.05}s`, animationFillMode: "both" }}>
            {/* Wick */}
            <line x1={x + candleWidth / 2} y1={wickTop} x2={x + candleWidth / 2} y2={wickBottom} stroke={color} strokeWidth="1" />
            {/* Body */}
            <rect x={x} y={bodyTop} width={candleWidth} height={bodyH} rx="1" fill={color} opacity={c.up ? 1 : 0.7} />
          </g>
        );
      })}
      {/* Moving Average Line */}
      <polyline
        points={candles.map((c, i) => `${gap + i * (candleWidth + gap) + candleWidth / 2},${scale((c.o + c.c) / 2)}`).join(" ")}
        fill="none"
        stroke="var(--color-ai-primary)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="200"
        className="animate-draw-line"
        opacity="0.6"
      />
    </svg>
  );
}

const ANALYSIS_FEATURES = [
  {
    icon: Activity,
    title: "Teknik Göstergeler",
    desc: "RSI, MACD, Bollinger",
    color: "text-ai-primary",
    bg: "bg-ai-primary/10",
    border: "border-ai-primary/20",
  },
  {
    icon: ShieldAlert,
    title: "Risk Metrikleri",
    desc: "VaR, Sharpe, Beta",
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    border: "border-amber-400/20",
  },
  {
    icon: Search,
    title: "Piyasa Taraması",
    desc: "BİST 30/50/100 AI tarama",
    color: "text-ai-premium",
    bg: "bg-ai-premium/10",
    border: "border-ai-premium/20",
  },
  {
    icon: Zap,
    title: "Sinyal Takibi",
    desc: "Golden Cross, RSI sinyalleri",
    color: "text-gain",
    bg: "bg-gain/10",
    border: "border-gain/20",
  },
];

export function StepAnalysis() {
  return (
    <div className="flex flex-col items-center text-center space-y-8">
      {/* Text */}
      <div className="space-y-3 max-w-md">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
          Derinlemesine
          <br />
          <span className="text-ai-premium">Analiz Araçları</span>
        </h1>
        <p className="text-muted-foreground text-base leading-relaxed">
          Teknik göstergeler, risk metrikleri ve AI destekli piyasa taramasıyla
          <span className="text-foreground font-medium"> bilinçli kararlar alın.</span>
        </p>
      </div>

      {/* Chart Preview */}
      <div className="w-full max-w-sm relative">
        <div className="absolute inset-0 bg-ai-premium/5 rounded-2xl blur-xl" />
        <div className="relative rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl overflow-hidden p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <LineChart className="h-3.5 w-3.5 text-ai-primary" />
              <span className="text-xs font-semibold text-foreground">THYAO</span>
              <span className="text-[10px] text-gain font-medium">₺312.40 (+2.8%)</span>
            </div>
            <div className="flex items-center gap-1">
              <Brain className="h-3 w-3 text-ai-primary" />
              <span className="text-[10px] text-ai-primary font-bold">AI</span>
            </div>
          </div>
          <MiniCandlestick />
          {/* Mini indicators row */}
          <div className="mt-3 flex gap-2">
            {[
              { label: "RSI", value: "62", color: "text-gain" },
              { label: "MACD", value: "Yükseliş", color: "text-gain" },
              { label: "BB", value: "Orta", color: "text-amber-400" },
            ].map((ind, i) => (
              <div
                key={ind.label}
                className="flex-1 text-center p-1.5 rounded-lg bg-white/[0.03] border border-border/10 animate-slide-up"
                style={{ animationDelay: `${0.5 + i * 0.1}s`, animationFillMode: "both" }}
              >
                <div className="text-[9px] text-muted-foreground/50 uppercase">{ind.label}</div>
                <div className={`text-[11px] font-bold ${ind.color}`}>{ind.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-2 gap-2.5 w-full max-w-sm">
        {ANALYSIS_FEATURES.map((f, i) => {
          const Icon = f.icon;
          return (
            <div
              key={f.title}
              className={`flex items-start gap-2.5 p-3 rounded-xl ${f.bg} border ${f.border} text-left animate-slide-up`}
              style={{ animationDelay: `${0.6 + i * 0.1}s`, animationFillMode: "both" }}
            >
              <Icon className={`h-4 w-4 ${f.color} shrink-0 mt-0.5`} />
              <div>
                <div className="text-xs font-bold text-foreground">{f.title}</div>
                <div className="text-[10px] text-muted-foreground">{f.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
