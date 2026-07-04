import { CalendarClock, CheckCircle2, CircleAlert, FileText, MessageSquareText, Users } from "lucide-react";
import {
  buildEventsForBuyer,
  buildWindow,
  positionPercent,
  todayPercent,
  type PulseEvent,
} from "@/components/pulse/pulse-types";
import type {
  BrokerTask,
  BuyerProfile,
  Conversation,
  FollowUpDraft,
} from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

/* Per-buyer horizontal timeline. Reuses pulse-types helpers so the visual
   language matches whatever else drives Today. Renders both:
     - horizontal axis with dots (-7d ... today ... +30d)
     - reverse-chronological list below so data is readable without hovering.
   No forecast / weighted KPIs — this is a factual history + upcoming view. */

export function BuyerTimeline({
  buyer,
  tasks,
  conversations,
  drafts,
}: {
  buyer: BuyerProfile;
  tasks: BrokerTask[];
  conversations: Conversation[];
  drafts: FollowUpDraft[];
}) {
  const window = buildWindow(false);
  const events = buildEventsForBuyer(buyer, tasks, conversations, drafts);
  const positioned = events
    .map((event) => ({
      event,
      percent: positionPercent(event.date, window),
    }))
    // Only render dots inside the window. The list below still shows everything.
    .filter((entry) => entry.percent >= 0 && entry.percent <= 100);
  const nowPct = todayPercent(window);

  const sorted = [...events].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  if (events.length === 0) {
    return (
      <div className="px-6 py-10 text-center">
        <CalendarClock className="mx-auto h-6 w-6 text-[#A9ABA5]" aria-hidden="true" />
        <p className="mt-3 text-[13px] text-[#5F625E]">
          No timeline events yet. As you log conversations and set follow-ups they'll appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 px-6 py-5">
      <section aria-label="Timeline axis">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8E918B]">
          <span>-7d</span>
          <span>Today</span>
          <span>+30d</span>
        </div>
        <div className="relative mt-3 h-16 rounded-[12px] border border-[#E7E7E7] bg-white">
          {/* Baseline */}
          <div className="absolute left-4 right-4 top-1/2 h-px -translate-y-1/2 bg-[#E7E7E7]" />
          {/* Today marker */}
          <div
            aria-hidden="true"
            className="absolute top-1 bottom-1 w-px bg-[#003C33]"
            style={{ left: `calc(${clampPct(nowPct)}% + 0px)` }}
          />
          {/* Dots */}
          {positioned.map(({ event, percent }) => (
            <TimelineDot
              key={event.id}
              event={event}
              leftPercent={clampPct(percent)}
            />
          ))}
        </div>
      </section>

      <section aria-label="Event log">
        <p className="bb-mono-label">Event log</p>
        <ol className="mt-3 divide-y divide-[#E7E7E7] rounded-[12px] border border-[#E7E7E7] bg-white">
          {sorted.map((event) => (
            <TimelineListRow key={event.id} event={event} />
          ))}
        </ol>
      </section>
    </div>
  );
}

function clampPct(value: number) {
  return Math.max(2, Math.min(98, value));
}

function TimelineDot({ event, leftPercent }: { event: PulseEvent; leftPercent: number }) {
  const color = toneColor(event.tone);
  return (
    <div
      className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${leftPercent}%` }}
    >
      <span
        aria-label={`${event.label} on ${formatDate(event.date)}`}
        className={cn(
          "block h-3 w-3 rounded-full border-2 border-white",
          color.bg,
        )}
        style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.05)" }}
      />
      <div
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-[220px] -translate-x-1/2 rounded-[10px] border border-[#E7E7E7] bg-white p-3 opacity-0 shadow-[0_12px_32px_rgba(23,31,25,0.14)] transition-opacity duration-150 group-hover:opacity-100"
      >
        <p className="text-[12px] font-semibold text-[#171719]">{event.label}</p>
        <p className="mt-1 text-[11.5px] uppercase tracking-[0.12em] text-[#8E918B]">
          {formatDate(event.date)} · {event.tone}
        </p>
        {event.detail ? (
          <p className="mt-1.5 text-[12px] leading-[1.5] text-[#5F625E]">{event.detail}</p>
        ) : null}
      </div>
    </div>
  );
}

function TimelineListRow({ event }: { event: PulseEvent }) {
  const Icon = kindIcon(event.kind, event.origin);
  const color = toneColor(event.tone);
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span
        className={cn(
          "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
          color.border,
          color.tint,
        )}
      >
        <Icon aria-hidden="true" className={cn("h-3.5 w-3.5", color.text)} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-[#171719]">{event.label}</p>
        {event.detail ? (
          <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-[1.5] text-[#5F625E]">
            {event.detail}
          </p>
        ) : null}
      </div>
      <p className="shrink-0 text-[11px] font-medium uppercase tracking-[0.12em] text-[#8E918B]">
        {formatDate(event.date)}
      </p>
    </li>
  );
}

function kindIcon(kind: PulseEvent["kind"], origin: PulseEvent["origin"]) {
  if (origin === "conversation") return MessageSquareText;
  if (origin === "draft") return FileText;
  if (kind === "viewing") return Users;
  if (kind === "verification") return CircleAlert;
  if (kind === "document") return FileText;
  if (kind === "matching") return CheckCircle2;
  return CalendarClock;
}

function toneColor(tone: PulseEvent["tone"]) {
  switch (tone) {
    case "overdue":
      return {
        bg: "bg-[#A86642]",
        border: "border-[#F0DDD0]",
        tint: "bg-[#F0DDD0]/50",
        text: "text-[#A86642]",
      };
    case "urgent":
      return {
        bg: "bg-[#A86642]",
        border: "border-[#F0DDD0]",
        tint: "bg-[#F0DDD0]/40",
        text: "text-[#A86642]",
      };
    case "scheduled":
      return {
        bg: "bg-[#003C33]",
        border: "border-[#E2ECE9]",
        tint: "bg-[#E2ECE9]/40",
        text: "text-[#003C33]",
      };
    case "done":
      return {
        bg: "bg-[#0F8F62]",
        border: "border-[#E1F1EA]",
        tint: "bg-[#E1F1EA]/40",
        text: "text-[#0F8F62]",
      };
    case "dormant":
      return {
        bg: "bg-[#8E918B]",
        border: "border-[#E7E7E7]",
        tint: "bg-white",
        text: "text-[#8E918B]",
      };
    default:
      return {
        bg: "bg-[#5F625E]",
        border: "border-[#E7E7E7]",
        tint: "bg-white",
        text: "text-[#5F625E]",
      };
  }
}
