"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ExternalLink,
  FileText,
  Gauge,
  HelpCircle,
  MapPin,
  MessageSquareText,
  Pencil,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { yachtListings } from "@/lib/demo-data";
import {
  type BrokerSegment,
  getBuyersForSegment,
  getListingsForSegment,
  getTasksForSegment,
} from "@/lib/broker-segments";
import {
  answerListingQuestion,
  buildListingBrain,
  getBuyerObjectionsForListing,
  getDocumentCompleteness,
  getListingBrain,
  getListingAssetType,
  getListingCoreFacts,
  getListingFitSignals,
  getListingSpecSummary,
  getSellerById,
} from "@/lib/services";
import type { ListingStatus, YachtListing } from "@/lib/types";
import { getListingMapLocation } from "@/lib/location-options";
import { cn, formatCurrency, percentage } from "@/lib/utils";
import {
  Badge,
  Card,
  CardHeader,
  CardHeaderIcon,
  EmptyState,
  ProgressBar,
  StatusDot,
} from "./ui";
import { ObjectionRecorder, type BuyerOption, type RecordedObjection } from "./objection-recorder";
import { ListingDeleteButton } from "./listing-delete-button";
import { AssetMedia } from "./asset-media";
import { ListingBrainTabs } from "./listing-brain-tabs";
import { ListingMediaGallery } from "./listing-media-gallery";
import { ListingsTable, toListingRows } from "./listings-table";

function vatTone(status: YachtListing["vatStatus"]): "success" | "error" | "warning" | "info" {
  if (status === "EU VAT Paid") return "success";
  if (status === "Unknown") return "error";
  if (status === "Not Paid") return "warning";
  return "info";
}

function statusTone(
  status: YachtListing["status"],
): "success" | "warning" | "info" | "neutral" {
  if (status === "Active") return "success";
  if (status === "Draft") return "neutral";
  if (status === "Pre-Market") return "info";
  if (status === "Under Offer") return "warning";
  return "neutral";
}

function mergeListings(primary: YachtListing[], fallback: YachtListing[]) {
  const seen = new Set<string>();

  return [...primary, ...fallback].filter((listing) => {
    if (seen.has(listing.id)) return false;
    seen.add(listing.id);
    return true;
  });
}

