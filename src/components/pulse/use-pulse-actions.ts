"use client";

import { useCallback, useEffect, useState } from "react";
import { readPersisted, writePersisted } from "@/lib/browser-persistence";
import type { PulseEvent } from "./pulse-types";

/* localStorage shape — keep simple, versioned by key so we can evolve. */
const ACTIONS_KEY = "brobroker:pulse:actions:v1";
const LAST_VISIT_KEY = "brobroker:pulse:lastVisit:v1";

export type PulseActionKind = "done" | "snoozed" | "rescheduled" | "dismissed";

export type PulseActionEntry = {
  eventId: string;
  buyerId: string;
  buyerName: string;
  eventLabel: string;
  /** done = mark complete, snoozed/rescheduled = new dueAt, dismissed = hide */
  action: PulseActionKind;
  /** ISO timestamp when the action was taken. */
  at: string;
  /** Optional new dueAt for snoozed / rescheduled. */
  newDate?: string;
};

export type PulseActionState = {
  log: PulseActionEntry[];
  /** Quick lookup by eventId — last action wins. */
  byEvent: Map<string, PulseActionEntry>;
};

function buildState(log: PulseActionEntry[]): PulseActionState {
  const byEvent = new Map<string, PulseActionEntry>();
  /* Apply chronologically so the latest action for an event overrides earlier ones. */
  const sorted = log.slice().sort((a, b) => a.at.localeCompare(b.at));
  for (const entry of sorted) byEvent.set(entry.eventId, entry);
  return { log: sorted, byEvent };
}

export function usePulseActions() {
  /* Lazy init reads localStorage during the first render. readPersisted is
     SSR-safe (returns fallback when window is undefined), so SSR sees empty
     and the first client render swaps in the persisted state. Matches the
     codebase convention used in reports-workspace.tsx. */
  const [state, setState] = useState<PulseActionState>(() =>
    buildState(readPersisted<PulseActionEntry[]>(ACTIONS_KEY, [])),
  );
  const [lastVisitAt] = useState<string | null>(() =>
    readPersisted<string | null>(LAST_VISIT_KEY, null),
  );

  /* Side-effect only: record this visit after mount. No setState cascade
     because lastVisitAt was already captured at render time. */
  useEffect(() => {
    writePersisted(LAST_VISIT_KEY, new Date().toISOString());
  }, []);

  const recordAction = useCallback(
    (entry: Omit<PulseActionEntry, "at"> & { at?: string }) => {
      const full: PulseActionEntry = {
        ...entry,
        at: entry.at ?? new Date().toISOString(),
      };
      setState((current) => {
        const nextLog = [...current.log, full].slice(-200); // cap log
        writePersisted(ACTIONS_KEY, nextLog);
        return buildState(nextLog);
      });
    },
    [],
  );

  const markDone = useCallback(
    (event: PulseEvent, buyerId: string, buyerName: string) =>
      recordAction({
        eventId: event.id,
        buyerId,
        buyerName,
        eventLabel: event.label,
        action: "done",
      }),
    [recordAction],
  );

  const snooze = useCallback(
    (
      event: PulseEvent,
      buyerId: string,
      buyerName: string,
      days: number,
    ) => {
      const base = new Date(event.date);
      const today = new Date();
      const from = base.getTime() > today.getTime() ? base : today;
      const newDate = new Date(from);
      newDate.setDate(newDate.getDate() + days);
      recordAction({
        eventId: event.id,
        buyerId,
        buyerName,
        eventLabel: event.label,
        action: "snoozed",
        newDate: newDate.toISOString(),
      });
    },
    [recordAction],
  );

  const reschedule = useCallback(
    (
      event: PulseEvent,
      buyerId: string,
      buyerName: string,
      newDate: string,
    ) =>
      recordAction({
        eventId: event.id,
        buyerId,
        buyerName,
        eventLabel: event.label,
        action: "rescheduled",
        newDate,
      }),
    [recordAction],
  );

  const dismiss = useCallback(
    (event: PulseEvent, buyerId: string, buyerName: string) =>
      recordAction({
        eventId: event.id,
        buyerId,
        buyerName,
        eventLabel: event.label,
        action: "dismissed",
      }),
    [recordAction],
  );

  const undo = useCallback(
    (eventId: string) => {
      setState((current) => {
        const nextLog = current.log.filter((entry) => entry.eventId !== eventId);
        writePersisted(ACTIONS_KEY, nextLog);
        return buildState(nextLog);
      });
    },
    [],
  );

  return {
    state,
    lastVisitAt,
    markDone,
    snooze,
    reschedule,
    dismiss,
    undo,
  };
}

/* Apply the action overlay to a single event. Returns null if dismissed. */
export function applyActionOverlay(
  event: PulseEvent,
  byEvent: Map<string, PulseActionEntry>,
): PulseEvent | null {
  const entry = byEvent.get(event.id);
  if (!entry) return event;
  if (entry.action === "dismissed") return null;
  if (entry.action === "done") {
    return {
      ...event,
      past: true,
      tone: "done",
      actionable: false,
      detail: event.detail ? `${event.detail} · marked done` : "Marked done",
    };
  }
  if ((entry.action === "snoozed" || entry.action === "rescheduled") && entry.newDate) {
    const newDate = entry.newDate;
    return {
      ...event,
      date: newDate,
      past: false,
      tone: relativeTone(newDate),
      detail: event.detail
        ? `${event.detail} · ${entry.action === "snoozed" ? "snoozed" : "rescheduled"}`
        : entry.action === "snoozed"
          ? "Snoozed"
          : "Rescheduled",
    };
  }
  return event;
}

function relativeTone(date: string): PulseEvent["tone"] {
  const ms = new Date(date).getTime();
  const now = Date.now();
  const days = (ms - now) / 86_400_000;
  if (days < 0) return "overdue";
  if (days <= 2) return "urgent";
  return "scheduled";
}
