"use client";

import { useState } from "react";
import { ChevronRightIcon, RocketIcon } from "@radix-ui/react-icons";
import { ToastViewport } from "./app-feedback";
import { cn } from "@/lib/utils";

/* Slim sidebar promo entry. Pro tier is not live yet — pressing it shows a
   "coming soon" toast instead of routing to a 404 /pricing page. */
export function GoProButton({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        aria-label={compact ? "Go Pro" : undefined}
        className={cn(
          "relative mb-2 flex w-full items-center overflow-hidden bg-[#171719] text-left text-white transition-colors hover:bg-[#0B4A3F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]",
          compact
            ? "min-h-9 justify-center rounded-[8px] px-2"
            : "min-h-9 gap-2.5 rounded-[8px] px-2.5 py-2",
        )}
        onClick={() => setOpen(true)}
        type="button"
        title="Go Pro"
      >
        <span aria-hidden="true" className="absolute -right-3 -top-2 h-10 w-7 rotate-12 bg-[#003C33] opacity-80" />
        <span aria-hidden="true" className="absolute -right-6 top-3 h-10 w-7 rotate-12 bg-[#003C33] opacity-70" />
        {compact ? (
          <RocketIcon aria-hidden="true" className="relative z-10 size-[17px]" />
        ) : (
          <>
            <span className="relative z-10 min-w-0 flex-1">
              <span className="block text-[12px] font-semibold leading-tight">Go Pro</span>
              <span className="mt-0.5 block text-[10px] leading-3 text-white/70">
                Priority support &amp; full analytics
              </span>
            </span>
            <ChevronRightIcon
              aria-hidden="true"
              className="relative z-10 size-4 shrink-0 text-white/70"
            />
          </>
        )}
      </button>

      <ToastViewport
        message={open ? "Pro tier is coming soon — we'll let you know when it's live." : null}
        onDismiss={() => setOpen(false)}
      />
    </>
  );
}
