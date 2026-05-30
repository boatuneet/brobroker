"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { persistDemoMode } from "@/lib/demo-mode-client";
import { cn } from "@/lib/utils";

/* Switch the broker between "demo + real data" and "real data only". The
   preference lives in a cookie (see lib/demo-mode-*); after toggling we
   refresh so server components re-read and the dashboard / pulse reflect
   the new mode immediately. */
export function DemoModeToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  function onToggle() {
    const next = !enabled;
    setEnabled(next); // optimistic
    startTransition(async () => {
      await persistDemoMode(next);
      router.refresh();
    });
  }

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-semibold text-[#171719]">Demo data</p>
        <button
          aria-checked={enabled}
          aria-label="Toggle demo data"
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]",
            enabled ? "bg-[#003C33]" : "bg-[#D9DAD4]",
          )}
          disabled={pending}
          onClick={onToggle}
          role="switch"
          type="button"
        >
          <span
            aria-hidden="true"
            className={cn(
              "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200",
              enabled ? "translate-x-[22px]" : "translate-x-0.5",
            )}
          />
          {pending ? (
            <Loader2 className="absolute inset-0 m-auto h-3 w-3 animate-spin text-white/80" aria-hidden="true" />
          ) : null}
        </button>
      </div>
      <p className="mt-1 text-[12px] leading-5 text-[#5F625E]">
        {enabled
          ? "Showing demo buyers, listings, and tasks alongside your real data."
          : "Only real data - your saved buyers, listings, and tasks."}
      </p>
    </div>
  );
}
