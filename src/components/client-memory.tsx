"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Building2,
  CarFront,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  FileText,
  Flame,
  Gauge,
  LockKeyhole,
  Mail,
  MapPin,
  MessageSquareText,
  MoreVertical,
  Pencil,
  PlusCircle,
  Radio,
  Search,
  ShieldCheck,
  Ship,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  type BrokerSegment,
  getBrokerSegmentMeta,
  getBuyersForSegment,
  getConversationsForSegment,
  getFollowUpDraftsForSegment,
  getListingsForSegment,
  getTasksForSegment,
} from "@/lib/broker-segments";
import {
  deriveBuyerNextActions,
  generateBuyerSafeBrief,
  generateMatchesForBuyer,
  getBuyerMemoryProfile,
  getListingById,
  getSellerById,
  getSellerMemoryProfile,
  getVerificationForBuyer,
  getVerificationTone,
} from "@/lib/services";
import type {
  BuyerProfile,
  Conversation,
  FollowUpDraft,
  MatchResult,
  Priority,
  YachtListing,
} from "@/lib/types";
import { cn, daysUntil, formatCurrency, formatDate, percentage } from "@/lib/utils";
import {
  Badge,
  Card,
  CardHeader,
  CardHeaderIcon,
  EmptyState,
  PageHeader,
  ProgressBar,
  Stat,
  StatusDot,
} from "./ui";
import { ConfirmDialog, ToastViewport } from "./app-feedback";
import { FitRing, Tile } from "./dashboard/visuals";
import { deleteSessionBuyer } from "@/lib/browser-persistence";
import { deleteBuyerCascade } from "@/lib/supabase/delete-buyer";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const segmentIcons = {
  Yacht: Ship,
  Car: CarFront,
  "Real Estate": Building2,
} satisfies Record<BrokerSegment, LucideIcon>;
import { SessionBuyerQueue } from "./intake-panels";
import { OwnerNotePanel } from "./owner-note-panel";

const PAGE_SIZE = 12;

function dueLabel(date: string) {
  const delta = daysUntil(date);
  if (delta < 0) return `${Math.abs(delta)}d overdue`;
  if (delta === 0) return "Due today";
  if (delta === 1) return "Due tomorrow";
  return `Due in ${delta}d`;
}

function urgencyTone(urgency: BuyerProfile["urgency"]): "error" | "warning" | "info" | "neutral" {
  if (urgency === "Immediate") return "error";
  if (urgency === "This Season") return "warning";
  if (urgency === "This Quarter") return "info";
  return "neutral";
}

function priorityTone(priority: Priority): "error" | "warning" | "info" | "neutral" {
  if (priority === "Critical") return "error";
  if (priority === "High") return "warning";
  if (priority === "Medium") return "info";
  return "neutral";
}

function stageTone(
  stage: BuyerProfile["currentStage"],
): "success" | "info" | "warning" | "neutral" {
  if (stage === "Negotiation") return "success";
  if (stage === "Viewing Planned") return "success";
  if (stage === "Shortlist Sent") return "info";
  if (stage === "Qualified") return "info";
  return "neutral";
}

type BuyerMemoryModel = NonNullable<ReturnType<typeof getBuyerMemoryProfile>>;

function getBuyerMemoryModel(
  buyer: BuyerProfile,
  segment?: BrokerSegment,
  inventoryOverride?: YachtListing[],
): BuyerMemoryModel {
  if (inventoryOverride) return buildBuyerMemoryModel(buyer, segment, inventoryOverride);
  return getBuyerMemoryProfile(buyer.id, segment) ?? buildBuyerMemoryModel(buyer, segment);
}

function buildBuyerMemoryModel(
  buyer: BuyerProfile,
  segment?: BrokerSegment,
  inventoryOverride?: YachtListing[],
): BuyerMemoryModel {
  const inventory = inventoryOverride ?? getListingsForSegment(segment);
  const matches = generateMatchesForBuyer(buyer, inventory);
  const tasks = getTasksForSegment(segment).filter(
    (task) => task.buyerId === buyer.id && task.status !== "Done",
  );
  const conversations = getConversationsForSegment(segment).filter(
    (conversation) => conversation.buyerId === buyer.id,
  );
  const drafts = getFollowUpDraftsForSegment(segment).filter((draft) => draft.buyerId === buyer.id);
  const rejectedListings = buyer.rejectedAssets.map((rejection) => ({
    rejection,
    listing: inventory.find((listing) => listing.id === rejection.listingId) ?? getListingById(rejection.listingId, segment),
  }));

  return {
    buyer,
    verification: getVerificationForBuyer(buyer.id, segment),
    matches,
    tasks,
    conversations,
    drafts,
    rejectedListings,
    nextActions: deriveBuyerNextActions(buyer, segment),
    buyerSafeBrief: generateBuyerSafeBrief(buyer, matches),
  };
}

function mergeBuyers(demoBuyers: BuyerProfile[], storedBuyers: BuyerProfile[]) {
  const seen = new Set<string>();

  return [...storedBuyers, ...demoBuyers].filter((buyer) => {
    if (seen.has(buyer.id)) return false;
    seen.add(buyer.id);
    return true;
  });
}

function mergeListings(storedListings: YachtListing[], demoListings: YachtListing[]) {
  const seen = new Set<string>();

  return [...storedListings, ...demoListings].filter((listing) => {
    if (seen.has(listing.id)) return false;
    seen.add(listing.id);
    return true;
  });
}

