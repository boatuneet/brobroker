"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  ClipboardList,
  Coins,
  Eye,
  FileText,
  Flame,
  Mail,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import {
  type BrokerSegment,
  getBrokerSegmentMeta,
} from "@/lib/broker-segments";
import type {
  BrokerTask,
  BuyerProfile,
  Conversation,
  FollowUpDraft,
  YachtListing,
} from "@/lib/types";
import { cn, daysUntil, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui";
import {
  DEMO_NOW,
  STAGES,
  STAGE_FORECAST_WEIGHTS,
  buildEventsForBuyer,
  buildWindow,
  deriveHealth,
  formatCompactEur,
  midpointBudget,
  pickPrimary,
  positionPercent,
  todayPercent,
  type BuyerLane,
  type EventTone,
  type PulseEvent,
  type TrackKind,
  type Window,
} from "./pulse-types";
import {
  applyActionOverlay,
  usePulseActions,
  type PulseActionEntry,
} from "./use-pulse-actions";
import { PulseEventPopover } from "./pulse-event-popover";

const TONE_STYLES: Record<EventTone, { dot: string; label: string }> = {
  overdue:   { dot: "bg-rose-500",   label: "text-rose-700" },
  urgent:    { dot: "bg-amber-500",  label: "text-amber-700" },
  scheduled: { dot: "bg-sky-500",    label: "text-sky-700" },
  done:      { dot: "bg-emerald-500",label: "text-emerald-700" },
  info:      { dot: "bg-[#75758a]",  label: "text-[#3f3f46]" },
  dormant:   { dot: "bg-[#d3d3d8]",  label: "text-[#75758a]" },
};

const TRACK_ICONS: Record<TrackKind, typeof Activity> = {
  pipeline: TrendingUp,
  verification: ShieldCheck,
  viewing: Eye,
  communication: MessageSquareText,
  document: FileText,
  matching: Sparkles,
};

const TRACK_LABELS: Record<TrackKind, string> = {
  pipeline: "Pipeline",
  verification: "Verification",
  viewing: "Viewings",
  communication: "Communication",
  document: "Documents",
  matching: "Matching",
};

/* -----------------------------------------------------------------------------
 * Main component
 * -------------------------------------------------------------------------- */

export function PulseBoard({
  conversations,
  demoBuyers,
  drafts,
  listings,
  segment,
  storedBuyers,
  tasks,
}: {
  conversations: Conversation[];
  demoBuyers: BuyerProfile[];
  drafts: FollowUpDraft[];
  listings: YachtListing[];
  segment: BrokerSegment;
  storedBuyers: BuyerProfile[];
  tasks: BrokerTask[];
}) {
  const [stageFilter, setStageFilter] = useState<BuyerProfile["currentStage"] | "All">("All");
  const [urgencyOnly, setUrgencyOnly] = useState(false);
  const [extended, setExtended] = useState(false);
  const [selectedBuyerId, setSelectedBuyerId] = useState<string | null>(null);
  const [activePopover, setActivePopover] = useState<{
    event: PulseEvent;
    buyerId: string;
    buyerName: string;
    rect: DOMRect;
  } | null>(null);

  const actions = usePulseActions();

  const allBuyers = useMemo(() => {
    const seen = new Set<string>();
    const out: BuyerProfile[] = [];
    for (const buyer of [...storedBuyers, ...demoBuyers]) {
      if (seen.has(buyer.id)) continue;
      seen.add(buyer.id);
      out.push(buyer);
    }
    return out;
  }, [storedBuyers, demoBuyers]);

  /* Derive lanes — apply action overlay so dismissed/done/snoozed events feel
     live in the UI. */
  const lanes: BuyerLane[] = useMemo(() => {
    return allBuyers.map((buyer) => {
      const raw = buildEventsForBuyer(buyer, tasks, conversations, drafts);
      const events = raw
        .map((event) => applyActionOverlay(event, actions.state.byEvent))
        .filter((event): event is PulseEvent => event !== null);
      const primary = pickPrimary(events);
      const daysSinceContact = buyer.lastContactedAt
        ? Math.max(0, -daysUntil(buyer.lastContactedAt))
        : 999;
      const health = deriveHealth(primary, daysSinceContact);
      const primaryDelta = primary
        ? new Date(primary.date).getTime() - DEMO_NOW.getTime()
        : Number.POSITIVE_INFINITY;
      return { buyer, events, primary, primaryDelta, health, daysSinceContact };
    });
  }, [allBuyers, tasks, conversations, drafts, actions.state.byEvent]);

  const stageCounts = useMemo(() => {
    const counts = new Map<BuyerProfile["currentStage"], number>();
    for (const stage of STAGES) counts.set(stage, 0);
    for (const lane of lanes) {
      counts.set(lane.buyer.currentStage, (counts.get(lane.buyer.currentStage) ?? 0) + 1);
    }
    return counts;
  }, [lanes]);

  const stageHealth = useMemo(() => {
    const tally = new Map<BuyerProfile["currentStage"], { overdue: number; total: number }>();
    for (const stage of STAGES) tally.set(stage, { overdue: 0, total: 0 });
    for (const lane of lanes) {
      const entry = tally.get(lane.buyer.currentStage)!;
      entry.total += 1;
      if (lane.health === "overdue" || lane.health === "dormant") entry.overdue += 1;
    }
    return tally;
  }, [lanes]);

  const visibleLanes = useMemo(() => {
    const filtered = lanes.filter((lane) => {
      if (stageFilter !== "All" && lane.buyer.currentStage !== stageFilter) return false;
      if (urgencyOnly && lane.health !== "overdue" && lane.health !== "urgent") return false;
      return true;
    });
    const order: Record<BuyerLane["health"], number> = {
      overdue: 0, urgent: 1, scheduled: 2, "on-track": 3, dormant: 4,
    };
    return filtered.sort((a, b) => {
      const oa = order[a.health];
      const ob = order[b.health];
      if (oa !== ob) return oa - ob;
      return a.primaryDelta - b.primaryDelta;
    });
  }, [lanes, stageFilter, urgencyOnly]);

  const window = useMemo(() => buildWindow(extended), [extended]);

  const needsMeCount = lanes.filter(
    (l) => l.health === "overdue" || l.health === "urgent",
  ).length;

  const selectedLane = selectedBuyerId
    ? lanes.find((lane) => lane.buyer.id === selectedBuyerId) ?? null
    : null;

  /* ---------- Pipeline value strip data ---------- */
  const pipelineValue = useMemo(() => {
    let active = 0;
    let weighted = 0;
    let likelyValue = 0;
    let likelyCount = 0;
    for (const lane of lanes) {
      const mid = midpointBudget(lane.buyer);
      active += mid;
      weighted += mid * STAGE_FORECAST_WEIGHTS[lane.buyer.currentStage];
      if (
        lane.buyer.currentStage === "Viewing Planned" ||
        lane.buyer.currentStage === "Negotiation"
      ) {
        likelyValue += mid;
        likelyCount += 1;
      }
    }
    return { active, weighted, likelyValue, likelyCount };
  }, [lanes]);

  /* ---------- Change feed since last visit ---------- */
  const changes = useMemo(
    () =>
      computeChanges({
        lanes,
        lastVisitAt: actions.lastVisitAt,
        actionLog: actions.state.log,
      }),
    [lanes, actions.lastVisitAt, actions.state.log],
  );

  const onDotClick = useCallback(
    (event: PulseEvent, buyerId: string, buyerName: string, rect: DOMRect) => {
      setActivePopover({ event, buyerId, buyerName, rect });
    },
    [],
  );

  return (
    <div className="mx-auto w-full max-w-[1400px] px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
      <PageHeader
        eyebrow="Pipeline pulse"
        title="Pulse"
        description="Live timeline of every deal — what's coming, what's late, what's stalled."
        actions={
          <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-rose-50 px-3.5 text-[12.5px] font-semibold text-rose-700">
            <Flame aria-hidden="true" className="h-3.5 w-3.5" />
            Needs me · {needsMeCount}
          </span>
        }
      />

      {/* Pipeline value strip — Feature 4. */}
      <PipelineValueStrip data={pipelineValue} lanesTotal={lanes.length} />

      {/* Since-last-visit change feed — Feature 2. */}
      <ChangeFeedStrip
        changes={changes}
        lastVisitAt={actions.lastVisitAt}
        onOpenBuyer={setSelectedBuyerId}
      />


      {/* Stage distribution strip. */}
      <section aria-label="Pipeline stages" className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {STAGES.map((stage) => {
          const count = stageCounts.get(stage) ?? 0;
          const health = stageHealth.get(stage) ?? { overdue: 0, total: 0 };
          const tone =
            health.total === 0
              ? "neutral"
              : health.overdue / health.total >= 0.5
                ? "rose"
                : health.overdue > 0
                  ? "amber"
                  : "emerald";
          const isActive = stageFilter === stage;
          return (
            <button
              aria-pressed={isActive}
              className={cn(
                "group relative overflow-hidden rounded-2xl border p-3.5 text-left transition-colors",
                isActive
                  ? "border-[#003c33] bg-[#003c33] text-white"
                  : "border-[#ececef] bg-white text-[#17171c] hover:border-[#003c33]",
              )}
              key={stage}
              onClick={() => setStageFilter(isActive ? "All" : stage)}
              type="button"
            >
              {/* Top-right indicator: X when selected (click anywhere to clear),
                  diagonal arrow when not (click anywhere to drill in). */}
              <span
                aria-hidden="true"
                className={cn(
                  "absolute right-2.5 top-2.5 inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors",
                  isActive
                    ? "bg-white/15 text-white"
                    : "text-[#9b9ba6] group-hover:bg-[#003c33]/8 group-hover:text-[#003c33]",
                )}
              >
                {isActive ? (
                  <X className="h-3.5 w-3.5" />
                ) : (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                )}
              </span>
              <p
                className={cn(
                  "bb-mono-label",
                  isActive ? "text-[#cce0d6]" : "text-[#75758a]",
                )}
              >
                {stage}
              </p>
              <p className="mt-1.5 text-[1.5rem] font-medium tabular-nums leading-none">
                {count}
              </p>
              <div
                className={cn(
                  "mt-3 h-1 w-full overflow-hidden rounded-full",
                  isActive ? "bg-white/20" : "bg-[#f2f2f5]",
                )}
              >
                <div
                  className={cn(
                    "h-full",
                    isActive
                      ? "bg-white"
                      : tone === "rose"
                        ? "bg-rose-500"
                        : tone === "amber"
                          ? "bg-amber-500"
                          : tone === "emerald"
                            ? "bg-emerald-500"
                            : "bg-[#d3d3d8]",
                  )}
                  style={{
                    width: `${
                      health.total ? Math.max(8, (1 - health.overdue / health.total) * 100) : 0
                    }%`,
                  }}
                />
              </div>
              <p
                className={cn(
                  "mt-2 text-[11px] leading-4",
                  isActive ? "text-white/85" : "text-[#75758a]",
                )}
              >
                {health.overdue
                  ? `${health.overdue} need attention`
                  : count
                    ? "Healthy"
                    : "Empty"}
              </p>
            </button>
          );
        })}
      </section>

      {/* Filter bar. */}
      <section
        aria-label="Pulse filters"
        className="mt-6 flex flex-wrap items-center gap-2"
      >
        <button
          className={cn(
            "inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 text-[12.5px] font-medium transition-colors",
            stageFilter !== "All"
              ? "border-[#17171c] bg-[#17171c] text-white"
              : "border-[#e5e7eb] bg-white text-[#3f3f46] hover:border-[#17171c]",
          )}
          onClick={() => setStageFilter("All")}
          type="button"
        >
          <Users aria-hidden="true" className="h-3.5 w-3.5" />
          {stageFilter === "All" ? "All stages" : `Stage · ${stageFilter}`}
          {stageFilter !== "All" ? <X aria-hidden="true" className="h-3 w-3" /> : null}
        </button>
        <button
          aria-pressed={urgencyOnly}
          className={cn(
            "inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 text-[12.5px] font-medium transition-colors",
            urgencyOnly
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-[#e5e7eb] bg-white text-[#3f3f46] hover:border-[#17171c]",
          )}
          onClick={() => setUrgencyOnly((current) => !current)}
          type="button"
        >
          <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
          Needs me this week
        </button>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11.5px] font-medium uppercase tracking-[0.12em] text-[#75758a]">
            Window
          </span>
          <button
            aria-pressed={!extended}
            className={cn(
              "inline-flex min-h-9 items-center rounded-full border px-3.5 text-[12.5px] font-medium transition-colors",
              !extended
                ? "border-[#17171c] bg-[#17171c] text-white"
                : "border-[#e5e7eb] bg-white text-[#3f3f46] hover:border-[#17171c]",
            )}
            onClick={() => setExtended(false)}
            type="button"
          >
            7d / 30d
          </button>
          <button
            aria-pressed={extended}
            className={cn(
              "inline-flex min-h-9 items-center rounded-full border px-3.5 text-[12.5px] font-medium transition-colors",
              extended
                ? "border-[#17171c] bg-[#17171c] text-white"
                : "border-[#e5e7eb] bg-white text-[#3f3f46] hover:border-[#17171c]",
            )}
            onClick={() => setExtended(true)}
            type="button"
          >
            Show beyond
          </button>
        </div>
      </section>

      {/* Lane grid. */}
      <section
        aria-label="Pulse lanes"
        className="mt-6 overflow-hidden rounded-[22px] border border-[#ececef] bg-white"
      >
        <LaneAxis window={window} />
        {visibleLanes.length === 0 ? (
          <div className="px-6 py-10 text-center text-[13px] text-[#75758a]">
            No buyers match the current filter.
          </div>
        ) : (
          <ul className="divide-y divide-[#f2f2f2]">
            {visibleLanes.map((lane) => (
              <li key={lane.buyer.id}>
                <PulseLaneRow
                  lane={lane}
                  onDotClick={onDotClick}
                  onSelect={() => setSelectedBuyerId(lane.buyer.id)}
                  segment={segment}
                  window={window}
                />
              </li>
            ))}
          </ul>
        )}
        <Legend />
      </section>

      {selectedLane ? (
        <PulseSidePanel
          listings={listings}
          onClose={() => setSelectedBuyerId(null)}
          lane={selectedLane}
          window={window}
        />
      ) : null}

      {activePopover ? (
        <PulseEventPopover
          anchorRect={activePopover.rect}
          buyerId={activePopover.buyerId}
          event={activePopover.event}
          onClose={() => setActivePopover(null)}
          onDismiss={() =>
            actions.dismiss(activePopover.event, activePopover.buyerId, activePopover.buyerName)
          }
          onMarkDone={() =>
            actions.markDone(activePopover.event, activePopover.buyerId, activePopover.buyerName)
          }
          onSnooze={(days) =>
            actions.snooze(activePopover.event, activePopover.buyerId, activePopover.buyerName, days)
          }
        />
      ) : null}
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * Pipeline value strip (Feature 4)
 * -------------------------------------------------------------------------- */

function PipelineValueStrip({
  data,
  lanesTotal,
}: {
  data: { active: number; weighted: number; likelyValue: number; likelyCount: number };
  lanesTotal: number;
}) {
  return (
    <section
      aria-label="Pipeline value"
      className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4"
    >
      <ValueTile
        icon={Wallet}
        label="Active pipeline"
        value={formatCompactEur(data.active)}
        detail={`${lanesTotal} live deal${lanesTotal === 1 ? "" : "s"}`}
        tone="cream"
      />
      <ValueTile
        icon={Target}
        label="Weighted forecast"
        value={formatCompactEur(data.weighted)}
        detail="Stage-weighted"
      />
      <ValueTile
        icon={Coins}
        label="Likely close value"
        value={formatCompactEur(data.likelyValue)}
        detail={`${data.likelyCount} deal${data.likelyCount === 1 ? "" : "s"} in viewing / negotiation`}
      />
      <ValueTile
        icon={Zap}
        label="Avg deal size"
        value={
          lanesTotal > 0
            ? formatCompactEur(Math.round(data.active / lanesTotal))
            : "—"
        }
        detail="Midpoint of buyer budgets"
      />
    </section>
  );
}

function ValueTile({
  detail,
  icon: Icon,
  label,
  tone = "paper",
  value,
}: {
  detail: string;
  icon: typeof Wallet;
  label: string;
  tone?: "cream" | "paper";
  value: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-3.5",
        tone === "cream"
          ? "border-transparent bg-[#f4ead5] text-[#17171c]"
          : "border-[#ececef] bg-white text-[#17171c]",
      )}
    >
      <div className="flex items-center justify-between">
        <p className="bb-mono-label text-[#75758a]">{label}</p>
        <Icon aria-hidden="true" className="h-3.5 w-3.5 text-[#75758a]" />
      </div>
      <p className="mt-1.5 text-[1.5rem] font-medium tabular-nums leading-none">{value}</p>
      <p className="mt-2 text-[11px] leading-4 text-[#75758a]">{detail}</p>
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * Change feed (Feature 2)
 * -------------------------------------------------------------------------- */

type ChangeItem = {
  id: string;
  label: string;
  detail: string;
  at: string;
  buyerId?: string;
  kind: "conversation" | "draft" | "action" | "overdue";
};

function computeChanges({
  lanes,
  lastVisitAt,
  actionLog,
}: {
  lanes: BuyerLane[];
  lastVisitAt: string | null;
  actionLog: PulseActionEntry[];
}): ChangeItem[] {
  /* If we don't have a prior visit recorded, default to last 24 hours. */
  const since = lastVisitAt
    ? new Date(lastVisitAt).getTime()
    : Date.now() - 24 * 60 * 60 * 1000;

  const items: ChangeItem[] = [];

  for (const lane of lanes) {
    for (const event of lane.events) {
      const at = new Date(event.date).getTime();
      if (event.origin === "conversation" && at >= since) {
        items.push({
          id: `conv-${event.id}`,
          label: `New conversation · ${lane.buyer.name}`,
          detail: event.label,
          at: event.date,
          buyerId: lane.buyer.id,
          kind: "conversation",
        });
      } else if (event.origin === "draft" && at >= since) {
        items.push({
          id: `draft-${event.id}`,
          label: `Draft pending · ${lane.buyer.name}`,
          detail: event.label,
          at: event.date,
          buyerId: lane.buyer.id,
          kind: "draft",
        });
      } else if (event.tone === "overdue" && event.actionable) {
        items.push({
          id: `od-${event.id}`,
          label: `Slipped · ${lane.buyer.name}`,
          detail: `${event.label} · ${Math.abs(daysUntil(event.date))}d late`,
          at: event.date,
          buyerId: lane.buyer.id,
          kind: "overdue",
        });
      }
    }
  }

  for (const entry of actionLog) {
    if (new Date(entry.at).getTime() < since) continue;
    items.push({
      id: `act-${entry.eventId}-${entry.at}`,
      label:
        entry.action === "done"
          ? `Completed · ${entry.buyerName}`
          : entry.action === "snoozed"
            ? `Snoozed · ${entry.buyerName}`
            : entry.action === "rescheduled"
              ? `Rescheduled · ${entry.buyerName}`
              : `Dismissed · ${entry.buyerName}`,
      detail: entry.eventLabel,
      at: entry.at,
      buyerId: entry.buyerId,
      kind: "action",
    });
  }

  /* Deduplicate overdue items if we also have a more relevant entry for the
     same event. */
  const seen = new Set<string>();
  const deduped: ChangeItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    deduped.push(item);
  }

  /* Sort newest first. */
  return deduped
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 8);
}

function ChangeFeedStrip({
  changes,
  lastVisitAt,
  onOpenBuyer,
}: {
  changes: ChangeItem[];
  lastVisitAt: string | null;
  onOpenBuyer: (buyerId: string) => void;
}) {
  if (!changes.length) {
    return (
      <section
        aria-label="Since last visit"
        className="mt-4 rounded-2xl border border-[#ececef] bg-[#fafaf7] px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
          <p className="text-[12.5px] text-[#3f3f46]">
            Nothing new since {lastVisitAt ? formatDate(lastVisitAt) : "your last visit"}. You&apos;re caught up.
          </p>
        </div>
      </section>
    );
  }
  return (
    <section
      aria-label="Since last visit"
      className="mt-4 grid gap-2 rounded-2xl border border-[#ececef] bg-white px-4 py-3"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="bb-mono-label text-[#75758a]">
          Since {lastVisitAt ? formatDate(lastVisitAt) : "yesterday"}
        </p>
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#75758a]">
          {changes.length} change{changes.length === 1 ? "" : "s"}
        </span>
      </div>
      <ul className="grid gap-1.5">
        {changes.map((item) => (
          <li key={item.id}>
            <button
              className="group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[#fafaf7]"
              onClick={() => (item.buyerId ? onOpenBuyer(item.buyerId) : undefined)}
              type="button"
            >
              <ChangeDot kind={item.kind} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium text-[#17171c]">
                  {item.label}
                </span>
                <span className="block truncate text-[11.5px] text-[#75758a]">
                  {item.detail}
                </span>
              </span>
              <span className="shrink-0 text-[11px] text-[#75758a]">
                {formatRelativeTime(item.at)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ChangeDot({ kind }: { kind: ChangeItem["kind"] }) {
  const Icon =
    kind === "conversation" ? MessageSquareText
    : kind === "draft" ? Mail
    : kind === "overdue" ? AlertTriangle
    : ClipboardCheck;
  const color =
    kind === "conversation" ? "text-sky-600 bg-sky-50"
    : kind === "draft" ? "text-amber-700 bg-amber-50"
    : kind === "overdue" ? "text-rose-700 bg-rose-50"
    : "text-emerald-700 bg-emerald-50";
  return (
    <span className={cn("inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full", color)}>
      <Icon aria-hidden="true" className="h-3 w-3" />
    </span>
  );
}

function formatRelativeTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return formatDate(iso);
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  return formatDate(iso);
}

/* -----------------------------------------------------------------------------
 * Axis header
 * -------------------------------------------------------------------------- */

function LaneAxis({ window }: { window: Window }) {
  const todayPct = todayPercent(window);
  const back = Math.round((DEMO_NOW.getTime() - window.startMs) / 86_400_000);
  const ahead = Math.round((window.endMs - DEMO_NOW.getTime()) / 86_400_000);
  return (
    <div className="grid grid-cols-[220px_minmax(0,1fr)_140px] border-b border-[#f2f2f2] bg-[#fbfbfa] px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a8a96]">
      <span>Buyer</span>
      <div className="relative">
        <span className="absolute left-0">-{back}d</span>
        <span
          className="absolute font-bold text-[#17171c]"
          style={{ left: `${todayPct}%`, transform: "translateX(-50%)" }}
        >
          Today
        </span>
        <span className="absolute right-0">+{ahead}d</span>
      </div>
      <span className="text-right">Status</span>
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * Lane row — with hover-scrub (Feature 7) and dot actions (Feature 1)
 * -------------------------------------------------------------------------- */

function PulseLaneRow({
  lane,
  onDotClick,
  onSelect,
  segment,
  window,
}: {
  lane: BuyerLane;
  onDotClick: (
    event: PulseEvent,
    buyerId: string,
    buyerName: string,
    rect: DOMRect,
  ) => void;
  onSelect: () => void;
  segment: BrokerSegment;
  window: Window;
}) {
  const { buyer, events, primary, health } = lane;
  const segmentMeta = getBrokerSegmentMeta(segment);
  const todayPct = todayPercent(window);
  /* Scrub state holds both the in-lane percentage (for the cursor line) and
     the viewport coordinates we need to position the tooltip with position:
     fixed — that lifts it above the lanes section's overflow:hidden clip. */
  const [scrub, setScrub] = useState<{
    pct: number;
    clientX: number;
    laneTop: number;
  } | null>(null);
  const laneRef = useRef<HTMLDivElement>(null);

  /* Stage history bar — approximation of "how long has buyer been in current stage". */
  const stageStart = Math.max(
    window.startMs,
    new Date(buyer.lastContactedAt ?? DEMO_NOW).getTime() - 21 * 86_400_000,
  );
  const stageStartPct = ((stageStart - window.startMs) / window.spanMs) * 100;

  const onLaneMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = laneRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    setScrub({
      pct: (x / rect.width) * 100,
      clientX: e.clientX,
      laneTop: rect.top,
    });
  };
  const onLaneLeave = () => setScrub(null);

  const scrubDate = scrub
    ? new Date(window.startMs + (scrub.pct / 100) * window.spanMs)
    : null;
  const nearbyEvents = scrubDate
    ? events
        .filter((event) => {
          const delta = Math.abs(new Date(event.date).getTime() - scrubDate.getTime());
          return delta <= 2 * 86_400_000;
        })
        .slice(0, 4)
    : [];

  return (
    <div className="grid w-full grid-cols-[220px_minmax(0,1fr)_140px] items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#fafaf7]">
      {/* Identity — clicking opens the side panel. */}
      <button
        className="min-w-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1863dc]"
        onClick={onSelect}
        type="button"
      >
        <p className="truncate text-[14px] font-semibold leading-[1.3] text-[#17171c] hover:text-[#003c33]">
          {buyer.name}
        </p>
        <p className="mt-1 truncate text-[11.5px] leading-[1.4] text-[#75758a]">
          {segmentMeta.label} · {buyer.currentStage}
        </p>
      </button>

      {/* Lane with hover-scrub */}
      <div
        className={cn("relative h-9", health === "dormant" && "opacity-55")}
        onClick={(e) => {
          /* Clicks on the lane background also open the side panel. */
          if ((e.target as HTMLElement).dataset.role !== "dot") onSelect();
        }}
        onPointerLeave={onLaneLeave}
        onPointerMove={onLaneMove}
        ref={laneRef}
      >
        {/* Background lane */}
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#f2f2f5]" />

        {/* Stage history tint */}
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#cce0d6]"
          style={{
            left: `${Math.max(0, stageStartPct)}%`,
            width: `${Math.max(0, todayPct - Math.max(0, stageStartPct))}%`,
          }}
        />

        {/* Scrub cursor (inside the lane, follows pointer). */}
        {scrub ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 bottom-0 w-px bg-[#1863dc]/60"
            style={{ left: `${scrub.pct}%` }}
          />
        ) : null}

        {/* Today line */}
        <div
          aria-hidden="true"
          className="absolute top-0 bottom-0 w-px bg-[#17171c]/80"
          style={{ left: `${todayPct}%` }}
        />

        {/* Event dots */}
        {events.map((event) => {
          const rawPct = positionPercent(event.date, window);
          if (rawPct < -2 || rawPct > 102) return null;
          const pct = Math.max(0.5, Math.min(99.5, rawPct));
          const isPrimary = primary?.id === event.id;
          const tone = TONE_STYLES[event.tone];
          return (
            <button
              aria-label={`${event.label} · ${formatDate(event.date)}`}
              className={cn(
                "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white transition-transform hover:scale-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1863dc]",
                tone.dot,
                isPrimary ? "h-3 w-3 ring-[3px]" : "h-2.5 w-2.5",
                !event.actionable && "cursor-default opacity-70",
              )}
              data-role="dot"
              disabled={!event.actionable}
              key={event.id}
              onClick={(e) => {
                e.stopPropagation();
                if (!event.actionable) return;
                const target = e.currentTarget;
                const rect = target.getBoundingClientRect();
                onDotClick(event, buyer.id, buyer.name, rect);
              }}
              style={{ left: `${pct}%` }}
              title={`${event.label} · ${formatDate(event.date)}`}
              type="button"
            />
          );
        })}

        {/* Primary event label */}
        {primary ? (
          <span
            className={cn(
              "pointer-events-none absolute top-[calc(50%+10px)] -translate-x-1/2 whitespace-nowrap rounded-md bg-white px-1.5 py-0.5 text-[10px] font-medium",
              TONE_STYLES[primary.tone].label,
            )}
            style={{
              left: `${Math.max(2, Math.min(98, positionPercent(primary.date, window)))}%`,
            }}
          >
            {truncate(primary.label, 32)} · {formatDate(primary.date)}
          </span>
        ) : null}

        {/* Scrub tooltip — fixed-positioned so it escapes the lanes section's
            overflow:hidden clip and always renders on top. */}
        {scrub && scrubDate ? (
          <ScrubTooltip
            clientX={scrub.clientX}
            date={scrubDate}
            laneTop={scrub.laneTop}
            nearbyEvents={nearbyEvents}
          />
        ) : null}
      </div>

      {/* Status */}
      <div className="flex items-center justify-end gap-1.5">
        <HealthPill health={health} primary={primary} contactDays={lane.daysSinceContact} />
        <button
          aria-label="Open buyer detail"
          className="text-[#9b9ba6] transition-colors hover:text-[#17171c]"
          onClick={onSelect}
          type="button"
        >
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ScrubTooltip({
  clientX,
  date,
  laneTop,
  nearbyEvents,
}: {
  clientX: number;
  date: Date;
  laneTop: number;
  nearbyEvents: PulseEvent[];
}) {
  /* Fixed-positioned in viewport coords so the lanes section's
     overflow:hidden can't clip us. Clamp horizontally to the viewport with
     small gutters; pivot to render below the lane if there's no room above. */
  const tooltipWidth = 240;
  const gutter = 12;
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
  const rawLeft = clientX - tooltipWidth / 2;
  const left = Math.max(
    gutter,
    Math.min(viewportWidth - tooltipWidth - gutter, rawLeft),
  );
  /* Anchor above the lane row by default; flip below if we're near the top. */
  const above = laneTop > 120;
  const top = above ? laneTop - 8 : laneTop + 44;
  const transform = above ? "translateY(-100%)" : "none";

  return (
    <div
      className="pointer-events-none fixed z-[55] rounded-xl border border-[#e3e3e8] bg-white px-3 py-2 text-[11.5px] shadow-[0_12px_30px_rgba(23,23,28,0.16)]"
      style={{ left, top, width: tooltipWidth, transform }}
    >
      <p className="font-semibold text-[#17171c]">{formatDate(date.toISOString())}</p>
      {nearbyEvents.length === 0 ? (
        <p className="mt-0.5 text-[10.5px] text-[#75758a]">No events near this date.</p>
      ) : (
        <ul className="mt-1 grid gap-1">
          {nearbyEvents.map((event) => (
            <li
              className="flex items-center gap-1.5 text-[#3f3f46]"
              key={event.id}
            >
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TONE_STYLES[event.tone].dot)} />
              <span className="truncate">
                {event.label}
                <span className="text-[#9b9ba6]"> · {formatDate(event.date)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HealthPill({
  health,
  primary,
  contactDays,
}: {
  health: BuyerLane["health"];
  primary: PulseEvent | null;
  contactDays: number;
}) {
  if (health === "overdue" && primary) {
    const overdueDays = Math.abs(daysUntil(primary.date));
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
        Overdue {overdueDays}d
      </span>
    );
  }
  if (health === "urgent" && primary) {
    const days = daysUntil(primary.date);
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
        {days <= 0 ? "Due today" : days === 1 ? "Due tomorrow" : `Due in ${days}d`}
      </span>
    );
  }
  if (health === "dormant") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#f4f4f5] px-2.5 py-1 text-[11px] font-semibold text-[#75758a]">
        Dormant {contactDays}d
      </span>
    );
  }
  if (health === "scheduled" && primary) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
        In {daysUntil(primary.date)}d
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
      On track
    </span>
  );
}

function Legend() {
  const items: { tone: EventTone; label: string }[] = [
    { tone: "overdue", label: "Overdue" },
    { tone: "urgent", label: "Due ≤ 2d" },
    { tone: "scheduled", label: "Scheduled" },
    { tone: "done", label: "Done" },
    { tone: "dormant", label: "Dormant" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-4 border-t border-[#f2f2f2] bg-[#fbfbfa] px-5 py-2.5 text-[10.5px] text-[#75758a]">
      {items.map((item) => (
        <span className="inline-flex items-center gap-1.5" key={item.tone}>
          <span className={cn("h-2 w-2 rounded-full", TONE_STYLES[item.tone].dot)} />
          {item.label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1 w-6 rounded-full bg-[#cce0d6]" />
        Stage history
      </span>
      <span className="inline-flex items-center gap-1.5 text-[#1863dc]">
        <span className="h-3 w-px bg-[#1863dc]/60" />
        Hover any lane to scrub time
      </span>
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * Side panel — multi-track view
 * -------------------------------------------------------------------------- */

function PulseSidePanel({
  listings,
  onClose,
  lane,
  window,
}: {
  listings: YachtListing[];
  onClose: () => void;
  lane: BuyerLane;
  window: Window;
}) {
  const { buyer, events } = lane;
  const grouped = useMemo(() => {
    const map = new Map<TrackKind, PulseEvent[]>();
    for (const event of events) {
      const list = map.get(event.kind) ?? [];
      list.push(event);
      map.set(event.kind, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
    return map;
  }, [events]);

  const linkedListings = useMemo(() => {
    const ids = new Set<string>();
    for (const rej of buyer.rejectedAssets ?? []) ids.add(rej.listingId);
    return listings.filter((l) => ids.has(l.id));
  }, [listings, buyer.rejectedAssets]);

  const trackOrder: TrackKind[] = [
    "pipeline", "viewing", "verification", "communication", "document", "matching",
  ];

  return (
    <>
      <button
        aria-label="Close panel"
        className="fixed inset-0 z-40 bg-[#17171c]/24 backdrop-blur-[2px]"
        onClick={onClose}
        type="button"
      />
      <aside
        aria-label={`${buyer.name} pulse detail`}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px] flex-col overflow-hidden border-l border-[#e5e7eb] bg-white shadow-[0_24px_80px_rgba(23,23,28,0.18)]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[#f2f2f2] px-6 py-5">
          <div className="min-w-0">
            <p className="bb-mono-label text-[#75758a]">{buyer.currentStage} · {buyer.urgency}</p>
            <h2 className="bb-display mt-1 truncate text-[1.4rem] font-medium text-[#17171c]">
              {buyer.name}
            </h2>
            <p className="mt-1 truncate text-[12.5px] text-[#75758a]">
              {(buyer.company ? `${buyer.company} · ` : "") + (buyer.country ?? "")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#d9d9dd] bg-white px-3 text-[12.5px] font-medium text-[#17171c] hover:border-[#17171c]"
              href={`/buyers/${buyer.id}`}
            >
              Open buyer
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            <button
              aria-label="Close"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#e5e7eb] bg-white text-[#3f3f46] hover:border-[#17171c]"
              onClick={onClose}
              type="button"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-5">
            {trackOrder.map((kind) => {
              const items = grouped.get(kind) ?? [];
              if (!items.length) return null;
              return <TrackSection key={kind} kind={kind} events={items} window={window} />;
            })}

            {linkedListings.length ? (
              <section className="grid gap-2 rounded-2xl border border-[#ececef] bg-[#fafaf7] p-4">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-3.5 w-3.5 text-[#003c33]" aria-hidden="true" />
                  <p className="bb-mono-label">Linked listings · seller events surface here</p>
                </div>
                <ul className="grid divide-y divide-[#ececef]">
                  {linkedListings.map((listing) => (
                    <li className="flex items-center justify-between gap-3 py-2.5 text-[13px]" key={listing.id}>
                      <Link
                        className="font-medium text-[#17171c] hover:text-[#1863dc] hover:underline"
                        href={`/listings/${listing.id}`}
                      >
                        {listing.name}
                      </Link>
                      <span className="text-[12px] text-[#75758a]">
                        {listing.builder} {listing.model} · {listing.location}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {lane.health === "dormant" ? (
              <section className="grid gap-1 rounded-2xl border border-dashed border-[#e5e7eb] bg-[#fafaf7] p-4 text-[13px] leading-6 text-[#3f3f46]">
                <div className="flex items-center gap-2">
                  <CircleAlert className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
                  <p className="bb-mono-label text-amber-700">Dormant signal</p>
                </div>
                <p>
                  No contact for {lane.daysSinceContact} days and no scheduled action.
                  Re-engage with a status check before this lead cools further.
                </p>
              </section>
            ) : null}
          </div>
        </div>
      </aside>
    </>
  );
}

function TrackSection({
  events,
  kind,
  window,
}: {
  events: PulseEvent[];
  kind: TrackKind;
  window: Window;
}) {
  const [open, setOpen] = useState(true);
  const Icon = TRACK_ICONS[kind];
  const todayPct = todayPercent(window);
  return (
    <section aria-label={TRACK_LABELS[kind]} className="rounded-2xl border border-[#ececef] bg-white">
      <button
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        <div className="flex items-center gap-2">
          <Icon aria-hidden="true" className="h-3.5 w-3.5 text-[#003c33]" />
          <p className="bb-mono-label">{TRACK_LABELS[kind]}</p>
          <span className="rounded-full bg-[#f4f4f5] px-2 py-0.5 text-[10.5px] font-semibold text-[#75758a]">
            {events.length}
          </span>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-[#75758a]" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4 text-[#75758a]" aria-hidden="true" />
        )}
      </button>
      {open ? (
        <div className="border-t border-[#f2f2f2] px-4 py-4">
          <div className="relative h-7">
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[#ececef]" />
            <div
              className="absolute top-0 bottom-0 w-px bg-[#17171c]/40"
              style={{ left: `${todayPct}%` }}
            />
            {events.map((event) => {
              const raw = positionPercent(event.date, window);
              if (raw < -2 || raw > 102) return null;
              const pct = Math.max(0.5, Math.min(99.5, raw));
              return (
                <span
                  className={cn(
                    "absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white",
                    TONE_STYLES[event.tone].dot,
                  )}
                  key={event.id}
                  style={{ left: `${pct}%` }}
                  title={`${event.label} · ${formatDate(event.date)}`}
                />
              );
            })}
          </div>
          <ul className="mt-3 grid divide-y divide-[#f2f2f2]">
            {events.map((event) => (
              <li key={event.id} className="grid gap-1 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-[#17171c]">{event.label}</p>
                    {event.detail ? (
                      <p className="mt-0.5 line-clamp-2 text-[12px] leading-5 text-[#75758a]">
                        {event.detail}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#fafaf7] px-2.5 py-1 text-[11px] font-medium",
                      TONE_STYLES[event.tone].label,
                    )}
                  >
                    <CalendarClock className="h-3 w-3" aria-hidden="true" />
                    {formatDate(event.date)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function truncate(input: string, max: number) {
  return input.length > max ? `${input.slice(0, max - 1)}…` : input;
}
