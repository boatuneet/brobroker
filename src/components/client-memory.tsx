"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Building2,
  CalendarClock,
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
  MessageCircle,
  MessageSquareText,
  MoreVertical,
  Phone,
  Pencil,
  Plus,
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
  BrokerTask,
  BuyerProfile,
  Conversation,
  DealRoom,
  FollowUpDraft,
  MatchResult,
  Priority,
  YachtListing,
} from "@/lib/types";
import { DealWorkflowStepper } from "./buyers/deal-workflow-stepper";
import { BuyerTimeline } from "./buyers/buyer-timeline";
import { BuyerTrust } from "./buyers/buyer-trust";
import { ShareRoomDialog } from "./buyers/share-room-dialog";
import { CloseDealDialog, StageControl } from "./buyers/stage-control";
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
import { RequirementSetDrawer } from "./buyer-requirement-set-drawer";
import { FitRing, Tile } from "./dashboard/visuals";
import { deleteSessionBuyer } from "@/lib/browser-persistence";
import {
  mergeRequirementSet,
  useRequirementSets,
  type RequirementSet,
} from "@/lib/buyer-requirement-sets";
import { readRerankConfig } from "@/lib/rerank-config";
import { deleteBuyerCascade } from "@/lib/supabase/delete-buyer";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const segmentIcons = {
  Yacht: Ship,
  Car: CarFront,
  "Real Estate": Building2,
} satisfies Record<BrokerSegment, LucideIcon>;
import { SessionBuyerQueue, useSessionBuyers } from "./intake-panels";
import { OwnerNotePanel } from "./owner-note-panel";

const PAGE_SIZE = 12;

function dueLabel(date: string) {
  const delta = daysUntil(date);
  // ponytail: past 14 days overdue, day counters read as noise. Show the date instead.
  if (delta < -14) return `Overdue since ${formatDate(date)}`;
  if (delta < 0) return `${Math.abs(delta)}d overdue`;
  if (delta === 0) return "Due today";
  if (delta === 1) return "Due tomorrow";
  return `Due in ${delta}d`;
}

/* Urgency ramp, hottest → coolest: Immediate (coral) → This Quarter (amber)
   → This Season (calm blue) → Exploratory (neutral). "This Season" used to
   read as an alarming coral warning even though it's a relaxed timeline. */
function urgencyTone(urgency: BuyerProfile["urgency"]): "error" | "warning" | "info" | "neutral" {
  if (urgency === "Immediate") return "error";
  if (urgency === "This Quarter") return "warning";
  if (urgency === "This Season") return "info";
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
  if (stage === "Closed Won") return "success";
  if (stage === "Closed Lost") return "neutral";
  if (stage === "Negotiation") return "success";
  if (stage === "Viewing Planned") return "success";
  if (stage === "Shortlist Sent") return "info";
  if (stage === "Qualified") return "info";
  return "neutral";
}

type BuyerMemoryModel = NonNullable<ReturnType<typeof getBuyerMemoryProfile>>;

type AiMatch = { listingId: string; fitScore: number; reason: string };

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
  "Closed Won",
  "Closed Lost",
];