function mergeById<T extends { id: string }>(stored: T[], demo: T[]): T[] {
  const seen = new Set<string>();
  return [...stored, ...demo].filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function filterBuyers(buyersToFilter: BuyerProfile[], query?: string) {
  const normalized = query?.trim().toLowerCase();
  if (!normalized) return buyersToFilter;

  return buyersToFilter.filter((buyer) =>
    [
      buyer.name,
      buyer.company,
      buyer.country,
      buyer.currentStage,
      buyer.urgency,
      buyer.preferredBrands.join(" "),
      buyer.preferredLocations.join(" "),
      buyer.lifestylePreferences.join(" "),
      buyer.mustHaves.join(" "),
      buyer.tags.join(" "),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalized),
  );
}

function buyerPrimarySegment(buyer: BuyerProfile, segment?: BrokerSegment): BrokerSegment {
  return segment ?? buyer.assetTypes?.[0] ?? "Yacht";
}

function buyerMetricLabel(buyer: BuyerProfile, segment?: BrokerSegment) {
  const primarySegment = buyerPrimarySegment(buyer, segment);
  if (primarySegment === "Car") return "Mileage";
  if (primarySegment === "Real Estate") return "Area";
  return "Size";
}

function formatBuyerMetricRange(buyer: BuyerProfile, segment?: BrokerSegment) {
  const primarySegment = buyerPrimarySegment(buyer, segment);
  const suffix = primarySegment === "Car" ? "km" : primarySegment === "Real Estate" ? "sqm" : "ft";
  return `${buyer.sizeRangeFt[0]}-${buyer.sizeRangeFt[1]} ${suffix}`;
}

function formatBuyerMetricDetail(buyer: BuyerProfile, segment?: BrokerSegment) {
  return [formatBuyerMetricRange(buyer, segment), buyer.preferredLocations.slice(0, 2).join(", ")]
    .filter(Boolean)
    .join(" · ");
}

const STAGE_OPTIONS: BuyerProfile["currentStage"][] = [
  "New Inquiry",
  "Qualified",
  "Shortlist Sent",
  "Viewing Planned",
  "Negotiation",
];

export function BuyerIndex({
  query: initialQuery,
  segment,
  storedBuyers = [],
  storedListings = [],
}: {
  query?: string;
  segment?: BrokerSegment;
  storedBuyers?: BuyerProfile[];
  storedListings?: YachtListing[];
}) {
  const allBuyers = useMemo(
    () => mergeBuyers(getBuyersForSegment(segment), storedBuyers),
    [storedBuyers, segment],
  );
  const inventory = useMemo(
    () => mergeListings(storedListings, getListingsForSegment(segment)),
    [storedListings, segment],
  );

  const [query, setQuery] = useState(initialQuery ?? "");
  const [stageFilter, setStageFilter] = useState<BuyerProfile["currentStage"] | "All">("All");
  const [page, setPage] = useState(1);

  const normalizedQuery = query.trim().toLowerCase();
  const searching = normalizedQuery !== "";

  // Query-only filter drives chip counts (Knowledge Vault pattern).
  const queryFilteredBuyers = useMemo(
    () => (searching ? filterBuyers(allBuyers, query) : allBuyers),
    [allBuyers, query, searching],
  );

  const dynamicStageCounts = useMemo(() => {
    const map = new Map<BuyerProfile["currentStage"], number>();
    for (const buyer of queryFilteredBuyers) {
      map.set(buyer.currentStage, (map.get(buyer.currentStage) ?? 0) + 1);
    }
    return map;
  }, [queryFilteredBuyers]);

  // Only show chips for stages that actually exist in the dataset.
  const availableStages = useMemo(() => {
    const present = new Set<BuyerProfile["currentStage"]>();
    for (const buyer of allBuyers) present.add(buyer.currentStage);
    return STAGE_OPTIONS.filter((stage) => present.has(stage));
  }, [allBuyers]);

  const filteredBuyers = useMemo(
    () =>
      stageFilter === "All"
        ? queryFilteredBuyers
        : queryFilteredBuyers.filter((buyer) => buyer.currentStage === stageFilter),
    [queryFilteredBuyers, stageFilter],
  );

  // Resolve top-match fits once for the entire current-view list.
  const fitByBuyer = useMemo(() => {
    const map = new Map<string, { score: number; listingName?: string }>();
    for (const buyer of filteredBuyers) {
      const profile = getBuyerMemoryModel(buyer, segment, inventory);
      const top = profile?.matches[0];
      if (top) {
        const listing = getListingById(top.listingId, segment);
        map.set(buyer.id, { score: top.fitScore, listingName: listing?.name });
      }
    }
    return map;
  }, [filteredBuyers, segment, inventory]);

  // KPI band — derived from the full segment buyer pool, not the filtered view.
  const hotCount = useMemo(
    () => allBuyers.filter((buyer) => buyer.urgency === "Immediate").length,
    [allBuyers],
  );
  const avgFit = useMemo(() => {
    let total = 0;
    let count = 0;
    for (const buyer of allBuyers) {
      const profile = getBuyerMemoryModel(buyer, segment, inventory);
      const top = profile?.matches[0];
      if (top) {
        total += top.fitScore;
        count += 1;
      }
    }
    return count === 0 ? 0 : Math.round(total / count);
  }, [allBuyers, segment, inventory]);
  const followUpCount = useMemo(
    () =>
      allBuyers.filter(
        (buyer) =>
          daysUntil(buyer.nextActionDueAt) <= 0 || buyer.currentStage === "New Inquiry",
      ).length,
    [allBuyers],
  );

  if (allBuyers.length === 0 && !initialQuery) {
    return <FirstRunBuyers />;
  }

  // Page guard runs after all hooks — inline correction beats useEffect for derived state.
  const pageCount = Math.max(1, Math.ceil(filteredBuyers.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  if (safePage !== page) {
    setPage(safePage);
  }
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageBuyers = filteredBuyers.slice(pageStart, pageStart + PAGE_SIZE);

  const onQueryChange = (next: string) => {
    setQuery(next);
    setPage(1);
  };
  const onStageChange = (next: BuyerProfile["currentStage"] | "All") => {
    setStageFilter(next);
    setPage(1);
  };
  const clearFilters = () => {
    setQuery("");
    setStageFilter("All");
    setPage(1);
  };
  const hasFilters = searching || stageFilter !== "All";

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
      <PageHeader
        eyebrow="Client memory"
        title="Buyers"
        description="Urgency, fit, and the next sentence to say."
        actions={
          <Link
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#17171c] px-5 text-sm font-medium text-white hover:bg-[#2a2a32]"
            href="/buyers/new"
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            New buyer
          </Link>
        }
      />

      {/* KPI band — one cream tile, three paper tiles. Same shape as Listings. */}
      <section
        aria-label="Buyer summary"
        className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4"
      >
        <KpiTile
          tone="cream"
          label="Pipeline"
          value={`${allBuyers.length}`}
          detail={
            filteredBuyers.length === allBuyers.length
              ? "All buyers in scope"
              : `${filteredBuyers.length} in current view`
          }
        />
        <KpiTile
          tone="paper"
          label="Hot"
          value={`${hotCount}`}
          detail="Immediate urgency"
        />
        <KpiTile
          tone="paper"
          label="Avg fit"
          value={avgFit > 0 ? percentage(avgFit) : "—"}
          detail="Top match across pipeline"
        />
        <KpiTile
          tone="paper"
          label="Needs follow-up"
          value={`${followUpCount}`}
          detail="Overdue or new inquiry"
        />
      </section>

      {/* Search + stage chips — Knowledge Vault dynamic-count pattern. */}
      <section
        aria-label="Filter buyers"
        className="mt-8 rounded-[22px] border border-[#ececef] bg-white p-4 sm:p-5"
      >
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <label className="relative block">
            <span className="sr-only">Search buyers</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#75758a]"
            />
            <input
              className="h-10 w-full rounded-full border border-[#e5e7eb] bg-white pl-10 pr-9 text-[13px] text-[#17171c] outline-none transition-colors placeholder:text-[#9b9ba6] focus:border-[#1863dc] focus:ring-2 focus:ring-[#1863dc]/15"
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Family use, VAT, Germany, brand…"
              type="search"
              value={query}
            />
            {searching ? (
              <button
                aria-label="Clear search"
                className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[#75758a] hover:bg-[#f4fbf5] hover:text-[#17171c]"
                onClick={() => onQueryChange("")}
                type="button"
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </label>
          <div className="flex flex-wrap gap-1.5">
            <StatusChip
              active={stageFilter === "All"}
              count={searching ? queryFilteredBuyers.length : allBuyers.length}
              label="All"
              onClick={() => onStageChange("All")}
            />
            {availableStages.map((stage) => {
              const count = searching
                ? (dynamicStageCounts.get(stage) ?? 0)
                : allBuyers.filter((b) => b.currentStage === stage).length;
              return (
                <StatusChip
                  active={stageFilter === stage}
                  count={count}
                  key={stage}
                  label={stage}
                  onClick={() => onStageChange(stage)}
                />
              );
            })}
          </div>
        </div>
      </section>

      <SessionBuyerQueue />

      {filteredBuyers.length === 0 ? (
        <Card className="mt-10">
          <EmptyState
            title={searching ? `No buyers match “${query}”` : "No buyers in this stage"}
            description="Adjust the search, clear the stage chip, or open the matching workspace to surface buyers by criteria."
            action={
              hasFilters ? (
                <button
                  className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#d9d9dd] bg-white px-4 text-[13px] font-medium text-[#17171c] hover:border-[#17171c]"
                  onClick={clearFilters}
                  type="button"
                >
                  Clear filters
                </button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          <section
            aria-label="Buyers"
            className="mt-8 overflow-hidden rounded-[22px] border border-[#ececef] bg-white"
          >
            <div className="hidden grid-cols-[minmax(280px,1.4fr)_minmax(200px,1fr)_minmax(180px,1fr)_44px] border-b border-[#f2f2f2] bg-[#fbfbfa] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a8a96] lg:grid">
              <span>Buyer</span>
              <span>Intent · range</span>
              <span>Signal</span>
              <span />
            </div>
            <div className="divide-y divide-[#f2f2f2]">
              {pageBuyers.map((buyer) => (
                <BuyerListRow
                  key={buyer.id}
                  buyer={buyer}
                  segment={segment}
                  fit={fitByBuyer.get(buyer.id)}
                />
              ))}
            </div>
          </section>

          {pageCount > 1 ? (
            <nav
              aria-label="Buyers pagination"
              className="mt-6 flex items-center justify-between gap-3"
            >
              <p className="text-[12px] text-[#75758a]">
                Showing{" "}
                <span className="font-mono font-semibold tabular-nums text-[#17171c]">
                  {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filteredBuyers.length)}
                </span>{" "}
                of{" "}
                <span className="font-mono font-semibold tabular-nums text-[#17171c]">
                  {filteredBuyers.length}
                </span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  aria-label="Previous page"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#e5e7eb] bg-white px-3 text-[12.5px] font-medium text-[#17171c] transition-colors hover:border-[#17171c] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#e5e7eb]"
                  disabled={safePage === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  type="button"
                >
                  <ChevronLeft aria-hidden="true" className="h-3.5 w-3.5" />
                  Prev
                </button>
                <span className="inline-flex h-9 items-center rounded-full border border-[#e5e7eb] bg-[#fbfbfa] px-3 font-mono text-[12.5px] font-semibold tabular-nums text-[#17171c]">
                  {safePage} / {pageCount}
                </span>
                <button
                  aria-label="Next page"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#e5e7eb] bg-white px-3 text-[12.5px] font-medium text-[#17171c] transition-colors hover:border-[#17171c] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#e5e7eb]"
                  disabled={safePage === pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  type="button"
                >
                  Next
                  <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              </div>
            </nav>
          ) : null}
        </>
      )}
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
        "rounded-[22px] border p-5",
        tone === "cream"
          ? "border-transparent bg-[#f4ead5] text-[#17171c]"
          : "border-[#ececef] bg-white text-[#17171c]",
      )}
    >
      <p className="bb-mono-label">{label}</p>
      <p className="bb-display mt-3 text-[28px] font-medium leading-none tabular-nums">{value}</p>
      <p className="mt-2 text-[12.5px] leading-[1.5] text-[#54545f]">{detail}</p>
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
        "inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1863dc]",
        active
          ? "border-[#17171c] bg-[#17171c] text-white"
          : isEmpty
            ? "cursor-not-allowed border-[#ececef] bg-white text-[#9b9ba6] opacity-50"
            : "border-[#e5e7eb] bg-white text-[#54545f] hover:border-[#17171c]",
      )}
      disabled={isEmpty}
      onClick={onClick}
      type="button"
    >
      <span>{label}</span>
      <span
        className={cn(
          "font-mono tabular-nums",
          active ? "text-white/80" : "text-[#75758a]",
        )}
      >
        · {count}
      </span>
    </button>
  );
}

function BuyerListRow({
  buyer,
  segment,
  fit,
}: {
  buyer: BuyerProfile;
  segment?: BrokerSegment;
  fit?: { score: number; listingName?: string };
}) {
  const subtitle = [buyerPrimarySegment(buyer, segment), buyer.currentStage]
    .filter(Boolean)
    .join(" · ");
  const dueDelta = daysUntil(buyer.nextActionDueAt);
  const overdue = dueDelta <= 0;

  return (
    <Link
      className="group grid gap-4 px-5 py-4 transition-colors hover:bg-[#fafaf7] focus-visible:bg-[#fafaf7] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1863dc] lg:grid-cols-[64px_minmax(220px,1.4fr)_minmax(200px,1fr)_minmax(160px,1fr)_44px] lg:items-center"
      href={`/buyers/${buyer.id}`}
    >
      {/* Fit ring — replaces avatar. Placeholder ring when no match available. */}
      <div className="flex shrink-0 items-center justify-center">
        {fit ? (
          <FitRing
            label={`${Math.round(fit.score)}`}
            size={44}
            stroke={4}
            tone="green"
            value={fit.score}
          />
        ) : (
          <span
            aria-label="No match score yet"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-dashed border-[#d9d9dd] font-mono text-[12px] font-semibold text-[#9b9ba6]"
          >
            —
          </span>
        )}
      </div>

      {/* Identity */}
      <div className="min-w-0">
        <h2
          className="truncate text-[14.5px] font-semibold leading-[1.3] text-[#17171c] group-hover:text-[#003c33]"
          title={buyer.name}
        >
          {buyer.name}
        </h2>
        <p
          className="mt-1 truncate text-[12.5px] leading-[1.4] text-[#75758a]"
          title={subtitle}
        >
          {subtitle}
        </p>
      </div>

      {/* Intent · range */}
      <div className="min-w-0">
        <p className="truncate text-[12.5px] font-medium leading-[1.4] text-[#3f3f46]">
          {formatCurrency(buyer.budgetMinEur)} – {formatCurrency(buyer.budgetMaxEur)}
        </p>
        <p
          className="mt-1 truncate text-[12px] leading-[1.4] text-[#75758a]"
          title={formatBuyerMetricDetail(buyer, segment)}
        >
          {formatBuyerMetricDetail(buyer, segment)}
        </p>
      </div>

      {/* Signal — urgency badge + overdue pill */}
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <Badge tone={urgencyTone(buyer.urgency)}>
          {buyer.urgency === "Immediate" ? (
            <Flame aria-hidden="true" className="h-3 w-3" />
          ) : null}
          {buyer.urgency}
        </Badge>
        {overdue ? (
          <Badge tone="coral">{dueLabel(buyer.nextActionDueAt)}</Badge>
        ) : null}
      </div>

      {/* Chevron */}
      <div className="hidden items-center justify-end lg:flex">
        <ArrowUpRight
          aria-hidden="true"
          className="h-4 w-4 text-[#9b9ba6] transition-colors group-hover:text-[#17171c]"
        />
      </div>
    </Link>
  );
}

/* First-run buyers — clean editorial hero + three primary actions + an
   explainer card showing what each buyer profile will remember. */
function FirstRunBuyers() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <PageHeader
        eyebrow="Client memory"
        title="Add your first buyer"
        description="Capture criteria, urgency, style, objections, and next actions for every conversation."
        actions={
          <Link
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#17171c] px-5 text-sm font-medium text-white hover:bg-[#2a2a32]"
            href="/buyers/new"
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            Add buyer
          </Link>
        }
      />

      <section aria-labelledby="buyers-quick-start" className="mt-12">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="bb-mono-label">Quick start</p>
            <h2
              className="bb-display mt-2 text-xl font-medium text-[#17171c]"
              id="buyers-quick-start"
            >
              Three ways to start a buyer
            </h2>
          </div>
          <p className="hidden text-[13px] text-[#75758a] sm:block">
            Each path persists buyer memory.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <BuyersActionCard
            description="Paste a call summary to create memory, tasks, and drafts."
            href="/voice-crm"
            icon={Radio}
            step="01"
            title="Capture a call"
          />
          <BuyersActionCard
            description="Type a brief and attach a generated shortlist."
            href="/matching"
            icon={Gauge}
            step="02"
            title="Run a brief"
          />
          <BuyersActionCard
            description="Clear serious inquiries before sensitive sharing."
            href="/verification"
            icon={ShieldCheck}
            step="03"
            title="Open verification"
          />
        </div>
      </section>

      <Card className="mt-12 scroll-mt-8" id="buyer-profile">
        <CardHeader
          eyebrow="What each buyer remembers"
          title="Memory you'll have on every conversation"
        />
        <ul className="divide-y divide-[#f2f2f2]">
          <BuyersExplainerRow
            icon={CircleAlert}
            title="Criteria, urgency, and stage"
            description="Budget, size, brands, VAT needs, timeline, and stage."
          />
          <BuyersExplainerRow
            icon={LockKeyhole}
            title="Verification and access readiness"
            description="Risk score, action, and broker-held sensitive assets."
          />
          <BuyersExplainerRow
            icon={MessageSquareText}
            title="Communication and relationship notes"
            description="Channel, cadence, objections, and rejected assets."
          />
          <BuyersExplainerRow
            icon={Mail}
            title="Drafts waiting for broker approval"
            description="Replies and recaps stay editable before send."
          />
        </ul>
      </Card>
    </div>
  );
}

function BuyersActionCard({
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

function BuyersExplainerRow({
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

export function BuyerMemoryProfile({
  buyerId,
  buyerOverride,
  segment,
  storedListings = [],
  storedConversations = [],
  storedDrafts = [],
}: {
  buyerId: string;
  buyerOverride?: BuyerProfile;
  segment?: BrokerSegment;
  storedListings?: YachtListing[];
  storedConversations?: Conversation[];
  storedDrafts?: FollowUpDraft[];
}) {
  const inventory = mergeListings(storedListings, getListingsForSegment(segment));
  const staticProfile = getBuyerMemoryProfile(buyerId, segment);
  const profile = buyerOverride
    ? getBuyerMemoryModel(buyerOverride, segment, inventory)
    : staticProfile
      ? buildBuyerMemoryModel(staticProfile.buyer, segment, inventory)
      : undefined;
  const [tab, setTab] = useState<"memory" | "matches" | "drafts">("memory");
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [toast, setToast] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!actionMenuOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (!actionMenuRef.current?.contains(event.target as Node)) {
        setActionMenuOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setActionMenuOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [actionMenuOpen]);

  if (!profile) {
    return null;
  }

  const {
    buyer,
    verification,
    matches,
    conversations: demoConversations,
    drafts: demoDrafts,
    rejectedListings,
    nextActions,
    buyerSafeBrief,
  } = profile;
  const conversations = mergeById(storedConversations, demoConversations);
  const drafts = mergeById(storedDrafts, demoDrafts);
  const verificationTone = getVerificationTone(verification?.status ?? "Needs Review");
  const segmentMeta = getBrokerSegmentMeta(segment);
  const SegmentIcon = segmentIcons[segmentMeta.id];
  const eyebrowDetail = [buyer.company, buyer.country].filter(Boolean).join(" · ");
  // Suppress the default placeholders set in stored-buyers.ts so the header
  // doesn't read like instructions to the broker.
  const PLACEHOLDER_SUMMARY = new Set([
    "Timeline to confirm with buyer.",
    "Broker to confirm preferred cadence.",
  ]);
  const headerSummary = [buyer.decisionTimeline, buyer.communicationStyle]
    .map((piece) => piece?.trim())
    .filter((piece): piece is string => Boolean(piece) && !PLACEHOLDER_SUMMARY.has(piece!))
    .join(" · ");
  const metaLineItemsRaw = [
    segmentMeta.label,
    buyer.currentStage,
    buyer.preferredLocations.length ? buyer.preferredLocations.join(" / ") : null,
    ...buyer.tags,
  ].filter((piece): piece is string => Boolean(piece && piece.trim().length));
  // Dedupe case-insensitively so "Mallorca" and lowercase "mallorca" tag don't
  // both appear in the meta line.
  const metaLineItemsSeen = new Set<string>();
  const metaLineItems = metaLineItemsRaw.filter((piece) => {
    const key = piece.toLowerCase();
    if (metaLineItemsSeen.has(key)) return false;
    metaLineItemsSeen.add(key);
    return true;
  });
  const topMatch = matches[0];
  const sortedMatches = [...matches].sort((a, b) => b.fitScore - a.fitScore);

  const handleConfirmDelete = () => {
    startDeleteTransition(async () => {
      try {
        if (isSupabaseConfigured()) {
          const result = await deleteBuyerCascade(buyer.id);
          if (!result.ok) {
            setToast({ tone: "error", message: result.error ?? "Could not delete buyer." });
            return;
          }
        }
        try {
          deleteSessionBuyer(buyer.id);
        } catch {
          // session cleanup is best-effort; ignore localStorage failures
        }
        setDeleteOpen(false);
        router.push("/buyers");
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unexpected error deleting buyer.";
        setToast({ tone: "error", message });
      }
    });
  };
  const memoryTiles: Array<{ label: string; value: string; detail?: string }> = [
    {
      label: "Budget",
      value: `${formatCurrency(buyer.budgetMinEur)} – ${formatCurrency(buyer.budgetMaxEur)}`,
      detail: "Approved working range",
    },
    {
      label: buyerMetricLabel(buyer, segment),
      value: formatBuyerMetricRange(buyer, segment),
    },
    {
      label: "Preferred brands",
      value: buyer.preferredBrands.length ? buyer.preferredBrands.join(", ") : "—",
    },
    {
      label: "Preferred locations",
      value: buyer.preferredLocations.length ? buyer.preferredLocations.join(", ") : "—",
    },
    {
      label: "Decision timeline",
      value: buyer.decisionTimeline,
    },
    {
      label: "Communication style",
      value: buyer.communicationStyle,
    },
    {
      label: "Last contacted",
      value: formatDate(buyer.lastContactedAt),
    },
    {
      label: "Next action",
      value: dueLabel(buyer.nextActionDueAt),
      detail: formatDate(buyer.nextActionDueAt),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
      <Link
        className="inline-flex items-center gap-2 text-sm font-medium text-[#3f3f46] hover:text-[#17171c]"
        href="/buyers"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to buyers
      </Link>

      {/* Editorial cockpit header — segment chip + last contacted, display h1,
          single-line summary, and a neat row of status badges. Action cluster
          (Capture / Open deal room / Delete) anchors top-right. */}
      <header className="mt-6 flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-[#dedee3] bg-white px-3 text-[11px] font-medium uppercase tracking-[0.16em] text-[#3f3f46]">
              <SegmentIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {eyebrowDetail || `${segmentMeta.label} buyer`}
            </span>
            <span className="bb-mono-label text-[#75758a]">
              Last contacted · {formatDate(buyer.lastContactedAt)}
            </span>
          </div>
          <h1 className="bb-display mt-4 text-[2rem] font-medium leading-[1.04] text-[#17171c] sm:text-[2.4rem]">
            {buyer.name}
          </h1>
          {headerSummary ? (
            <p className="mt-3 max-w-xl text-[13.5px] leading-7 text-[#3f3f46]">
              {headerSummary}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <Badge tone={stageTone(buyer.currentStage)}>{buyer.currentStage}</Badge>
            <Badge tone={urgencyTone(buyer.urgency)}>{buyer.urgency}</Badge>
            <Badge className={verificationTone.className}>
              <StatusDot className={verificationTone.dotClassName} />
              {verification?.status ?? "Needs Review"}
            </Badge>
          </div>
          {metaLineItems.length ? (
            <p
              className="bb-mono-label mt-3 truncate whitespace-nowrap text-[#75758a]"
              title={metaLineItems.join("  ·  ")}
            >
              {metaLineItems.join("  ·  ")}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#d9d9dd] bg-white px-4 text-sm font-medium text-[#17171c] transition-colors hover:border-[#17171c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c6ee6]"
            href="/voice-crm"
          >
            <Bot className="h-4 w-4" aria-hidden="true" />
            Capture voice note
          </Link>
          <Link
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#17171c] px-5 text-sm font-medium text-white transition-colors hover:bg-[#2a2a32] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c6ee6]"
            href="/deal-rooms"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            Open deal room
          </Link>
          <div className="relative" ref={actionMenuRef}>
            <button
              aria-expanded={actionMenuOpen}
              aria-haspopup="menu"
              aria-label="More buyer actions"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d9d9dd] bg-white text-[#3f3f46] transition-colors hover:border-[#17171c] hover:text-[#17171c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c6ee6]"
              onClick={() => setActionMenuOpen((open) => !open)}
              type="button"
            >
              <MoreVertical aria-hidden="true" className="h-4 w-4" />
            </button>
            {actionMenuOpen ? (
              <div
                aria-orientation="vertical"
                className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border border-[#e3e3e8] bg-white p-1.5 shadow-[0_18px_45px_rgba(23,23,28,0.13)]"
                role="menu"
              >
                <Link
                  className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[#3f3f46] transition-colors hover:bg-[#f5f5f7] hover:text-[#17171c] focus:bg-[#f5f5f7] focus:outline-none"
                  href={`/buyers/${buyer.id}/edit`}
                  onClick={() => setActionMenuOpen(false)}
                  role="menuitem"
                >
                  <Pencil aria-hidden="true" className="h-4 w-4" />
                  Edit
                </Link>
                <button
                  className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-rose-600 transition-colors hover:bg-rose-50 focus:bg-rose-50 focus:outline-none"
                  onClick={() => {
                    setActionMenuOpen(false);
                    setDeleteOpen(true);
                  }}
                  role="menuitem"
                  type="button"
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                  Delete
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* Metric fold — Budget / Next action / Top match fit (with FitRing). */}
      <section
        aria-label="Buyer at a glance"
        className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-3"
      >
        <Tile tone="paper">
          <p className="bb-mono-label">Budget</p>
          <p className="bb-display mt-3 text-[1.5rem] font-medium leading-[1.1] tabular-nums text-[#17171c]">
            {formatCurrency(buyer.budgetMinEur)} – {formatCurrency(buyer.budgetMaxEur)}
          </p>
          <p className="mt-2 text-[12.5px] leading-[1.5] text-[#54545f]">
            {buyer.urgency} · {buyer.decisionTimeline}
          </p>
        </Tile>
        <Tile tone="paper">
          <p className="bb-mono-label">Next action</p>
          <p className="bb-display mt-3 text-[1.5rem] font-medium leading-[1.1] text-[#17171c]">
            {dueLabel(buyer.nextActionDueAt)}
          </p>
          <p className="mt-2 text-[12.5px] leading-[1.5] text-[#54545f]">
            {formatDate(buyer.nextActionDueAt)} · {buyer.communicationStyle}
          </p>
        </Tile>
        <Tile tone="paper">
          <p className="bb-mono-label">Top match fit</p>
          {topMatch ? (
            <div className="mt-3 flex items-center gap-4">
              <FitRing
                value={Math.round(topMatch.fitScore * 100)}
                size={64}
                stroke={6}
                tone="green"
              />
              <div className="min-w-0">
                <p className="bb-display text-[1.25rem] font-medium leading-[1.15] text-[#17171c]">
                  {percentage(topMatch.fitScore)}
                </p>
                <p className="mt-1 text-[12.5px] leading-[1.5] text-[#54545f]">
                  {topMatch.category} · {matches.length} candidate{matches.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          ) : (
            <>
              <p className="bb-display mt-3 text-[1.5rem] font-medium leading-[1.1] text-[#17171c]">
                —
              </p>
              <p className="mt-2 text-[12.5px] leading-[1.5] text-[#54545f]">
                No matches surfaced yet
              </p>
            </>
          )}
        </Tile>
      </section>

      {/* Tabbed Buyer Profile card — overflow-hidden so inner rounded edges clip cleanly. */}
      <Card className="mt-7 overflow-hidden rounded-[20px]" id="buyer-profile">
        <CardHeader
          eyebrow="Buyer profile"
          title={
            tab === "memory"
              ? "Criteria and relationship memory"
              : tab === "matches"
                ? "Current recommendations and missing criteria"
                : "Recent conversations and drafts"
          }
          action={<BuyerMemoryNav value={tab} onChange={setTab} />}
        />

        {tab === "memory" ? (
          <div className="grid gap-5 px-6 py-5">
            {/* 8-field mini-tile grid. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {memoryTiles.map((tile) => (
                <div
                  key={tile.label}
                  className="rounded-xl border border-[#ececef] bg-[#fafaf7] p-4"
                >
                  <p className="bb-mono-label">{tile.label}</p>
                  <p className="mt-2 text-[14px] font-medium leading-[1.4] text-[#17171c]">
                    {tile.value}
                  </p>
                  {tile.detail ? (
                    <p className="mt-1 text-[12px] leading-[1.5] text-[#75758a]">
                      {tile.detail}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>

            {/* Preferences / Must-haves / Deal breakers — 3-col sub-tiles with icon eyebrows. */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <InsightSubtile
                icon={Sparkles}
                title="Preferences"
                items={buyer.lifestylePreferences}
              />
              <InsightSubtile
                icon={CheckCircle2}
                title="Must-haves"
                items={buyer.mustHaves}
              />
              <InsightSubtile
                icon={CircleAlert}
                title="Deal breakers"
                items={buyer.dealBreakers}
              />
            </div>

            {/* Relationship notes / Known objections — paired Tiles with divided lists. */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <NotesTile
                icon={MessageSquareText}
                title="Relationship notes"
                items={buyer.relationshipNotes}
              />
              <NotesTile
                icon={CircleAlert}
                title="Known objections"
                items={
                  buyer.objections.length ? buyer.objections : ["No open objections recorded"]
                }
              />
            </div>
          </div>
        ) : null}

        {tab === "matches" ? (
          sortedMatches.length ? (
            <div className="px-6 py-5">
              <p className="bb-mono-label">
                Top {Math.min(sortedMatches.length, 3)} of {sortedMatches.length} match
                {sortedMatches.length === 1 ? "" : "es"}
              </p>
              <ul className="mt-3 overflow-hidden rounded-xl border border-[#ececef] bg-white divide-y divide-[#f2f2f2]">
                {sortedMatches.map((match) => (
                  <MatchPanel
                    key={match.id}
                    inventory={inventory}
                    match={match}
                    segment={segment}
                  />
                ))}
              </ul>
            </div>
          ) : (
            <div className="px-6 py-5">
              <EmptyState
                title="No matches surfaced yet"
                description="Once the matching engine identifies candidates for this buyer, they will appear here ranked by fit score."
              />
            </div>
          )
        ) : null}

        {tab === "drafts" ? (
          <div className="grid gap-5 px-6 py-5">
            <section aria-label="Recent conversations">
              <p className="bb-mono-label">Recent conversations</p>
              {conversations.length ? (
                <ul className="mt-3 overflow-hidden rounded-xl border border-[#ececef] bg-white divide-y divide-[#f2f2f2]">
                  {conversations.map((conversation) => (
                    <li key={conversation.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="neutral">{conversation.channel}</Badge>
                        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#75758a]">
                          {formatDate(conversation.occurredAt)}
                        </span>
                        {conversation.needsSummary ? (
                          <Badge tone="warning">Needs summary</Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 text-[13px] leading-6 text-[#3f3f46]">
                        {conversation.summary}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-3 rounded-xl border border-dashed border-[#e5e7eb] bg-white">
                  <EmptyState
                    title="No conversations captured"
                    description="Voice notes and inbox threads tied to this buyer will appear here."
                  />
                </div>
              )}
            </section>

            <section aria-label="Drafts in approval">
              <p className="bb-mono-label">Drafts in approval</p>
              {drafts.length ? (
                <ul className="mt-3 overflow-hidden rounded-xl border border-[#ececef] bg-white divide-y divide-[#f2f2f2]">
                  {drafts.map((draft) => (
                    <li key={draft.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="success">{draft.status}</Badge>
                        <Badge tone="neutral">{draft.channel}</Badge>
                      </div>
                      <h2 className="mt-2 text-[14px] font-medium text-[#17171c]">
                        {draft.subject}
                      </h2>
                      <p className="mt-2 text-[13px] leading-6 text-[#3f3f46]">{draft.body}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-3 rounded-xl border border-dashed border-[#e5e7eb] bg-white">
                  <EmptyState
                    title="No drafts pending"
                    description="Outgoing follow-ups awaiting your approval will land here before send."
                  />
                </div>
              )}
            </section>
          </div>
        ) : null}
      </Card>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div className="grid content-start gap-6">
          {/* Rejected assets — Tile with editorial divided list. */}
          <Tile tone="paper" className="!p-0">
            <div className="flex items-start justify-between gap-3 px-6 pt-5">
              <div>
                <p className="bb-mono-label">Rejected assets</p>
                <p className="bb-display mt-2 text-[1.05rem] font-medium leading-[1.2] text-[#17171c]">
                  Do not repeat the same mismatch
                </p>
              </div>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#ececef] bg-white text-[#003c33]">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </div>
            <ul className="mt-4 divide-y divide-[#f2f2f2] border-t border-[#f2f2f2]">
              {rejectedListings.length ? (
                rejectedListings.map(({ rejection, listing }) => (
                  <li
                    key={rejection.listingId}
                    className="grid gap-3 px-6 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                  >
                    <div className="min-w-0">
                      {listing ? (
                        <Link
                          className="text-[14px] font-medium text-[#17171c] hover:text-[#003c33] hover:underline"
                          href={`/listings/${listing.id}`}
                        >
                          {listing.name}
                        </Link>
                      ) : (
                        <p className="text-[14px] font-medium text-[#17171c]">Unknown asset</p>
                      )}
                      <p className="mt-1 text-[12.5px] leading-[1.5] text-[#75758a]">
                        {rejection.reason}
                      </p>
                    </div>
                    <span className="bb-mono-label rounded-full border border-[#ececef] bg-white px-2.5 py-1 text-[#54545f]">
                      Rejected {formatDate(rejection.rejectedAt)}
                    </span>
                  </li>
                ))
              ) : (
                <li className="px-6 py-5">
                  <EmptyState
                    title="No rejections recorded"
                    description="Once buyers veto an asset, the reason lands here so we never re-pitch it."
                  />
                </li>
              )}
            </ul>
          </Tile>

          {/* Broker guardrails — paired with Rejected assets (both are "be careful" context). */}
          <Tile tone="paper">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="bb-mono-label">Broker guardrails</p>
                <p className="bb-display mt-2 text-[1.05rem] font-medium leading-[1.2] text-[#17171c]">
                  Filtered before buyer delivery
                </p>
              </div>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#ececef] bg-white text-[#003c33]">
                <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </div>
            <ul className="mt-4 divide-y divide-[#f2f2f2] border-t border-[#f2f2f2]">
              {buyerSafeBrief.removedInternalFields.map((field, index) => (
                <li
                  key={`${field}-${index}`}
                  className="flex items-start gap-3 py-3 text-[13px] leading-6 text-[#3f3f46]"
                >
                  <LockKeyhole
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#003c33]"
                    aria-hidden="true"
                  />
                  <span>{field}</span>
                </li>
              ))}
            </ul>
          </Tile>
        </div>

        {/* Right rail — ActionStack stays as Card; supporting context becomes Tiles. */}
        <div className="grid content-start gap-6">
          <ActionStack actions={nextActions} title="Memory-derived next actions" />

          <Tile tone="cream">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="bb-mono-label">Buyer-safe content</p>
                <p className="bb-display mt-2 text-[1.15rem] font-medium leading-[1.2] text-[#17171c]">
                  {buyerSafeBrief.headline}
                </p>
              </div>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/60 text-[#003c33]">
                <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </div>
            <ul className="mt-4 grid gap-2">
              {buyerSafeBrief.body.map((line, index) => (
                <li
                  key={`${line}-${index}`}
                  className="text-[13px] leading-6 text-[#3f3f46]"
                >
                  · {line}
                </li>
              ))}
            </ul>
            <div className="mt-5 border-t border-[#17171c]/10 pt-4">
              <p className="bb-mono-label">Approved facts used</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {buyerSafeBrief.approvedFacts.map((fact, index) => (
                  <Badge key={`${fact}-${index}`} tone="success">
                    {fact}
                  </Badge>
                ))}
              </div>
            </div>
          </Tile>

          <Tile tone="paper">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="bb-mono-label">Verification context</p>
                <p className="bb-display mt-2 text-[1.05rem] font-medium leading-[1.2] text-[#17171c]">
                  {verification?.requestedAccess ?? "Access request"}
                </p>
              </div>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#ececef] bg-white text-[#003c33]">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <Badge className={verificationTone.className}>
                <StatusDot className={verificationTone.dotClassName} />
                {verification?.status ?? "Needs Review"}
              </Badge>
              <span className="bb-display font-mono text-[1.05rem] font-medium tabular-nums text-[#17171c]">
                {verification?.score ?? 0}
              </span>
            </div>
            <ProgressBar className="mt-3" value={verification?.score ?? 0} />
            <p className="mt-3 text-[13px] leading-6 text-[#54545f]">
              {verification?.recommendedAction ?? "No verification recommendation recorded."}
            </p>
          </Tile>
        </div>
      </div>

      <ConfirmDialog
        cancelLabel="Keep buyer"
        confirmDisabled={isDeleting}
        confirmLabel={isDeleting ? "Deleting…" : "Delete buyer"}
        confirmTone="destructive"
        description={`Removes the buyer profile, conversations, and follow-up drafts attached to ${buyer.name}. This cannot be undone.`}
        onCancel={() => {
          if (!isDeleting) setDeleteOpen(false);
        }}
        onConfirm={handleConfirmDelete}
        open={deleteOpen}
        title="Delete this buyer?"
      />
      <ToastViewport
        message={toast?.message ?? null}
        onDismiss={() => setToast(null)}
        tone={toast?.tone ?? "success"}
      />
    </div>
  );
}

function InsightSubtile({
  icon: Icon,
  title,
  items,
}: {
  icon: LucideIcon;
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-xl border border-[#ececef] bg-[#fafaf7] p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-[#003c33]" aria-hidden="true" />
        <p className="bb-mono-label">{title}</p>
      </div>
      {items.length ? (
        <ul className="mt-3 grid gap-1.5">
          {items.map((item, index) => (
            <li
              key={`${item}-${index}`}
              className="text-[13px] leading-[1.5] text-[#3f3f46]"
            >
              · {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[12.5px] leading-[1.5] text-[#75758a]">None recorded</p>
      )}
    </div>
  );
}

function NotesTile({
  icon: Icon,
  title,
  items,
}: {
  icon: LucideIcon;
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-xl border border-[#ececef] bg-[#fafaf7] p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-[#003c33]" aria-hidden="true" />
        <p className="bb-mono-label">{title}</p>
      </div>
      <ul className="mt-3 divide-y divide-[#f2f2f2]">
        {items.map((item, index) => (
          <li
            key={`${item}-${index}`}
            className="py-2 text-[13px] leading-[1.55] text-[#3f3f46] first:pt-0 last:pb-0"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BuyerMemoryNav({
  value,
  onChange,
}: {
  value: "memory" | "matches" | "drafts";
  onChange: (next: "memory" | "matches" | "drafts") => void;
}) {
  const items: { label: string; key: "memory" | "matches" | "drafts" }[] = [
    { label: "Memory", key: "memory" },
    { label: "Matches", key: "matches" },
    { label: "Drafts", key: "drafts" },
  ];

  return (
    <nav
      aria-label="Buyer profile section"
      className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-[#d9d9dd] bg-white p-1"
    >
      {items.map((item) => {
        const active = value === item.key;
        return (
          <button
            aria-pressed={active}
            className={cn(
              "inline-flex min-h-8 shrink-0 items-center rounded-full px-3 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c6ee6]",
              active ? "bg-[#17171c] text-white" : "text-[#3f3f46] hover:bg-[#f5f4ef]",
            )}
            key={item.key}
            onClick={() => onChange(item.key)}
            type="button"
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

function MatchPanel({
  inventory,
  match,
  segment,
}: {
  inventory?: YachtListing[];
  match: MatchResult;
  segment?: BrokerSegment;
}) {
  const listing = inventory?.find((listing) => listing.id === match.listingId) ?? getListingById(match.listingId, segment);
  const owner = listing ? getSellerById(listing.ownerId, segment) : undefined;

  return (
    <li className="px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge tone="info">{match.category}</Badge>
          <h2 className="mt-2 text-[14px] font-medium">
            {listing ? (
              <Link className="text-[#17171c] hover:text-[#1863dc] hover:underline" href={`/listings/${listing.id}`}>
                {listing.name} · {listing.builder} {listing.model}
              </Link>
            ) : (
              <span className="text-[#17171c]">Unknown asset</span>
            )}
          </h2>
          {owner ? (
            <Link
              className="mt-1 inline-flex text-[13px] font-medium text-[#1863dc] hover:underline"
              href={`/sellers/${owner.id}`}
            >
              {owner.name}
            </Link>
          ) : null}
        </div>
        <span className="font-mono text-[13px] font-medium text-[#17171c]">
          {percentage(match.fitScore)}
        </span>
      </div>
      <ProgressBar className="mt-3" value={match.fitScore} />
      <p className="mt-3 text-[13px] leading-6 text-[#3f3f46]">{match.rationale}</p>
      <div className="mt-3 grid gap-x-10 gap-y-3 sm:grid-cols-2">
        <ListBlock
          label="Criteria met"
          items={match.criteriaMet.length ? match.criteriaMet : ["Needs broker review"]}
        />
        <ListBlock
          label="Missing criteria"
          items={
            match.missingCriteria.length
              ? match.missingCriteria
              : ["No missing criteria flagged"]
          }
        />
      </div>
    </li>
  );
}

export function SellerMemoryProfile({ sellerId, segment }: { sellerId: string; segment?: BrokerSegment }) {
  const profile = getSellerMemoryProfile(sellerId, segment);

  if (!profile) {
    return null;
  }

  const { seller, assets, tasks, conversations, reports, nextActions } = profile;
  const totalValue = assets.reduce((total, listing) => total + listing.priceEur, 0);

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <Link
        className="inline-flex items-center gap-2 text-sm font-medium text-[#3f3f46] hover:text-[#17171c]"
        href="/listings"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to listings
      </Link>

      <div className="mt-6">
        <PageHeader
          eyebrow="Seller memory"
          title={seller.name}
          description="Owner motivation, pricing posture, feedback expectations, and next update timing."
          metrics={[
            { label: "Portfolio", value: `${assets.length} assets` },
            { label: "Asking value", value: formatCurrency(totalValue) },
            { label: "Owner update", value: dueLabel(seller.nextOwnerUpdateDueAt) },
          ]}
          actions={<Badge tone="neutral">{seller.reportingCadence}</Badge>}
        />
      </div>

      <div className="mt-12 grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div className="grid content-start gap-8">
          <Card>
            <CardHeader eyebrow="Owner profile" title="Expectations and pricing context" />
            <div className="grid gap-x-10 gap-y-5 px-6 py-5 sm:grid-cols-2">
              <InfoColumn
                title="Commercial context"
                rows={[
                  ["Motivation", seller.motivation],
                  ["Pricing sensitivity", seller.pricingSensitivity],
                  ["Reporting cadence", seller.reportingCadence],
                  ["Next update", dueLabel(seller.nextOwnerUpdateDueAt)],
                ]}
              />
              <InfoColumn
                title="Communication expectation"
                rows={[
                  ["Expectation", seller.communicationExpectation],
                  ["Open tasks", `${tasks.length}`],
                  ["Recent conversations", `${conversations.length}`],
                  ["Report drafts", `${reports.length}`],
                ]}
              />
            </div>
            <div className="border-t border-[#f2f2f2] px-6 py-5">
              <InsightList
                icon={MessageSquareText}
                title="Feedback history"
                items={seller.feedbackHistory}
              />
            </div>
          </Card>

          <Card>
            <CardHeader eyebrow="Portfolio" title="Listed assets and blockers" />
            <ul className="grid gap-0 divide-y divide-[#f2f2f2]">
              {assets.map((asset) => (
                <li
                  key={asset.id}
                  className="grid gap-3 px-6 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                >
                  <div className="min-w-0">
                    <Link
                      className="text-[14px] font-medium text-[#17171c] hover:text-[#1863dc]"
                      href={`/listings/${asset.id}`}
                    >
                      {asset.name}
                    </Link>
                    <p className="mt-1 text-[13px] leading-6 text-[#616161]">
                      {asset.builder} {asset.model} · {asset.location} · Missing:{" "}
                      {asset.missingInfo.length ? asset.missingInfo.join(", ") : "none"}.
                    </p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="font-mono text-[14px] font-medium text-[#17171c]">
                      {formatCurrency(asset.priceEur)}
                    </p>
                    <p className="mt-1 text-[12px] uppercase tracking-[0.14em] text-[#75758a]">
                      {asset.status}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader eyebrow="Owner reporting" title="Prepared update material" />
            <div className="grid gap-0 divide-y divide-[#f2f2f2]">
              {reports.length ? (
                reports.map((report) => (
                  <article key={report.title} className="px-6 py-5">
                    <h2 className="text-[14px] font-medium text-[#17171c]">{report.title}</h2>
                    <p className="mt-2 text-[13px] leading-6 text-[#3f3f46]">{report.summary}</p>
                    <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                      {report.sections.map((section) => (
                        <div key={section.label}>
                          <dt className="bb-mono-label">{section.label}</dt>
                          <dd className="mt-1.5 text-[13px] leading-6 text-[#3f3f46]">
                            {section.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </article>
                ))
              ) : (
                <p className="px-6 py-5 text-sm leading-6 text-[#616161]">
                  No owner report draft is prepared for this seller yet.
                </p>
              )}
            </div>
          </Card>
        </div>

        <div className="grid content-start gap-8">
          <ActionStack actions={nextActions} title="Owner next actions" />

          <OwnerNotePanel sellerId={seller.id} />

          <Card>
            <CardHeader
              eyebrow="Owner cadence"
              title="Next update preparation"
              action={
                <CardHeaderIcon>
                  <Mail className="h-4 w-4" aria-hidden="true" />
                </CardHeaderIcon>
              }
            />
            <div className="grid gap-4 px-6 py-5">
              <p className="text-[13px] leading-6 text-[#3f3f46]">
                {seller.communicationExpectation}
              </p>
              <Stat
                label="Cadence"
                value={seller.reportingCadence}
                detail={`Next update ${dueLabel(seller.nextOwnerUpdateDueAt)}`}
              />
              <Stat
                label="Sensitivity"
                value="Pricing posture"
                detail={seller.pricingSensitivity}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Recent touchpoints"
              title="Conversations and open tasks"
            />
            <ul className="grid gap-0 divide-y divide-[#f2f2f2]">
              {conversations.map((conversation) => (
                <li key={conversation.id} className="px-6 py-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{conversation.channel}</Badge>
                    <span className="text-[12px] uppercase tracking-[0.14em] text-[#75758a]">
                      {formatDate(conversation.occurredAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] leading-6 text-[#3f3f46]">
                    {conversation.summary}
                  </p>
                </li>
              ))}
              {tasks.map((task) => (
                <li key={task.id} className="px-6 py-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={priorityTone(task.priority)}>{task.priority}</Badge>
                    <span className="text-[12px] uppercase tracking-[0.14em] text-[#75758a]">
                      {dueLabel(task.dueAt)}
                    </span>
                  </div>
                  <h2 className="mt-2 text-[14px] font-medium text-[#17171c]">{task.title}</h2>
                  <p className="mt-1 text-[13px] leading-6 text-[#616161]">{task.reason}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ActionStack({
  actions,
  title,
}: {
  actions: Array<{
    label: string;
    reason: string;
    priority: Priority;
    dueAt: string;
    kind: string;
  }>;
  title: string;
}) {
  return (
    <Card>
      <CardHeader
        eyebrow="Next-best action"
        title={title}
        action={
          <CardHeaderIcon>
            <Gauge className="h-4 w-4" aria-hidden="true" />
          </CardHeaderIcon>
        }
      />
      <ul className="grid gap-0 divide-y divide-[#f2f2f2]">
        {actions.length ? (
          actions.map((action) => (
            <li key={`${action.label}-${action.dueAt}`} className="px-6 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={priorityTone(action.priority)}>{action.priority}</Badge>
                <Badge tone="neutral">{action.kind}</Badge>
                <span className="text-[12px] uppercase tracking-[0.14em] text-[#75758a]">
                  {dueLabel(action.dueAt)}
                </span>
              </div>
              <h2 className="mt-2 text-[14px] font-medium text-[#17171c]">{action.label}</h2>
              <p className="mt-2 text-[13px] leading-6 text-[#616161]">{action.reason}</p>
            </li>
          ))
        ) : (
          <li className="px-6 py-5 text-sm leading-6 text-[#616161]">
            No memory-derived action is currently required.
          </li>
        )}
      </ul>
    </Card>
  );
}

function InfoColumn({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, string]>;
}) {
  return (
    <div className="min-w-0">
      <p className="bb-mono-label">{title}</p>
      <dl className="mt-3 grid gap-2.5">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[150px_1fr] gap-3 text-sm">
            <dt className="text-[#75758a]">{label}</dt>
            <dd className="text-[#3f3f46]">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function InsightList({
  icon: Icon,
  title,
  items,
}: {
  icon: LucideIcon;
  title: string;
  items: string[];
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-[#003c33]" aria-hidden="true" />
        <p className="bb-mono-label">{title}</p>
      </div>
      <ul className="mt-2 grid gap-1">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="text-[13px] leading-6 text-[#3f3f46]">
            · {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ListBlock({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="min-w-0">
      <p className="bb-mono-label">{label}</p>
      <ul className="mt-2 grid gap-1">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="text-[13px] leading-6 text-[#3f3f46]">
            · {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

