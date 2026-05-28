import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ============================================================
   Dashboard-only visualisations.
   All pure SVG/CSS, no external chart deps. Server-renderable.
   ============================================================ */

/* FitRing — circular progress with a numeric label in the center.
   Used for hot-buyer fit scores and matching cards. */
export function FitRing({
  value,
  size = 56,
  stroke = 5,
  tone = "ink",
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: "ink" | "green" | "coral" | "ivory";
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circumference;
  const color =
    tone === "green"
      ? "#003c33"
      : tone === "coral"
        ? "#9f4f2e"
        : tone === "ivory"
          ? "#f4ead5"
          : "#17171c";
  const track =
    tone === "ivory" ? "rgba(255,255,255,0.18)" : "rgba(23,23,28,0.08)";

  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        aria-hidden="true"
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        width={size}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={track}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={color}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeDashoffset={circumference / 4}
          strokeLinecap="round"
          strokeWidth={stroke}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span
        className={cn(
          "absolute font-mono text-[12px] font-semibold tabular-nums",
          tone === "ivory" ? "text-white" : "text-[#17171c]",
        )}
      >
        {label ?? `${Math.round(clamped)}`}
      </span>
    </div>
  );
}

/* BubbleCluster — three sized circles in a triangle arrangement.
   Reads pipeline composition at a glance: buyers/listings/verifications. */
export function BubbleCluster({
  items,
}: {
  items: Array<{
    label: string;
    value: number;
    detail?: string;
    tone?: "green" | "coral" | "ink";
  }>;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="relative grid grid-cols-3 items-end gap-3">
      {items.map((item) => {
        const ratio = item.value / max;
        const size = 56 + ratio * 62; // 56–118px
        const bg =
          item.tone === "coral"
            ? "bg-[#9f4f2e] text-[#f7efe5]"
            : item.tone === "ink"
              ? "bg-[#17171c] text-white"
              : "bg-[#003c33] text-[#f4ead5]";
        return (
          <div className="flex flex-col items-center" key={item.label}>
            <div
              className={cn(
                "flex shrink-0 items-center justify-center rounded-full",
                bg,
              )}
              style={{ width: size, height: size }}
            >
              <span className="bb-display text-2xl font-medium tabular-nums leading-none">
                {item.value}
              </span>
            </div>
            <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.14em] text-[#3f3f46]">
              {item.label}
            </p>
            {item.detail ? (
              <p className="mt-1 text-[11px] text-[#75758a]">{item.detail}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/* Sparkbars — small vertical bar chart strip. Pass numeric series + labels. */
export function Sparkbars({
  data,
  highlightIndex,
  height = 56,
}: {
  data: Array<{ label: string; value: number }>;
  highlightIndex?: number;
  height?: number;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex w-full items-end gap-1.5" style={{ height }}>
      {data.map((d, i) => {
        const h = (d.value / max) * height;
        const isHigh = i === highlightIndex;
        return (
          <div className="flex flex-1 flex-col items-center gap-1.5" key={d.label}>
            <div
              aria-label={`${d.label}: ${d.value}`}
              className={cn(
                "w-full rounded-t-[3px] transition-all",
                isHigh ? "bg-[#9f4f2e]" : "bg-[#17171c]/15",
              )}
              role="img"
              style={{ height: Math.max(2, h) }}
            />
            <span className="truncate text-[9px] font-medium uppercase tracking-[0.12em] text-[#75758a]">
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* StatBadge — pill with mono label and number, used on the hero anchor tile. */
export function StatBadge({
  label,
  value,
  tone = "ivory",
}: {
  label: string;
  value: string;
  tone?: "ivory" | "outline";
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5",
        tone === "ivory"
          ? "bg-[#f4ead5]/15 text-[#f4ead5]"
          : "border border-white/20 bg-transparent text-white/85",
      )}
    >
      <span className="text-[10px] font-medium uppercase tracking-[0.16em] opacity-75">
        {label}
      </span>
      <span className="font-mono text-[13px] font-semibold tabular-nums">
        {value}
      </span>
    </div>
  );
}

/* Tile — a rounded panel used for non-anchor visualisations.
   Provides consistent padding + radius without forcing a CardHeader shape. */
export function Tile({
  className,
  children,
  tone = "paper",
}: {
  className?: string;
  children: ReactNode;
  tone?: "paper" | "cream" | "ink" | "outline";
}) {
  const base =
    tone === "ink"
      ? "bg-[#17171c] text-white"
      : tone === "cream"
        ? "bg-[#f4ead5] text-[#17171c]"
        : tone === "outline"
          ? "border border-[#e5e7eb] bg-transparent text-[#17171c]"
          : "bg-white text-[#17171c] border border-[#ececef]";
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[22px] p-5 sm:p-6",
        base,
        className,
      )}
    >
      {children}
    </div>
  );
}
