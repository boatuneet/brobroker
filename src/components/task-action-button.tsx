"use client";

import { useCallback, useSyncExternalStore } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { mirrorWorkflowEvent, readPersisted, writePersisted } from "@/lib/browser-persistence";
import { Button } from "./ui";

const STORAGE_KEY = "brobroker:dashboard:completed-tasks";
const COMPLETED_CHANGED = "brobroker:dashboard:completed-tasks:changed";

// Stable empty array reference for the SSR snapshot so React's
// useSyncExternalStore is happy (no new reference per render).
const EMPTY_IDS: string[] = [];

// Cache the parsed snapshot so getClientSnapshot returns a stable reference
// until the underlying localStorage payload actually changes. Without this,
// useSyncExternalStore would see a new array each render and warn.
let cachedRaw: string | null = null;
let cachedSnapshot: string[] = EMPTY_IDS;

function subscribe(notify: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("storage", notify);
  window.addEventListener(COMPLETED_CHANGED, notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(COMPLETED_CHANGED, notify);
  };
}

function getClientSnapshot(): string[] {
  if (typeof window === "undefined") return EMPTY_IDS;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedSnapshot;
  cachedRaw = raw;
  cachedSnapshot = readPersisted<string[]>(STORAGE_KEY, EMPTY_IDS);
  return cachedSnapshot;
}

function getServerSnapshot(): string[] {
  return EMPTY_IDS;
}

export function TaskActionButton({
  taskId,
  label,
}: {
  taskId: string;
  label: string;
}) {
  // useSyncExternalStore renders the server snapshot during SSR + first
  // client render, then switches to the live localStorage snapshot. This
  // keeps SSR and the first client paint identical (no hydration mismatch)
  // while still reflecting persisted state.
  const completedIds = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );
  const isDone = completedIds.includes(taskId);

  const completeTask = useCallback(() => {
    const next = [...new Set([taskId, ...completedIds])];
    writePersisted(STORAGE_KEY, next);
    mirrorWorkflowEvent("dashboard_task_completed", taskId, { taskId });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(COMPLETED_CHANGED));
    }
  }, [taskId, completedIds]);

  return (
    <Button
      className="self-start md:self-auto"
      disabled={isDone}
      onClick={completeTask}
      size="sm"
      type="button"
      variant="secondary"
    >
      {isDone ? (
        <>
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          Done
        </>
      ) : (
        <>
          {label}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </>
      )}
    </Button>
  );
}
