"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

/* The primary action pill on the focal dashboard task + queue rows.
   Pure navigation: clicking it opens the relevant workspace (matcher,
   verification, voice-crm, owner page, etc.). Task completion happens
   inside that workspace once the broker actually does the work — and
   will eventually be persisted to Supabase from there.

   When the destination can't be resolved (the dashboard guard passes no
   href) we render nothing — better to omit the CTA than to ship the user
   to a dead page. */
export function TaskActionButton({
  href,
  label,
}: {
  href?: string;
  label: string;
  // `taskId` is kept on the call-site API for compatibility, and will become
  // the row identifier for the Supabase completion mutation once that lands.
  // Mark optional + not destructured so the linter doesn't flag an unused
  // binding in the meantime.
  taskId?: string;
}) {
  if (!href) return null;

  return (
    <Link
      className="inline-flex min-h-10 items-center gap-2 rounded-[8px] bg-[#003C33] px-5 text-[13px] font-medium text-white transition-colors hover:bg-[#0B4A3F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]"
      href={href}
    >
      {label}
      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
    </Link>
  );
}
