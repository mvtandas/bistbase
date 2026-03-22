"use client";

import { useEffect, useRef } from "react";
import { motion, useInView, useAnimation, type Variant } from "framer-motion";

interface TextRevealProps {
  children: string;
  className?: string;
  delay?: number;
  once?: boolean;
}

const wordVariants = {
  hidden: {
    opacity: 0,
    y: 20,
    filter: "blur(8px)",
  } as Variant,
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
  } as Variant,
};

export function TextReveal({
  children,
  className = "",
  delay = 0,
  once = true,
}: TextRevealProps) {
  const controls = useAnimation();
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once, margin: "-10% 0px" });

  useEffect(() => {
    if (isInView) {
      controls.start("visible");
    }
  }, [isInView, controls]);

  const words = children.split(" ");

  return (
    <motion.span ref={ref} className={`inline ${className}`} aria-label={children}>
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          className="inline-block mr-[0.25em]"
          variants={wordVariants}
          initial="hidden"
          animate={controls}
          transition={{
            duration: 0.5,
            delay: delay + i * 0.04,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        >
          {word}
        </motion.span>
      ))}
    </motion.span>
  );
}

/* Split text with gradient support */
interface SplitTextProps {
  children: string;
  className?: string;
  delay?: number;
}

const charVariants = {
  hidden: { opacity: 0, y: 30 } as Variant,
  visible: { opacity: 1, y: 0 } as Variant,
};

export function SplitText({ children, className = "", delay = 0 }: SplitTextProps) {
  const controls = useAnimation();
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10% 0px" });

  useEffect(() => {
    if (isInView) controls.start("visible");
  }, [isInView, controls]);

  return (
    <motion.span ref={ref} className={`inline-block ${className}`} aria-label={children}>
      {children.split("").map((char, i) => (
        <motion.span
          key={`${char}-${i}`}
          className="inline-block"
          style={{ whiteSpace: char === " " ? "pre" : undefined }}
          variants={charVariants}
          initial="hidden"
          animate={controls}
          transition={{
            duration: 0.35,
            delay: delay + i * 0.02,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        >
          {char}
        </motion.span>
      ))}
    </motion.span>
  );
}