export function BuyerIndex({
  focusNoNextStep = false,
  includeDemo = true,
  initialStage,
  query: initialQuery,
  segment,
  storedBuyers = [],
  storedListings = [],
  storedTasks = [],
}: {
  /* Deep link from Today's "No next step" KPI — pre-applies the filter. */
  focusNoNextStep?: boolean;
  includeDemo?: boolean;
  /* Deep link from Today's funnel tiles (?stage=). */
  initialStage?: string;
  query?: string;
  segment?: BrokerSegment;
  storedBuyers?: BuyerProfile[];
  storedListings?: YachtListing[];
  storedTasks?: BrokerTask[];
}) {
  /* When demo mode is off, drop the seed dataset entirely — the broker sees
     only their Supabase-backed buyers and listings. */
  const allBuyers = useMemo(
    () => mergeBuyers(includeDemo ? getBuyersForSegment(segment) : [], storedBuyers),
    [includeDemo, storedBuyers, segment],
  );
  const inventory = useMemo(
    () => mergeListings(storedListings, includeDemo ? getListingsForSegment(segment) : []),
    [includeDemo, storedListings, segment],
  );
  /* Buyers with at least one open task (real + demo) — inverse powers the
     "No next step" filter that Today's KPI deep-links to. */
  const buyerIdsWithOpenTask = useMemo(() => {
    const demoTasks = includeDemo ? getTasksForSegment(segment) : [];
    return new Set(
      [...storedTasks, ...demoTasks]
        .filter((task) => task.status !== "Done")
        .map((task) => task.buyerId)
        .filter((id): id is string => Boolean(id)),
    );
  }, [storedTasks, includeDemo, segment]);

  const [query, setQuery] = useState(initialQuery ?? "");
  const [stageFilter, setStageFilter] = useState<BuyerProfile["currentStage"] | "All">(() =>
    STAGE_OPTIONS.includes(initialStage as BuyerProfile["currentStage"])
      ? (initialStage as BuyerProfile["currentStage"])
      : "All",
  );
  const [noNextStepOnly, setNoNextStepOnly] = useState(focusNoNextStep);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<"buyers" | "captures">("buyers");
  const sessionBuyers = useSessionBuyers();

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

  const filteredBuyers = useMemo(() => {
    const byStage =
      stageFilter === "All"
        ? queryFilteredBuyers
        : queryFilteredBuyers.filter((buyer) => buyer.currentStage === stageFilter);
    return noNextStepOnly
      ? byStage.filter((buyer) => !buyerIdsWithOpenTask.has(buyer.id))
      : byStage;
  }, [queryFilteredBuyers, stageFilter, noNextStepOnly, buyerIdsWithOpenTask]);

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
    setNoNextStepOnly(false);
    setPage(1);
  };
  const hasFilters = searching || stageFilter !== "All" || noNextStepOnly;

  return (
    <div className="mx-auto w-full max-w-[1536px] px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
      {/* KPI band — one cream tile, three paper tiles. Same shape as Listings. */}
      <section
        aria-label="Buyer summary"
        className="grid grid-cols-2 gap-4 md:grid-cols-4"
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

      {/* Two tabs (was two stacked lists): the full buyer table and the
          local, session-only CRM captures — one card, clear switch. */}
      <section
        aria-label="Buyers"
        className="mt-8 overflow-hidden rounded-[12px] border border-[#E7E7E7] bg-white"
      >
        {/* Tab bar: primary switch on the left; buyer search on the right,
            shown only on the buyers tab (captures aren't searched here). */}
        <div className="flex flex-col gap-2 border-b border-[#E7E7E7] px-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-5">
            <BuyerTab
              active={tab === "buyers"}
              count={allBuyers.length}
              label="All buyers"
              onClick={() => setTab("buyers")}
            />
            <BuyerTab
              active={tab === "captures"}
              count={sessionBuyers.length}
              label="Local CRM captures"
              onClick={() => setTab("captures")}
            />
          </div>
          {tab === "buyers" ? (
            <label className="relative block w-full pb-3 sm:w-72 sm:pb-0">
              <span className="sr-only">Search buyers</span>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8E918B]"
              />
              <input
                className="h-9 w-full rounded-[10px] border border-[#E7E7E7] bg-white pl-10 pr-9 text-[13px] text-[#171719] outline-none transition-colors placeholder:text-[#A9ABA5] focus:border-[#1863dc] focus:ring-2 focus:ring-[#1863dc]/15"
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Family use, VAT, Germany, brand…"
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
          ) : null}
        </div>

        {tab === "captures" ? (
          <SessionBuyerQueue bare />
        ) : (
          <>
        <div className="border-b border-[#E7E7E7] px-4 py-3 sm:px-5">
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
              {/* Cross-cutting filter (not a stage): deals with no open task.
                  Today's "No next step" KPI deep-links here pre-applied. */}
              <StatusChip
                active={noNextStepOnly}
                count={queryFilteredBuyers.filter((b) => !buyerIdsWithOpenTask.has(b.id)).length}
                label="No next step"
                onClick={() => {
                  setNoNextStepOnly((current) => !current);
                  setPage(1);
                }}
              />
          </div>
        </div>

        {filteredBuyers.length === 0 ? (
          <div className="px-6 py-14">
            <EmptyState
              title={searching ? `No buyers match “${query}”` : "No buyers in this stage"}
              description="Adjust the search, clear the stage chip, or open the matching workspace to surface buyers by criteria."
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
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(280px,1.4fr)_minmax(200px,1fr)_minmax(180px,1fr)_44px] border-b border-[#E7E7E7] bg-white px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8E918B] lg:grid">
              <span>Buyer</span>
              <span>Intent · range</span>
              <span>Signal</span>
              <span />
            </div>
            <div className="divide-y divide-[#E7E7E7]">
              {pageBuyers.map((buyer) => (
                <BuyerListRow
                  key={buyer.id}
                  buyer={buyer}
                  segment={segment}
                  fit={fitByBuyer.get(buyer.id)}
                />
              ))}
            </div>
          </>
        )}
          </>
        )}
      </section>

      {tab === "buyers" && filteredBuyers.length > 0 && pageCount > 1 ? (
            <nav
              aria-label="Buyers pagination"
              className="mt-6 flex items-center justify-between gap-3"
            >
              <p className="text-[12px] text-[#8E918B]">
                Showing{" "}
                <span className="font-mono font-semibold tabular-nums text-[#171719]">
                  {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filteredBuyers.length)}
                </span>{" "}
                of{" "}
                <span className="font-mono font-semibold tabular-nums text-[#171719]">
                  {filteredBuyers.length}
                </span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  aria-label="Previous page"
                  className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#E7E7E7] bg-white px-3 text-[12.5px] font-medium text-[#171719] transition-colors hover:border-[#003C33] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#E7E7E7]"
                  disabled={safePage === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  type="button"
                >
                  <ChevronLeft aria-hidden="true" className="h-3.5 w-3.5" />
                  Prev
                </button>
                <span className="inline-flex h-9 items-center rounded-[8px] border border-[#E7E7E7] bg-[#F1F2EE] px-3 font-mono text-[12.5px] font-semibold tabular-nums text-[#171719]">
                  {safePage} / {pageCount}
                </span>
                <button
                  aria-label="Next page"
                  className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#E7E7E7] bg-white px-3 text-[12.5px] font-medium text-[#171719] transition-colors hover:border-[#003C33] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#E7E7E7]"
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

/* Primary tab for the Buyers card — underline style with a count pill,
   matching the reference invoice-table tabs. */
function BuyerTab({
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
  return (
    <button
      aria-pressed={active}
      className={cn(
        "relative -mb-px flex items-center gap-2 whitespace-nowrap border-b-2 py-3.5 text-[13.5px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]",
        active
          ? "border-[#003C33] text-[#171719]"
          : "border-transparent text-[#8E918B] hover:text-[#171719]",
      )}
      onClick={onClick}
      type="button"
    >
      {label}
      <span
        className={cn(
          "inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
          active ? "bg-[#E1F1EA] text-[#0F8F62]" : "bg-[#F1F2EE] text-[#8E918B]",
        )}
      >
        {count}
      </span>
    </button>
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
      className="group grid gap-4 px-5 py-4 transition-colors hover:bg-[#F1F2EE] focus-visible:bg-[#F1F2EE] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1863dc] lg:grid-cols-[64px_minmax(220px,1.4fr)_minmax(200px,1fr)_minmax(160px,1fr)_44px] lg:items-center"
      href={`/buyers/${buyer.id}`}
    >
      {/* Fit ring — replaces avatar. Placeholder ring when no match available. */}
      <div className="flex shrink-0 items-center justify-center">
        {fit ? (
          <FitRing
            label={`${Math.round(fit.score)}%`}
            size={44}
            stroke={4}
            tone="green"
            value={fit.score}
          />
        ) : (
          <span
            aria-label="No match score yet"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-dashed border-[#D9DAD4] font-mono text-[12px] font-semibold text-[#A9ABA5]"
          >
            —
          </span>
        )}
      </div>

      {/* Identity */}
      <div className="min-w-0">
        <h2
          className="truncate text-[14.5px] font-semibold leading-[1.3] text-[#171719] group-hover:text-[#003C33]"
          title={buyer.name}
        >
          {buyer.name}
        </h2>
        <p
          className="mt-1 truncate text-[12.5px] leading-[1.4] text-[#8E918B]"
          title={subtitle}
        >
          {subtitle}
        </p>
      </div>

      {/* Intent · range */}
      <div className="min-w-0">
        <p className="truncate text-[12.5px] font-medium leading-[1.4] text-[#5F625E]">
          {formatCurrency(buyer.budgetMinEur)} – {formatCurrency(buyer.budgetMaxEur)}
        </p>
        <p
          className="mt-1 truncate text-[12px] leading-[1.4] text-[#8E918B]"
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
          className="h-4 w-4 text-[#A9ABA5] transition-colors group-hover:text-[#171719]"
        />
      </div>
    </Link>
  );
}

/* First-run buyers — clean editorial hero + three primary actions + an
   explainer card showing what each buyer profile will remember. */
function FirstRunBuyers() {
  return (
    <div className="mx-auto w-full max-w-[1536px] px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
      <section aria-labelledby="buyers-quick-start">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="bb-mono-label">Quick start</p>
            <h2
              className="bb-display mt-2 text-xl font-medium text-[#171719]"
              id="buyers-quick-start"
            >
              Three ways to start a buyer
            </h2>
          </div>
          <p className="hidden text-[13px] text-[#8E918B] sm:block">
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
          title="Memory you'll have on every conversation"
        />
        <ul className="divide-y divide-[#E7E7E7]">
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

type BuyerProfileTab = "memory" | "matches" | "drafts" | "timeline" | "trust";

export function BuyerMemoryProfile({
  buyerId,
  buyerOverride,
  includeDemo = true,
  initialTab,
  segment,
  storedListings = [],
  storedConversations = [],
  storedDrafts = [],
  storedDealRooms = [],
}: {
  buyerId: string;
  buyerOverride?: BuyerProfile;
  includeDemo?: boolean;
  initialTab?: BuyerProfileTab;
  segment?: BrokerSegment;
  storedListings?: YachtListing[];
  storedConversations?: Conversation[];
  storedDrafts?: FollowUpDraft[];
  /* Every persisted room attached to this buyer, newest first. The newest
     drives the workflow + share dialog; the union of listingIds marks
     matches as already-in-a-room. */
  storedDealRooms?: DealRoom[];
}) {
  const staticProfile = includeDemo ? getBuyerMemoryProfile(buyerId, segment) : undefined;
  // Match a real (stored) buyer only against the broker's real inventory —
  // never the demo seed boats, so sample listings can't outrank actual ones.
  // Demo buyers still match the demo catalogue.
  const inventory = buyerOverride
    ? storedListings
    : includeDemo
      ? getListingsForSegment(segment)
      : storedListings;
  const profile = buyerOverride
    ? getBuyerMemoryModel(buyerOverride, segment, inventory)
    : staticProfile
      ? buildBuyerMemoryModel(staticProfile.buyer, segment, inventory)
      : undefined;
  const [tab, setTab] = useState<BuyerProfileTab>(initialTab ?? "memory");
  // Listings the broker has ticked on the Matches tab to carry into a new deal
  // room in one go (curate here, then "Build shortlist room" once).
  const [shortlistIds, setShortlistIds] = useState<string[]>([]);
  const toggleShortlist = (listingId: string) =>
    setShortlistIds((current) =>
      current.includes(listingId)
        ? current.filter((id) => id !== listingId)
        : [...current, listingId],
    );
  const profileCardRef = useRef<HTMLDivElement>(null);
  const stageControlRef = useRef<HTMLDivElement>(null);
  // Switch the profile-card tab and scroll it into view — used by the deal
  // workflow stepper so clicking a step lands the broker on the right tab.
  const goToTab = (next: BuyerProfileTab) => {
    setTab(next);
    profileCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  // Local-only buyer overlay so demo-buyer stage / closed-value changes reflect
  // immediately without a Supabase round trip. Stored buyers get a router
  // refresh through the stage helper.
  const [localBuyer, setLocalBuyer] = useState<BuyerProfile | null>(null);
  /* Newest room drives the workflow; a local overlay reflects the share-mark
     immediately (server props refresh behind it). */
  const [localRoom, setLocalRoom] = useState<DealRoom | null>(null);
  const storedDealRoom = localRoom ?? storedDealRooms[0];
  const [shareOpen, setShareOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [aiMatches, setAiMatches] = useState<AiMatch[] | null>(null);
  const [aiMode, setAiMode] = useState<"ai" | "deterministic" | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const router = useRouter();

  // Requirement sets: the buyer's on-record ask is "Primary"; brokers can add
  // more so matching isn't locked to one brief. The active set drives both the
  // deterministic matches and the AI re-rank below. Persisted via the hook
  // (Supabase when signed in, else device).
  const {
    sets: requirementSets,
    activeSetId,
    selectActive,
    saveSet,
    removeSet,
  } = useRequirementSets(buyerId);
  const [setDrawerOpen, setSetDrawerOpen] = useState(false);
  const [editingSet, setEditingSet] = useState<RequirementSet | null>(null);
  const [pendingDeleteSet, setPendingDeleteSet] = useState<RequirementSet | null>(null);
  const activeSet = useMemo(
    () => requirementSets.find((set) => set.id === activeSetId),
    [requirementSets, activeSetId],
  );
  const activeMatches = useMemo(
    () =>
      profile
        ? generateMatchesForBuyer(
            activeSet ? mergeRequirementSet(profile.buyer, activeSet) : profile.buyer,
            inventory,
            12,
          )
        : [],
    [profile, activeSet, inventory],
  );

  /* Rooms built from the ACTIVE requirement set — legacy rooms with no
     recorded set read as primary. Drives View-vs-Build on the Matches tab
     and the per-listing "In shortlist room" chips; other sets keep their
     own Build action until they get a room. */
  const roomForActiveSet = useMemo(
    () =>
      storedDealRooms.find(
        (room) => (room.requirementSetId ?? "primary") === activeSetId,
      ),
    [storedDealRooms, activeSetId],
  );
  const roomListingIds = useMemo(() => {
    const ids = new Set<string>();
    for (const room of storedDealRooms) {
      if ((room.requirementSetId ?? "primary") !== activeSetId) continue;
      for (const id of room.listingIds) ids.add(id);
    }
    return ids;
  }, [storedDealRooms, activeSetId]);

  function selectRequirementSet(nextId: string) {
    selectActive(nextId);
    setAiMatches(null);
    setAiError(null);
  }

  async function runAiMatch() {
    if (aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/buyer-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyerId, config: readRerankConfig(), requirementSet: activeSet ?? null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not run the AI match.");
      setAiMatches(Array.isArray(data.ranked) ? data.ranked : []);
      setAiMode(data.mode === "ai" ? "ai" : "deterministic");
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Could not run the AI match.");
    } finally {
      setAiLoading(false);
    }
  }
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
    verification,
    matches,
    conversations: demoConversations,
    drafts: demoDrafts,
    rejectedListings,
    nextActions,
    buyerSafeBrief,
  } = profile;
  const buyer = localBuyer ?? profile.buyer;
  // A "stored" buyer is one that lives in Supabase (buyerOverride was passed
  // in from the server component). Demo buyers get an optimistic-only path.
  const isStoredBuyer = Boolean(buyerOverride);
  const buyerTasks = getTasksForSegment(segment).filter((task) => task.buyerId === buyer.id);
  const conversations = mergeById(storedConversations, demoConversations);
  const drafts = mergeById(storedDrafts, demoDrafts);
  const verificationTone = getVerificationTone(verification?.status ?? "Needs Review");
  const segmentMeta = getBrokerSegmentMeta(segment);
  const SegmentIcon = segmentIcons[segmentMeta.id];
  const eyebrowDetail = [buyer.company, buyer.country].filter(Boolean).join(" · ");
  const topMatch = matches[0];
  // Matches tab reflects the active requirement set (Primary === the buyer's
  // own ask, so this matches `matches` when no custom set is selected).
  const sortedMatches = [...activeMatches].sort((a, b) => b.fitScore - a.fitScore);
  const requirementDefaults = {
    budgetMinEur: buyer.budgetMinEur,
    budgetMaxEur: buyer.budgetMaxEur,
    sizeRangeFt: buyer.sizeRangeFt,
    preferredBrands: buyer.preferredBrands,
    preferredLocations: buyer.preferredLocations,
    mustHaves: buyer.mustHaves,
    dealBreakers: buyer.dealBreakers,
    urgency: buyer.urgency,
  };

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
    <div className="mx-auto w-full max-w-[1536px] px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
      {/* Back-link removed — breadcrumb in the top bar covers navigation. */}

      {/* Editorial cockpit header — segment chip + last contacted, display h1,
          single-line summary, and a neat row of status badges. Action cluster
          (Capture / Open deal room / Delete) anchors top-right. */}
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-[#D9DAD4] bg-white px-3 text-[11px] font-medium uppercase tracking-[0.16em] text-[#5F625E]">
              <SegmentIcon className="h-3.5 w-3.5 text-[#8E918B]" aria-hidden="true" />
              {eyebrowDetail || `${segmentMeta.label} buyer`}
            </span>
            <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-[#D9DAD4] bg-white px-3 text-[11px] font-medium uppercase tracking-[0.16em] text-[#5F625E]">
              <CalendarClock className="h-3.5 w-3.5 text-[#8E918B]" aria-hidden="true" />
              Last contacted · {formatDate(buyer.lastContactedAt)}
            </span>
            {buyer.email ? (
              <a
                aria-label={`Email ${buyer.name}`}
                className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-[#D9DAD4] bg-white px-3 text-[11px] font-medium uppercase tracking-[0.16em] text-[#5F625E] transition-colors hover:border-[#003C33] hover:text-[#003C33]"
                href={`mailto:${buyer.email}`}
                title={buyer.email}
              >
                <Mail className="h-3.5 w-3.5 text-[#8E918B]" aria-hidden="true" />
                Email
              </a>
            ) : null}
            {buyer.phone ? (
              <a
                aria-label={`Call ${buyer.name}`}
                className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-[#D9DAD4] bg-white px-3 text-[11px] font-medium uppercase tracking-[0.16em] text-[#5F625E] transition-colors hover:border-[#003C33] hover:text-[#003C33]"
                href={`tel:${buyer.phone}`}
                title={buyer.phone}
              >
                <Phone className="h-3.5 w-3.5 text-[#8E918B]" aria-hidden="true" />
                Phone
              </a>
            ) : null}
            {/* Urgency + verification status ride the same eyebrow row as the
                location/contact chips — one status line above the name. */}
            <Badge tone={urgencyTone(buyer.urgency)}>{buyer.urgency}</Badge>
            <Badge className={verificationTone.className}>
              <StatusDot className={verificationTone.dotClassName} />
              {verification?.status ?? "Needs Review"}
            </Badge>
          </div>
          <h1 className="bb-display mt-4 text-[2rem] font-medium leading-[1.04] text-[#171719] sm:text-[2.4rem]">
            {buyer.name}
          </h1>
          <div className="mt-4" ref={stageControlRef}>
            <StageControl
              buyer={buyer}
              isStored={isStoredBuyer}
              onLocalChange={(next) => setLocalBuyer(next)}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[#D9DAD4] bg-white px-4 text-sm font-medium text-[#171719] transition-colors hover:border-[#003C33] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c6ee6]"
            href="/voice-crm"
          >
            <Bot className="h-4 w-4" aria-hidden="true" />
            Capture voice note
          </Link>
          <Link
            className="inline-flex min-h-10 items-center gap-2 rounded-[8px] bg-[#003C33] px-5 text-sm font-medium text-white transition-colors hover:bg-[#0B4A3F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c6ee6]"
            href={storedDealRoom ? `/deal-rooms/${storedDealRoom.id}` : `/deal-rooms/new?buyer=${buyer.id}`}
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            {storedDealRoom ? "Open deal room" : "New deal room"}
          </Link>
          <div className="relative" ref={actionMenuRef}>
            <button
              aria-expanded={actionMenuOpen}
              aria-haspopup="menu"
              aria-label="More buyer actions"
              className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] border border-[#D9DAD4] bg-white text-[#5F625E] transition-colors hover:border-[#003C33] hover:text-[#171719] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c6ee6]"
              onClick={() => setActionMenuOpen((open) => !open)}
              type="button"
            >
              <MoreVertical aria-hidden="true" className="h-4 w-4" />
            </button>
            {actionMenuOpen ? (
              <div
                aria-orientation="vertical"
                className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-[12px] border border-[#e3e3e8] bg-white p-1.5"
                role="menu"
              >
                <Link
                  className="flex min-h-10 w-full items-center gap-2.5 rounded-[8px] px-3 py-2 text-left text-[13px] font-medium text-[#5F625E] transition-colors hover:bg-[#f5f5f7] hover:text-[#171719] focus:bg-[#f5f5f7] focus:outline-none"
                  href={`/buyers/${buyer.id}/edit`}
                  onClick={() => setActionMenuOpen(false)}
                  role="menuitem"
                >
                  <Pencil aria-hidden="true" className="h-4 w-4" />
                  Edit
                </Link>
                <button
                  className="flex min-h-10 w-full items-center gap-2.5 rounded-[8px] px-3 py-2 text-left text-[13px] font-medium text-[#A86642] transition-colors hover:bg-[#F0DDD0] focus:bg-[#F0DDD0] focus:outline-none"
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

      {/* Deal workflow — Capture → Qualify → Match → Share → View → Close.
          Sits directly under the header (before the metric fold) so the
          broker sees where the deal stands before the supporting numbers.
          State is derived from real data; in-progress drafts show an amber
          dot so an unfinished flow surfaces here instead of vanishing. */}
      <div className="mt-7">
        <DealWorkflowStepper
          buyer={buyer}
          conversations={conversations}
          matches={matches}
          drafts={drafts}
          dealRoom={storedDealRoom}
          verification={verification}
          activeTab={tab}
          onSelectTab={goToTab}
          onShare={() => setShareOpen(true)}
          onCloseDeal={() => setCloseOpen(true)}
        />
      </div>

      {shareOpen && storedDealRoom ? (
        <ShareRoomDialog
          isStoredRoom
          listings={inventory}
          matches={matches}
          onClose={() => setShareOpen(false)}
          onShared={(next) => {
            setLocalRoom(next);
            router.refresh();
          }}
          room={storedDealRoom}
        />
      ) : null}

      {closeOpen ? (
        <CloseDealDialog
          buyer={buyer}
          isStored={isStoredBuyer}
          onClose={() => setCloseOpen(false)}
          onLocalChange={(next) => setLocalBuyer(next)}
          onSaved={() => router.refresh()}
        />
      ) : null}

      {/* Metric fold — Budget / Next action / Top match fit (with FitRing). */}
      <section
        aria-label="Buyer at a glance"
        className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3"
      >
        <Tile tone="paper">
          <p className="bb-mono-label">Budget</p>
          <p className="bb-display mt-3 text-[1.5rem] font-medium leading-[1.1] tabular-nums text-[#171719]">
            {formatCurrency(buyer.budgetMinEur)} – {formatCurrency(buyer.budgetMaxEur)}
          </p>
          <p className="mt-2 text-[12.5px] leading-[1.5] text-[#5F625E]">
            {buyer.urgency} · {buyer.decisionTimeline}
          </p>
        </Tile>
        <Tile tone="paper">
          <p className="bb-mono-label">Next action</p>
          <p className="bb-display mt-3 text-[1.5rem] font-medium leading-[1.1] text-[#171719]">
            {dueLabel(buyer.nextActionDueAt)}
          </p>
          <p className="mt-2 text-[12.5px] leading-[1.5] text-[#5F625E]">
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
                <p className="bb-display text-[1.25rem] font-medium leading-[1.15] text-[#171719]">
                  {percentage(topMatch.fitScore)}
                </p>
                <p className="mt-1 text-[12.5px] leading-[1.5] text-[#5F625E]">
                  {topMatch.category} · {matches.length} candidate{matches.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          ) : (
            <>
              <p className="bb-display mt-3 text-[1.5rem] font-medium leading-[1.1] text-[#171719]">
                —
              </p>
              <p className="mt-2 text-[12.5px] leading-[1.5] text-[#5F625E]">
                No matches surfaced yet
              </p>
            </>
          )}
        </Tile>
      </section>

      {/* Tabbed Buyer Profile card — overflow-hidden so inner rounded edges clip cleanly.
          Wrapper carries the scroll anchor + ref so the workflow stepper can
          jump the broker straight to the right tab. scroll-mt clears the
          sticky top bar. */}
      <div ref={profileCardRef} className="scroll-mt-20">
      <Card className="mt-7 overflow-hidden rounded-[12px]" id="buyer-profile">
        <CardHeader
          title={
            tab === "memory"
              ? "Criteria and relationship memory"
              : tab === "matches"
                ? "Current recommendations and missing criteria"
                : tab === "timeline"
                  ? "Timeline of tasks, conversations, and drafts"
                  : tab === "trust"
                    ? "Verification and access readiness"
                    : "Recent conversations and drafts"
          }
          action={<BuyerMemoryNav value={tab} onChange={setTab} />}
        />

        {tab === "timeline" ? (
          <BuyerTimeline
            buyer={buyer}
            tasks={buyerTasks}
            conversations={conversations}
            drafts={drafts}
          />
        ) : null}

        {tab === "trust" ? <BuyerTrust verification={verification} /> : null}

        {tab === "memory" ? (
          <div className="grid gap-5 px-6 py-5">
            {/* 8-field mini-tile grid. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {memoryTiles.map((tile) => (
                <div
                  key={tile.label}
                  className="rounded-[12px] border border-[#E7E7E7] bg-white p-4"
                >
                  <p className="bb-mono-label">{tile.label}</p>
                  <p className="mt-2 text-[14px] font-medium leading-[1.4] text-[#171719]">
                    {tile.value}
                  </p>
                  {tile.detail ? (
                    <p className="mt-1 text-[12px] leading-[1.5] text-[#8E918B]">
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
          <div className="px-6 py-5">
            {/* Requirement set switcher — its own panel above the matches.
                Header row carries the label + Edit; chips sit on their own line. */}
            <div className="rounded-[12px] border border-[#E7E7E7] bg-white px-4 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="bb-mono-label">Requirement set</span>
                <button
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-[8px] border border-[#E7E7E7] bg-white px-3 text-[12.5px] font-medium text-[#5F625E] transition-colors hover:border-[#003C33] hover:text-[#003C33] disabled:cursor-not-allowed disabled:border-[#E7E7E7] disabled:text-[#C2C4BE] disabled:hover:border-[#E7E7E7]"
                  disabled={!activeSet}
                  onClick={() => {
                    if (!activeSet) return;
                    setEditingSet(activeSet);
                    setSetDrawerOpen(true);
                  }}
                  type="button"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  Edit set
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <RequirementChip
                  active={activeSetId === "primary"}
                  label="Primary"
                  onClick={() => selectRequirementSet("primary")}
                />
                {requirementSets.map((set) => (
                  <RequirementChip
                    active={activeSetId === set.id}
                    key={set.id}
                    label={set.label}
                    onClick={() => selectRequirementSet(set.id)}
                    onRemove={() => setPendingDeleteSet(set)}
                  />
                ))}
                <button
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-[8px] border border-dashed border-[#D9DAD4] bg-white px-3 text-[12.5px] font-medium text-[#5F625E] transition-colors hover:border-[#003C33] hover:text-[#003C33]"
                  onClick={() => {
                    setEditingSet(null);
                    setSetDrawerOpen(true);
                  }}
                  type="button"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Add set
                </button>
              </div>
            </div>

            {sortedMatches.length ? (
              <div className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="bb-mono-label">
                  Top matches · {sortedMatches.length}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-[8px] border border-[#E7E7E7] bg-white px-3 text-[12.5px] font-medium text-[#5F625E] transition-colors hover:border-[#003C33] hover:text-[#003C33] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={aiLoading}
                    onClick={() => void runAiMatch()}
                    type="button"
                  >
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    {aiLoading ? "Ranking…" : aiMatches ? "Re-run AI ranking" : "Re-rank with AI"}
                  </button>
                  {/* A room already exists FOR THIS SET and nothing new is
                      ticked → view it. Other sets (or ticking matches) keep
                      the Build action, stamped with the active set. */}
                  {roomForActiveSet && !shortlistIds.length ? (
                    <Link
                      className="inline-flex min-h-8 items-center gap-1.5 rounded-[8px] bg-[#003C33] px-3 text-[12.5px] font-medium text-white transition-colors hover:bg-[#0B4A3F]"
                      href={`/deal-rooms/${roomForActiveSet.id}`}
                    >
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                      View shortlist room
                    </Link>
                  ) : (
                    <Link
                      className="inline-flex min-h-8 items-center gap-1.5 rounded-[8px] bg-[#003C33] px-3 text-[12.5px] font-medium text-white transition-colors hover:bg-[#0B4A3F]"
                      href={`/deal-rooms/new?buyer=${buyer.id}&set=${encodeURIComponent(activeSetId)}${shortlistIds.map((id) => `&listing=${id}`).join("")}`}
                    >
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                      {shortlistIds.length
                        ? `Build shortlist room (${shortlistIds.length})`
                        : "Build shortlist room"}
                    </Link>
                  )}
                </div>
              </div>

              {aiError ? (
                <p className="mt-3 rounded-[8px] bg-[#F0DDD0]/60 px-3 py-2 text-[12.5px] text-[#A86642]">{aiError}</p>
              ) : null}

              {aiMatches ? (
                <div className="mt-3 overflow-hidden rounded-[12px] border border-[#E7EFEA] bg-[#f4fbf5]">
                  <div className="flex items-center justify-between gap-3 border-b border-[#E7EFEA] px-4 py-2.5">
                    <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#3F5249]">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      {aiMode === "ai" ? "AI semantic ranking" : "Rule-based ranking (no OpenAI key)"}
                    </p>
                    <button
                      className="text-[12px] font-medium text-[#5F7A6F] transition-colors hover:text-[#003C33]"
                      onClick={() => setAiMatches(null)}
                      type="button"
                    >
                      Hide
                    </button>
                  </div>
                  {aiMatches.length ? (
                    <ul className="max-h-[280px] divide-y divide-[#E7EFEA] overflow-y-auto">
                      {aiMatches.map((item) => {
                        const listing =
                          inventory.find((entry) => entry.id === item.listingId) ??
                          getListingById(item.listingId, segment);
                        return (
                          <li className="px-4 py-3" key={item.listingId}>
                            <div className="flex items-center justify-between gap-3">
                              <Link
                                className="truncate text-[14px] font-medium text-[#171719] hover:text-[#003C33] hover:underline"
                                href={`/listings/${item.listingId}`}
                              >
                                {listing?.name ?? item.listingId}
                              </Link>
                              <span className="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-[#003C33]">
                                {item.fitScore}%
                              </span>
                            </div>
                            {item.reason ? (
                              <p className="mt-1 text-[12.5px] leading-[1.55] text-[#5F625E]">{item.reason}</p>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="px-4 py-3 text-[12.5px] text-[#5F625E]">No candidates to rank.</p>
                  )}
                </div>
              ) : null}

              <ul className="mt-3 max-h-[600px] overflow-y-auto rounded-[12px] border border-[#E7E7E7] bg-white divide-y divide-[#E7E7E7] [&>li:first-child]:rounded-t-[12px] [&>li:last-child]:rounded-b-[12px]">
                {sortedMatches.map((match) => (
                  <MatchPanel
                    key={match.id}
                    inRoom={roomListingIds.has(match.listingId)}
                    inventory={inventory}
                    match={match}
                    roomHref={roomForActiveSet ? `/deal-rooms/${roomForActiveSet.id}` : undefined}
                    segment={segment}
                    selected={shortlistIds.includes(match.listingId)}
                    onToggleSelect={() => toggleShortlist(match.listingId)}
                  />
                ))}
              </ul>
              </div>
            ) : (
              <div className="mt-4">
                <EmptyState
                  title="No matches for this requirement set"
                  description="Try a different requirement set, widen the budget or size, or add inventory. Primary uses the buyer's saved ask."
                />
              </div>
            )}
          </div>
        ) : null}

        {setDrawerOpen ? (
          <RequirementSetDrawer
            defaults={requirementDefaults}
            editing={editingSet ?? undefined}
            onClose={() => {
              setSetDrawerOpen(false);
              setEditingSet(null);
            }}
            onSave={(set) => {
              saveSet(set);
              selectRequirementSet(set.id);
              setSetDrawerOpen(false);
              setEditingSet(null);
            }}
          />
        ) : null}

        {tab === "drafts" ? (
          <div className="grid gap-5 px-6 py-5">
            <section aria-label="Recent conversations">
              <p className="bb-mono-label">Recent conversations</p>
              {conversations.length ? (
                <div className="mt-3 max-h-[380px] overflow-y-auto rounded-[12px] border border-[#E7E7E7] bg-white">
                  <ul className="divide-y divide-[#E7E7E7]">
                    {conversations.map((conversation) => (
                      <li key={conversation.id} className="px-5 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="neutral">{conversation.channel}</Badge>
                          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8E918B]">
                            {formatDate(conversation.occurredAt)}
                          </span>
                          {conversation.needsSummary ? (
                            <Badge tone="warning">Needs summary</Badge>
                          ) : null}
                        </div>
                        <p className="mt-2 text-[13px] leading-6 text-[#5F625E]">
                          {conversation.summary}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="mt-3 rounded-[12px] border border-dashed border-[#E7E7E7] bg-white">
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
                <div className="mt-3 max-h-[380px] overflow-y-auto rounded-[12px] border border-[#E7E7E7] bg-white">
                  <ul className="divide-y divide-[#E7E7E7]">
                    {drafts.map((draft) => (
                      <DraftRow key={draft.id} draft={draft} buyer={buyer} />
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="mt-3 rounded-[12px] border border-dashed border-[#E7E7E7] bg-white">
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
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] xl:items-start">
        <div className="grid content-start gap-6">
          {/* Rejected assets — Card with divide list */}
          <Card>
            <CardHeader
              title="Rejected assets"
              description="Do not repeat the same mismatch"
              action={
                <CardHeaderIcon>
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                </CardHeaderIcon>
              }
            />
            {rejectedListings.length ? (
              <ul className="divide-y divide-[#E7E7E7] border-t border-[#E7E7E7]">
                {rejectedListings.map(({ rejection, listing }) => (
                  <li
                    key={rejection.listingId}
                    className="flex flex-col gap-1.5 px-6 py-4 transition-colors hover:bg-[#fcfcfb]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      {listing ? (
                        <Link
                          className="text-[14px] font-semibold text-[#171719] hover:text-[#1863dc] hover:underline"
                          href={`/listings/${listing.id}`}
                        >
                          {listing.name}
                        </Link>
                      ) : (
                        <span className="text-[14px] font-semibold text-[#171719]">Unknown asset</span>
                      )}
                      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#8E918B] bg-[#F5F5F7] px-2.5 py-0.5 rounded-[4px] border border-[#E7E7E7]">
                        Rejected {formatDate(rejection.rejectedAt)}
                      </span>
                    </div>
                    <p className="text-[13.0px] leading-relaxed text-[#5F625E]">
                      {rejection.reason}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-2.5 border-t border-[#E7E7E7] px-6 py-3 text-[13px] text-[#8E918B]">
                <MapPin className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
                <span>No rejected assets recorded for this buyer.</span>
              </div>
            )}
          </Card>

          {/* Broker guardrails — Card with secure badges */}
          <Card>
            <CardHeader
              title="Broker guardrails"
              description="Filtered before buyer delivery"
              action={
                <CardHeaderIcon>
                  <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                </CardHeaderIcon>
              }
            />
            <div className="border-t border-[#E7E7E7] px-6 py-5">
              <div className="flex flex-wrap gap-2">
                {buyerSafeBrief.removedInternalFields.map((field, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[8px] bg-white border border-[#E7E7E7] text-[#5F625E] text-[13px] font-medium transition-colors hover:border-[#003C33] hover:text-[#003C33]"
                  >
                    <LockKeyhole className="h-3.5 w-3.5 text-[#A86642] shrink-0" />
                    {field}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Right rail — ActionStack */}
        <div className="grid content-start gap-6">
          <ActionStack actions={nextActions} title="Memory-derived next actions" />
        </div>
      </div>

      {/* Buyer-safe content — full-width below the two-column row */}
      <Card className="mt-6 overflow-hidden border border-[#E7E7E7]">
        <CardHeader
          title="Buyer-safe content"
          description="Copyable preview of the memory-derived brief"
          action={
            <CardHeaderIcon>
              <MessageSquareText className="h-4 w-4" aria-hidden="true" />
            </CardHeaderIcon>
          }
        />
        <div className="grid gap-5 border-t border-[#E7E7E7] bg-white p-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
          <div className="bg-[#FBFBFB] border border-[#E7E7E7] rounded-[12px] p-5">
            <h3 className="text-[14px] font-semibold text-[#171719] leading-snug">
              &ldquo;{buyerSafeBrief.headline}&rdquo;
            </h3>
            <ul className="mt-4 space-y-2.5 border-l-2 border-[#E2ECE9] pl-4">
              {buyerSafeBrief.body.map((line, index) => (
                <li
                  key={`${line}-${index}`}
                  className="text-[13px] leading-relaxed text-[#5F625E]"
                >
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:border-l lg:border-[#E7E7E7] lg:pl-5">
            <span className="bb-mono-label block mb-2">Approved facts referenced</span>
            <div className="flex flex-wrap gap-1.5">
              {buyerSafeBrief.approvedFacts.map((fact, index) => (
                <span
                  key={index}
                  className="inline-flex items-center text-[12px] bg-[#E1F1EA]/60 text-[#0F8F62] px-2.5 py-0.5 rounded-[6px] font-medium border border-[#E1F1EA]"
                >
                  {fact}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>

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
      <ConfirmDialog
        cancelLabel="Keep set"
        confirmLabel="Delete set"
        confirmTone="destructive"
        description={
          pendingDeleteSet
            ? `Removes the "${pendingDeleteSet.label}" requirement set for ${buyer.name}. This cannot be undone.`
            : ""
        }
        onCancel={() => setPendingDeleteSet(null)}
        onConfirm={() => {
          if (pendingDeleteSet) {
            removeSet(pendingDeleteSet.id);
            setAiMatches(null);
            setAiError(null);
          }
          setPendingDeleteSet(null);
        }}
        open={Boolean(pendingDeleteSet)}
        title="Delete requirement set?"
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
    <div className="rounded-[12px] border border-[#E7E7E7] bg-white p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-[#003C33]" aria-hidden="true" />
        <p className="bb-mono-label">{title}</p>
      </div>
      {items.length ? (
        <ul className="mt-3 grid gap-1.5">
          {items.map((item, index) => (
            <li
              key={`${item}-${index}`}
              className="text-[13px] leading-[1.5] text-[#5F625E]"
            >
              · {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[12.5px] leading-[1.5] text-[#8E918B]">None recorded</p>
      )}
    </div>
  );
}

function RequirementChip({
  active,
  label,
  onClick,
  onRemove,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  onRemove?: () => void;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center gap-1 rounded-[8px] border pl-3 text-[12.5px] font-medium transition-colors",
        onRemove ? "pr-1.5" : "pr-3",
        active
          ? "border-[#003C33] bg-[#003C33] text-white"
          : "border-[#E7E7E7] bg-white text-[#5F625E] hover:border-[#003C33]/40 hover:bg-[#F1F2EE]",
      )}
    >
      <button className="inline-flex items-center" onClick={onClick} type="button">
        {label}
      </button>
      {onRemove ? (
        <button
          aria-label={`Remove ${label}`}
          className={cn(
            "inline-flex h-5 w-5 items-center justify-center rounded-full transition-colors",
            active ? "text-white/70 hover:bg-white/15 hover:text-white" : "text-[#A9ABA5] hover:text-[#A4361C]",
          )}
          onClick={onRemove}
          type="button"
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      ) : null}
    </span>
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
    <div className="rounded-[12px] border border-[#E7E7E7] bg-white p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-[#003C33]" aria-hidden="true" />
        <p className="bb-mono-label">{title}</p>
      </div>
      <ul className="mt-3 divide-y divide-[#E7E7E7]">
        {items.map((item, index) => (
          <li
            key={`${item}-${index}`}
            className="py-2 text-[13px] leading-[1.55] text-[#5F625E] first:pt-0 last:pb-0"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* wa.me wants country-code digits only: no plus, no leading zeros, no spaces
   or punctuation. Strip everything non-digit; then drop a single leading zero
   (a common local-format artifact like "0039..."). Preserves the rest. */
function normalizePhoneForWa(phone: string): string {
  const digits = phone.replace(/\D+/g, "");
  return digits.replace(/^0+/, "");
}

function DraftRow({ draft, buyer }: { draft: FollowUpDraft; buyer: BuyerProfile }) {
  // "Approve & copy" label — sending isn't wired end-to-end yet, so we don't
  // promise a send. Clipboard copy gives the broker the exact approved text
  // they can paste into their real email/WhatsApp client.
  const [copied, setCopied] = useState(false);
  const disabled = draft.status === "Approved";

  async function onApprove() {
    try {
      await navigator.clipboard.writeText(`${draft.subject}\n\n${draft.body}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Best-effort. Some browsers block clipboard writes without user gesture,
      // but a click IS a gesture — this path is only hit when clipboard is
      // fully blocked (e.g. non-secure origin).
    }
  }

  const waDigits = buyer.phone ? normalizePhoneForWa(buyer.phone) : "";
  const messageText = [draft.subject, draft.body].filter(Boolean).join("\n\n");
  const waHref = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(messageText)}`
    : undefined;
  // ponytail: mailto for now — swap to the Resend send route once email infra lands
  const mailtoHref = buyer.email
    ? `mailto:${buyer.email}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`
    : undefined;

  const sendBtnBase =
    "inline-flex min-h-8 items-center gap-1.5 rounded-[8px] border border-[#D9DAD4] bg-white px-3 text-[12.5px] font-medium text-[#171719] transition-colors hover:border-[#003C33] hover:bg-[#F1F2EE]";
  const sendBtnDisabled = "cursor-not-allowed border-[#E7E7E7] text-[#A9ABA5] hover:border-[#E7E7E7] hover:bg-white";

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="success">{draft.status}</Badge>
          <Badge tone="neutral">{draft.channel}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {waHref ? (
            <a
              className={sendBtnBase}
              href={waHref}
              rel="noopener noreferrer"
              target="_blank"
            >
              <MessageCircle aria-hidden="true" className="h-3.5 w-3.5" />
              Send via WhatsApp
            </a>
          ) : (
            <button
              aria-disabled="true"
              className={cn(sendBtnBase, sendBtnDisabled)}
              disabled
              title="Add a phone number to this buyer first"
              type="button"
            >
              <MessageCircle aria-hidden="true" className="h-3.5 w-3.5" />
              Send via WhatsApp
            </button>
          )}
          {mailtoHref ? (
            <a className={sendBtnBase} href={mailtoHref}>
              <Mail aria-hidden="true" className="h-3.5 w-3.5" />
              Send email
            </a>
          ) : (
            <button
              aria-disabled="true"
              className={cn(sendBtnBase, sendBtnDisabled)}
              disabled
              title="Add an email to this buyer first"
              type="button"
            >
              <Mail aria-hidden="true" className="h-3.5 w-3.5" />
              Send email
            </button>
          )}
          <button
            className="inline-flex min-h-8 items-center gap-1.5 rounded-[8px] border border-[#D9DAD4] bg-white px-3 text-[12.5px] font-medium text-[#171719] transition-colors hover:border-[#003C33] disabled:opacity-50"
            disabled={disabled}
            onClick={onApprove}
            type="button"
          >
            {copied ? "Copied to clipboard" : "Approve & copy"}
          </button>
        </div>
      </div>
      <h2 className="mt-2 text-[14px] font-semibold text-[#171719]">{draft.subject}</h2>
      <p className="mt-2 text-[13px] leading-6 text-[#5F625E]">{draft.body}</p>
    </li>
  );
}

function BuyerMemoryNav({
  value,
  onChange,
}: {
  value: BuyerProfileTab;
  onChange: (next: BuyerProfileTab) => void;
}) {
  /* Ordered to mirror the workflow steps: Memory (the buyer's ask), then
     Capture→Timeline, Qualify→Trust, Match→Matches, Share→Drafts. */
  const items: { label: string; key: BuyerProfileTab }[] = [
    { label: "Memory", key: "memory" },
    { label: "Timeline", key: "timeline" },
    { label: "Trust", key: "trust" },
    { label: "Matches", key: "matches" },
    { label: "Drafts", key: "drafts" },
  ];

  return (
    <nav
      aria-label="Buyer profile section"
      className="flex max-w-full items-center gap-1 overflow-x-auto rounded-[8px] border border-[#D9DAD4] bg-white p-1"
    >
      {items.map((item) => {
        const active = value === item.key;
        return (
          <button
            aria-pressed={active}
            className={cn(
              "inline-flex min-h-8 shrink-0 items-center rounded-[8px] px-3 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c6ee6]",
              active ? "bg-[#171719] text-white" : "text-[#5F625E] hover:bg-[#F1F2EE]",
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

function CompactFitRing({
  value,
  size = 48,
  stroke = 4,
}: {
  value: number;
  size?: number;
  stroke?: number;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circumference;

  let color = "#0F8F62"; // green
  let track = "#E1F1EA"; // soft green
  let textColor = "#0F8F62";

  if (clamped < 72) {
    color = "#A86642"; // coral/copper
    track = "#F0DDD0"; // soft copper
    textColor = "#A86642";
  } else if (clamped < 88) {
    color = "#003C33"; // brand green
    track = "#E2ECE9"; // soft brand green
    textColor = "#003C33";
  }

  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center font-sans"
      style={{ width: size, height: size }}
    >
      <svg
        aria-hidden="true"
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        width={size}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={track}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={color}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeDashoffset={circumference / 4}
          strokeLinecap="round"
          strokeWidth={stroke}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span
        className="absolute text-[11px] font-bold tabular-nums"
        style={{ color: textColor }}
      >
        {Math.round(clamped)}%
      </span>
    </div>
  );
}

function getListingDisplayName(listing: YachtListing) {
  const name = listing.name;
  const builder = listing.builder;
  const model = listing.model;
  
  const containsBuilder = name.toLowerCase().includes(builder.toLowerCase());
  const containsModel = name.toLowerCase().includes(model.toLowerCase());
  
  if (containsBuilder && containsModel) {
    return name;
  }
  if (containsModel) {
    return `${builder} · ${name}`;
  }
  if (containsBuilder) {
    return `${name} · ${model}`;
  }
  return `${name} · ${builder} ${model}`;
}

function formatListWithAnd(items: string[]) {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function getCleanRationale(match: MatchResult, listingName: string) {
  const met = match.criteriaMet;
  const missing = match.missingCriteria;
  
  if (met.length === 0) {
    return `${listingName} requires manual broker review to confirm criteria alignment.`;
  }
  
  const metClean = met.map(c => {
    const lower = c.toLowerCase();
    if (lower === "inside budget" || lower === "inside max budget" || lower === "budget fit") return "being within budget";
    if (lower === "size range") return "matching the requested size range";
    if (lower === "preferred brand") return "being from a preferred brand";
    if (lower === "preferred location") return "being in a preferred location";
    if (lower === "eu vat paid") return "having EU VAT paid status";
    return lower;
  });
  
  const metStr = formatListWithAnd(metClean);
  const actualMissing = missing.filter(c => c && !c.toLowerCase().includes("no missing") && !c.toLowerCase().includes("no blockers") && !c.toLowerCase().includes("needs broker review"));
  
  if (actualMissing.length > 0) {
    const missingClean = actualMissing.map(c => {
      const lower = c.toLowerCase();
      if (lower === "budget fit" || lower === "budget ceiling") return "budget fit";
      if (lower === "size range") return "exact size range";
      if (lower === "preferred location") return "preferred location";
      if (lower === "eu vat paid") return "VAT status";
      return lower;
    });
    const missingStr = formatListWithAnd(missingClean);
    return `${listingName} is a strong fit due to ${metStr}, but requires confirmation on ${missingStr}.`;
  }
  
  return `${listingName} aligns perfectly with all key requirements, including ${metStr}.`;
}

function MatchPanel({
  inRoom = false,
  inventory,
  match,
  roomHref,
  segment,
  selected,
  onToggleSelect,
}: {
  /* Listing already lives in one of this buyer's shortlist rooms. */
  inRoom?: boolean;
  inventory?: YachtListing[];
  match: MatchResult;
  /* The buyer's newest room — where the "In shortlist room" chip links. */
  roomHref?: string;
  segment?: BrokerSegment;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const listing = inventory?.find((listing) => listing.id === match.listingId) ?? getListingById(match.listingId, segment);
  const owner = listing ? getSellerById(listing.ownerId, segment) : undefined;

  const badgeTone = match.category === "Exact Match" ? "success" : match.category === "Close Match" ? "info" : "warning";

  return (
    <li className="relative px-6 py-5 transition-colors hover:bg-[#fcfcfb]">
      {/* Category badge positioned at the top-right corner */}
      <div className="absolute top-5 right-6">
        {match.category === "Close Match" ? (
          <span className="inline-flex min-h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[8px] border border-[#D0DFDC] bg-[#E2ECE9] text-[#003C33] px-2.5 py-0.5 text-[11px] font-medium leading-[1.6] tracking-[0.01em]">
            {match.category}
          </span>
        ) : (
          <Badge tone={badgeTone}>{match.category}</Badge>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-5">
        {/* Left side: Dynamic circular fit indicator + "why this score?" tooltip */}
        <div className="group/ring relative flex shrink-0 items-center justify-start sm:mt-1">
          <CompactFitRing value={match.fitScore} size={48} stroke={4.5} />
          {match.scoreBreakdown?.length ? (
            <div className="pointer-events-none absolute left-0 top-full z-30 mt-2 w-[260px] rounded-[10px] border border-[#E7E7E7] bg-white p-3 opacity-0 shadow-[0_12px_32px_rgba(23,31,25,0.14)] transition-opacity duration-150 group-hover/ring:opacity-100">
              <p className="bb-mono-label">Why {match.fitScore}%</p>
              <ul className="mt-2 grid gap-1">
                {match.scoreBreakdown.map((row, index) => (
                  <li
                    className="flex items-center justify-between gap-3 text-[12.5px] leading-5"
                    key={`${row.label}-${index}`}
                  >
                    <span
                      className={cn(
                        "flex items-center gap-1.5",
                        row.points > 0 ? "text-[#171719]" : "text-[#8E918B]",
                      )}
                    >
                      {row.points > 0 ? (
                        <CheckCircle2 className="h-3 w-3 shrink-0 text-[#0F8F62]" aria-hidden="true" />
                      ) : row.points < 0 ? (
                        <CircleAlert className="h-3 w-3 shrink-0 text-[#A4361C]" aria-hidden="true" />
                      ) : (
                        <span className="inline-block h-3 w-3 shrink-0 text-center text-[#C2C4BE]">·</span>
                      )}
                      {row.label}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 font-mono tabular-nums",
                        row.points > 0
                          ? "text-[#0F8F62]"
                          : row.points < 0
                            ? "text-[#A4361C]"
                            : "text-[#A9ABA5]",
                      )}
                    >
                      {row.points > 0 ? `+${row.points}` : row.points < 0 ? `${row.points}` : "0"}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center justify-between border-t border-[#E7E7E7] pt-2 text-[12.5px] font-semibold text-[#171719]">
                <span>Fit score</span>
                <span className="font-mono tabular-nums">{match.fitScore}%</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Details & Criteria */}
        <div className="min-w-0 flex-1">
          {/* Header row: title and seller details, padded to avoid badge collision */}
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 pr-[120px]">
            <h2 className="text-[14px] font-semibold leading-tight">
              {listing ? (
                <Link className="text-[#171719] hover:text-[#1863dc] hover:underline" href={`/listings/${listing.id}`}>
                  {getListingDisplayName(listing)}
                </Link>
              ) : (
                <span className="text-[#171719]">Unknown asset</span>
              )}
            </h2>
            {owner ? (
              <span className="text-[12px] text-[#8E918B] leading-none">
                Seller:{" "}
                <Link
                  className="text-[#5F625E] hover:text-[#1863dc] hover:underline"
                  href={`/sellers/${owner.id}`}
                >
                  {owner.name}
                </Link>
              </span>
            ) : null}
          </div>

          {/* Rationale text */}
          <p className="mt-2 text-[13.5px] leading-relaxed text-[#5F625E] pr-[120px] sm:pr-0">
            {listing ? getCleanRationale(match, getListingDisplayName(listing)) : match.rationale}
          </p>

          {/* Criteria tags section (flex-wrap to fit on a single line where possible) */}
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {/* Met criteria list */}
            {match.criteriaMet.length ? (
              match.criteriaMet.map((item, idx) => (
                <span
                  key={`met-${idx}`}
                  className="inline-flex items-center gap-1 text-[12px] bg-[#E1F1EA]/60 text-[#0F8F62] px-2 py-0.5 rounded-[6px] font-medium border border-[#E1F1EA]"
                >
                  <CheckCircle2 className="h-3 w-3 shrink-0" />
                  {item}
                </span>
              ))
            ) : (
              <span className="inline-flex items-center gap-1 text-[12px] bg-white text-[#5F625E] px-2 py-0.5 rounded-[6px] font-medium border border-[#E7E7E7]">
                Needs broker review
              </span>
            )}

            {/* Missing criteria list */}
            {match.missingCriteria.length ? (
              match.missingCriteria.map((item, idx) => (
                <span
                  key={`missing-${idx}`}
                  className="inline-flex items-center gap-1 text-[12px] bg-[#F0DDD0]/30 text-[#A86642] px-2 py-0.5 rounded-[6px] font-medium border border-[#F0DDD0]/50"
                >
                  <CircleAlert className="h-3 w-3 shrink-0" />
                  {item}
                </span>
              ))
            ) : (
              <span className="inline-flex items-center gap-1 text-[12px] bg-[#E1F1EA]/60 text-[#0F8F62] px-2 py-0.5 rounded-[6px] font-medium border border-[#E1F1EA]">
                <CheckCircle2 className="h-3 w-3 shrink-0" />
                No missing criteria
              </span>
            )}
          </div>

          {/* Action row — tick matches to build a shortlist, then create the
              room once via "Build shortlist room" above. This is how the Match
              stage advances to Share. */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {inRoom ? (
              /* Already curated into a shortlist room — no re-adding; the chip
                 links to the room so "where is it?" is one click. */
              roomHref ? (
                <Link
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-[8px] border border-[#E1F1EA] bg-[#E1F1EA]/60 px-3 text-[12.5px] font-medium text-[#0F8F62] transition-colors hover:bg-[#E1F1EA]"
                  href={roomHref}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  In shortlist room
                </Link>
              ) : (
                <span className="inline-flex min-h-8 items-center gap-1.5 rounded-[8px] border border-[#E1F1EA] bg-[#E1F1EA]/60 px-3 text-[12.5px] font-medium text-[#0F8F62]">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  In shortlist room
                </span>
              )
            ) : (
              <button
                aria-pressed={selected}
                className={cn(
                  "inline-flex min-h-8 items-center gap-1.5 rounded-[8px] border px-3 text-[12.5px] font-medium transition-colors",
                  selected
                    ? "border-[#003C33] bg-[#F1F2EE] text-[#003C33] hover:bg-[#E7EAE4]"
                    : "border-[#003C33] bg-white text-[#003C33] hover:bg-[#F1F2EE]",
                )}
                onClick={onToggleSelect}
                type="button"
              >
                {selected ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Added to shortlist
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    Add to shortlist
                  </>
                )}
              </button>
            )}
            {listing ? (
              <Link
                className="inline-flex min-h-8 items-center gap-1.5 rounded-[8px] border border-[#E7E7E7] bg-white px-3 text-[12.5px] font-medium text-[#5F625E] transition-colors hover:border-[#003C33] hover:text-[#003C33]"
                href={`/listings/${listing.id}`}
              >
                View listing
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        </div>
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
    <div className="mx-auto w-full max-w-[1536px] px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
      {/* Back-link removed — breadcrumb in the top bar covers navigation. */}

      <div>
        <PageHeader
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
            <div className="border-t border-[#E7E7E7] px-6 py-5">
              <InsightList
                icon={MessageSquareText}
                title="Feedback history"
                items={seller.feedbackHistory}
              />
            </div>
          </Card>

          <Card>
            <CardHeader eyebrow="Portfolio" title="Listed assets and blockers" />
            <ul className="grid gap-0 divide-y divide-[#E7E7E7]">
              {assets.map((asset) => (
                <li
                  key={asset.id}
                  className="grid gap-3 px-6 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                >
                  <div className="min-w-0">
                    <Link
                      className="text-[14px] font-medium text-[#171719] hover:text-[#1863dc]"
                      href={`/listings/${asset.id}`}
                    >
                      {asset.name}
                    </Link>
                    <p className="mt-1 text-[13px] leading-6 text-[#5F625E]">
                      {asset.builder} {asset.model} · {asset.location} · Missing:{" "}
                      {asset.missingInfo.length ? asset.missingInfo.join(", ") : "none"}.
                    </p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="font-mono text-[14px] font-medium text-[#171719]">
                      {formatCurrency(asset.priceEur)}
                    </p>
                    <p className="mt-1 text-[12px] uppercase tracking-[0.14em] text-[#8E918B]">
                      {asset.status}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader eyebrow="Owner reporting" title="Prepared update material" />
            <div className="grid gap-0 divide-y divide-[#E7E7E7]">
              {reports.length ? (
                reports.map((report) => (
                  <article key={report.title} className="px-6 py-5">
                    <h2 className="text-[14px] font-medium text-[#171719]">{report.title}</h2>
                    <p className="mt-2 text-[13px] leading-6 text-[#5F625E]">{report.summary}</p>
                    <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                      {report.sections.map((section) => (
                        <div key={section.label}>
                          <dt className="bb-mono-label">{section.label}</dt>
                          <dd className="mt-1.5 text-[13px] leading-6 text-[#5F625E]">
                            {section.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </article>
                ))
              ) : (
                <p className="px-6 py-5 text-sm leading-6 text-[#5F625E]">
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
              title="Next update preparation"
              action={
                <CardHeaderIcon>
                  <Mail className="h-4 w-4" aria-hidden="true" />
                </CardHeaderIcon>
              }
            />
            <div className="grid gap-4 px-6 py-5">
              <p className="text-[13px] leading-6 text-[#5F625E]">
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
              title="Conversations and open tasks"
            />
            <ul className="grid gap-0 divide-y divide-[#E7E7E7]">
              {conversations.map((conversation) => (
                <li key={conversation.id} className="px-6 py-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{conversation.channel}</Badge>
                    <span className="text-[12px] uppercase tracking-[0.14em] text-[#8E918B]">
                      {formatDate(conversation.occurredAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] leading-6 text-[#5F625E]">
                    {conversation.summary}
                  </p>
                </li>
              ))}
              {tasks.map((task) => (
                <li key={task.id} className="px-6 py-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={priorityTone(task.priority)}>{task.priority}</Badge>
                    <span className="text-[12px] uppercase tracking-[0.14em] text-[#8E918B]">
                      {dueLabel(task.dueAt)}
                    </span>
                  </div>
                  <h2 className="mt-2 text-[14px] font-medium text-[#171719]">{task.title}</h2>
                  <p className="mt-1 text-[13px] leading-6 text-[#5F625E]">{task.reason}</p>
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
        title={title}
        action={
          <CardHeaderIcon>
            <Gauge className="h-4 w-4" aria-hidden="true" />
          </CardHeaderIcon>
        }
      />
      <ul className="grid gap-0 divide-y divide-[#E7E7E7]">
        {actions.length ? (
          actions.map((action) => (
            <li
              key={`${action.label}-${action.dueAt}`}
              className="relative px-6 py-5 transition-colors hover:bg-[#fcfcfb]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={priorityTone(action.priority)}>{action.priority}</Badge>
                <Badge tone="neutral">{action.kind}</Badge>
                <span className="text-[12px] uppercase tracking-[0.14em] text-[#8E918B]">
                  {dueLabel(action.dueAt)}
                </span>
              </div>
              <h2 className="mt-2 text-[14px] font-semibold text-[#171719]">{action.label}</h2>
              <p className="mt-2 text-[13.0px] leading-relaxed text-[#5F625E]">{action.reason}</p>
            </li>
          ))
        ) : (
          <li className="px-6 py-5 text-sm leading-6 text-[#5F625E]">
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
            <dt className="text-[#8E918B]">{label}</dt>
            <dd className="text-[#5F625E]">{value}</dd>
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
        <Icon className="h-3.5 w-3.5 text-[#003C33]" aria-hidden="true" />
        <p className="bb-mono-label">{title}</p>
      </div>
      <ul className="mt-2 grid gap-1">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="text-[13px] leading-6 text-[#5F625E]">
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
          <li key={`${item}-${index}`} className="text-[13px] leading-6 text-[#5F625E]">
            · {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
