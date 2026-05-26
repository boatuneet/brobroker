"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectMenuOption = {
  label: string;
  value: string;
  meta?: string;
};

export function SelectMenu({
  label,
  value,
  options,
  onChange,
  className,
  buttonClassName,
}: {
  label?: string;
  value: string;
  options: SelectMenuOption[];
  onChange: (value: string) => void;
  className?: string;
  buttonClassName?: string;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className={cn("relative min-w-0", className)} ref={rootRef}>
      {label ? (
        <label
          className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-[#777888]"
          id={`${id}-label`}
        >
          {label}
        </label>
      ) : null}
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-labelledby={label ? `${id}-label ${id}-button` : `${id}-button`}
        className={cn(
          "inline-flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-[#d8d8df] bg-white px-3.5 py-2.5 text-left text-[14px] font-medium text-[#17171c] transition-colors hover:border-[#bfc0c8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c6ee6]",
          open && "border-[#9b60aa] ring-2 ring-[#9b60aa]/15",
          buttonClassName,
        )}
        id={`${id}-button`}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="min-w-0 truncate">{selected?.label ?? "Select"}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-[#777888] transition-transform",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          className="absolute right-0 z-50 mt-2 max-h-72 w-full min-w-[15rem] overflow-auto rounded-xl border border-[#e3e3e8] bg-white p-1.5 shadow-[0_18px_45px_rgba(23,23,28,0.13)]"
          role="listbox"
          aria-labelledby={label ? `${id}-label` : undefined}
        >
          {options.map((option) => {
            const active = option.value === selected?.value;
            return (
              <button
                className={cn(
                  "flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-[#3f3f46] transition-colors hover:bg-[#f5f5f7] focus:bg-[#f5f5f7] focus:outline-none",
                  active && "bg-[#17171c] text-white hover:bg-[#17171c] focus:bg-[#17171c]",
                )}
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                role="option"
                aria-selected={active}
                type="button"
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {active ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{option.label}</span>
                  {option.meta ? (
                    <span
                      className={cn(
                        "mt-0.5 block truncate text-[12px] text-[#777888]",
                        active && "text-white/70",
                      )}
                    >
                      {option.meta}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
