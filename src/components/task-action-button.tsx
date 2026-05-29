"use client";

import Link from "next/link";
import { useCallback, useSyncExternalStore } from "react";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { mirrorWorkflowEvent, readPersisted, writePersisted } from "@/lib/browser-persistence";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "brobroker:dashboard:completed-tasks";
const COMPLETED_CHANGED = "brobroker:dashboard:completed-tasks:changed";

// Stable empty array reference for the SSR snapshot so React's
// useSyncExternalStore is happy (no new reference per render).
const EMPTY_IDS: string[] = [];

// Cache the parsed snapshot so getClientSnapshot returns a stable reference
// until the underlying localStorage payload actually changes.
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

/* The primary "action" button on the focal task card.
   - When `href` is provided, the button navigates to the relevant workspace
     (matcher, verification, voice-crm, etc.) — actually doing what its label
     says, e.g. "Open matcher". A small mark-done toggle sits beside it so the
     broker can flag completion without conflating the two intents.
   - When no href is provided, the button falls back to a pure mark-done
     toggle (legacy behaviour). */
export function TaskActionButton({
  href,
  label,
  taskId,
}: {
  href?: string;
  label: string;
  taskId: string;
}) {
  const completedIds = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );
  const isDone = completedIds.includes(taskId);

  const toggleDone = useCallback(() => {
    const next = isDone
      ? completedIds.filter((id) => id !== taskId)
      : [...new Set([taskId, ...completedIds])];
    writePersisted(STORAGE_KEY, next);
    mirrorWorkflowEvent(
      isDone ? "dashboard_task_reopened" : "dashboard_task_completed",
      taskId,
      { taskId },
    );
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(COMPLETED_CHANGED));
    }
  }, [completedIds, isDone, taskId]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {href ? (
        <Link
          className={cn(
            "inline-flex min-h-10 items-center gap-2 rounded-full px-5 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2EADC]",
            "bg-[#F2EADC] text-[#003C33] hover:bg-white",
          )}
          href={href}
        >
          {label}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      ) : (
        <button
          className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#F2EADC] px-5 text-[13px] font-medium text-[#003C33] transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2EADC]"
          onClick={toggleDone}
          type="button"
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
        </button>
      )}

      {href ? (
        <button
          aria-label={isDone ? "Mark as not done" : "Mark as done"}
          aria-pressed={isDone}
          className={cn(
            "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2EADC]",
            isDone
              ? "border-transparent bg-[#0F8F62]/15 text-[#E1F1EA] hover:bg-[#0F8F62]/25"
              : "border-white/15 bg-transparent text-[#F2EADC]/75 hover:border-white/30 hover:text-white",
          )}
          onClick={toggleDone}
          type="button"
        >
          {isDone ? (
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Circle className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {isDone ? "Done" : "Mark done"}
        </button>
      ) : null}
    </div>
  );
}
