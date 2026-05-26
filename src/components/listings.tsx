import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowLeft,
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
  PlusCircle,
  Radio,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
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
import type { YachtListing } from "@/lib/types";
import { getListingMapLocation } from "@/lib/location-options";
import { formatCurrency, percentage } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardHeaderIcon,
  EmptyState,
  PageHeader,
  ProgressBar,
  StatusDot,
} from "./ui";
import { ObjectionRecorder, type BuyerOption, type RecordedObjection } from "./objection-recorder";
import { AssetMedia } from "./asset-media";
import { ListingBrainTabs } from "./listing-brain-tabs";
import { ListingMediaGallery } from "./listing-media-gallery";

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

export function ListingIndex({
  query,
  segment,
  status,
  storedListings = [],
}: {
  query?: string;
  segment?: BrokerSegment;
  status?: string;
  storedListings?: YachtListing[];
}) {
  const segmentListings = mergeListings(storedListings, getListingsForSegment(segment));
  const searchedListings = query ? filterListings(segmentListings, query) : segmentListings;
  const statusFilter = status === "All" ? undefined : status;
  const listings = statusFilter
    ? searchedListings.filter((listing) => listing.status === statusFilter)
    : searchedListings;
  const statusOptions = ["All", "Draft", "Active", "Pre-Market", "Under Offer", "Coming Soon"];

  if (segmentListings.length === 0 && !query) {
    return <FirstRunListings />;
  }

  const averageCompleteness = Math.round(
    listings.reduce((total, listing) => total + getDocumentCompleteness(listing).percent, 0) /
      Math.max(listings.length, 1),
  );
  const reviewCount = listings.filter((listing) => listing.missingInfo.length > 0).length;
  const inventoryValue = listings.reduce((total, listing) => total + listing.priceEur, 0);

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <PageHeader
        eyebrow="Asset intelligence"
        title="Listing intelligence"
        description="Search inventory by fit, owner, location, documents, and missing facts."
        metrics={[
          { label: "Visible", value: `${listings.length}` },
          { label: "Inventory value", value: formatCurrency(inventoryValue) },
          { label: "Doc completeness", value: percentage(averageCompleteness) },
          { label: "Needs follow-up", value: `${reviewCount}` },
        ]}
        actions={
          <Link
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#17171c] px-5 text-sm font-medium text-white hover:bg-[#2a2a32]"
            href="/listings/new"
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            Add listing
          </Link>
        }
      />

      <Card className="mt-10 p-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <form action="/listings" className="flex min-w-0 items-stretch gap-2">
            <label className="relative flex-1">
              <span className="sr-only">Search listings</span>
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#75758a]"
                aria-hidden="true"
              />
              <input
                className="h-11 w-full rounded-full border border-[#d9d9dd] bg-white pl-11 pr-4 text-sm text-[#17171c] outline-none placeholder:text-[#9b9ba6] focus:border-[#9b60aa] focus:ring-2 focus:ring-[#9b60aa]/15"
                defaultValue={query}
                name="q"
                placeholder="Search make, model, owner, location, docs..."
                type="search"
              />
            </label>
            {statusFilter ? <input name="status" type="hidden" value={statusFilter} /> : null}
            <Button size="sm" type="submit" variant="secondary">
              Search
            </Button>
          </form>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#e5e7eb] bg-[#f7f7f9] px-3 text-[12px] font-medium text-[#616161]">
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              Quick filters
            </span>
            {statusOptions.map((option) => {
              const active = (statusFilter ?? "All") === option;
              const href = `/listings?${new URLSearchParams({
                ...(query ? { q: query } : {}),
                ...(option === "All" ? {} : { status: option }),
              }).toString()}`;

              return (
                <Link
                  className={`inline-flex min-h-9 items-center rounded-full border px-3 text-[12px] font-medium transition-colors ${
                    active
                      ? "border-[#17171c] bg-[#17171c] text-white"
                      : "border-[#d9d9dd] bg-white text-[#3f3f46] hover:border-[#17171c]"
                  }`}
                  href={href}
                  key={option}
                >
                  {option}
                </Link>
              );
            })}
          </div>
        </div>
      </Card>

      {listings.length === 0 ? (
        <Card className="mt-12">
          <EmptyState
            title={`No listings match “${query}”`}
            description="Try a different keyword or clear the search to see every listing in the brain."
            action={
              <Link
                className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#d9d9dd] bg-white px-4 text-[13px] font-medium text-[#17171c] hover:border-[#17171c]"
                href="/listings"
              >
                Clear search
              </Link>
            }
          />
        </Card>
      ) : (
        <section className="mt-8 overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-[0_18px_55px_rgba(23,23,28,0.04)]">
          <div className="hidden grid-cols-[minmax(260px,1.25fr)_minmax(220px,1fr)_210px_140px_140px] border-b border-[#f2f2f2] bg-[#fbfbfa] px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8a8a96] lg:grid">
            <span>Asset</span>
            <span>Location and specs</span>
            <span>Status</span>
            <span>Documents</span>
            <span className="text-right">Price</span>
          </div>
          {listings.map((listing, index) => (
            <ListingListRow key={listing.id} index={index} listing={listing} segment={segment} />
          ))}
        </section>
      )}
    </div>
  );
}

