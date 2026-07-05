"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlarmClockPlus, Check } from "lucide-react";
import { completeTask, snoozeTask } from "@/lib/supabase/task-actions";
import { cn } from "@/lib/utils";

/* Done + snooze controls for Today's task hero and queue rows — the piece
   that turns the dashboard from a reading surface into a working one.

   Stored tasks: mutate Supabase then router.refresh() so the server
   re-renders the list without the task (or with the new due date).
   Demo tasks (isStored=false): the mutation no-ops server-side, so we keep
   a local "done/snoozed" state for the session — demo data resets on
   reload by design. */
export function TaskQuickActions({
  taskId,
  isStored,
  compact = false,
}: {
  taskId: string;
  isStored: boolean;
  /* compact = icon-only buttons for queue rows; full = labeled buttons for
     the hero card. */
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localState, setLocalState] = useState<"idle" | "done" | "snoozed">("idle");
  const [error, setError] = useState<string | null>(null);

  async function run(action: "done" | "snooze") {
    setError(null);
    const result = action === "done" ? await completeTask(taskId) : await snoozeTask(taskId, 3);
    if (!result.ok) {
      setError(result.error ?? "Could not update the task.");
      return;
    }
    if (isStored) {
      startTransition(() => router.refresh());
    } else {
      setLocalState(action === "done" ? "done" : "snoozed");
    }
  }

  if (localState === "done") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#0F8F62]">
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
        Done
      </span>
    );
  }
  if (localState === "snoozed") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#8E918B]">
        <AlarmClockPlus className="h-3.5 w-3.5" aria-hidden="true" />
        Snoozed 3d
      </span>
    );
  }

  const iconBtn =
    "inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#D9DAD4] bg-white text-[#5F625E] transition-colors hover:border-[#003C33] hover:text-[#003C33] hover:bg-[#F1F2EE] disabled:pointer-events-none disabled:opacity-50";
  const labelBtn =
    "inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[#D9DAD4] bg-white px-4 text-[13px] font-medium text-[#171719] transition-colors hover:border-[#003C33] hover:bg-[#F1F2EE] disabled:pointer-events-none disabled:opacity-50";

  return (
    <span className="inline-flex items-center gap-2">
      <button
        aria-label="Mark task done"
        className={cn(compact ? iconBtn : labelBtn)}
        disabled={pending}
        onClick={() => run("done")}
        title="Mark done"
        type="button"
      >
        <Check className={compact ? "h-4 w-4" : "h-4 w-4"} aria-hidden="true" />
        {compact ? null : "Mark done"}
      </button>
      <button
        aria-label="Snooze task 3 days"
        className={cn(compact ? iconBtn : labelBtn)}
        disabled={pending}
        onClick={() => run("snooze")}
        title="Snooze 3 days"
        type="button"
      >
        <AlarmClockPlus className="h-4 w-4" aria-hidden="true" />
        {compact ? null : "Snooze 3d"}
      </button>
      {error ? <span className="text-[11px] text-[#A4361C]">{error}</span> : null}
    </span>
  );
}
