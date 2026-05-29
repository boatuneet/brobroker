"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Building2, CarFront, CheckCircle2, Ship } from "lucide-react";
import {
  type BrokerSegment,
  brokerSegments,
  getBuyersForSegment,
  getListingsForSegment,
  normalizeBrokerSegment,
} from "@/lib/broker-segments";
import { persistBrokerSegment } from "@/lib/broker-segment-client";
import { cn } from "@/lib/utils";

const icons = {
  Yacht: Ship,
  Car: CarFront,
  "Real Estate": Building2,
} satisfies Record<BrokerSegment, typeof Ship>;

export function BrokerSegmentSelector({
  currentSegment,
}: {
  currentSegment: BrokerSegment;
}) {
  const router = useRouter();
  const [selectedSegment, setSelectedSegment] = useState(currentSegment);
  const cards = useMemo(
    () =>
      (["Real Estate", "Yacht", "Car"] satisfies BrokerSegment[]).map((segmentId) => {
        const segment = brokerSegments.find((item) => item.id === segmentId) ?? brokerSegments[0];
        return {
          ...segment,
          buyers: getBuyersForSegment(segment.id).length,
          listings: getListingsForSegment(segment.id).length,
        };
      }),
    [],
  );

  async function selectSegment(nextSegment: BrokerSegment) {
    const normalized = normalizeBrokerSegment(nextSegment);
    setSelectedSegment(normalized);
    await persistBrokerSegment(normalized);
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {cards.map((segment) => {
        const active = selectedSegment === segment.id;
        const Icon = icons[segment.id];

        return (
          <button
            key={segment.id}
            aria-pressed={active}
            className={cn(
              "group h-full overflow-hidden rounded-2xl border bg-white text-left transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c6ee6]",
              active
                ? "border-[#003C33] shadow-[0_18px_45px_rgba(0,60,51,0.14)]"
                : "border-[#E7E7E2] hover:-translate-y-0.5 hover:border-[#D9DAD4] hover:shadow-[0_18px_45px_rgba(23,23,28,0.08)]",
            )}
            onClick={() => selectSegment(segment.id)}
            type="button"
          >
            <div className="relative aspect-[16/9] overflow-hidden bg-[#F1F2EE]">
              <Image
                alt=""
                className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]"
                fill
                priority={active}
                sizes="(min-width: 1280px) 330px, (min-width: 1024px) calc((100vw - 180px) / 3), calc(100vw - 48px)"
                src={segment.imageSrc}
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.02)_0%,rgba(0,0,0,0.2)_100%)]" />
              <span
                className={cn(
                  "absolute left-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/92 shadow-[0_10px_28px_rgba(23,23,28,0.14)] backdrop-blur",
                  active ? "text-[#003C33]" : "text-[#5F625E]",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              {active ? (
                <span className="absolute right-4 top-4 inline-flex h-8 items-center gap-1.5 rounded-full bg-[#003C33] px-3 text-[12px] font-medium text-white shadow-[0_10px_28px_rgba(0,60,51,0.24)]">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Selected
                </span>
              ) : null}
            </div>

            <div className="grid gap-4 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-3 sm:block">
                  <div className="min-w-0">
                    <p className="bb-mono-label">{segment.label}</p>
                    <h3 className="bb-display mt-2 text-xl font-medium leading-tight text-[#171719]">
                      {segment.title}
                    </h3>
                  </div>
                  <span
                    className={cn(
                      "inline-flex shrink-0 rounded-full px-3 py-1 text-[12px] font-medium sm:hidden",
                      segment.accentClass,
                    )}
                  >
                    {segment.listings} assets
                  </span>
                </div>
                <p className="mt-2 text-[13px] leading-6 text-[#5F625E]">{segment.description}</p>
                <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.12em] text-[#8E918B]">
                  {segment.buyers} clients in demo data
                </p>
              </div>
              <div className="hidden items-center justify-between gap-3 sm:flex">
                <span className={cn("rounded-full px-3 py-1 text-[12px] font-medium", segment.accentClass)}>
                  {segment.listings} assets
                </span>
                <div className="min-w-0">
                  <p className="bb-mono-label text-right">{active ? "Active workspace" : "Available workspace"}</p>
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
