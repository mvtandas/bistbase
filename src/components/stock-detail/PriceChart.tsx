"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Period } from "./types";
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
} from "lightweight-charts";

interface ChartBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface OverlayPoint {
  date: string;
  value: number;
}

interface ChartOverlays {
  ma20: OverlayPoint[];
  ma50: OverlayPoint[];
  ma200: OverlayPoint[];
  bbUpper: OverlayPoint[];
  bbLower: OverlayPoint[];
  support: number | null;
  resistance: number | null;
}

interface PriceChartProps {
  bars: ChartBar[];
  overlays: ChartOverlays;
  period: Period;
}

type ChartType = "candlestick" | "line";

const COLORS = {
  gain: "#34d399",
  gainDim: "rgba(52, 211, 153, 0.18)",
  loss: "#fb7185",
  lossDim: "rgba(251, 113, 133, 0.18)",
  ma20: "#3b82f6",
  ma50: "#f59e0b",
  ma200: "#8b5cf6",
  bbBand: "rgba(156, 163, 175, 0.45)",
  support: "rgba(52, 211, 153, 0.7)",
  resistance: "rgba(251, 113, 133, 0.7)",
  grid: "rgba(255, 255, 255, 0.03)",
  border: "rgba(255, 255, 255, 0.08)",
  text: "rgba(255, 255, 255, 0.45)",
  crosshair: "rgba(255, 255, 255, 0.2)",
  bg: "#0a0a0f",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const t = (d: string) => d as any;

/** Remove duplicate dates and ensure ascending order */
function dedup<T extends { date: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  return arr
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((item) => {
      if (seen.has(item.date)) return false;
      seen.add(item.date);
      return true;
    });
}

export function PriceChart({ bars, overlays, period }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const [chartType, setChartType] = useState<ChartType>("candlestick");
  const [showMA20, setShowMA20] = useState(true);
  const [showMA50, setShowMA50] = useState(false);
  const [showMA200, setShowMA200] = useState(false);
  const [showBB, setShowBB] = useState(false);
  const [showSR, setShowSR] = useState(true);

  // Build chart synchronously in useEffect (no async import needed — static import above)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || bars.length === 0) return;

    // Deduplicate and sort bars
    const cleanBars = dedup(bars);

    // Clean previous
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: COLORS.bg },
        textColor: COLORS.text,
        fontFamily: "inherit",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: COLORS.grid },
        horzLines: { color: COLORS.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: COLORS.crosshair, width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#1a1a2e" },
        horzLine: { color: COLORS.crosshair, width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#1a1a2e" },
      },
      timeScale: {
        borderColor: COLORS.border,
        timeVisible: false,
        rightOffset: 5,
        barSpacing: 8,
        minBarSpacing: 3,
      },
      rightPriceScale: {
        borderColor: COLORS.border,
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      handleScroll: { vertTouchDrag: false },
      attributionLogo: false,
    });

    chartRef.current = chart;

    // ── Main Price Series ──
    if (chartType === "candlestick") {
      const mainSeries = chart.addCandlestickSeries({
        upColor: COLORS.gain,
        downColor: COLORS.loss,
        borderUpColor: COLORS.gain,
        borderDownColor: COLORS.loss,
        wickUpColor: COLORS.gain,
        wickDownColor: COLORS.loss,
      });
      mainSeries.setData(
        cleanBars.map((b) => ({ time: t(b.date), open: b.open, high: b.high, low: b.low, close: b.close }))
      );

      if (showSR) {
        if (overlays.support != null) {
          mainSeries.createPriceLine({ price: overlays.support, color: COLORS.support, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "Destek" });
        }
        if (overlays.resistance != null) {
          mainSeries.createPriceLine({ price: overlays.resistance, color: COLORS.resistance, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "Direnç" });
        }
      }
    } else {
      const mainSeries = chart.addAreaSeries({
        topColor: COLORS.gainDim,
        bottomColor: "rgba(52, 211, 153, 0.02)",
        lineColor: COLORS.gain,
        lineWidth: 2,
      });
      mainSeries.setData(
        cleanBars.map((b) => ({ time: t(b.date), value: b.close }))
      );

      if (showSR) {
        if (overlays.support != null) {
          mainSeries.createPriceLine({ price: overlays.support, color: COLORS.support, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "Destek" });
        }
        if (overlays.resistance != null) {
          mainSeries.createPriceLine({ price: overlays.resistance, color: COLORS.resistance, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "Direnç" });
        }
      }
    }

    // ── Volume ──
    const volSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });
    volSeries.setData(
      cleanBars.map((b) => ({ time: t(b.date), value: b.volume, color: b.close >= b.open ? COLORS.gainDim : COLORS.lossDim }))
    );

    // ── Overlay helper ──
    const addLine = (data: OverlayPoint[], color: string, dotted?: boolean) => {
      if (data.length === 0) return;
      const s = chart.addLineSeries({
        color,
        lineWidth: 1,
        ...(dotted ? { lineStyle: LineStyle.Dotted } : {}),
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      s.setData(dedup(data).map((p) => ({ time: t(p.date), value: p.value })));
    };

    // ── Moving Averages ──
    if (showMA20) addLine(overlays.ma20, COLORS.ma20);
    if (showMA50) addLine(overlays.ma50, COLORS.ma50);
    if (showMA200) addLine(overlays.ma200, COLORS.ma200);

    // ── Bollinger Bands ──
    if (showBB) {
      addLine(overlays.bbUpper, COLORS.bbBand, true);
      addLine(overlays.bbLower, COLORS.bbBand, true);
    }

    // Show last 90 bars by default, user can scroll/zoom to see more
    if (cleanBars.length > 90) {
      const from = cleanBars[cleanBars.length - 90].date;
      const to = cleanBars[cleanBars.length - 1].date;
      chart.timeScale().setVisibleRange({ from: t(from), to: t(to) });
    } else {
      chart.timeScale().fitContent();
    }

    // Resize
    const ro = new ResizeObserver(() => {
      if (container && chartRef.current) {
        chartRef.current.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight,
        });
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [bars, overlays, chartType, showMA20, showMA50, showMA200, showBB, showSR]);

  if (bars.length === 0) return null;

  const periodLabel = period === "today" ? "Günlük" : period === "week" ? "Haftalık" : "Aylık";

  return (
    <div className="rounded-2xl border border-border/30 bg-[#0a0a0f] mb-5 overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2.5 border-b border-border/20 bg-card/30">
        <span className="text-xs font-medium text-muted-foreground mr-1.5">{periodLabel} Grafik</span>

        <div className="flex rounded-lg bg-background/50 p-0.5">
          <button
            onClick={() => setChartType("candlestick")}
            className={cn(
              "px-2 py-1 text-[10px] font-medium rounded-md transition-all",
              chartType === "candlestick" ? "bg-ai-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Mum
          </button>
          <button
            onClick={() => setChartType("line")}
            className={cn(
              "px-2 py-1 text-[10px] font-medium rounded-md transition-all",
              chartType === "line" ? "bg-ai-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Çizgi
          </button>
        </div>

        <div className="w-px h-4 bg-border/30 mx-0.5" />

        <ToggleBtn active={showMA20} onClick={() => setShowMA20(!showMA20)} color={COLORS.ma20} label="MA20" />
        <ToggleBtn active={showMA50} onClick={() => setShowMA50(!showMA50)} color={COLORS.ma50} label="MA50" />
        <ToggleBtn active={showMA200} onClick={() => setShowMA200(!showMA200)} color={COLORS.ma200} label="MA200" />

        <div className="w-px h-4 bg-border/30 mx-0.5" />

        <ToggleBtn active={showBB} onClick={() => setShowBB(!showBB)} color={COLORS.bbBand} label="BB" />
        <ToggleBtn active={showSR} onClick={() => setShowSR(!showSR)} color={COLORS.support} label="D/D" />
      </div>

      {/* Chart */}
      <div ref={containerRef} className="w-full [&_a[href*='tradingview']]:!hidden [&_div[class*='attribution']]:!hidden" style={{ height: 400 }} />
    </div>
  );
}

function ToggleBtn({ active, onClick, color, label }: { active: boolean; onClick: () => void; color: string; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-md transition-all",
        active ? "bg-white/10 text-foreground" : "text-muted-foreground/50 hover:text-muted-foreground"
      )}
    >
      <span
        className="h-2 w-2 rounded-full border"
        style={{ backgroundColor: active ? color : "transparent", borderColor: active ? color : "rgba(255,255,255,0.15)" }}
      />
      {label}
    </button>
  );
}
