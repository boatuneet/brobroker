"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CalendarIcon } from "@radix-ui/react-icons";
import { Calendar } from "@/components/calendar";
import { cn } from "@/lib/utils";

type DatePickerProps = {
  className?: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
};

export function DatePicker({ className, label, onChange, value }: DatePickerProps) {
  const id = useId();
  const rootRef = useRef<HTMLLabelElement>(null);
  const [open, setOpen] = useState(false);
  const selected = parseDateValue(value);
  const displayValue = selected ? formatDisplayDate(selected) : "";

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <label className={cn("relative grid gap-1.5", className)} ref={rootRef}>
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#8E918B]">
        {label}
      </span>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "inline-flex h-10 min-h-10 w-full items-center justify-start gap-2.5 rounded-[8px] border border-[#D9DAD4] bg-white px-3 text-left text-[14px] font-normal text-[#171719] outline-none transition-colors hover:border-[#A9ABA5] focus-visible:border-[#003C33] focus-visible:ring-2 focus-visible:ring-[#003C33]/15",
          !value && "text-[#A9ABA5]",
        )}
        id={id}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <CalendarIcon className="h-4 w-4 shrink-0 text-[#8E918B]" aria-hidden="true" />
        <span>{displayValue || "Pick a date"}</span>
      </button>
      {open ? (
        <div
          aria-label={`${label} calendar`}
          className="absolute left-0 top-[calc(100%+8px)] z-50"
          role="dialog"
        >
          <Calendar
            captionLayout="dropdown"
            className="rounded-[8px]"
            key={value || "empty"}
            mode="single"
            onSelect={(nextDate) => {
              onChange(nextDate ? formatDateValue(nextDate) : "");
              setOpen(false);
            }}
            selected={selected}
          />
        </div>
      ) : null}
    </label>
  );
}

function parseDateValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