/* First-run listings — clean editorial hero + three primary actions + an
   explainer card showing what the brain will surface once inventory lands. */
function FirstRunListings() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <PageHeader
        eyebrow="Asset intelligence"
        title="Add your first asset"
        description="Capture specs, documents, comps, buyer fits, and pitch lines in one listing brain."
        actions={
          <Link
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#17171c] px-5 text-sm font-medium text-white hover:bg-[#2a2a32]"
            href="/voice-crm"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Capture by voice
          </Link>
        }
      />

      <section aria-labelledby="listings-quick-start" className="mt-12">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="bb-mono-label">Quick start</p>
            <h2
              className="bb-display mt-2 text-xl font-medium text-[#17171c]"
              id="listings-quick-start"
            >
              Three ways to seed the inventory
            </h2>
          </div>
          <p className="hidden text-[13px] text-[#75758a] sm:block">
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
          eyebrow="What each listing remembers"
          title="The brain you'll have on every asset"
        />
        <ul className="divide-y divide-[#f2f2f2]">
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
      className="group flex h-full flex-col justify-between gap-5 rounded-2xl border border-[#e5e7eb] bg-white p-6 transition-colors hover:border-[#17171c]"
      href={href}
    >
      <div>
        <div className="flex items-center justify-between">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#003c33] text-white">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="bb-mono-label">{step}</span>
        </div>
        <h3 className="bb-display mt-5 text-lg font-medium text-[#17171c]">{title}</h3>
        <p className="mt-2 text-[13px] leading-6 text-[#616161]">{description}</p>
      </div>
      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#17171c]">
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
      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e5e7eb] bg-white text-[#003c33]">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-[14px] font-medium text-[#17171c]">{title}</p>
        <p className="mt-1 text-[13px] leading-6 text-[#616161]">{description}</p>
      </div>
    </li>
  );
}

