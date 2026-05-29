"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { ToastViewport } from "./app-feedback";

/* Slim sidebar promo entry. Pro tier is not live yet — pressing it shows a
   "coming soon" toast instead of routing to a 404 /pricing page. */
export function GoProButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="relative mb-2 flex w-full items-center gap-3 overflow-hidden rounded-[14px] bg-[#171719] px-3.5 py-3 text-left text-white transition-colors hover:bg-[#0B4A3F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]"
        onClick={() => setOpen(true)}
        type="button"
      >
        <span aria-hidden="true" className="absolute -right-3 -top-2 h-10 w-7 rotate-12 bg-[#003C33] opacity-80" />
        <span aria-hidden="true" className="absolute -right-6 top-3 h-10 w-7 rotate-12 bg-[#003C33] opacity-70" />
        <span className="relative z-10 min-w-0 flex-1">
          <span className="block text-[13px] font-semibold leading-tight">Go Pro</span>
          <span className="mt-0.5 block text-[11px] leading-4 text-white/70">
            Priority support &amp; full analytics
          </span>
        </span>
        <ChevronRight
          aria-hidden="true"
          className="relative z-10 h-4 w-4 shrink-0 text-white/70"
        />
      </button>

      <ToastViewport
        message={open ? "Pro tier is coming soon — we'll let you know when it's live." : null}
        onDismiss={() => setOpen(false)}
      />
    </>
  );
}
