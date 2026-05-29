import Link from "next/link";
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

/* Compact preview of the Pulse swimlanes for the dashboard. Renders the
   most urgent N buyers with mini-lanes, no popovers, no scrub. Click-through
   to the full /pulse view via the header link or per-row link. */
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
          <p className="bb-mono-label">Pulse</p>
          <p className="bb-display mt-1.5 text-lg font-medium text-[#171719]">
            Top deals on the timeline
          </p>
        </div>
        <div className="flex items-center gap-3">
          {needsMe > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F0DDD0] px-2.5 py-1 text-[11.5px] font-semibold text-[#A86642]">
              <Flame aria-hidden="true" className="h-3 w-3" />
              Needs me · {needsMe}
            </span>
          ) : null}
          <Link
            className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[#171719] hover:underline"
            href="/pulse"
          >
            Open Pulse <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <PreviewAxis window={window} />

      {sorted.length === 0 ? (
        <p className="mt-3 text-[12.5px] text-[#8E918B]">
          No active deals to surface yet.
        </p>
      ) : (
        <ul className="mt-1 divide-y divide-[#E7E7E2]">
          {sorted.map((lane) => (
            <li key={lane.buyer.id}>
              <PreviewRow lane={lane} window={window} />
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
    <div className="mt-5 grid grid-cols-[140px_minmax(0,1fr)_92px] items-center gap-3 border-b border-[#E7E7E2] pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8E918B]">
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
}: {
  lane: BuyerLane;
  window: Window;
}) {
  const { buyer, events, primary, health } = lane;
  const todayPct = todayPercent(window);
  const stageStart = Math.max(
    window.startMs,
    new Date(buyer.lastContactedAt ?? DEMO_NOW).getTime() - 21 * 86_400_000,
  );
  const stageStartPct = ((stageStart - window.startMs) / window.spanMs) * 100;

  return (
    <Link
      className="group grid grid-cols-[140px_minmax(0,1fr)_92px] items-center gap-3 py-2.5 transition-colors hover:bg-[#F1F2EE]"
      href={`/pulse?focus=${buyer.id}`}
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
        <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-[#E7E7E2]" />
        <div
          className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-[#E7EFEA]"
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
            <span
              aria-hidden="true"
              className={cn(
                "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white",
                TONE_DOT[event.tone],
                isPrimary ? "h-2.5 w-2.5 ring-[2.5px]" : "h-2 w-2",
              )}
              key={event.id}
              style={{ left: `${pct}%` }}
              title={`${event.label} · ${formatDate(event.date)}`}
            />
          );
        })}
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
      <span className="inline-flex items-center rounded-full bg-[#F0DDD0] px-2 py-0.5 text-[10.5px] font-semibold text-[#A86642]">
        Overdue {Math.abs(daysUntil(primary.date))}d
      </span>
    );
  }
  if (health === "urgent" && primary) {
    const days = daysUntil(primary.date);
    return (
      <span className="inline-flex items-center rounded-full bg-[#F0DDD0] px-2 py-0.5 text-[10.5px] font-semibold text-[#A86642]">
        {days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `${days}d`}
      </span>
    );
  }
  if (health === "dormant") {
    return (
      <span className="inline-flex items-center rounded-full bg-[#F1F2EE] px-2 py-0.5 text-[10.5px] font-semibold text-[#8E918B]">
        Dormant {contactDays}d
      </span>
    );
  }
  if (health === "scheduled" && primary) {
    return (
      <span className="inline-flex items-center rounded-full bg-[#E0ECF2] px-2 py-0.5 text-[10.5px] font-semibold text-[#3D6F8F]">
        In {daysUntil(primary.date)}d
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-[#E1F1EA] px-2 py-0.5 text-[10.5px] font-semibold text-[#0F8F62]">
      On track
    </span>
  );
}
