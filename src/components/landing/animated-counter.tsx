"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedCounterProps {
  value: string; // e.g. "500+", "10,000+", "150+"
  className?: string;
  duration?: number;
}

function parseNumber(val: string): { num: number; prefix: string; suffix: string } {
  const match = val.match(/^([^\d]*)([\d,]+)(.*)$/);
  if (!match) return { num: 0, prefix: "", suffix: val };
  return {
    prefix: match[1],
    num: parseInt(match[2].replace(/,/g, ""), 10),
    suffix: match[3],
  };
}

function formatWithCommas(n: number): string {
  return n.toLocaleString("tr-TR");
}

export function AnimatedCounter({ value, className = "", duration = 2000 }: AnimatedCounterProps) {
  const [displayed, setDisplayed] = useState("0");
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);
  const { num, prefix, suffix } = parseNumber(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          observer.unobserve(el);

          // If not a number, just show value
          if (num === 0 && !value.match(/\d/)) {
            setDisplayed(value);
            return;
          }

          const start = performance.now();
          const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

          const tick = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = easeOutQuart(progress);
            const current = Math.round(easedProgress * num);
            setDisplayed(`${prefix}${formatWithCommas(current)}${suffix}`);
            if (progress < 1) requestAnimationFrame(tick);
          };

          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [num, prefix, suffix, value, duration]);

  return (
    <span ref={ref} className={className}>
      {displayed}
    </span>
  );
}
