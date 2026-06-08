import { getListingSpecSummary } from "@/lib/services";
import type { YachtListing } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { Card } from "./ui";

export interface ShortlistRow {
  listing: YachtListing;
  approvedDocumentCount: number;
}

/* Comparison card for the deal room — each asset is its own bordered row
   with asset / price / specs / status columns; columns gain labels and
   stack on small screens. Adapted from the broker's ShortlistAtGlanceCard
   reference to the BroBroker token set. */
export function ShortlistAtGlance({
  eyebrow = "Comparison",
  title = "Shortlist at a glance",
  rows,
}: {
  eyebrow?: string;
  title?: string;
  rows: ShortlistRow[];
}) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="px-1 pb-6">
        <p className="bb-mono-label">{eyebrow}</p>
        <h2 className="bb-display mt-3 text-3xl font-semibold tracking-[-0.02em] text-[#171719]">
          {title}
        </h2>
      </div>

      <div className="grid gap-4">
        {rows.map((row) => {
          const { specs, location } = splitSpecs(row.listing);
          const subLine = `${row.listing.builder} ${row.listing.model}`.trim();
          const showSubLine = subLine && subLine !== row.listing.name;
          const hasApproved = row.approvedDocumentCount > 0;

          return (
            <div
              key={row.listing.id}
              className="rounded-[12px] border border-[#E7E7E7] bg-white p-5"
            >
              <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr_1.4fr_auto] lg:items-start">
                <div className="min-w-0">
                  <p className="truncate text-xl font-semibold tracking-[-0.02em] text-[#171719]">
                    {row.listing.name}
                  </p>
                  {showSubLine ? (
                    <p className="mt-1 truncate text-[14px] leading-6 text-[#8E918B]" title={subLine}>
                      {subLine}
                    </p>
                  ) : null}
                </div>

                <div>
                  <ColumnLabel>Price</ColumnLabel>
                  <p className="mt-1 whitespace-nowrap font-mono text-lg font-semibold tabular-nums text-[#171719] lg:mt-0">
                    {formatCurrency(row.listing.priceEur)}
                  </p>
                </div>

                <div className="min-w-0">
                  <ColumnLabel>Specs</ColumnLabel>
                  <p className="mt-1 text-[14px] leading-6 text-[#5F625E] lg:mt-0">{specs}</p>
                  {location ? (
                    <p className="mt-0.5 text-[14px] leading-6 text-[#5F625E]">{location}</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-end">
                  <StatusChip
                    className={
                      row.listing.vatStatus === "Unknown"
                        ? "border-[#E7E7E7] bg-white text-[#8E918B]"
                        : "border-[#E7E7E7] bg-white text-[#5F625E]"
                    }
                  >
                    {row.listing.vatStatus}
                  </StatusChip>
                  <StatusChip
                    className={
                      hasApproved
                        ? "border-transparent bg-[#E1F1EA] text-[#0F8F62]"
                        : "border-transparent bg-[#F2EADC] text-[#A86642]"
                    }
                  >
                    {hasApproved ? `${row.approvedDocumentCount} approved` : "None yet"}
                  </StatusChip>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ColumnLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8E918B] lg:hidden">
      {children}
    </p>
  );
}

function StatusChip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-[8px] border px-3 py-1.5 text-[13px] font-semibold",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* The spec summary usually ends with the location ("42ft · 2 cabins · …
   Berlin / Pichelssee, Germany"). Split it onto its own line so the specs
   column stays scannable; fall back gracefully when the shapes differ. */
function splitSpecs(listing: YachtListing): { specs: string; location?: string } {
  const summary = getListingSpecSummary(listing);
  const location = listing.location?.trim();

  if (!location) return { specs: summary };

  const index = summary.indexOf(location);
  if (index > 0) {
    return {
      specs: summary.slice(0, index).replace(/[\s·,]+$/, ""),
      location: summary.slice(index),
    };
  }
  if (index === 0) return { specs: summary };

  return { specs: summary, location };
}
