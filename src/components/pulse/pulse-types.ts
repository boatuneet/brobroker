import type {
  BrokerTask,
  BuyerProfile,
  Conversation,
  FollowUpDraft,
} from "@/lib/types";
import { daysUntil } from "@/lib/utils";

/* Demo "now" — matches utils.ts daysUntil() default so derived dates align. */
export const DEMO_NOW = new Date("2026-05-24T09:00:00+03:00");

export const STAGES: BuyerProfile["currentStage"][] = [
  "New Inquiry",
  "Qualified",
  "Shortlist Sent",
  "Viewing Planned",
  "Negotiation",
];

/* Stage-weighted forecast multipliers (sales-style). Tune later from the
   broker's own conversion history once we track stage transitions. */
export const STAGE_FORECAST_WEIGHTS: Record<BuyerProfile["currentStage"], number> = {
  "New Inquiry": 0.1,
  Qualified: 0.25,
  "Shortlist Sent": 0.45,
  "Viewing Planned": 0.65,
  Negotiation: 0.85,
};

export type TrackKind =
  | "pipeline"
  | "verification"
  | "viewing"
  | "communication"
  | "document"
  | "matching";

export type EventTone =
  | "overdue"
  | "urgent"
  | "scheduled"
  | "done"
  | "info"
  | "dormant";

export type PulseEvent = {
  id: string;
  kind: TrackKind;
  label: string;
  detail?: string;
  /** ISO date string. */
  date: string;
  /** Whether the event already happened. */
  past: boolean;
  tone: EventTone;
  /** True if the event is an actionable task / draft / pipeline next-action;
      false for read-only history (conversations, last-touch). */
  actionable: boolean;
  /** Original task / draft kind for the action popover. */
  origin: "task" | "draft" | "conversation" | "pipeline" | "last-touch";
};

export type BuyerLane = {
  buyer: BuyerProfile;
  events: PulseEvent[];
  primary: PulseEvent | null;
  primaryDelta: number;
  health: "overdue" | "urgent" | "on-track" | "scheduled" | "dormant";
  daysSinceContact: number;
};

export type Window = { startMs: number; endMs: number; spanMs: number };

/* -----------------------------------------------------------------------------
 * Pure helpers
 * -------------------------------------------------------------------------- */

export function classifyTone(date: string): EventTone {
  const delta = daysUntil(date);
  if (delta < 0) return "overdue";
  if (delta <= 2) return "urgent";
  if (delta <= 30) return "scheduled";
  return "info";
}

export function buildWindow(extended: boolean): Window {
  const back = extended ? 30 : 7;
  const ahead = extended ? 90 : 30;
  const start = new Date(DEMO_NOW);
  start.setDate(start.getDate() - back);
  const end = new Date(DEMO_NOW);
  end.setDate(end.getDate() + ahead);
  return {
    startMs: start.getTime(),
    endMs: end.getTime(),
    spanMs: end.getTime() - start.getTime(),
  };
}

export function positionPercent(date: string, window: Window): number {
  const ms = new Date(date).getTime();
  if (!Number.isFinite(ms)) return -1;
  return ((ms - window.startMs) / window.spanMs) * 100;
}

export function todayPercent(window: Window): number {
  return ((DEMO_NOW.getTime() - window.startMs) / window.spanMs) * 100;
}

export function mapTaskKind(kind: BrokerTask["kind"]): TrackKind {
  if (kind === "Viewing") return "viewing";
  if (kind === "Verification") return "verification";
  if (kind === "Document") return "document";
  if (kind === "Matching") return "matching";
  return "communication";
}

export function nextStageOf(stage: BuyerProfile["currentStage"]): string | null {
  const idx = STAGES.indexOf(stage);
  if (idx < 0 || idx >= STAGES.length - 1) return null;
  return STAGES[idx + 1];
}

/* Build the raw event list for a buyer. Action overlay is applied separately
   so that mark-done / snooze can adjust dates and tones in-memory. */
