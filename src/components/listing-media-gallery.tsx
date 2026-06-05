"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";
import Image from "next/image";
import type { ListingPhoto, YachtListing } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ListingMediaGallery({ listing }: { listing: YachtListing }) {
  const photos = listing.photos ?? [];
  const visiblePhotos = photos.slice(0, 2);
  const hiddenCount = Math.max(photos.length - visiblePhotos.length, 0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedPhoto = selectedIndex === null ? null : photos[selectedIndex];

  function openPreview(index: number) {
    if (!photos[index]) return;
    setSelectedIndex(index);
  }

  function stepPreview(direction: -1 | 1) {
    if (selectedIndex === null || photos.length === 0) return;
    setSelectedIndex((selectedIndex + direction + photos.length) % photos.length);
  }

  return (
    <>
      <div
        className={cn(
          "grid h-full min-h-48 gap-4",
          hiddenCount ? "sm:grid-cols-3" : visiblePhotos.length > 1 ? "sm:grid-cols-2" : "sm:grid-cols-1",
        )}
      >
        {(visiblePhotos.length ? visiblePhotos : [undefined]).map((photo, index) => (
          <button
            aria-label={photo ? `Open ${photo.alt}` : `Open ${listing.name} media`}
            className="group min-h-48 min-w-0 overflow-hidden rounded-[12px] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c6ee6]"
            key={photo?.id ?? "listing-media-fallback"}
            onClick={() => openPreview(index)}
            type="button"
          >
            <ListingPhotoTile photo={photo} />
          </button>
        ))}

        {hiddenCount ? (
          <button
            aria-label={`Open all ${photos.length} listing photos`}
            className="group relative min-h-48 overflow-hidden rounded-[12px] border border-[#E7E7E7] bg-[#171719] text-left text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c6ee6]"
            onClick={() => openPreview(2)}
            type="button"
          >
            {photos[2] ? (
              <Image
                alt={photos[2].alt}
                className="object-cover opacity-55 transition-transform duration-300 group-hover:scale-[1.04]"
                fill
                sizes="320px"
                src={photos[2].src}
              />
            ) : null}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(23,23,28,0.22)_0%,rgba(23,23,28,0.68)_100%)]" />
            <div className="relative flex h-full min-h-48 flex-col justify-between p-4">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/16 backdrop-blur">
                <Images className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="bb-display text-2xl font-medium">+{hiddenCount} more</p>
                <p className="mt-1 text-[12px] leading-5 text-white/78">Open fullscreen listing gallery</p>
              </div>
            </div>
          </button>
        ) : null}
      </div>

      {selectedPhoto && selectedIndex !== null ? (
        <div className="fixed inset-0 z-50 grid grid-rows-[auto_minmax(0,1fr)_auto] bg-[#0e0e12]/96 px-5 py-5 text-white">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="bb-mono-label !text-white/58">
                {selectedIndex + 1} / {photos.length}
              </p>
              <h2 className="bb-display mt-1 truncate text-xl font-medium">{listing.name}</h2>
            </div>
            <button
              aria-label="Close photo preview"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/18"
              onClick={() => setSelectedIndex(null)}
              type="button"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="relative mx-auto my-5 flex min-h-0 w-full max-w-7xl items-center justify-center">
            {photos.length > 1 ? (
              <button
                aria-label="Previous photo"
                className="absolute left-0 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/18"
                onClick={() => stepPreview(-1)}
                type="button"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
            ) : null}
            <div className="relative h-full max-h-[72vh] w-full overflow-hidden rounded-[12px]">
              <Image
                alt={selectedPhoto.alt}
                className="object-contain"
                fill
                priority
                sizes="100vw"
                src={selectedPhoto.src}
              />
            </div>
            {photos.length > 1 ? (
              <button
                aria-label="Next photo"
                className="absolute right-0 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/18"
                onClick={() => stepPreview(1)}
                type="button"
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <div className="mx-auto flex w-full max-w-7xl gap-2 overflow-x-auto pb-1">
            {photos.map((photo, index) => (
              <button
                aria-label={`Show ${photo.alt}`}
                className={cn(
                  "relative h-16 w-24 shrink-0 overflow-hidden rounded-[12px] border transition",
                  index === selectedIndex ? "border-white opacity-100" : "border-white/10 opacity-55 hover:opacity-85",
                )}
                key={photo.id}
                onClick={() => setSelectedIndex(index)}
                type="button"
              >
                <Image alt={photo.alt} className="object-cover" fill sizes="96px" src={photo.src} />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

function ListingPhotoTile({
  photo,
}: {
  photo?: ListingPhoto;
}) {
  return (
    <div className="relative h-full min-h-48 overflow-hidden rounded-[12px] border border-[#E7E7E7] bg-[#F1F2EE]">
      {photo ? (
        <Image
          alt={photo.alt}
          className="object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
          fill
          sizes="320px"
          src={photo.src}
        />
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#edf1ee_0%,#F8F3E8_45%,#e5ece8_100%)]" />
      )}
    </div>
  );
}
