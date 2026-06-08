"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { YachtListing } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AssetFitCard } from "./asset-fit-card";

export interface AssetFitSlide {
  listing: YachtListing;
  fitScore: number;
  rationale: string;
  tradeOff: string;
}

/* One-card-at-a-time carousel for the deal-room shortlist. The track slides
   horizontally with an eased transform while inactive cards dim, so moving
   between assets reads as one smooth motion. Controls live at the bottom:
   prev / "1 of N" / next. */
export function AssetFitCarousel({ slides }: { slides: AssetFitSlide[] }) {
  const [index, setIndex] = useState(0);
  const count = slides.length;

  if (count === 0) return null;

  function go(delta: number) {
    setIndex((current) => Math.min(count - 1, Math.max(0, current + delta)));
  }

  return (
    <div>
      <div className="overflow-hidden px-5 pt-5 sm:px-6 sm:pt-6">
        <ul
          className="flex transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((slide, slideIndex) => {
            const isActive = slideIndex === index;
            return (
              <li
                key={slide.listing.id}
                aria-hidden={!isActive}
                inert={!isActive}
                className={cn(
                  "w-full min-w-0 shrink-0 px-1 transition-opacity duration-500 motion-reduce:transition-none",
                  isActive ? "opacity-100" : "opacity-30",
                )}
              >
                <AssetFitCard
                  fitScore={slide.fitScore}
                  listing={slide.listing}
                  rationale={slide.rationale}
                  tradeOff={slide.tradeOff}
                />
              </li>
            );
          })}
        </ul>
      </div>

      {count > 1 ? (
        <div className="flex items-center justify-center gap-5 px-6 py-5">
          <CarouselButton
            disabled={index === 0}
            label="Previous asset"
            onClick={() => go(-1)}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </CarouselButton>
          <p aria-live="polite" className="bb-mono-label tabular-nums">
            {index + 1} of {count}
          </p>
          <CarouselButton
            disabled={index === count - 1}
            label="Next asset"
            onClick={() => go(1)}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </CarouselButton>
        </div>
      ) : null}
    </div>
  );
}

function CarouselButton({
  children,
  disabled,
  label,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#D9DAD4] bg-white text-[#171719] transition-colors hover:border-[#003C33] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33] disabled:pointer-events-none disabled:opacity-35"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}
