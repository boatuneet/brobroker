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
      ? "#003C33"
      : tone === "coral"
        ? "#A86642"
        : tone === "ivory"
          ? "#F2EADC"
          : "#171719";
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
          tone === "ivory" ? "text-white" : "text-[#171719]",
        )}
      >
        {label ?? `${Math.round(clamped)}`}
      </span>
    </div>
  );
}

/* HalfGauge — segmented semicircle gauge.
   N radial bars span 180°. The first `activeCount` bars are filled in the
   ramp color; the rest fade out to a lighter tint of the same family so the
   gauge always reads "how much of the dial is lit?" without needing a track
   ring. Drop-in replacement for FitRing when a card has room for a more
   editorial visualization. Server-renderable (pure SVG). */
export function HalfGauge({
  label,
  segments = 13,
  size = 160,
  sublabel,
  tone = "coral",
  value,
}: {
  label?: string;
  segments?: number;
  size?: number;
  sublabel?: string;
  tone?: "coral" | "green" | "ink";
  value: number;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  /* Round up so a non-zero value always lights at least one bar — otherwise
     1% reads as identical to 0%. */
  const activeCount =
    clamped === 0 ? 0 : Math.max(1, Math.round((clamped / 100) * segments));
  const cx = size / 2;
  /* Taller container + cy lifted from the bottom create breathing room
     between the bottom-most bars (at 0° / 180°) and the centered label. */
  const viewHeight = Math.round(size * 0.72);
  const cy = viewHeight - 22;
  const outerR = size * 0.46;
  const innerR = size * 0.3;
  /* Bars taper: narrower at the inner end, wider at the outer end. */
  const baseWidth = Math.max(6, Math.round(size * 0.045));
  const innerWidth = baseWidth * 0.62;
  const outerWidth = baseWidth * 1.12;

  const activeColor =
    tone === "coral" ? "#A86642"
    : tone === "green" ? "#003C33"
    : "#171719";
  const inactiveColor =
    tone === "coral" ? "#f1ddd0"
    : tone === "green" ? "#F1F2EE"
    : "#E7E7E7";

  return (
    <div
      className="relative inline-flex items-end justify-center"
      style={{ width: size, height: viewHeight }}
    >
      <svg
        aria-hidden="true"
        height={viewHeight}
        viewBox={`0 0 ${size} ${viewHeight}`}
        width={size}
      >
        {Array.from({ length: segments }).map((_, i) => {
          const angle = 180 - (180 / (segments - 1)) * i;
          const isActive = i < activeCount;
          return (
            <path
              d={taperedBarPath({
                angleDeg: angle,
                cx,
                cy,
                innerR,
                innerWidth,
                outerR,
                outerWidth,
              })}
              fill={isActive ? activeColor : inactiveColor}
              key={i}
            />
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-x-0 bottom-2 grid place-items-center text-center">
        {/* Label + sublabel scale with `size` so they don't collide with the
            bars when the gauge is rendered small (dashboard tile) vs large
            (standalone). At size=128 → label ≈16px; at 180 → ≈22px. */}
        <span
          className="bb-display font-medium leading-none tabular-nums text-[#171719]"
          style={{ fontSize: Math.max(13, Math.round(size * 0.125)) }}
        >
          {label ?? `${Math.round(clamped)}%`}
        </span>
        {sublabel ? (
          <span
            className="mt-1 leading-4 text-[#8E918B]"
            style={{ fontSize: Math.max(9, Math.round(size * 0.065)) }}
          >
            {sublabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* Build an SVG path for a tapered, capsule-shaped radial bar.
   Inner end uses innerWidth; outer end uses outerWidth; rounded caps at both
   ends. Path traced as: inner-left → outer-left → arc → outer-right →
   inner-right → arc → inner-left. */
function taperedBarPath({
  angleDeg,
  cx,
  cy,
  innerR,
  innerWidth,
  outerR,
  outerWidth,
}: {
  angleDeg: number;
  cx: number;
  cy: number;
  innerR: number;
  innerWidth: number;
  outerR: number;
  outerWidth: number;
}): string {
  const rad = (angleDeg * Math.PI) / 180;
  /* Radial unit vector (toward outer end). SVG y-down: cos for x, -sin for y. */
  const rxU = Math.cos(rad);
  const ryU = -Math.sin(rad);
  /* Tangent unit vector (perpendicular, clockwise from radial in screen space). */
  const txU = Math.sin(rad);
  const tyU = Math.cos(rad);

  const pInX = cx + innerR * rxU;
  const pInY = cy + innerR * ryU;
  const pOutX = cx + outerR * rxU;
  const pOutY = cy + outerR * ryU;

  const iw = innerWidth / 2;
  const ow = outerWidth / 2;

  const ilX = pInX - iw * txU;
  const ilY = pInY - iw * tyU;
  const irX = pInX + iw * txU;
  const irY = pInY + iw * tyU;
  const olX = pOutX - ow * txU;
  const olY = pOutY - ow * tyU;
  const orX = pOutX + ow * txU;
  const orY = pOutY + ow * tyU;

  return [
    `M ${ilX} ${ilY}`,
    `L ${olX} ${olY}`,
    `A ${ow} ${ow} 0 0 1 ${orX} ${orY}`,
    `L ${irX} ${irY}`,
    `A ${iw} ${iw} 0 0 1 ${ilX} ${ilY}`,
    "Z",
  ].join(" ");
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
            ? "bg-[#A86642] text-[#f7efe5]"
            : item.tone === "ink"
              ? "bg-[#171719] text-white"
              : "bg-[#003C33] text-[#F2EADC]";
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
            <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.14em] text-[#5F625E]">
              {item.label}
            </p>
            {item.detail ? (
              <p className="mt-1 text-[11px] text-[#8E918B]">{item.detail}</p>
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
                "w-full rounded-t-[4px] transition-all",
                isHigh ? "bg-[#A86642]" : "bg-[#171719]/15",
              )}
              role="img"
              style={{ height: Math.max(2, h) }}
            />
            <span className="truncate text-[9px] font-medium uppercase tracking-[0.12em] text-[#8E918B]">
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
        "inline-flex items-center gap-2 rounded-[8px] px-3 py-1.5",
        tone === "ivory"
          ? "bg-[#F2EADC]/15 text-[#F2EADC]"
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
      ? "bg-[#171719] text-white"
      : tone === "cream"
        ? "bg-[#F2EADC] text-[#171719]"
        : tone === "outline"
          ? "border border-[#E7E7E7] bg-transparent text-[#171719]"
          : "bg-white text-[#171719] border border-[#E7E7E7]";
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[12px] p-5 sm:p-6",
        base,
        className,
      )}
    >
      {children}
    </div>
  );
}
