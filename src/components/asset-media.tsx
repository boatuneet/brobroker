import { Building2, CarFront, Ship } from "lucide-react";
import Image from "next/image";
import { getListingAssetType } from "@/lib/services";
import type { YachtListing } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "./ui";

export function AssetMedia({
  listing,
  className,
  compact = false,
  showChrome = true,
  photoIndex = 0,
}: {
  listing: YachtListing;
  className?: string;
  compact?: boolean;
  showChrome?: boolean;
  photoIndex?: number;
}) {
  const type = getListingAssetType(listing);
  const photo = listing.photos?.[photoIndex] ?? listing.photos?.[0];
  const Icon = type === "Car" ? CarFront : type === "Real Estate" ? Building2 : Ship;
  const tone =
    type === "Car"
      ? "bg-[#ebe7e0] text-[#3c2f2f]"
      : type === "Real Estate"
        ? "bg-[#e7ece7] text-[#263c32]"
        : "bg-[#e7ecef] text-[#233c45]";

  return (
    <div
      className={cn(
        "relative flex aspect-[16/10] min-h-44 w-full overflow-hidden rounded-2xl border border-[#e5e7eb]",
        photo ? "bg-[#edeae3]" : tone,
        className,
      )}
    >
      {photo ? (
        <>
          <Image
            alt={photo.alt}
            className="object-cover object-center"
            fill
            sizes={compact ? "420px" : "520px"}
            src={photo.src}
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.02)_0%,rgba(0,0,0,0.26)_100%)]" />
        </>
      ) : (
        <>
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-white/35" />
          <div className="absolute left-0 top-0 h-full w-1/4 bg-white/30" />
        </>
      )}
      {showChrome ? (
        <div className="relative flex h-full w-full flex-col justify-between p-4">
          <div className="flex items-start justify-between gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/80">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <Badge tone="neutral">{type}</Badge>
          </div>
          {!compact ? (
            <div>
              <p className={cn("bb-display text-base font-medium", photo ? "text-white" : "text-[#17171c]")}>
                {listing.name}
              </p>
              <p className={cn("mt-1 text-[12px] leading-5", photo ? "text-white/82" : "text-[#3f3f46]")}>
                {listing.location}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
