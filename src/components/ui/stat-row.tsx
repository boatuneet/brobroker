import type { ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatRowTrend = "up" | "down" | "neutral";

/* Compact KPI card used in horizontal rows on the dashboard.
   Layout: title (eyebrow) → value (big number, optionally with a unit
   suffix like "K" or "%") → small trend chip on the right (icon + label).

   Designed to flex inside `<div className="flex flex-wrap gap-3">`. Each
   card has a min width so the row wraps cleanly on small screens. */
export function StatRow({
  title,
  value,
  unit,
  trend = "neutral",
  trendLabel,
  href,
  className,
}: {
  title: string;
  value: ReactNode;
  unit?: string;
  trend?: StatRowTrend;
  trendLabel?: string;
  href?: string;
  className?: string;
}) {
  const trendStyles = {
    up: {
      icon: ArrowUpRight,
      pill: "bg-[#E1F1EA] text-[#0F8F62]",
    },
    down: {
      icon: ArrowDownRight,
      pill: "bg-[#F0DDD0] text-[#A86642]",
    },
    neutral: {
      icon: ArrowRight,
      pill: "bg-[#F1F2EE] text-[#5F625E]",
    },
  } as const;
  const TrendIcon = trendStyles[trend].icon;

  const content = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E918B]">
        {title}
      </p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-[1.75rem] font-semibold leading-none tabular-nums text-[#171719]">
          {value}
        </span>
        {unit ? (
          <span className="text-[15px] font-medium text-[#5F625E]">{unit}</span>
        ) : null}
      </div>
      {trendLabel ? (
        <span
          className={cn(
            "mt-3 inline-flex w-fit items-center gap-1 rounded-[8px] px-2 py-0.5 text-[11.5px] font-semibold",
            trendStyles[trend].pill,
          )}
        >
          <TrendIcon className="h-3 w-3" aria-hidden="true" />
          {trendLabel}
        </span>
      ) : null}
    </>
  );

  const base =
    "min-w-[180px] flex-1 rounded-[12px] border border-[#E7E7E7] bg-white p-4 transition-colors";

  if (href) {
    return (
      <a className={cn(base, "hover:border-[#003C33] hover:bg-[#FBFBFB]", className)} href={href}>
        {content}
      </a>
    );
  }

  return <div className={cn(base, className)}>{content}</div>;
}
