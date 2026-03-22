"use client";

import { useEffect, useRef, memo } from "react";
import { createChart, type IChartApi, type ISeriesApi, type SeriesType, ColorType } from "lightweight-charts";

export interface ChartSeries {
  data: { time: string; value: number }[];
  color?: string;
  lineWidth?: number;
  type?: "line" | "area" | "histogram";
  priceScaleId?: string;
  title?: string;
}

interface LightweightChartProps {
  series: ChartSeries[];
  height?: number;
  showGrid?: boolean;
  showCrosshair?: boolean;
  showTimeScale?: boolean;
  showPriceScale?: boolean;
  autoResize?: boolean;
  className?: string;
}

function LightweightChartInner({
  series,
  height = 280,
  showGrid = true,
  showCrosshair = true,
  showTimeScale = true,
  showPriceScale = true,
  autoResize = true,
  className,
}: LightweightChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<ISeriesApi<SeriesType>[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(255, 255, 255, 0.5)",
        fontSize: 11,
      },
      grid: {
        vertLines: { visible: showGrid, color: "rgba(255, 255, 255, 0.04)" },
        horzLines: { visible: showGrid, color: "rgba(255, 255, 255, 0.04)" },
      },
      crosshair: {
        mode: showCrosshair ? 0 : 1,
        vertLine: { color: "rgba(255, 255, 255, 0.1)", width: 1, style: 2, labelVisible: false },
        horzLine: { color: "rgba(255, 255, 255, 0.1)", width: 1, style: 2 },
      },
      timeScale: {
        visible: showTimeScale,
        borderVisible: false,
        timeVisible: false,
      },
      rightPriceScale: {
        visible: showPriceScale,
        borderVisible: false,
      },
      handleScroll: false,
      handleScale: false,
    });

    chartRef.current = chart;

    // Add series
    const refs: ISeriesApi<SeriesType>[] = [];
    for (const s of series) {
      const type = s.type ?? "line";
      const color = s.color ?? "#818cf8";

      if (type === "area") {
        const areaSeries = chart.addAreaSeries({
          lineColor: color,
          topColor: color.replace(")", ", 0.3)").replace("rgb", "rgba").replace("oklch", "oklch"),
          bottomColor: "transparent",
          lineWidth: (s.lineWidth ?? 2) as 1 | 2 | 3 | 4,
          priceScaleId: s.priceScaleId,
          title: s.title,
          crosshairMarkerVisible: showCrosshair,
        });
        // topColor fallback for hex colors
        if (color.startsWith("#")) {
          areaSeries.applyOptions({
            topColor: color + "4D",
            bottomColor: color + "08",
          });
        }
        areaSeries.setData(s.data.map(d => ({ time: d.time, value: d.value })));
        refs.push(areaSeries);
      } else if (type === "histogram") {
        const histSeries = chart.addHistogramSeries({
          color,
          priceScaleId: s.priceScaleId,
          title: s.title,
        });
        histSeries.setData(s.data.map(d => ({ time: d.time, value: d.value })));
        refs.push(histSeries);
      } else {
        const lineSeries = chart.addLineSeries({
          color,
          lineWidth: (s.lineWidth ?? 2) as 1 | 2 | 3 | 4,
          priceScaleId: s.priceScaleId,
          title: s.title,
          crosshairMarkerVisible: showCrosshair,
        });
        lineSeries.setData(s.data.map(d => ({ time: d.time, value: d.value })));
        refs.push(lineSeries);
      }
    }
    seriesRefs.current = refs;

    chart.timeScale().fitContent();

    // Resize observer
    let resizeObserver: ResizeObserver | null = null;
    if (autoResize && containerRef.current) {
      resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          const { width } = entry.contentRect;
          if (width > 0) chart.applyOptions({ width });
        }
      });
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver?.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRefs.current = [];
    };
  }, [series, height, showGrid, showCrosshair, showTimeScale, showPriceScale, autoResize]);

  return <div ref={containerRef} className={className} />;
}

export const LightweightChart = memo(LightweightChartInner);
