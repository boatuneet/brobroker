"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

/* Page title that fades its letters in (rising up, staggered) once on mount —
   i.e. once per navigation when keyed by the title. CSS-only, no dependency,
   and respects prefers-reduced-motion. Letters are aria-hidden with an
   aria-label on the heading so screen readers still announce the whole word.
   `leading-[1.3]` keeps descenders (g/y) from clipping. */
const STAGGER_SECONDS = 0.04;
const NBSP = " ";

export function AnimatedTitle({ text, className }: { text: string; className?: string }) {
  const letters = useMemo(() => Array.from(text), [text]);

  return (
    <h1
      aria-label={text}
      className={cn(
        "whitespace-nowrap text-[18px] font-semibold leading-[1.3] text-[#171719]",
        className,
      )}
    >
      {letters.map((char, index) => (
        <span
          aria-hidden="true"
          className="bb-fade-up-letter"
          key={`${char}-${index}`}
          style={{
            display: "inline-block",
            animationName: "bb-fade-in-up",
            animationDuration: "400ms",
            animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            animationFillMode: "both",
            animationDelay: `${index * STAGGER_SECONDS}s`,
          }}
        >
          {char === " " ? NBSP : char}
        </span>
      ))}
    </h1>
  );
}
