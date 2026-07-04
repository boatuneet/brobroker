import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getListingSpecSummary } from "@/lib/services";
import type { YachtListing } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { Card } from "./ui";

export interface ShortlistRow {
  listing: YachtListing;
  approvedDocumentCount: number;
}

/* Slim comparison strip for the deal room. Complements the asset grid above
   by putting price · specs · VAT · docs side-by-side across every listing,
   with the docs status doubling as a link into that listing's Documents tab
   so the broker can approve from here. Renders as a dense table on desktop
   and a compact key-value stack on small screens. */
export function ShortlistAtGlance({
  title = "Shortlist at a glance",
  rows,
}: {
  title?: string;
  rows: ShortlistRow[];
}) {
  return (
    <Card className="px-5 py-4 sm:px-6 sm:py-5">
      <div className="flex items-baseline gap-3 pb-3">
        <h2 className="bb-display text-xl font-semibold tracking-[-0.01em] text-[#171719]">
          {title}
        </h2>
      </div>

      {/* Desktop: real table with slim rows. Hidden on small screens. */}
      <div className="hidden lg:block">
        <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-4 border-b border-[#E7E7E7] px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8E918B]">
          <span>Asset</span>
          <span>Price</span>
          <span>Specs</span>
          <span>VAT</span>
          <span>Docs</span>
        </div>
        <ul className="divide-y divide-[#E7E7E7]">
          {rows.map((row) => {
            const specSummary = getListingSpecSummary(row.listing);
            return (
              <li
                key={row.listing.id}
                className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-4 px-1 py-2.5 text-[13px] leading-5"
              >
                <span className="min-w-0 truncate font-medium text-[#171719]" title={row.listing.name}>
                  {row.listing.name}
                </span>
                <span className="whitespace-nowrap font-mono font-semibold tabular-nums text-[#171719]">
                  {formatCurrency(row.listing.priceEur)}
                </span>
                <span className="truncate text-[#5F625E]" title={specSummary}>
                  {specSummary}
                </span>
                <VatBadge status={row.listing.vatStatus} />
                <DocsLink
                  listingId={row.listing.id}
                  count={row.approvedDocumentCount}
                />
              </li>
            );
          })}
        </ul>
      </div>

      {/* Mobile: stacked rows, one card of key/values per listing. */}
      <ul className="grid gap-3 lg:hidden">
        {rows.map((row) => (
          <li
            key={row.listing.id}
            className="grid gap-2 rounded-[8px] border border-[#E7E7E7] px-3 py-3 text-[13px] leading-5"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate font-medium text-[#171719]">
                {row.listing.name}
              </p>
              <p className="whitespace-nowrap font-mono font-semibold tabular-nums text-[#171719]">
                {formatCurrency(row.listing.priceEur)}
              </p>
            </div>
            <p className="text-[#5F625E]">{getListingSpecSummary(row.listing)}</p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <VatBadge status={row.listing.vatStatus} />
              <DocsLink
                listingId={row.listing.id}
                count={row.approvedDocumentCount}
              />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function VatBadge({ status }: { status: YachtListing["vatStatus"] }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center whitespace-nowrap rounded-[8px] px-2 py-0.5 text-[12px] font-medium",
        status === "Unknown"
          ? "bg-[#F1F2EE] text-[#8E918B]"
          : "bg-[#F1F2EE] text-[#5F625E]",
      )}
    >
      {status}
    </span>
  );
}

function DocsLink({ listingId, count }: { listingId: string; count: number }) {
  const hasApproved = count > 0;
  return (
    <Link
      href={`/listings/${listingId}?tab=docs`}
      className={cn(
        "inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-[8px] px-2 py-0.5 text-[12px] font-medium transition-colors hover:brightness-95",
        hasApproved
          ? "bg-[#E1F1EA] text-[#0F8F62]"
          : "bg-[#F2EADC] text-[#A86642]",
      )}
    >
      {hasApproved ? `${count} approved` : "None yet"}
      <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
    </Link>
  );
}
