"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Badge } from "./ui";

export function ExpandablePreferenceChips({
  items,
}: {
  items: string[];
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(items.length);
  const containerRef = useRef<HTMLDivElement>(null);
  const measuringChipRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const measuringButtonRef = useRef<HTMLButtonElement>(null);
  const gapPx = 6;

  const calculateVisibleCount = useCallback(() => {
    const containerWidth = containerRef.current?.clientWidth ?? 0;
    const measuringButtonWidth = measuringButtonRef.current?.offsetWidth ?? 0;
    const chipWidths = items.map((_, index) => measuringChipRefs.current[index]?.offsetWidth ?? 0);

    if (!containerWidth || chipWidths.some((width) => width === 0)) {
      return;
    }

    const allChipsWidth =
      chipWidths.reduce((total, width) => total + width, 0) + gapPx * Math.max(0, items.length - 1);

    if (allChipsWidth <= containerWidth) {
      setVisibleCount(items.length);
      return;
    }

    for (let count = items.length - 1; count >= 0; count -= 1) {
      const visibleWidth =
        chipWidths.slice(0, count).reduce((total, width) => total + width, 0) +
        gapPx * Math.max(0, count);
      const totalWidth = visibleWidth + measuringButtonWidth;

      if (totalWidth <= containerWidth) {
        setVisibleCount(count);
        return;
      }
    }

    setVisibleCount(0);
  }, [items]);

  useLayoutEffect(() => {
    calculateVisibleCount();

    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(calculateVisibleCount);
    observer.observe(container);

    return () => observer.disconnect();
  }, [calculateVisibleCount]);

  const isCollapsed = !isExpanded && visibleCount < items.length;
  const visibleItems = isExpanded ? items : items.slice(0, visibleCount);
  const hiddenCount = Math.max(0, items.length - visibleCount);

  return (
    <div className="relative mt-3 min-h-8" ref={containerRef}>
      <div
        className={
          isExpanded
            ? "flex flex-wrap gap-1.5"
            : "flex items-center gap-1.5 overflow-hidden whitespace-nowrap pr-px"
        }
      >
        {visibleItems.map((item, index) => (
          <Badge key={`${item}-${index}`} className="shrink-0" tone="neutral">
            {item}
          </Badge>
        ))}
        {isCollapsed ? (
          <button
            className="shrink-0 rounded-full border border-[#d4d4da] bg-[#f1f1f3] px-2.5 py-1 text-[11px] font-semibold text-[#3f3f46] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition-colors hover:border-[#b8b8c0] hover:bg-[#e7e7ea] hover:text-[#17171c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c6ee6]"
            onClick={() => setIsExpanded((current) => !current)}
            type="button"
          >
            +{hiddenCount} more
          </button>
        ) : null}
        {isExpanded && hiddenCount > 0 ? (
          <button
            className="shrink-0 rounded-full border border-[#d4d4da] bg-[#f1f1f3] px-2.5 py-1 text-[11px] font-semibold text-[#3f3f46] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition-colors hover:border-[#b8b8c0] hover:bg-[#e7e7ea] hover:text-[#17171c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c6ee6]"
            onClick={() => setIsExpanded(false)}
            type="button"
          >
            Show less
          </button>
        ) : null}
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none invisible absolute inset-x-0 top-0 flex items-center gap-1.5 overflow-hidden whitespace-nowrap"
      >
        {items.map((item, index) => (
          <span
            key={`${item}-${index}-measure`}
            ref={(node) => {
              measuringChipRefs.current[index] = node;
            }}
          >
            <Badge className="shrink-0" tone="neutral">
              {item}
            </Badge>
          </span>
        ))}
        <button
          className="shrink-0 rounded-full border border-[#d4d4da] bg-[#f1f1f3] px-2.5 py-1 text-[11px] font-semibold text-[#3f3f46]"
          ref={measuringButtonRef}
          tabIndex={-1}
          type="button"
        >
          +{items.length} more
        </button>
      </div>
    </div>
  );
}