function ListingListRow({
  index,
  listing,
  segment,
}: {
  index: number;
  listing: YachtListing;
  segment?: BrokerSegment;
}) {
  const completeness = getDocumentCompleteness(listing);
  const openTasks = getTasksForSegment(segment).filter(
    (task) => task.listingId === listing.id && task.status !== "Done",
  ).length;

  return (
    <Link
      className="grid gap-4 border-b border-[#f2f2f2] px-6 py-5 transition-colors last:border-b-0 hover:bg-[#fbfbfa] lg:grid-cols-[minmax(260px,1.25fr)_minmax(220px,1fr)_210px_140px_140px] lg:items-center"
      href={`/listings/${listing.id}`}
    >
      <div className="min-w-0">
        <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-4 items-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-lg border border-[#e5e7eb] bg-[#f5f4ef] font-mono text-[11px] font-semibold text-[#75758a]">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="min-w-0 truncate text-[15px] font-semibold text-[#17171c]">{listing.name}</h2>
            </div>
            <p className="mt-1 truncate text-[13px] leading-5 text-[#75758a]">
              {listing.builder} {listing.model}
            </p>
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-[#3f3f46]">{listing.location}</p>
        <p className="mt-1 truncate text-[13px] leading-5 text-[#75758a]">{getListingSpecSummary(listing)}</p>
      </div>

      <div className="flex flex-nowrap gap-1.5 w-full overflow-hidden">
        <Badge tone={statusTone(listing.status)} className="shrink-0 max-w-[50%]">
          <span className="truncate">{listing.status}</span>
        </Badge>
        <Badge tone={vatTone(listing.vatStatus)} className="shrink-0 max-w-[50%]">
          <span className="truncate">{listing.vatStatus}</span>
        </Badge>
      </div>

      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[12px] font-semibold text-[#17171c]">
            {completeness.percent}% ready
          </span>
          {openTasks ? (
            <span className="rounded-full bg-[#fff7ed] px-2 py-0.5 text-[11px] font-medium text-[#b45309]">
              {openTasks} tasks
            </span>
          ) : null}
        </div>
        <ProgressBar className="mt-2 h-1.5" value={completeness.percent} />
      </div>

      <p className="font-mono text-[14px] font-semibold text-[#17171c] lg:text-right">
        {formatCurrency(listing.priceEur)}
      </p>
    </Link>
  );
}

function ListingDetailHero({
  documentPercent,
  listing,
  sellerHref,
  topFitPercent,
}: {
  documentPercent: number;
  listing: YachtListing;
  sellerHref?: string;
  topFitPercent: number;
}) {
  const assetType = getListingAssetType(listing);
  const specSummary = getListingSpecSummary(listing);

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-[0_18px_55px_rgba(23,23,28,0.04)]">
      <div className="relative min-w-0 p-6 pb-0 sm:p-8 sm:pb-0">
        <Link
          className="absolute right-5 top-5 inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-[#17171c] px-3.5 text-[13px] font-medium text-white shadow-[0_10px_24px_rgba(23,23,28,0.14)] hover:bg-[#2a2a32] sm:right-6 sm:top-6"
          href={`/listings/${listing.id}/edit`}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          Edit
        </Link>

        <div className="max-w-[calc(100%-5.5rem)] sm:max-w-[calc(100%-6.5rem)]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-7 items-center rounded-full border border-[#e5e7eb] bg-[#fbfbfa] px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6f7080]">
              {assetType}
            </span>
            <span className="text-[12px] font-medium text-[#75758a]">
              {listing.builder} / {listing.model}
            </span>
          </div>

          <h1 className="bb-display mt-5 max-w-4xl text-[2.2rem] font-medium leading-[1.04] tracking-[-0.03em] text-[#17171c] sm:text-[2.75rem]">
            {listing.name}
          </h1>
          <p className="mt-4 max-w-3xl text-[15px] leading-7 text-[#52525b]">
            {specSummary}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2 pb-6">
          <Badge tone={statusTone(listing.status)}>{listing.status}</Badge>
          <Badge tone={vatTone(listing.vatStatus)}>{listing.vatStatus}</Badge>
          <span className="text-[13px] leading-6 text-[#616161]">{listing.idealBuyer}</span>
          {sellerHref ? (
            <Link
              className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[#d9d9dd] bg-white px-3 text-[12px] font-medium text-[#17171c] hover:border-[#17171c]"
              href={sellerHref}
            >
              Owner context
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid border-t border-[#f2f2f2] bg-[#fbfbfa] sm:grid-cols-3">
        <HeroMetric label="Ask" value={formatCurrency(listing.priceEur)} />
        <HeroMetric label="Documents" value={percentage(documentPercent)} />
        <HeroMetric label="Top fit" value={percentage(topFitPercent)} />
      </div>
    </section>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-[#e8e8ec] px-5 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a8a96]">{label}</p>
      <p className="mt-1 font-mono text-[17px] font-semibold text-[#17171c]">{value}</p>
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
    <Card className="overflow-hidden p-0 shadow-[0_12px_35px_rgba(23,23,28,0.04)]">
      <div className="relative">
        <AssetMedia
          className="min-h-56 !rounded-none border-0"
          compact
          listing={listing}
          showChrome={false}
        />
        <span className="absolute left-5 top-5 inline-flex h-10 min-w-10 items-center justify-center rounded-full bg-white/85 px-2 font-mono text-lg font-semibold text-[#17171c] shadow-[0_6px_18px_rgba(23,23,28,0.12)] backdrop-blur">
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
            <h2 className="bb-display truncate text-[1.45rem] font-medium leading-tight text-[#17171c]">
              <Link className="hover:text-[#1863dc]" href={`/listings/${listing.id}`}>
                {listing.name}
              </Link>
            </h2>
            <p className="mt-1 text-[14px] leading-6 text-[#75758a]">
              {listing.builder} {listing.model} · {getListingSpecSummary(listing)}
            </p>
          </div>
          <p className="font-mono text-[15px] font-semibold text-[#17171c] sm:text-right">
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

        <div className="mt-5 divide-y divide-[#f2f2f2] border-y border-[#f2f2f2]">
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
            <span className="font-mono text-[12px] font-semibold text-[#17171c]">
              {completeness.percent}%
            </span>
          </div>
          <ProgressBar className="mt-3 h-2" value={completeness.percent} />
          <p className="mt-2 text-[13px] text-[#616161]">
            {completeness.missingCount} missing facts
          </p>
        </div>

        <Link
          className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#17171c] px-5 text-sm font-medium text-white hover:bg-[#2a2a32] sm:w-auto"
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
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f5f4ef] text-[#17171c]">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="bb-mono-label">{label}</p>
        <p className="mt-1 truncate text-[15px] font-medium text-[#17171c]">{title}</p>
        <p className="mt-1 text-[13px] leading-5 text-[#75758a]">{detail}</p>
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
    <div className="min-w-0 rounded-xl border border-[#f0f0f2] bg-[#fbfbfa] p-3">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#3f3f46] shadow-[0_1px_8px_rgba(23,23,28,0.05)]">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-mono text-[15px] font-semibold text-[#17171c]">{value}</p>
          <p className="truncate text-[11px] font-medium text-[#75758a]">{label}</p>
        </div>
      </div>
    </div>
  );
}

export function ListingBrain({
  activeTab,
  listingId,
  listingOverride,
  segment,
}: {
  activeTab?: string;
  listingId: string;
  listingOverride?: YachtListing;
  segment?: BrokerSegment;
}) {
  const brain = listingOverride
    ? buildListingBrain(listingOverride, segment)
    : getListingBrain(listingId, segment);

  if (!brain) {
    return null;
  }

  const { listing, seller, documentCompleteness, fitSignals, pitch, comparison } = brain;
  const questions = [
    "What should I highlight for low maintenance?",
    "What are the weaknesses or objections?",
    "Which documents are missing?",
    "Can I promise the owner motivation?",
  ];
  const buyerOptions: BuyerOption[] = getBuyersForSegment(segment).map((buyer) => ({
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
    <div className="mx-auto w-full max-w-[1280px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <Link
        className="inline-flex items-center gap-2 text-sm font-medium text-[#3f3f46] hover:text-[#17171c]"
        href="/listings"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to listings
      </Link>

      <ListingDetailHero
        documentPercent={documentCompleteness.percent}
        listing={listing}
        sellerHref={seller && !seller.id.startsWith("seller-listing-") ? `/sellers/${seller.id}` : undefined}
        topFitPercent={fitSignals.highestScore}
      />

      <div className="mt-12 grid gap-8">
        <Card>
          <div className="grid items-stretch gap-5 border-b border-[#f2f2f2] px-6 py-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
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

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
          <div className="grid content-start gap-8">
            <Card>
              <CardHeader eyebrow="Source-aware answers" title="Broker question examples" />
              <ul className="grid gap-0 divide-y divide-[#f2f2f2]">
                {questions.map((question) => {
                  const response = answerListingQuestion(listing, question);
                  return (
                    <li key={question} className="grid gap-3 px-6 py-5 sm:grid-cols-[28px_1fr]">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#e5e7eb] bg-white text-[#17171c]">
                        <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-[14px] font-medium text-[#17171c]">{question}</h2>
                        <p className="mt-2 text-[13px] leading-6 text-[#3f3f46]">
                          {response.answer}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {response.sources.length ? (
                            response.sources.map((source) => (
                              <Badge key={source} tone="success">
                                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                                {source}
                              </Badge>
                            ))
                          ) : (
                            <Badge tone="error">Missing approved source</Badge>
                          )}
                          {response.missing.map((missing) => (
                            <Badge key={missing} tone="warning">
                              Missing: {missing}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>

          <Card>
            <CardHeader
              eyebrow="Objection memory"
              title="Record and surface buyer objections"
            />
            <div className="px-6 py-5">
              <ObjectionRecorder
                buyers={buyerOptions}
                initialObjections={objectionItems}
                listingId={listing.id}
              />
            </div>
          </Card>
        </div>

        <div className="grid content-start gap-8">
          <Card>
            <CardHeader
              eyebrow="AI pitch"
              title="Broker-ready positioning"
              action={
                <CardHeaderIcon>
                  <Bot className="h-4 w-4" aria-hidden="true" />
                </CardHeaderIcon>
              }
            />
            <ul className="grid gap-0 divide-y divide-[#f2f2f2]">
              <PitchRow label="30-second pitch" value={pitch.thirtySecond} />
              <PitchRow label="Buyer-safe angle" value={pitch.buyerSafe} />
              <PitchRow label="Internal shorthand" value={pitch.short} />
            </ul>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Competitive set"
              title={comparison.title}
              action={
                <CardHeaderIcon>
                  <Gauge className="h-4 w-4" aria-hidden="true" />
                </CardHeaderIcon>
              }
            />
            <ul className="grid gap-0 divide-y divide-[#f2f2f2]">
              {comparison.points.map((point) => (
                <li key={point} className="px-6 py-3.5 text-sm leading-6 text-[#3f3f46]">
                  {point}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader eyebrow="Buyer fit" title="Top buyers for this listing" />
            <ul className="grid gap-0 divide-y divide-[#f2f2f2]">
              {fitSignals.topMatches.map(({ buyer, match }) => (
                <li key={match.id} className="px-6 py-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-[14px] font-medium text-[#17171c]">{buyer?.name}</h3>
                      <p className="mt-0.5 text-[12px] uppercase tracking-[0.12em] text-[#75758a]">
                        {match.category}
                      </p>
                    </div>
                    <span className="font-mono text-[13px] font-medium text-[#17171c]">
                      {percentage(match.fitScore)}
                    </span>
                  </div>
                  <ProgressBar className="mt-3" value={match.fitScore} />
                  <p className="mt-3 text-[13px] leading-6 text-[#616161]">{match.rationale}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Buyer memory echoes"
              title="Rejections and objections"
              action={
                <CardHeaderIcon>
                  <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                </CardHeaderIcon>
              }
            />
            <ul className="grid gap-0 divide-y divide-[#f2f2f2]">
              {objectionItems.length ? (
                objectionItems.map((objection) => (
                  <li
                    key={`${objection.source}-${objection.buyerName}-${objection.raisedAt}`}
                    className="px-6 py-5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusDot className="bg-amber-500" />
                      <h3 className="text-[14px] font-medium text-[#17171c]">
                        {objection.buyerName ?? "Unknown buyer"}
                      </h3>
                    </div>
                    <p className="mt-2 text-[13px] leading-6 text-[#616161]">{objection.detail}</p>
                  </li>
                ))
              ) : (
                <li className="px-6 py-5 text-sm leading-6 text-[#616161]">
                  No buyer-memory objections recorded yet.
                </li>
              )}
            </ul>
          </Card>
        </div>
        </div>
      </div>
    </div>
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
    <div className="h-full min-h-48 overflow-hidden rounded-2xl border border-[#e5e7eb] bg-[#f5f4ef]">
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
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#edf1ee_0%,#f8f6ef_45%,#e5ece8_100%)]">
            <div className="absolute left-1/4 top-0 h-full w-px rotate-12 bg-white/80" />
            <div className="absolute left-1/2 top-0 h-full w-px -rotate-12 bg-white/80" />
            <div className="absolute left-0 top-1/2 h-px w-full bg-white/80" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.94)_42%,rgba(255,255,255,0.98)_100%)] p-4 pt-12">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="bb-mono-label">{type === "Yacht" ? "Location / marina" : "Location"}</p>
              <h3 className="mt-1 truncate text-[15px] font-semibold text-[#17171c]">
                {mapLocation.label}
              </h3>
              <p className="mt-1 text-[12px] leading-5 text-[#616161]">
                {mapLocation.precision === "Private"
                  ? "Private or approximate pin. Exact address stays broker-controlled."
                  : `${mapLocation.precision} map preview for broker orientation.`}
              </p>
            </div>
            {openUrl ? (
              <a
                aria-label={`Open ${mapLocation.label} in OpenStreetMap`}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#17171c] text-white hover:bg-[#2a2a32]"
                href={openUrl}
                rel="noreferrer"
                target="_blank"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            ) : (
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#003c33]">
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
      <p className="mt-2 text-[13px] leading-6 text-[#3f3f46]">{value}</p>
    </li>
  );
}

export function getListingIds() {
  return yachtListings.map((listing) => listing.id);
}