export function buildEventsForBuyer(
  buyer: BuyerProfile,
  tasks: BrokerTask[],
  conversations: Conversation[],
  drafts: FollowUpDraft[],
): PulseEvent[] {
  const out: PulseEvent[] = [];

  if (buyer.nextActionDueAt) {
    out.push({
      id: `${buyer.id}-next-action`,
      kind: "pipeline",
      label: `Move to ${nextStageOf(buyer.currentStage) ?? "close"}`,
      detail: `Currently ${buyer.currentStage}`,
      date: buyer.nextActionDueAt,
      past: daysUntil(buyer.nextActionDueAt) < 0,
      tone: classifyTone(buyer.nextActionDueAt),
      actionable: true,
      origin: "pipeline",
    });
  }
  if (buyer.lastContactedAt) {
    out.push({
      id: `${buyer.id}-last-touch`,
      kind: "communication",
      label: "Last contact",
      detail: buyer.currentStage,
      date: buyer.lastContactedAt,
      past: true,
      tone: "done",
      actionable: false,
      origin: "last-touch",
    });
  }

  for (const task of tasks) {
    if (task.buyerId !== buyer.id) continue;
    if (task.status === "Done") continue;
    out.push({
      id: task.id,
      kind: mapTaskKind(task.kind),
      label: task.title,
      detail: task.actionLabel,
      date: task.dueAt,
      past: daysUntil(task.dueAt) < 0,
      tone: classifyTone(task.dueAt),
      actionable: true,
      origin: "task",
    });
  }

  for (const conversation of conversations) {
    if (conversation.buyerId !== buyer.id) continue;
    out.push({
      id: conversation.id,
      kind: "communication",
      label: `${conversation.channel} · ${conversation.sentiment}`,
      detail: conversation.summary,
      date: conversation.occurredAt,
      past: true,
      tone: conversation.needsSummary ? "urgent" : "done",
      actionable: false,
      origin: "conversation",
    });
  }

  for (const draft of drafts) {
    if (draft.buyerId !== buyer.id) continue;
    if (draft.status === "Approved") continue;
    out.push({
      id: draft.id,
      kind: "communication",
      label: `Draft · ${draft.subject}`,
      detail: `${draft.channel} · ${draft.status}`,
      date: DEMO_NOW.toISOString(),
      past: false,
      tone: "urgent",
      actionable: true,
      origin: "draft",
    });
  }

  return out;
}

export function pickPrimary(events: PulseEvent[]): PulseEvent | null {
  if (!events.length) return null;
  const actionable = events.filter(
    (e) =>
      e.actionable &&
      (e.tone === "overdue" || e.tone === "urgent" || e.tone === "scheduled"),
  );
  const sorted = (actionable.length ? actionable : events)
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const overdue = sorted.filter((e) => e.tone === "overdue");
  if (overdue.length) return overdue[0];
  const upcoming = sorted.filter((e) => !e.past);
  if (upcoming.length) return upcoming[0];
  return sorted[0];
}

export function deriveHealth(
  primary: PulseEvent | null,
  daysSinceContact: number,
): BuyerLane["health"] {
  if (primary?.tone === "overdue") return "overdue";
  if (primary?.tone === "urgent") return "urgent";
  if (daysSinceContact >= 14 && (!primary || primary.tone === "info"))
    return "dormant";
  if (primary?.tone === "scheduled") return "scheduled";
  return "on-track";
}

export function midpointBudget(buyer: BuyerProfile): number {
  if (!buyer.budgetMinEur && !buyer.budgetMaxEur) return 0;
  if (!buyer.budgetMaxEur) return buyer.budgetMinEur;
  if (!buyer.budgetMinEur) return buyer.budgetMaxEur;
  return Math.round((buyer.budgetMinEur + buyer.budgetMaxEur) / 2);
}

export function formatCompactEur(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "€0";
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `€${Math.round(value / 1_000)}k`;
  return `€${Math.round(value)}`;
}
