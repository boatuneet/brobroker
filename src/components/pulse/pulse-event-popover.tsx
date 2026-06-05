"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  ArrowUpRight,
  Bell,
  CalendarPlus,
  CheckCircle2,
  CircleSlash,
  Mail,
} from "lucide-react";
import type { PulseEvent } from "./pulse-types";
import { formatDate } from "@/lib/utils";

export type PulseEventPopoverProps = {
  anchorRect: DOMRect;
  buyerId: string;
  event: PulseEvent;
  onClose: () => void;
  onMarkDone: () => void;
  onSnooze: (days: number) => void;
  onDismiss: () => void;
};

/* The popover renders in a portal-style fixed layer so it doesn't get clipped
   by the lane row's overflow. Anchored to the dot's bounding rect. */
export function PulseEventPopover({
  anchorRect,
  buyerId,
  event,
  onClose,
  onMarkDone,
  onSnooze,
  onDismiss,
}: PulseEventPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  /* Close on outside click + Esc. */
  useEffect(() => {
    function onPointer(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  /* Position above the dot, clamped to viewport. */
  const popoverWidth = 280;
  const left = clamp(anchorRect.left + anchorRect.width / 2 - popoverWidth / 2, 8, window.innerWidth - popoverWidth - 8);
  /* If there's room above, anchor above; otherwise below. */
  const above = anchorRect.top > 200;
  const top = above ? anchorRect.top - 12 : anchorRect.bottom + 12;
  const transform = above ? "translateY(-100%)" : "none";

  const isDraft = event.origin === "draft";

  return (
    <div
      className="fixed z-[60]"
      ref={ref}
      role="dialog"
      aria-label={`Actions for ${event.label}`}
      style={{ left, top, transform, width: popoverWidth }}
    >
      <div className="overflow-hidden rounded-[12px] border border-[#e3e3e8] bg-white">
        <div className="border-b border-[#E7E7E7] px-3.5 py-3">
          <p className="bb-mono-label text-[#8E918B]">{kindLabel(event.kind)}</p>
          <p className="mt-1 truncate text-[13px] font-semibold text-[#171719]" title={event.label}>
            {event.label}
          </p>
          <p className="mt-0.5 text-[11.5px] text-[#8E918B]">{formatDate(event.date)}</p>
        </div>
        <div className="grid gap-1 p-1.5">
          <ActionItem
            icon={CheckCircle2}
            label="Mark done"
            onClick={() => {
              onMarkDone();
              onClose();
            }}
          />
          <ActionItem
            icon={Bell}
            label="Snooze 2 days"
            onClick={() => {
              onSnooze(2);
              onClose();
            }}
          />
          <ActionItem
            icon={Bell}
            label="Snooze 1 week"
            onClick={() => {
              onSnooze(7);
              onClose();
            }}
          />
          <ActionItem
            icon={CalendarPlus}
            label="Reschedule 2 weeks"
            onClick={() => {
              onSnooze(14);
              onClose();
            }}
          />
          {isDraft ? (
            <Link
              className="flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[13px] font-medium text-[#171719] transition-colors hover:bg-[#F1F2EE]"
              href={`/buyers/${buyerId}#drafts`}
              onClick={onClose}
            >
              <Mail className="h-3.5 w-3.5 text-[#1863dc]" aria-hidden="true" />
              Approve &amp; send
              <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-[#8E918B]" aria-hidden="true" />
            </Link>
          ) : null}
          <ActionItem
            icon={CircleSlash}
            label="Dismiss"
            tone="danger"
            onClick={() => {
              onDismiss();
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}

function ActionItem({
  icon: Icon,
  label,
  onClick,
  tone = "neutral",
}: {
  icon: typeof CheckCircle2;
  label: string;
  onClick: () => void;
  tone?: "neutral" | "danger";
}) {
  return (
    <button
      className={
        "flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[13px] font-medium transition-colors " +
        (tone === "danger"
          ? "text-[#A86642] hover:bg-[#F0DDD0]"
          : "text-[#171719] hover:bg-[#F1F2EE]")
      }
      onClick={onClick}
      type="button"
    >
      <Icon
        aria-hidden="true"
        className={
          "h-3.5 w-3.5 " + (tone === "danger" ? "text-[#A86642]" : "text-[#003C33]")
        }
      />
      {label}
    </button>
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
