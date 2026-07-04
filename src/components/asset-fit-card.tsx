import Image from "next/image";
import { Building2, CarFront, Ship } from "lucide-react";
import { getListingAssetType, getListingSpecSummary } from "@/lib/services";
import type { YachtListing } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";

/* Compact image-overlay asset card for deal-room shortlists. The hero is a
   4:3 photo with brand/year and fit pills over gradient scrims, plus the
   title and price laid on top of the image. Below the image sits a tight
   rationale + trade-off block. Placeholder covers the no-photo case. */
export function AssetFitCard({
  listing,
  fitScore,
  rationale,
  tradeOff,
}: {
  listing: YachtListing;
  fitScore: number;
  rationale: string;
  tradeOff: string;
}) {
  const fit = Math.round(Math.max(0, Math.min(100, fitScore)));
  const type = getListingAssetType(listing);
  const photo = listing.photos?.[0];
  const Icon = type === "Car" ? CarFront : type === "Real Estate" ? Building2 : Ship;
  const fitChip =
    fit >= 70
      ? "bg-[#E1F1EA] text-[#0F8F62]"
      : fit >= 40
        ? "bg-[#F2EADC] text-[#A86642]"
        : "bg-[#F1F2EE] text-[#5F625E]";

  return (
    <article className="overflow-hidden rounded-[12px] border border-[#E7E7E7] bg-white">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#F1F2EE]">
        {photo ? (
          <Image
            alt={photo.alt ?? listing.name}
            className="object-cover object-center"
            fill
            sizes="(min-width: 1280px) 1100px, 100vw"
            src={photo.src}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-[#233c45]">
              <Icon className="h-7 w-7" aria-hidden="true" />
            </span>
          </div>
        )}

        {/* Top scrim — legibility for pills */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(0,0,0,0.55)_0%,rgba(0,0,0,0)_100%)]"
        />
        {/* Bottom scrim — legibility for title/price */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,0.15)_35%,rgba(0,0,0,0.72)_100%)]"
        />

        {/* Top-left: brand · year */}
        <div className="absolute left-4 top-4 flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-white/95 px-3 py-1 text-[12px] font-semibold text-[#171719] shadow-[0_1px_2px_rgba(0,0,0,0.12)] backdrop-blur">
            {listing.builder} · {listing.year}
          </span>
        </div>

        {/* Top-right: fit pill */}
        <div className="absolute right-4 top-4">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold tabular-nums shadow-[0_1px_2px_rgba(0,0,0,0.18)]",
              fitChip,
            )}
          >
            {fit}% fit
          </span>
        </div>

        {/* Bottom: title + price overlaid on image */}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5">
          <h3
            className="bb-display flex-1 text-2xl font-medium leading-tight tracking-[-0.01em] text-white [text-shadow:0_1px_16px_rgba(0,0,0,0.55)]"
          >
            {listing.name}
          </h3>
          <p className="whitespace-nowrap font-mono text-lg font-semibold tabular-nums text-white [text-shadow:0_1px_16px_rgba(0,0,0,0.55)]">
            {formatCurrency(listing.priceEur)}
          </p>
        </div>
      </div>

      {/* Compact info strip below image */}
      <div className="grid gap-3 p-5">
        <p className="text-[13px] leading-5 text-[#8E918B]">
          {listing.builder} {listing.model} · {getListingSpecSummary(listing)}
        </p>
        <p className="text-[14px] leading-6 text-[#5F625E]">{rationale}</p>
        <p className="border-t border-[#E7E7E7] pt-3 text-[13px] leading-5 text-[#8E918B]">
          <span className="bb-mono-label mr-2 text-[#171719]">Trade-off</span>
          {tradeOff}
        </p>
      </div>
    </article>
  );
}
