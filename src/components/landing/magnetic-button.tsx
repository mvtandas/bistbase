"use client";

import { useRef, useState, type ReactNode, type MouseEvent } from "react";

interface MagneticButtonProps {
  children: ReactNode;
  className?: string;
  strength?: number;
  as?: "button" | "a" | "div";
  [key: string]: unknown;
}

export function MagneticButton({
  children,
  className = "",
  strength = 0.3,
  as: Tag = "div",
  ...props
}: MagneticButtonProps) {
  const ref = useRef<HTMLElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouse = (e: MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) * strength;
    const y = (e.clientY - rect.top - rect.height / 2) * strength;
    setPosition({ x, y });
  };

  const handleLeave = () => setPosition({ x: 0, y: 0 });

  return (
    <Tag
      ref={ref as never}
      className={className}
      onMouseMove={handleMouse}
      onMouseLeave={handleLeave}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition: position.x === 0 ? "transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)" : "transform 0.15s ease-out",
      }}
      {...props}
    >
      {children}
    </Tag>
  );
}
