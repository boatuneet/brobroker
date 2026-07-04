"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Flame } from "lucide-react";
import type {
  BrokerTask,
  BuyerProfile,
  Conversation,
  FollowUpDraft,
} from "@/lib/types";
import { cn, daysUntil, formatDate } from "@/lib/utils";
import { Tile } from "@/components/dashboard/visuals";
import {
  DEMO_NOW,
  buildEventsForBuyer,
  buildWindow,
  deriveHealth,
  pickPrimary,
  positionPercent,
  todayPercent,
  type BuyerLane,
  type EventTone,
  type PulseEvent,
  type Window,
} from "./pulse-types";

const TONE_DOT: Record<EventTone, string> = {
  overdue:   "bg-[#A86642]",
  urgent:    "bg-[#A86642]",
  scheduled: "bg-[#3D6F8F]",
  done:      "bg-[#0F8F62]",
  info:      "bg-[#8E918B]",
  dormant:   "bg-[#d3d3d8]",
};

const PREVIEW_LIMIT = 5;

/* Compact deal-timeline preview for Today. Renders the most urgent N
   buyers with mini-lanes, no popovers, no scrub. Rows click through to
   the buyer's detail page, where the full timeline lives. */
export function DashboardPulsePreview({
  buyers,
  conversations,
  drafts,
  tasks,
  className,
}: {
  buyers: BuyerProfile[];
  conversations: Conversation[];
  drafts: FollowUpDraft[];
  tasks: BrokerTask[];
  className?: string;
}) {
  const window = buildWindow(false);

  const lanes: BuyerLane[] = buyers.map((buyer) => {
    const events = buildEventsForBuyer(buyer, tasks, conversations, drafts);
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

  const order: Record<BuyerLane["health"], number> = {
    overdue: 0, urgent: 1, scheduled: 2, "on-track": 3, dormant: 4,
  };
  const sorted = lanes
    .sort((a, b) => {
      const oa = order[a.health];
      const ob = order[b.health];
      if (oa !== ob) return oa - ob;
      return a.primaryDelta - b.primaryDelta;
    })
    .slice(0, PREVIEW_LIMIT);

  const needsMe = lanes.filter(
    (l) => l.health === "overdue" || l.health === "urgent",
  ).length;

  return (
    <Tile className={className}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="bb-mono-label">Deal timelines</p>
          <p className="bb-display mt-1.5 text-lg font-medium text-[#171719]">
            Top deals on the timeline
          </p>
        </div>
        <div className="flex items-center gap-3">
          {needsMe > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#F0DDD0] px-2.5 py-1 text-[11.5px] font-semibold text-[#A86642]">
              <Flame aria-hidden="true" className="h-3 w-3" />
              Needs me · {needsMe}
            </span>
          ) : null}
          <Link
            className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[#171719] hover:underline"
            href="/buyers"
          >
            Open buyers <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <PreviewAxis window={window} />

      {sorted.length === 0 ? (
        <p className="mt-3 text-[12.5px] text-[#8E918B]">
          No active deals to surface yet.
        </p>
      ) : (
        /* Negative horizontal margin lets the row hover background bleed to
           the Tile's actual content edges (offsetting the Tile's px-5/sm:px-6
           inset) while the row itself still has internal px-3 — so the hover
           reads as a clean rounded pill that hugs the buyer name on the left
           and the status chip on the right. Without this, the hover stripe
           clips into the Tile's padding and looks "cut" at the sides. */
        <ul className="mt-1 -mx-2 grid gap-0.5 sm:-mx-3">
          {sorted.map((lane, index) => (
            <li key={lane.buyer.id}>
              <PreviewRow
                index={index}
                lane={lane}
                total={sorted.length}
                window={window}
              />
            </li>
          ))}
        </ul>
      )}
    </Tile>
  );
}

function PreviewAxis({ window }: { window: Window }) {
  const pct = todayPercent(window);
  const back = Math.round((DEMO_NOW.getTime() - window.startMs) / 86_400_000);
  const ahead = Math.round((window.endMs - DEMO_NOW.getTime()) / 86_400_000);
  return (
    <div className="mt-5 grid grid-cols-[140px_minmax(0,1fr)_92px] items-center gap-3 border-b border-[#E7E7E7] pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8E918B]">
      <span>Buyer</span>
      <div className="relative">
        <span className="absolute left-0">-{back}d</span>
        <span
          className="absolute font-bold text-[#171719]"
          style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
        >
          Today
        </span>
        <span className="absolute right-0">+{ahead}d</span>
      </div>
      <span className="text-right">Status</span>
    </div>
  );
}

function PreviewRow({
  lane,
  window,
  index,
  total,
}: {
  lane: BuyerLane;
  window: Window;
  index: number;
  total: number;
}) {
  // Flip the hover card above the lane for the lower rows so it never spills
  // past the card's bottom edge (and gets clipped).
  const flipInfoUp = index >= total - 2;
  const { buyer, events, primary, health } = lane;
  const todayPct = todayPercent(window);
  const stageStart = Math.max(
    window.startMs,
    new Date(buyer.lastContactedAt ?? DEMO_NOW).getTime() - 21 * 86_400_000,
  );
  const stageStartPct = ((stageStart - window.startMs) / window.spanMs) * 100;
  /* Which event the broker is hovering — drives the lightweight info card
     under the lane. `null` means no hover (the row link gets the normal
     hover background only). */
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const hoveredEvent = hoveredEventId
    ? events.find((e) => e.id === hoveredEventId) ?? null
    : null;

  return (
    /* px-2/sm:px-3 internally restores axis alignment after the ul's
       -mx-2/sm:-mx-3 shift, while letting the rounded hover background
       fill the row edge-to-edge inside the Tile. */
    <Link
      className="group relative grid grid-cols-[140px_minmax(0,1fr)_92px] items-center gap-3 rounded-[8px] px-2 py-2.5 transition-colors hover:bg-[#F1F2EE] sm:px-3"
      href={`/buyers/${buyer.id}`}
    >
      {/* Identity */}
      <div className="min-w-0">
        <p className="truncate text-[12.5px] font-semibold leading-[1.3] text-[#171719] group-hover:text-[#003C33]">
          {buyer.name}
        </p>
        <p className="mt-0.5 truncate text-[11px] leading-[1.3] text-[#8E918B]">
          {buyer.currentStage}
        </p>
      </div>

      {/* Mini-lane */}
      <div className={cn("relative h-6", health === "dormant" && "opacity-55")}>
        <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-[#E7E7E7]" />
        <div
          className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-[#F1F2EE]"
          style={{
            left: `${Math.max(0, stageStartPct)}%`,
            width: `${Math.max(0, todayPct - Math.max(0, stageStartPct))}%`,
          }}
        />
        <div
          aria-hidden="true"
          className="absolute top-0 bottom-0 w-px bg-[#171719]/70"
          style={{ left: `${todayPct}%` }}
        />
        {events.map((event) => {
          const raw = positionPercent(event.date, window);
          if (raw < -2 || raw > 102) return null;
          const pct = Math.max(0.5, Math.min(99.5, raw));
          const isPrimary = primary?.id === event.id;
          return (
            /* Dots are clickable hit areas — a transparent button wraps the
               visual dot so the hover region is forgiving (16px) but the
               visible dot stays small. Hover surfaces the quick-info card
               with kind + label + date, matching the Pulse screen pattern
               but read-only (no actions). */
            <button
              aria-label={`${event.label}, ${formatDate(event.date)}`}
              className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 cursor-default rounded-full p-1"
              key={event.id}
              onBlur={() => setHoveredEventId(null)}
              onClick={(e) => e.preventDefault()}
              onFocus={() => setHoveredEventId(event.id)}
              onMouseEnter={() => setHoveredEventId(event.id)}
              onMouseLeave={() => setHoveredEventId(null)}
              style={{ left: `${pct}%` }}
              type="button"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "block rounded-full ring-2 ring-white",
                  TONE_DOT[event.tone],
                  isPrimary ? "h-2.5 w-2.5 ring-[2.5px]" : "h-2 w-2",
                )}
              />
            </button>
          );
        })}

        {/* Quick-info card. Anchored to the lane (absolute), positioned via
            the event's percentage so it sits right under the dot. Read-only
            — full action menu is on the Pulse screen. */}
        {hoveredEvent ? (
          <PreviewDotInfo
            buyerName={buyer.name}
            event={hoveredEvent}
            flipUp={flipInfoUp}
            positionPct={Math.max(
              0.5,
              Math.min(99.5, positionPercent(hoveredEvent.date, window)),
            )}
          />
        ) : null}
      </div>

      {/* Status pill */}
      <div className="flex items-center justify-end">
        <MiniHealthPill
          health={health}
          primary={primary}
          contactDays={lane.daysSinceContact}
        />
      </div>
    </Link>
  );
}

/* Quick info card shown when the broker hovers a dot in the dashboard
   preview. Mirrors the Pulse screen popover but read-only: kind, label,
   date — no Mark done / Snooze actions, those live on /pulse. Positioned
   relative to the lane so it follows the dot, clamped to stay readable
   near the edges. */
function PreviewDotInfo({
  buyerName,
  event,
  positionPct,
  flipUp = false,
}: {
  buyerName: string;
  event: PulseEvent;
  positionPct: number;
  flipUp?: boolean;
}) {
  /* Anchor right under the dot. Use percent-based positioning so the card
     tracks the dot even as the lane resizes. Flip horizontal anchor when
     the dot is near the right edge so the card doesn't overflow. Flip
     vertically (above the lane) for lower rows so the card stays inside the
     dashboard tile instead of being clipped at the bottom. */
  const anchorRight = positionPct > 65;
  const anchorLeft = positionPct < 35;

  return (
    <div
      className={cn(
        "pointer-events-none absolute z-20 w-[220px] rounded-[8px] border border-[#E7E7E7] bg-white p-3 shadow-[0_12px_32px_rgba(23,31,25,0.10)]",
        flipUp ? "bottom-full mb-2" : "top-full mt-2",
      )}
      role="tooltip"
      style={{
        left: anchorRight ? "auto" : anchorLeft ? "0%" : `${positionPct}%`,
        right: anchorRight ? "0%" : "auto",
        transform: anchorRight || anchorLeft ? "none" : "translateX(-50%)",
      }}
    >
      <p className="bb-mono-label text-[#8E918B]">{kindLabel(event.kind)}</p>
      <p className="mt-1 truncate text-[12.5px] font-semibold text-[#171719]" title={event.label}>
        {event.label}
      </p>
      <p className="mt-0.5 text-[11px] text-[#8E918B]">
        {formatDate(event.date)} · {buyerName}
      </p>
    </div>
  );
}

function kindLabel(kind: PulseEvent["kind"]): string {
  return {
    pipeline: "Pipeline",
    verification: "Verification",
    viewing: "Viewing",
    communication: "Communication",
    document: "Document",
    matching: "Matching",
  }[kind];
}

function MiniHealthPill({
  health,
  primary,
  contactDays,
}: {
  health: BuyerLane["health"];
  primary: PulseEvent | null;
  contactDays: number;
}) {
  if (health === "overdue" && primary) {
    return (
      <span className="inline-flex items-center rounded-[8px] bg-[#F0DDD0] px-2 py-0.5 text-[10.5px] font-semibold text-[#A86642]">
        Overdue {Math.abs(daysUntil(primary.date))}d
      </span>
    );
  }
  if (health === "urgent" && primary) {
    const days = daysUntil(primary.date);
    return (
      <span className="inline-flex items-center rounded-[8px] bg-[#F0DDD0] px-2 py-0.5 text-[10.5px] font-semibold text-[#A86642]">
        {days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `${days}d`}
      </span>
    );
  }
  if (health === "dormant") {
    return (
      <span className="inline-flex items-center rounded-[8px] bg-[#F1F2EE] px-2 py-0.5 text-[10.5px] font-semibold text-[#8E918B]">
        Dormant {contactDays}d
      </span>
    );
  }
  if (health === "scheduled" && primary) {
    return (
      <span className="inline-flex items-center rounded-[8px] bg-[#E0ECF2] px-2 py-0.5 text-[10.5px] font-semibold text-[#3D6F8F]">
        In {daysUntil(primary.date)}d
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-[8px] bg-[#E1F1EA] px-2 py-0.5 text-[10.5px] font-semibold text-[#0F8F62]">
      On track
    </span>
  );
}
