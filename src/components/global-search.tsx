"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Search } from "lucide-react";
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

const SUGGESTIONS = [
  "Monaco",
  "Ferrari",
  "VAT",
  "owner update",
  "verification",
  "family",
];

function includesQuery(parts: Array<string | number | undefined>, query: string) {
  return parts.filter(Boolean).join(" ").toLowerCase().includes(query);
}

export function GlobalSearch({
  query,
  segment,
}: {
  query?: string;
  segment?: BrokerSegment;
}) {
  const router = useRouter();
  const [value, setValue] = useState(query ?? "");
  const lastSyncedRef = useRef(query ?? "");

  // Keep local input in sync if the URL query changes from outside (back/forward).
  useEffect(() => {
    const next = query ?? "";
    if (next !== lastSyncedRef.current) {
      setValue(next);
      lastSyncedRef.current = next;
    }
  }, [query]);

  // When the input is cleared, drop ?q= from the URL so the user sees the
  // quick-start state instead of being stranded on an empty results screen.
  useEffect(() => {
    if (value.trim() === "" && (query ?? "") !== "") {
      lastSyncedRef.current = "";
      router.replace("/search");
    }
  }, [value, query, router]);

  const normalized = value.trim().toLowerCase();

  const listings = useMemo(() => getListingsForSegment(segment), [segment]);
  const buyers = useMemo(() => getBuyersForSegment(segment), [segment]);
  const sellers = useMemo(() => getSellersForSegment(segment), [segment]);
  const tasks = useMemo(() => getTasksForSegment(segment), [segment]);

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
        includesQuery(
          [task.title, task.kind, task.priority, task.status, task.reason],
          normalized,
        ),
      )
    : [];
  const total =
    listingResults.length +
    buyerResults.length +
    sellerResults.length +
    taskResults.length;

  function applySuggestion(term: string) {
    setValue(term);
    lastSyncedRef.current = term;
    router.push(`/search?q=${encodeURIComponent(term)}`);
  }

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <PageHeader
        title="Search everything"
        description="Find buyers, listings, owner notes, tasks, tags, and document gaps."
        metrics={[
          { label: "Results", value: normalized ? `${total}` : "—" },
          { label: "Listings", value: `${listingResults.length}` },
          { label: "Buyers", value: `${buyerResults.length}` },
          { label: "Tasks", value: `${taskResults.length}` },
        ]}
      />

      <form
        action="/search"
        className="mt-10 flex max-w-2xl items-stretch gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const next = value.trim();
          if (next === "") {
            router.replace("/search");
          } else {
            router.push(`/search?q=${encodeURIComponent(next)}`);
          }
        }}
      >
        <label className="relative flex-1">
          <span className="sr-only">Search everything</span>
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8E918B]"
            aria-hidden="true"
          />
          <input
            className="h-11 w-full rounded-full border border-[#D9DAD4] bg-white pl-11 pr-4 text-sm text-[#171719] outline-none placeholder:text-[#A9ABA5] focus:border-[#1863dc] focus:ring-2 focus:ring-[#1863dc]/15"
            name="q"
            onChange={(event) => setValue(event.target.value)}
            placeholder="Search buyer memory, listing facts, owner notes..."
            type="search"
            value={value}
          />
        </label>
        <button
          className="min-h-11 rounded-full bg-[#003C33] px-5 text-sm font-medium text-white transition-colors hover:bg-[#0B4A3F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c6ee6]"
          type="submit"
        >
          Search
        </button>
      </form>

      {!normalized ? (
        <Card className="mt-12">
          <div className="p-6 sm:p-8">
            <p className="bb-mono-label">Quick starts</p>
            <h2 className="bb-display mt-2 text-[22px] font-medium text-[#171719]">
              Pick a starting point or return to the dashboard
            </h2>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-6 text-[#5F625E]">
              Type any keyword above — buyer names, locations, tags, owner
              notes, document gaps — or jump in with one of these.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {SUGGESTIONS.map((term) => (
                <button
                  className="inline-flex h-8 items-center rounded-full border border-[#D9DAD4] bg-white px-3 text-[12.5px] font-medium text-[#171719] transition-colors hover:border-[#003C33] hover:bg-[#F1F2EE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c6ee6]"
                  key={term}
                  onClick={() => applySuggestion(term)}
                  type="button"
                >
                  {term}
                </button>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Link
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#D9DAD4] bg-white px-4 text-[13px] font-medium text-[#171719] transition-colors hover:border-[#003C33] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c6ee6]"
                href="/dashboard"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Back to dashboard
              </Link>
              <Link
                className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[#1863dc] hover:underline"
                href="/buyers"
              >
                Browse buyers
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
              <Link
                className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[#1863dc] hover:underline"
                href="/listings"
              >
                Browse listings
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </Card>
      ) : total === 0 ? (
        <Card className="mt-12">
          <EmptyState
            title={`No results for "${value}"`}
            description="Try a broader term or search by buyer, location, asset type, tag, or task reason."
          />
          <div className="px-6 pb-6 sm:px-8">
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((term) => (
                <button
                  className="inline-flex h-8 items-center rounded-full border border-[#D9DAD4] bg-white px-3 text-[12.5px] font-medium text-[#171719] transition-colors hover:border-[#003C33] hover:bg-[#F1F2EE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c6ee6]"
                  key={term}
                  onClick={() => applySuggestion(term)}
                  type="button"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        </Card>
      ) : (
        <div className="mt-12 grid gap-8 xl:grid-cols-2">
          <Card>
            <CardHeader eyebrow="Listings" title="Asset intelligence matches" />
            <ul className="divide-y divide-[#E7E7E2]">
              {listingResults.map((listing) => (
                <li key={listing.id} className="px-6 py-5">
                  <Link
                    className="text-[15px] font-medium text-[#171719] hover:text-[#1863dc]"
                    href={`/listings/${listing.id}`}
                  >
                    {listing.name}
                  </Link>
                  <p className="mt-1 text-[13px] leading-6 text-[#5F625E]">
                    {listing.builder} {listing.model} ·{" "}
                    {getListingSpecSummary(listing)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge tone="neutral">{listing.assetType ?? "Yacht"}</Badge>
                    <Badge tone="neutral">
                      {formatCurrency(listing.priceEur)}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader eyebrow="Buyers" title="Client memory matches" />
            <ul className="divide-y divide-[#E7E7E2]">
              {buyerResults.map((buyer) => (
                <li key={buyer.id} className="px-6 py-5">
                  <Link
                    className="text-[15px] font-medium text-[#171719] hover:text-[#1863dc]"
                    href={`/buyers/${buyer.id}`}
                  >
                    {buyer.name}
                  </Link>
                  <p className="mt-1 text-[13px] leading-6 text-[#5F625E]">
                    {[buyer.company, buyer.country, buyer.currentStage]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {buyer.tags.slice(0, 4).map((tag) => (
                      <Badge key={tag} tone="neutral">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader eyebrow="Tasks" title="Broker actions" />
            <ul className="divide-y divide-[#E7E7E2]">
              {taskResults.map((task) => (
                <li key={task.id} className="px-6 py-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[15px] font-medium text-[#171719]">
                      {task.title}
                    </p>
                    <Badge tone="neutral">{task.priority}</Badge>
                  </div>
                  <p className="mt-1 text-[13px] leading-6 text-[#5F625E]">
                    {task.reason}
                  </p>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader eyebrow="Owners" title="Seller context" />
            <ul className="divide-y divide-[#E7E7E2]">
              {sellerResults.map((seller) => (
                <li key={seller.id} className="px-6 py-5">
                  <Link
                    className="text-[15px] font-medium text-[#171719] hover:text-[#1863dc]"
                    href={`/sellers/${seller.id}`}
                  >
                    {seller.name}
                  </Link>
                  <p className="mt-1 text-[13px] leading-6 text-[#5F625E]">
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
