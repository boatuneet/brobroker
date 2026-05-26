import Link from "next/link";
import { Search } from "lucide-react";
import {
  type BrokerSegment,
  getBuyersForSegment,
  getListingsForSegment,
  getSellersForSegment,
  getTasksForSegment,
} from "@/lib/broker-segments";
import { getListingSpecSummary } from "@/lib/services";
import { formatCurrency } from "@/lib/utils";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "./ui";

function includesQuery(parts: Array<string | number | undefined>, query: string) {
  return parts.filter(Boolean).join(" ").toLowerCase().includes(query);
}

export function GlobalSearch({ query, segment }: { query?: string; segment?: BrokerSegment }) {
  const normalized = query?.trim().toLowerCase() ?? "";
  const listings = getListingsForSegment(segment);
  const buyers = getBuyersForSegment(segment);
  const sellers = getSellersForSegment(segment);
  const tasks = getTasksForSegment(segment);
  const listingResults = normalized
    ? listings.filter((listing) =>
        includesQuery(
          [
            listing.name,
            listing.assetType,
            listing.builder,
            listing.model,
            listing.location,
            listing.status,
            listing.vatStatus,
            listing.highlights.join(" "),
            listing.missingInfo.join(" "),
            listing.ownerNotes.join(" "),
          ],
          normalized,
        ),
      )
    : [];
  const buyerResults = normalized
    ? buyers.filter((buyer) =>
        includesQuery(
          [
            buyer.name,
            buyer.company,
            buyer.country,
            buyer.currentStage,
            buyer.urgency,
            buyer.tags.join(" "),
            buyer.preferredBrands.join(" "),
            buyer.preferredLocations.join(" "),
            buyer.lifestylePreferences.join(" "),
            buyer.relationshipNotes.join(" "),
          ],
          normalized,
        ),
      )
    : [];
  const sellerResults = normalized
    ? sellers.filter((seller) =>
        includesQuery(
          [
            seller.name,
            seller.motivation,
            seller.communicationExpectation,
            seller.pricingSensitivity,
            seller.feedbackHistory.join(" "),
          ],
          normalized,
        ),
      )
    : [];
  const taskResults = normalized
    ? tasks.filter((task) =>
        includesQuery([task.title, task.kind, task.priority, task.status, task.reason], normalized),
      )
    : [];
  const total =
    listingResults.length + buyerResults.length + sellerResults.length + taskResults.length;

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <PageHeader
        eyebrow="Global search"
        title="Search everything"
        description="Find buyers, listings, owner notes, tasks, tags, and document gaps."
        metrics={[
          { label: "Results", value: normalized ? `${total}` : "—" },
          { label: "Listings", value: `${listingResults.length}` },
          { label: "Buyers", value: `${buyerResults.length}` },
          { label: "Tasks", value: `${taskResults.length}` },
        ]}
      />

      <form action="/search" className="mt-10 flex max-w-2xl items-stretch gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Search everything</span>
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#75758a]"
            aria-hidden="true"
          />
          <input
            className="h-11 w-full rounded-full border border-[#d9d9dd] bg-white pl-11 pr-4 text-sm text-[#17171c] outline-none placeholder:text-[#9b9ba6] focus:border-[#9b60aa] focus:ring-2 focus:ring-[#9b60aa]/15"
            defaultValue={query}
            name="q"
            placeholder="Search buyer memory, listing facts, owner notes..."
            type="search"
          />
        </label>
        <button className="min-h-11 rounded-full bg-[#17171c] px-5 text-sm font-medium text-white" type="submit">
          Search
        </button>
      </form>

      {!normalized ? (
        <Card className="mt-12">
          <EmptyState
            title="Enter a search term"
            description="Try family, Monaco, Ferrari, VAT, owner update, or verification."
          />
        </Card>
      ) : total === 0 ? (
        <Card className="mt-12">
          <EmptyState title={`No results for "${query}"`} description="Try a broader term or search by buyer, location, asset type, tag, or task reason." />
        </Card>
      ) : (
        <div className="mt-12 grid gap-8 xl:grid-cols-2">
          <Card>
            <CardHeader eyebrow="Listings" title="Asset intelligence matches" />
            <ul className="divide-y divide-[#f2f2f2]">
              {listingResults.map((listing) => (
                <li key={listing.id} className="px-6 py-5">
                  <Link className="text-[15px] font-medium text-[#17171c] hover:text-[#1863dc]" href={`/listings/${listing.id}`}>
                    {listing.name}
                  </Link>
                  <p className="mt-1 text-[13px] leading-6 text-[#616161]">
                    {listing.builder} {listing.model} · {getListingSpecSummary(listing)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge tone="neutral">{listing.assetType ?? "Yacht"}</Badge>
                    <Badge tone="neutral">{formatCurrency(listing.priceEur)}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader eyebrow="Buyers" title="Client memory matches" />
            <ul className="divide-y divide-[#f2f2f2]">
              {buyerResults.map((buyer) => (
                <li key={buyer.id} className="px-6 py-5">
                  <Link className="text-[15px] font-medium text-[#17171c] hover:text-[#1863dc]" href={`/buyers/${buyer.id}`}>
                    {buyer.name}
                  </Link>
                  <p className="mt-1 text-[13px] leading-6 text-[#616161]">
                    {[buyer.company, buyer.country, buyer.currentStage].filter(Boolean).join(" · ")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {buyer.tags.slice(0, 4).map((tag) => (
                      <Badge key={tag} tone="neutral">{tag}</Badge>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader eyebrow="Tasks" title="Broker actions" />
            <ul className="divide-y divide-[#f2f2f2]">
              {taskResults.map((task) => (
                <li key={task.id} className="px-6 py-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[15px] font-medium text-[#17171c]">{task.title}</p>
                    <Badge tone="neutral">{task.priority}</Badge>
                  </div>
                  <p className="mt-1 text-[13px] leading-6 text-[#616161]">{task.reason}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader eyebrow="Owners" title="Seller context" />
            <ul className="divide-y divide-[#f2f2f2]">
              {sellerResults.map((seller) => (
                <li key={seller.id} className="px-6 py-5">
                  <Link className="text-[15px] font-medium text-[#17171c] hover:text-[#1863dc]" href={`/sellers/${seller.id}`}>
                    {seller.name}
                  </Link>
                  <p className="mt-1 text-[13px] leading-6 text-[#616161]">
                    {seller.motivation}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
