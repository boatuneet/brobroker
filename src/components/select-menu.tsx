"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon } from "@radix-ui/react-icons";
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
  disabled = false,
}: {
  label?: string;
  value: string;
  options: SelectMenuOption[];
  onChange: (value: string) => void;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
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
          className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-[#8E918B]"
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
          "inline-flex min-h-11 w-full items-center justify-between gap-3 rounded-[10px] border border-[#D9DAD4] bg-white px-3.5 py-2.5 text-left text-[14px] font-medium text-[#171719] transition-colors hover:border-[#A9ABA5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c6ee6]",
          open && "border-[#003C33] ring-2 ring-[#003C33]/15",
          disabled && "cursor-not-allowed bg-[#F6F6F4] text-[#A9ABA5] hover:border-[#D9DAD4]",
          buttonClassName,
        )}
        disabled={disabled}
        id={`${id}-button`}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="min-w-0 truncate">{selected?.label ?? "Select"}</span>
        <ChevronDownIcon
          className={cn(
            "h-4 w-4 shrink-0 text-[#8E918B] transition-transform",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {open && !disabled ? (
        <div
          className="absolute right-0 z-50 mt-2 max-h-72 w-full min-w-[15rem] overflow-auto rounded-[10px] border border-[#E7E7E7] bg-white p-1.5"
          role="listbox"
          aria-labelledby={label ? `${id}-label` : undefined}
        >
          {options.map((option) => {
            const active = option.value === selected?.value;
            return (
              <button
                className={cn(
                  "flex min-h-10 w-full items-center gap-3 rounded-[8px] px-3 py-2 text-left text-sm transition-colors focus:outline-none",
                  active
                    ? "bg-[#171719] text-white hover:bg-[#171719] focus:bg-[#171719]"
                    : "text-[#5F625E] hover:bg-[#F1F2EE] focus:bg-[#F1F2EE]",
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
                  {active ? <CheckIcon className="h-4 w-4" aria-hidden="true" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{option.label}</span>
                  {option.meta ? (
                    <span
                      className={cn(
                        "mt-0.5 block truncate text-[12px] text-[#8E918B]",
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