function filterListings(listings: YachtListing[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return listings;

  return listings.filter((listing) =>
    [
      listing.name,
      listing.builder,
      listing.model,
      listing.location,
      listing.vatStatus,
      listing.status,
      listing.interiorStyle,
      listing.highlights.join(" "),
      listing.missingInfo.join(" "),
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalized),
  );
}

const PAGE_SIZE = 10;
const STATUS_OPTIONS: ListingStatus[] = [
  "Draft",
  "Active",
  "Pre-Market",
  "Under Offer",
  "Coming Soon",
];
/* Quick filters that are always shown, even at a count of 0, so brokers can
   jump to Drafts (or Pre-Market) before any exist. Other statuses appear only
   when present in the data. */
const PRIMARY_STATUSES: ListingStatus[] = ["Active", "Pre-Market", "Draft"];

function isListingStatus(value: string): value is ListingStatus {
  return (STATUS_OPTIONS as string[]).includes(value);
}

export function ListingIndex({
  includeDemo = true,
  query: initialQuery,
  segment,
  status: initialStatus,
  storedListings = [],
}: {
  includeDemo?: boolean;
  query?: string;
  segment?: BrokerSegment;
  status?: string;
  storedListings?: YachtListing[];
}) {
  const segmentListings = useMemo(
    () => mergeListings(storedListings, includeDemo ? getListingsForSegment(segment) : []),
    [includeDemo, storedListings, segment],
  );

  // Tasks resolved once for the whole list — keeps row work O(1).
  const openTaskCounts = useMemo(() => {
    const map = new Map<string, number>();
    const segmentTasks = includeDemo ? getTasksForSegment(segment) : [];
    for (const task of segmentTasks) {
      if (task.status === "Done" || !task.listingId) continue;
      map.set(task.listingId, (map.get(task.listingId) ?? 0) + 1);
    }
    return map;
  }, [includeDemo, segment]);

  const [query, setQuery] = useState(initialQuery ?? "");
  const [statusFilter, setStatusFilter] = useState<ListingStatus | "All">(() => {
    if (initialStatus && initialStatus !== "All" && isListingStatus(initialStatus)) {
      return initialStatus;
    }
    return "All";
  });
  const [page, setPage] = useState(1);

  const normalizedQuery = query.trim().toLowerCase();
  const searching = normalizedQuery !== "";

  // Query-only filter drives chip counts (Knowledge Vault pattern).
  const queryFilteredListings = useMemo(
    () => (searching ? filterListings(segmentListings, query) : segmentListings),
    [segmentListings, query, searching],
  );

  const dynamicStatusCounts = useMemo(() => {
    const map = new Map<ListingStatus, number>();
    for (const listing of queryFilteredListings) {
      map.set(listing.status, (map.get(listing.status) ?? 0) + 1);
    }
    return map;
  }, [queryFilteredListings]);

  // Primary statuses (Active, Pre-Market, Draft) are always shown; the rest
  // only appear when present in the data.
  const availableStatuses = useMemo(() => {
    const present = new Set<ListingStatus>();
    for (const listing of segmentListings) present.add(listing.status);
    const extras = STATUS_OPTIONS.filter(
      (status) => !PRIMARY_STATUSES.includes(status) && present.has(status),
    );
    return [...PRIMARY_STATUSES, ...extras];
  }, [segmentListings]);

  const filteredListings = useMemo(
    () =>
      statusFilter === "All"
        ? queryFilteredListings
        : queryFilteredListings.filter((listing) => listing.status === statusFilter),
    [queryFilteredListings, statusFilter],
  );

  // Computed before the early return so all hooks run in a stable order.
  const listingRows = useMemo(
    () => toListingRows(filteredListings, openTaskCounts),
    [filteredListings, openTaskCounts],
  );

  if (segmentListings.length === 0 && !initialQuery) {
    return <FirstRunListings />;
  }

  // Reset to page 1 when filters change — but only when the page is now out of range.
  const pageCount = Math.max(1, Math.ceil(filteredListings.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  if (safePage !== page) {
    // Inline correction — cheaper than useEffect for derived state.
    setPage(safePage);
  }

  // KPI band — only fields we genuinely have on YachtListing.
  const activeCount = filteredListings.filter((listing) => listing.status === "Active").length;
  const reviewCount = filteredListings.filter((listing) => listing.missingInfo.length > 0).length;
  const completenessAvg = Math.round(
    filteredListings.reduce(
      (total, listing) => total + getDocumentCompleteness(listing).percent,
      0,
    ) / Math.max(filteredListings.length, 1),
  );

  const onQueryChange = (next: string) => {
    setQuery(next);
    setPage(1);
  };
  const onStatusChange = (next: ListingStatus | "All") => {
    setStatusFilter(next);
    setPage(1);
  };
  const clearFilters = () => {
    setQuery("");
    setStatusFilter("All");
    setPage(1);
  };
  const hasFilters = searching || statusFilter !== "All";

  return (
    <div className="mx-auto w-full max-w-[1536px] px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
      {/* KPI band — editorial cockpit. One cream tile, three paper tiles. */}
      <section
        aria-label="Inventory summary"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <KpiTile
          tone="cream"
          label="Inventory"
          value={`${segmentListings.length}`}
          detail={
            filteredListings.length === segmentListings.length
              ? "All listings in scope"
              : `${filteredListings.length} in current view`
          }
        />
        <KpiTile
          tone="paper"
          label="Active"
          value={`${activeCount}`}
          detail="Live in market"
        />
        <KpiTile
          tone="paper"
          label="Doc completeness"
          value={percentage(completenessAvg)}
          detail={`${reviewCount} need follow-up`}
        />
        <KpiTile
          tone="paper"
          label="Needs review"
          value={`${reviewCount}`}
          detail="Open gaps to close"
        />
      </section>

      {/* Inventory — search + quick filters now live inside the card, since
          they're inseparable from the list they act on. */}
      <section aria-label="Listings" className="mt-8">
        <ListingsTable
          emptyState={
            <EmptyState
              title={searching ? `No listings match “${query}”` : "No listings in this status"}
              description="Try a different keyword, clear the status filter, or open a new listing brain."
              action={
                hasFilters ? (
                  <button
                    className="inline-flex min-h-9 items-center gap-2 rounded-[8px] border border-[#D9DAD4] bg-white px-4 text-[13px] font-medium text-[#171719] hover:border-[#003C33]"
                    onClick={clearFilters}
                    type="button"
                  >
                    Clear filters
                  </button>
                ) : undefined
              }
            />
          }
          filters={
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
              <label className="relative block">
                <span className="sr-only">Search listings</span>
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8E918B]"
                />
                <input
                  className="h-10 w-full rounded-[10px] border border-[#E7E7E7] bg-white pl-10 pr-9 text-[13px] text-[#171719] outline-none transition-colors placeholder:text-[#A9ABA5] focus:border-[#1863dc] focus:ring-2 focus:ring-[#1863dc]/15"
                  onChange={(event) => onQueryChange(event.target.value)}
                  placeholder="Search make, model, location, missing info…"
                  type="search"
                  value={query}
                />
                {searching ? (
                  <button
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[#8E918B] hover:bg-[#F1F2EE] hover:text-[#171719]"
                    onClick={() => onQueryChange("")}
                    type="button"
                  >
                    <X aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </label>
              <div className="flex flex-wrap gap-1.5">
                <StatusChip
                  active={statusFilter === "All"}
                  count={searching ? queryFilteredListings.length : segmentListings.length}
                  label="All"
                  onClick={() => onStatusChange("All")}
                />
                {availableStatuses.map((status) => {
                  const count = searching
                    ? (dynamicStatusCounts.get(status) ?? 0)
                    : segmentListings.filter((l) => l.status === status).length;
                  return (
                    <StatusChip
                      active={statusFilter === status}
                      count={count}
                      key={status}
                      label={status}
                      onClick={() => onStatusChange(status)}
                    />
                  );
                })}
              </div>
            </div>
          }
          listings={listingRows}
          onPageChange={setPage}
          page={safePage}
          pageCount={pageCount}
          pageSize={PAGE_SIZE}
        />
      </section>
    </div>
  );
}

function KpiTile({
  tone,
  label,
  value,
  detail,
}: {
  tone: "cream" | "paper";
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[12px] border p-5",
        tone === "cream"
          ? "border-transparent bg-[#F2EADC] text-[#171719]"
          : "border-[#E7E7E7] bg-white text-[#171719]",
      )}
    >
      <p className="bb-mono-label">{label}</p>
      <p className="bb-display mt-3 text-[28px] font-medium leading-none tabular-nums">{value}</p>
      <p className="mt-2 text-[12.5px] leading-[1.5] text-[#5F625E]">{detail}</p>
    </div>
  );
}

function StatusChip({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
}) {
  const isEmpty = count === 0 && !active;
  return (
    <button
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-7 items-center gap-1.5 rounded-[8px] border px-2.5 text-[11.5px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1863dc]",
        active
          ? "border-[#171719] bg-[#171719] text-white"
          : isEmpty
            ? "cursor-not-allowed border-[#E7E7E7] bg-white text-[#A9ABA5] opacity-50"
            : "border-[#E7E7E7] bg-white text-[#5F625E] hover:border-[#003C33]",
      )}
      disabled={isEmpty}
      onClick={onClick}
      type="button"
    >
      <span>{label}</span>
      <span
        className={cn(
          "font-mono tabular-nums",
          active ? "text-white/80" : "text-[#8E918B]",
        )}
      >
        · {count}
      </span>
    </button>
  );
}

/* First-run listings — clean editorial hero + three primary actions + an
   explainer card showing what the brain will surface once inventory lands. */
function FirstRunListings() {
  return (
    <div className="mx-auto w-full max-w-[1536px] px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
      <section aria-labelledby="listings-quick-start">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="bb-mono-label">Quick start</p>
            <h2
              className="bb-display mt-2 text-xl font-medium text-[#171719]"
              id="listings-quick-start"
            >
              Three ways to seed the inventory
            </h2>
          </div>
          <p className="hidden text-[13px] text-[#8E918B] sm:block">
            Pick whichever signal you have first.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <ListingsActionCard
            description="Paste an owner call to capture specs and gaps."
            href="/voice-crm"
            icon={Radio}
            step="01"
            title="Capture an owner call"
          />
          <ListingsActionCard
            description="Stage a client brief for future matching."
            href="/matching"
            icon={Gauge}
            step="02"
            title="Stage a buyer brief"
          />
          <ListingsActionCard
            description="Clear serious inquiries before sharing."
            href="/verification"
            icon={ShieldCheck}
            step="03"
            title="Open verification"
          />
        </div>
      </section>

      <Card className="mt-12">
        <CardHeader
          title="The brain you'll have on every asset"
        />
        <ul className="divide-y divide-[#E7E7E7]">
          <ExplainerRow
            icon={FileText}
            title="Approved documents and missing facts"
            description="Survey, VAT, specs, media — and any gap that should be closed before a buyer-safe share."
          />
          <ExplainerRow
            icon={Gauge}
            title="Top buyer fits and hidden opportunities"
            description="Deterministic scoring against every buyer memory profile, with rationale and trade-offs."
          />
          <ExplainerRow
            icon={MessageSquareText}
            title="Broker pitches and objection memory"
            description="Pitch, buyer-safe angle, shorthand, and objection log."
          />
          <ExplainerRow
            icon={Bot}
            title="Source-aware Q&A"
            description="Answers cite approved sources or flag missing facts."
          />
        </ul>
      </Card>
    </div>
  );
}

function ListingsActionCard({
  description,
  href,
  icon: Icon,
  step,
  title,
}: {
  description: string;
  href: string;
  icon: LucideIcon;
  step: string;
  title: string;
}) {
  return (
    <Link
      className="group flex h-full flex-col justify-between gap-5 rounded-[12px] border border-[#E7E7E7] bg-white p-6 transition-colors hover:border-[#003C33]"
      href={href}
    >
      <div>
        <div className="flex items-center justify-between">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#003C33] text-white">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="bb-mono-label">{step}</span>
        </div>
        <h3 className="bb-display mt-5 text-lg font-medium text-[#171719]">{title}</h3>
        <p className="mt-2 text-[13px] leading-6 text-[#5F625E]">{description}</p>
      </div>
      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#171719]">
        Get started
        <ArrowRight
          className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}

function ExplainerRow({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <li className="grid gap-4 px-6 py-5 sm:grid-cols-[36px_1fr]">
      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E7E7E7] bg-white text-[#003C33]">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-[14px] font-medium text-[#171719]">{title}</p>
        <p className="mt-1 text-[13px] leading-6 text-[#5F625E]">{description}</p>
      </div>
    </li>
  );
}

function ListingDetailHero({
  canDelete = false,
  documentPercent,
  listing,
  sellerHref,
  topFitPercent,
}: {
  canDelete?: boolean;
  documentPercent: number;
  listing: YachtListing;
  sellerHref?: string;
  topFitPercent: number;
}) {
  const assetType = getListingAssetType(listing);
  const specSummary = getListingSpecSummary(listing);

  return (
    <section className="overflow-hidden rounded-[12px] border border-[#E7E7E7] bg-white">
      <div className="relative min-w-0 p-6 pb-0 sm:p-8 sm:pb-0">
        <div className="absolute right-5 top-5 flex items-center gap-2 sm:right-6 sm:top-6">
          <Link
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[8px] border border-[#D9DAD4] bg-white px-3.5 text-[13px] font-medium text-[#171719] transition-colors hover:border-[#003C33] hover:bg-[#F1F2EE]"
            href={`/listings/${listing.id}/edit`}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            Edit
          </Link>
          {canDelete ? (
            <ListingDeleteButton listingId={listing.id} listingName={listing.name} />
          ) : null}
        </div>

        <div className="max-w-[calc(100%-8.5rem)] sm:max-w-[calc(100%-9.5rem)]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-7 items-center rounded-[8px] border border-[#E7E7E7] bg-[#F1F2EE] px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E918B]">
              {assetType}
            </span>
            <span className="text-[12px] font-medium text-[#8E918B]">
              {listing.builder} / {listing.model}
            </span>
          </div>

          <h1 className="bb-display mt-5 max-w-4xl text-[2.2rem] font-medium leading-[1.04] tracking-[-0.03em] text-[#171719] sm:text-[2.75rem]">
            {listing.name}
          </h1>
          <p className="mt-4 max-w-3xl text-[15px] leading-7 text-[#5F625E]">
            {specSummary}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2 pb-6">
          <Badge tone={statusTone(listing.status)}>{listing.status}</Badge>
          <Badge tone={vatTone(listing.vatStatus)}>{listing.vatStatus}</Badge>
          <span className="text-[13px] leading-6 text-[#5F625E]">{listing.idealBuyer}</span>
          {sellerHref ? (
            <Link
              className="inline-flex min-h-8 items-center gap-1.5 rounded-[8px] border border-[#D9DAD4] bg-white px-3 text-[12px] font-medium text-[#171719] hover:border-[#003C33]"
              href={sellerHref}
            >
              Owner context
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid border-t border-[#E7E7E7] bg-[#F1F2EE] sm:grid-cols-3">
        <HeroMetric label="Ask" value={formatCurrency(listing.priceEur)} />
        <HeroMetric label="Documents" value={percentage(documentPercent)} />
        <HeroMetric label="Top fit" value={percentage(topFitPercent)} />
      </div>
    </section>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-[#E7E7E7] px-5 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8E918B]">{label}</p>
      <p className="mt-1 font-mono text-[17px] font-semibold text-[#171719]">{value}</p>
    </div>
  );
}

export function ListingCard({
  index,
  listing,
  segment,
}: {
  index: number;
  listing: YachtListing;
  segment?: BrokerSegment;
}) {
  const completeness = getDocumentCompleteness(listing);
  const fitSignals = getListingFitSignals(listing);
  const topFit = fitSignals.topMatches[0];
  const seller = getSellerById(listing.ownerId);
  const openTasks = getTasksForSegment(segment).filter(
    (task) => task.listingId === listing.id && task.status !== "Done",
  ).length;
  const needsReview = listing.missingInfo.length;
  const approvedDocuments = listing.documents.filter(
    (document) => document.status === "Approved",
  ).length;

  return (
    <Card className="overflow-hidden p-0">
      <div className="relative">
        <AssetMedia
          className="min-h-56 !rounded-none border-0"
          compact
          listing={listing}
          showChrome={false}
        />
        <span className="absolute left-5 top-5 inline-flex h-10 min-w-10 items-center justify-center rounded-[8px] bg-white/85 px-2 font-mono text-lg font-semibold text-[#171719] backdrop-blur">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="absolute right-5 top-5 flex flex-wrap justify-end gap-2">
          <Badge tone={statusTone(listing.status)}>{listing.status}</Badge>
          <Badge tone={vatTone(listing.vatStatus)}>{listing.vatStatus}</Badge>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="min-w-0">
            <h2 className="bb-display truncate text-[1.45rem] font-medium leading-tight text-[#171719]">
              <Link className="hover:text-[#1863dc]" href={`/listings/${listing.id}`}>
                {listing.name}
              </Link>
            </h2>
            <p className="mt-1 text-[14px] leading-6 text-[#8E918B]">
              {listing.builder} {listing.model} · {getListingSpecSummary(listing)}
            </p>
          </div>
          <p className="font-mono text-[15px] font-semibold text-[#171719] sm:text-right">
            {formatCurrency(listing.priceEur)}
          </p>
        </div>

        <div className="mt-5 flex flex-wrap gap-1.5">
          {listing.highlights.slice(0, 3).map((highlight) => (
            <Badge key={highlight} tone="neutral">
              {highlight}
            </Badge>
          ))}
        </div>

        <div className="mt-5 divide-y divide-[#E7E7E7] border-y border-[#E7E7E7]">
          <ListingCardRow
            icon={Gauge}
            label="Owner"
            title={seller?.name ?? "Owner not recorded"}
            detail={seller ? `${seller.motivation} · ${seller.reportingCadence}` : "No owner context"}
          />
          <ListingCardRow
            icon={Sparkles}
            label="Top fit"
            title={
              topFit
                ? `${topFit.buyer?.name ?? "Buyer"} · ${percentage(topFit.match.fitScore)}`
                : "No buyer fit"
            }
            detail={`${fitSignals.hiddenOpportunities} hidden opportunities above review threshold.`}
          />
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <ListingMiniStat
            icon={FileText}
            label="Docs"
            value={`${approvedDocuments}/${listing.documents.length}`}
          />
          <ListingMiniStat icon={CheckCircle2} label="Tasks" value={`${openTasks}`} />
          <ListingMiniStat icon={AlertTriangle} label="Review" value={`${needsReview}`} />
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <p className="bb-mono-label">Document completeness</p>
            <span className="font-mono text-[12px] font-semibold text-[#171719]">
              {completeness.percent}%
            </span>
          </div>
          <ProgressBar className="mt-3 h-2" value={completeness.percent} />
          <p className="mt-2 text-[13px] text-[#5F625E]">
            {completeness.missingCount} missing facts
          </p>
        </div>

        <Link
          className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-[#003C33] px-5 text-sm font-medium text-white hover:bg-[#0B4A3F] sm:w-auto"
          href={`/listings/${listing.id}`}
        >
          Open listing brain
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </Card>
  );
}

function ListingCardRow({
  detail,
  icon: Icon,
  label,
  title,
}: {
  detail: string;
  icon: LucideIcon;
  label: string;
  title: string;
}) {
  return (
    <div className="grid gap-3 py-4 sm:grid-cols-[38px_minmax(0,1fr)]">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F1F2EE] text-[#171719]">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="bb-mono-label">{label}</p>
        <p className="mt-1 truncate text-[15px] font-medium text-[#171719]">{title}</p>
        <p className="mt-1 text-[13px] leading-5 text-[#8E918B]">{detail}</p>
      </div>
    </div>
  );
}

function ListingMiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-[12px] border border-[#E7E7E7] bg-[#F1F2EE] p-3">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#5F625E]">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-mono text-[15px] font-semibold text-[#171719]">{value}</p>
          <p className="truncate text-[11px] font-medium text-[#8E918B]">{label}</p>
        </div>
      </div>
    </div>
  );
}

export function ListingBrain({
  activeTab,
  includeDemo = true,
  listingId,
  listingOverride,
  segment,
}: {
  activeTab?: string;
  includeDemo?: boolean;
  listingId: string;
  listingOverride?: YachtListing;
  segment?: BrokerSegment;
}) {
  const brain = listingOverride
    ? buildListingBrain(listingOverride, segment)
    : includeDemo
      ? getListingBrain(listingId, segment)
      : undefined;

  if (!brain) {
    return null;
  }

  const { listing, seller, documentCompleteness, fitSignals, pitch } = brain;
  const questions = [
    "What should I highlight for low maintenance?",
    "What are the weaknesses or objections?",
    "Which documents are missing?",
    "Can I promise the owner motivation?",
  ];
  const buyerOptions: BuyerOption[] = (includeDemo ? getBuyersForSegment(segment) : []).map((buyer) => ({
    id: buyer.id,
    name: buyer.name,
    memoryNote: [
      `${buyer.sizeRangeFt[0]}-${buyer.sizeRangeFt[1]}ft`,
      buyer.urgency.toLowerCase(),
      buyer.objections[0] ?? buyer.mustHaves[0],
    ].join(", "),
  }));
  const objectionItems: RecordedObjection[] = getBuyerObjectionsForListing(listing.id, segment).map(
    (objection, index) => ({
      id: `${objection.source}-${index}`,
      buyerId: objection.buyer?.id,
      buyerName: objection.buyer?.name,
      label: objection.label,
      detail: objection.detail,
      raisedAt: objection.raisedAt,
      source: objection.source,
    }),
  );
  const ownerTasks = getTasksForSegment(segment).filter(
    (task) =>
      task.status !== "Done" &&
      (task.sellerId === seller?.id || (task.listingId === listing.id && task.kind === "Owner Update")),
  );

  return (
    <div className="mx-auto w-full max-w-[1536px] px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
      {/* Back-link removed — breadcrumb in the top bar covers navigation. */}

      <ListingDetailHero
        canDelete={Boolean(listingOverride)}
        documentPercent={documentCompleteness.percent}
        listing={listing}
        sellerHref={seller && !seller.id.startsWith("seller-listing-") ? `/sellers/${seller.id}` : undefined}
        topFitPercent={fitSignals.highestScore}
      />

      <div className="mt-12 grid gap-8">
        <Card>
          <div className="grid items-stretch gap-5 border-b border-[#E7E7E7] px-6 py-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
            <ListingMediaGallery listing={listing} />
            <ListingLocationMap listing={listing} />
          </div>
          <ListingBrainTabs
            coreFacts={getListingCoreFacts(listing)}
            documentCompleteness={documentCompleteness}
            initialTab={activeTab}
            listing={listing}
            ownerTasks={ownerTasks}
            seller={seller}
          />
        </Card>

        <Card>
          <CardHeader title="Record and surface buyer objections" />
          <div className="px-6 py-5">
            <ObjectionRecorder
              buyers={buyerOptions}
              initialObjections={objectionItems}
              listingId={listing.id}
            />
          </div>
        </Card>

        {/* Masonry via native CSS columns: card heights vary per listing
            (0–3 matches, 0–N objections), so any fixed 2-column split leaves
            one side blank. `columns` balances height automatically, whatever
            the data. break-inside-avoid keeps each card whole; mb-8 is the
            inter-card gap (column-gap set separately). */}
        <div className="xl:columns-2 xl:gap-8 [&>*]:mb-8 [&>*]:break-inside-avoid xl:[&>*:last-child]:mb-0">
            <Card>
              <CardHeader
                title="Broker-ready positioning"
                action={
                  <CardHeaderIcon>
                    <Bot className="h-4 w-4" aria-hidden="true" />
                  </CardHeaderIcon>
                }
              />
              <ul className="grid gap-0 divide-y divide-[#E7E7E7]">
                <PitchRow label="30-second pitch" value={pitch.thirtySecond} />
                <PitchRow label="Buyer-safe angle" value={pitch.buyerSafe} />
                <PitchRow label="Internal shorthand" value={pitch.short} />
              </ul>
            </Card>

            <Card>
              <CardHeader eyebrow="Buyer fit" title="Top buyers for this listing" />
              <ul className="grid gap-0 divide-y divide-[#E7E7E7]">
                {fitSignals.topMatches.map(({ buyer, match }) => (
                  <li key={match.id} className="px-6 py-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-[14px] font-medium text-[#171719]">{buyer?.name}</h3>
                        <p className="mt-0.5 text-[12px] uppercase tracking-[0.12em] text-[#8E918B]">
                          {match.category}
                        </p>
                      </div>
                      <span className="font-mono text-[13px] font-medium text-[#171719]">
                        {percentage(match.fitScore)}
                      </span>
                    </div>
                    <ProgressBar className="mt-3" value={match.fitScore} />
                    <p className="mt-3 text-[13px] leading-6 text-[#5F625E]">{match.rationale}</p>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardHeader
                title="Rejections and objections"
                action={
                  <CardHeaderIcon>
                    <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                  </CardHeaderIcon>
                }
              />
              {objectionItems.length ? (
                <ul className="grid gap-0 divide-y divide-[#E7E7E7]">
                  {objectionItems.map((objection) => (
                    <li
                      key={`${objection.source}-${objection.buyerName}-${objection.raisedAt}`}
                      className="px-6 py-5"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusDot className="bg-[#A86642]" />
                        <h3 className="text-[14px] font-medium text-[#171719]">
                          {objection.buyerName ?? "Unknown buyer"}
                        </h3>
                      </div>
                      <p className="mt-2 text-[13px] leading-6 text-[#5F625E]">{objection.detail}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                /* Compact empty state — one row, not a full-height card. */
                <div className="flex items-center gap-2 px-6 py-4 text-[13px] leading-6 text-[#8E918B]">
                  <MessageSquareText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>No buyer-memory objections recorded yet.</span>
                </div>
              )}
            </Card>

            <BrokerQuestionExamplesCard listing={listing} questions={questions} />
        </div>
      </div>
    </div>
  );
}

/* Compact, tightened Q&A block:
   - shows up to 3 example questions; the rest sit behind a disclosure
   - dedupes the "Missing approved source" chip when it's the only signal
   - denser row padding than the previous wall-of-cards layout */
function BrokerQuestionExamplesCard({
  listing,
  questions,
}: {
  listing: YachtListing;
  questions: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const previewCount = 3;
  const preview = questions.slice(0, previewCount);
  const overflow = questions.slice(previewCount);
  const visible = expanded ? questions : preview;

  return (
    <Card>
      <CardHeader eyebrow="Source-aware answers" title="Broker question examples" />
      <ul className="grid gap-0 divide-y divide-[#E7E7E7]">
        {visible.map((question) => {
          const response = answerListingQuestion(listing, question);
          const hasSources = response.sources.length > 0;
          const hasMissing = response.missing.length > 0;

          return (
            <li key={question} className="grid gap-2.5 px-6 py-4 sm:grid-cols-[24px_1fr]">
              <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-[#E7E7E7] bg-white text-[#171719]">
                <HelpCircle className="h-3 w-3" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="text-[13px] font-medium leading-5 text-[#171719]">{question}</h2>
                <p className="mt-1.5 text-[13px] leading-6 text-[#5F625E]">{response.answer}</p>
                {hasSources || hasMissing ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {hasSources
                      ? response.sources.map((source) => (
                          <Badge key={source} tone="success">
                            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                            {source}
                          </Badge>
                        ))
                      : /* Only show the "Missing approved source" chip when
                           there are no more specific "Missing: X" chips —
                           otherwise it duplicates the same signal. */
                        !hasMissing && <Badge tone="error">Missing approved source</Badge>}
                    {response.missing.map((missing) => (
                      <Badge key={missing} tone="warning">
                        Missing: {missing}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {overflow.length ? (
        <div className="border-t border-[#E7E7E7] px-6 py-3">
          <button
            aria-expanded={expanded}
            className="text-[12px] font-medium text-[#003C33] transition-colors hover:text-[#0B4A3F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c6ee6]"
            onClick={() => setExpanded((prev) => !prev)}
            type="button"
          >
            {expanded ? "Show fewer questions" : `More questions (${overflow.length})`}
          </button>
        </div>
      ) : null}
    </Card>
  );
}

function ListingLocationMap({ listing }: { listing: YachtListing }) {
  const mapLocation = getListingMapLocation(listing);
  const type = getListingAssetType(listing);
  const embedUrl = mapLocation.coordinates ? getOpenStreetMapEmbedUrl(mapLocation.coordinates) : undefined;
  const openUrl = mapLocation.coordinates
    ? `https://www.openstreetmap.org/?mlat=${mapLocation.coordinates.lat}&mlon=${mapLocation.coordinates.lng}#map=14/${mapLocation.coordinates.lat}/${mapLocation.coordinates.lng}`
    : undefined;

  return (
    <div className="h-full min-h-48 overflow-hidden rounded-[12px] border border-[#E7E7E7] bg-[#F1F2EE]">
      <div className="relative h-full min-h-48">
        {embedUrl ? (
          <iframe
            className="absolute inset-0 h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={embedUrl}
            title={`${listing.name} map`}
          />
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#edf1ee_0%,#F8F3E8_45%,#e5ece8_100%)]">
            <div className="absolute left-1/4 top-0 h-full w-px rotate-12 bg-white/80" />
            <div className="absolute left-1/2 top-0 h-full w-px -rotate-12 bg-white/80" />
            <div className="absolute left-0 top-1/2 h-px w-full bg-white/80" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.94)_42%,rgba(255,255,255,0.98)_100%)] p-4 pt-12">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="bb-mono-label">{type === "Yacht" ? "Location / marina" : "Location"}</p>
              <h3 className="mt-1 truncate text-[15px] font-semibold text-[#171719]">
                {mapLocation.label}
              </h3>
              <p className="mt-1 text-[12px] leading-5 text-[#5F625E]">
                {mapLocation.precision === "Private"
                  ? "Private or approximate pin. Exact address stays broker-controlled."
                  : `${mapLocation.precision} map preview for broker orientation.`}
              </p>
            </div>
            {openUrl ? (
              <a
                aria-label={`Open ${mapLocation.label} in OpenStreetMap`}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#003C33] text-white hover:bg-[#0B4A3F]"
                href={openUrl}
                rel="noreferrer"
                target="_blank"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            ) : (
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#003C33]">
                <MapPin className="h-4 w-4" aria-hidden="true" />
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getOpenStreetMapEmbedUrl({ lat, lng }: { lat: number; lng: number }) {
  const delta = 0.018;
  const params = new URLSearchParams({
    bbox: `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`,
    layer: "mapnik",
    marker: `${lat},${lng}`,
  });

  return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`;
}

function PitchRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="px-6 py-4">
      <p className="bb-mono-label">{label}</p>
      <p className="mt-2 text-[13px] leading-6 text-[#5F625E]">{value}</p>
    </li>
  );
}

export function getListingIds() {
  return yachtListings.map((listing) => listing.id);
}
