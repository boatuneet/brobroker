import Image from "next/image";
import { Building2, CarFront, Ship } from "lucide-react";
import { getListingAssetType, getListingSpecSummary } from "@/lib/services";
import type { YachtListing } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { ProgressBar } from "./ui";

/* Editorial fit card for deal-room shortlists — chip row, hero image,
   title, recommendation + price panel, trade-off footnote. Adapted from
   the broker's YachtFitCard reference to the BroBroker token set. */
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
    <article className="rounded-[12px] border border-[#E7E7E7] bg-white p-5">
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardChip>{type}</CardChip>
            <CardChip>{listing.builder}</CardChip>
            <CardChip>{listing.year}</CardChip>
          </div>
          <span
            className={cn(
              "inline-flex items-center rounded-[8px] px-3 py-1.5 text-[13px] font-semibold tabular-nums",
              fitChip,
            )}
          >
            {fit}% fit
          </span>
        </div>

        <div className="relative h-[250px] overflow-hidden rounded-[12px] border border-[#E7E7E7] bg-[#F1F2EE] lg:h-[340px]">
          {photo ? (
            <>
              <Image
                alt={photo.alt ?? listing.name}
                className="object-cover object-center"
                fill
                sizes="(min-width: 1280px) 1100px, 100vw"
                src={photo.src}
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.02)_0%,rgba(0,0,0,0.14)_100%)]" />
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/85 text-[#233c45]">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
            </div>
          )}
        </div>

        <div>
          <h3 className="bb-display text-2xl font-medium tracking-[-0.01em] text-[#171719]">
            {listing.name}
          </h3>
          <p className="mt-1.5 text-[14px] leading-6 text-[#8E918B]">
            {listing.builder} {listing.model} · {getListingSpecSummary(listing)}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_190px]">
          <div className="rounded-[12px] border border-[#E7E7E7] bg-[#FBFBFB] p-4">
            <p className="bb-mono-label">Recommendation</p>
            <p className="mt-2 text-[14px] leading-6 text-[#5F625E]">{rationale}</p>
          </div>
          <div className="rounded-[12px] border border-[#E7E7E7] bg-white p-4">
            <p className="bb-mono-label">Price</p>
            <p className="mt-2 font-mono text-lg font-semibold tabular-nums text-[#171719]">
              {formatCurrency(listing.priceEur)}
            </p>
            <ProgressBar className="mt-4" tone="green" value={fit} />
          </div>
        </div>

        <p className="text-[13px] leading-6 text-[#8E918B]">Trade-off: {tradeOff}</p>
      </div>
    </article>
  );
}

function CardChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-[8px] bg-[#F1F2EE] px-3 py-1.5 text-[13px] font-semibold text-[#5F625E]">
      {children}
    </span>
  );
}
