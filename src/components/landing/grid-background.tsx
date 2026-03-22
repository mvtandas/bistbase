"use client";

import { useEffect, useRef } from "react";

export function GridBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      // Animated gradient orbs
      const orbs = [
        {
          x: w * 0.3 + Math.sin(time * 0.4) * w * 0.1,
          y: h * 0.4 + Math.cos(time * 0.3) * h * 0.1,
          r: w * 0.35,
          color: "oklch(0.673 0.182 276.935 / 0.04)",
        },
        {
          x: w * 0.7 + Math.cos(time * 0.35) * w * 0.08,
          y: h * 0.3 + Math.sin(time * 0.45) * h * 0.08,
          r: w * 0.3,
          color: "oklch(0.541 0.281 293.009 / 0.03)",
        },
        {
          x: w * 0.5 + Math.sin(time * 0.5) * w * 0.12,
          y: h * 0.6 + Math.cos(time * 0.25) * h * 0.1,
          r: w * 0.25,
          color: "oklch(0.765 0.177 163.223 / 0.02)",
        },
      ];

      for (const orb of orbs) {
        const gradient = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r);
        gradient.addColorStop(0, orb.color);
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
      }

      // Dot grid
      const spacing = 32;
      const dotRadius = 0.8;
      const centerX = w / 2;
      const centerY = h / 2;
      const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);

      ctx.fillStyle = `oklch(1 0 0 / ${0.035 + Math.sin(time * 0.5) * 0.01})`;

      for (let x = spacing; x < w; x += spacing) {
        for (let y = spacing; y < h; y += spacing) {
          const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
          const fade = Math.max(0, 1 - dist / (maxDist * 0.7));
          if (fade <= 0) continue;

          ctx.globalAlpha = fade;
          ctx.beginPath();
          ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1;
      time += 0.008;
      animationId = requestAnimationFrame(draw);
    };

    // Only animate on desktop for performance
    const mq = window.matchMedia("(min-width: 768px)");
    if (mq.matches) {
      animationId = requestAnimationFrame(draw);
    } else {
      // Static fallback for mobile
      draw();
    }

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ willChange: "auto" }}
      />
      {/* Radial glow overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.673_0.182_276.935/0.06),transparent_70%)]" />
    </div>
  );
}
