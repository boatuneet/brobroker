import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import type { DealRoomReadinessCheck } from "@/lib/services";
import { cn } from "@/lib/utils";

/* Readiness check pills shared by the deal rooms list and the New room
   flow — green when done, actionable link/button while pending. Every
   unresolved chip routes the broker to the exact place that resolves it,
   so the checklist is never dead UI. */

export interface ReadinessPillContext {
  /* First listing in the room — powers the "Approved docs" chip so it
     jumps straight to that listing's documents section. */
  firstListingId?: string;
  /* Deal room id — powers "Listings added" (links to the room edit /
     picker) and the "Reviewed" self-approval action. */
  roomId?: string;
  /* Called when the broker clicks the unchecked "Reviewed" chip. When
     omitted the chip stays a passive label — safe fallback for surfaces
     that can't mutate the room yet (e.g. the New-room review card). */
  onMarkReviewed?: () => void;
}

/* Map the service-layer labels to the UI copy + destination. Keeping the
   mapping here (not in services.ts, which is read-only) means the source
   of truth stays a plain list and each surface can decide its actions. */
function resolvePill(
  check: DealRoomReadinessCheck,
  ctx: ReadinessPillContext,
): {
  displayLabel: string;
  href?: string;
  onClick?: () => void;
  actionLabel?: string;
} {
  switch (check.label) {
    case "Buyer verified":
      return { displayLabel: "Buyer verified", href: "/verification" };
    case "Broker approved":
      /* The broker is the only user — "approved" reads as a mystery. Frame
         this as self-attestation: they confirm they've reviewed the room
         before sharing it. Clicking the unchecked chip performs the flip. */
      return {
        displayLabel: check.done ? "Reviewed by you" : "Reviewed",
        onClick: ctx.onMarkReviewed,
        actionLabel: "Mark as reviewed",
      };
    case "Listings added":
      return {
        displayLabel: "Listings added",
        href: ctx.roomId ? `/deal-rooms/${ctx.roomId}` : undefined,
      };
    case "Approved docs":
      /* A room can hold several listings, each with its own documents, so
         jumping to one listing is arbitrary. Open the room instead — its
         "Shortlist at a glance" lists every listing's doc status, and each
         row links out to that listing's Documents tab to approve. Fall back
         to the first listing only when there's no saved room yet (create). */
      return {
        displayLabel: "Approved docs",
        href: ctx.roomId
          ? `/deal-rooms/${ctx.roomId}`
          : ctx.firstListingId
            ? `/listings/${ctx.firstListingId}?tab=docs`
            : undefined,
      };
    default:
      return { displayLabel: check.label };
  }
}

export function DealRoomReadinessPills({
  checks,
  context = {},
}: {
  checks: DealRoomReadinessCheck[];
  context?: ReadinessPillContext;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {checks.map((check) => (
        <ReadinessPill key={check.label} check={check} context={context} />
      ))}
    </div>
  );
}

function ReadinessPill({
  check,
  context,
}: {
  check: DealRoomReadinessCheck;
  context: ReadinessPillContext;
}) {
  const resolved = resolvePill(check, context);
  const Icon = check.done ? CheckCircle2 : Circle;

  const doneClasses = "border-[#CDE7DC] bg-[#E1F1EA] text-[#0F8F62]";
  /* Actionable pending chips read as buttons — solid white surface, firm
     border, and a trailing arrow — so they're clearly distinct from the
     passive green "done" badges. */
  const pendingLinkClasses =
    "border-[#D9DAD4] bg-white text-[#171719] shadow-[0_1px_2px_rgba(23,31,25,0.04)] hover:border-[#003C33] hover:bg-[#F1F2EE] transition-colors cursor-pointer";
  const pendingStaticClasses = "border-[#E7E7E7] bg-[#F1F2EE] text-[#8E918B]";

  const baseClasses =
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]";

  /* Done: passive success chip. */
  if (check.done) {
    return (
      <span className={cn(baseClasses, doneClasses)}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {resolved.displayLabel}
      </span>
    );
  }

  /* Pending + click handler (only "Reviewed" today) — render a real button
     that performs the fix inline. */
  if (resolved.onClick) {
    return (
      <button
        className={cn(baseClasses, pendingLinkClasses)}
        onClick={resolved.onClick}
        type="button"
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {resolved.actionLabel ?? resolved.displayLabel}
        <ArrowRight className="h-3 w-3 text-[#8E918B]" aria-hidden="true" />
      </button>
    );
  }

  /* Pending + href — link to the screen that resolves the blocker. */
  if (resolved.href) {
    return (
      <Link className={cn(baseClasses, pendingLinkClasses)} href={resolved.href}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {resolved.displayLabel}
        <ArrowRight className="h-3 w-3 text-[#8E918B]" aria-hidden="true" />
      </Link>
    );
  }

  /* Fallback: no destination known — render a passive label rather than
     pretending it's clickable. */
  return (
    <span className={cn(baseClasses, pendingStaticClasses)}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {resolved.displayLabel}
    </span>
  );
}
