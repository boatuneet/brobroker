"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Circle, Copy, X } from "lucide-react";
import { getDealRoomReadiness } from "@/lib/services";
import { markRoomShared } from "@/lib/supabase/room-share";
import type { DealRoom, MatchResult, YachtListing } from "@/lib/types";
import { cn } from "@/lib/utils";

/* Share dialog for the buyer-detail Share step.

   Not shareable yet → the readiness checklist with the missing items called
   out, plus a link into the room to finish setup.
   Shareable → the public /room/<id> link with a copy button. Copying is the
   share moment: we stamp deal_rooms (status Active + payload.sharedAt) so the
   workflow step flips to "Shared" — real tracking, not a local flag. */
export function ShareRoomDialog({
  room,
  listings,
  matches,
  isStoredRoom,
  onClose,
  onShared,
}: {
  room: DealRoom;
  listings: YachtListing[];
  matches: MatchResult[];
  /* Room persisted in Supabase (vs demo) — demo rooms can't be marked. */
  isStoredRoom: boolean;
  onClose: () => void;
  /* Called with the updated room after a successful share-mark. */
  onShared: (next: DealRoom) => void;
}) {
  const roomListings = listings.filter((listing) => room.listingIds.includes(listing.id));
  const readiness = getDealRoomReadiness({
    room,
    listings: roomListings,
    matches,
    approvedDocuments: room.approvedDocumentIds.map((id) => ({ id })),
  });
  const shareUrl =
    typeof window === "undefined" ? "" : `${window.location.origin}/room/${room.id}`;
  const alreadyShared = room.status !== "Draft";

  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marking, startTransition] = useTransition();

  function copyAndMarkShared() {
    void navigator.clipboard?.writeText(shareUrl).catch(() => undefined);
    setCopied(true);
    if (alreadyShared || !isStoredRoom) return;
    startTransition(async () => {
      const result = await markRoomShared(room.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onShared({ ...room, status: "Active" });
    });
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#171719]/40 p-6"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="w-full max-w-lg rounded-[12px] border border-[#E7E7E7] bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="bb-display text-lg font-medium text-[#171719]">
              {readiness.isShareable ? "Share this room" : "Room not ready to share"}
            </h3>
            <p className="mt-1.5 text-[13px] leading-6 text-[#5F625E]">
              {readiness.isShareable
                ? "Send the private link below — the buyer sees only broker-approved content, no login needed."
                : "Finish the checks below, then come back here for the share link."}
            </p>
          </div>
          <button
            aria-label="Close"
            className="rounded-[8px] p-1 text-[#8E918B] transition-colors hover:bg-[#F1F2EE] hover:text-[#171719]"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        {/* Readiness checklist — always visible so the broker sees WHY the
            room is or isn't shareable. Approved docs is recommended, not
            blocking, and is labeled as such. */}
        <ul className="mt-4 grid gap-1.5">
          {readiness.checks.map((check) => (
            <li
              className="flex items-center gap-2.5 rounded-[8px] bg-[#FBFBFB] px-3 py-2"
              key={check.label}
            >
              {check.done ? (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0F8F62] text-white">
                  <Check aria-hidden="true" className="h-3 w-3" />
                </span>
              ) : (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#D9DAD4] bg-white text-[#A9ABA5]">
                  <Circle aria-hidden="true" className="h-2.5 w-2.5" />
                </span>
              )}
              <span
                className={cn(
                  "text-[13px] font-medium",
                  check.done ? "text-[#171719]" : "text-[#8E918B]",
                )}
              >
                {check.label}
                {check.label === "Approved docs" && !check.done ? (
                  <span className="ml-1.5 text-[11.5px] font-normal text-[#A9ABA5]">
                    recommended, not blocking
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>

        {readiness.isShareable ? (
          <>
            <div className="mt-4 flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate rounded-[8px] border border-[#E7E7E7] bg-[#FBFBFB] px-3 py-2.5 font-mono text-[12px] text-[#5F625E]">
                {shareUrl}
              </p>
              <button
                className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-[8px] bg-[#003C33] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#0B4A3F] disabled:opacity-60"
                disabled={marking}
                onClick={copyAndMarkShared}
                type="button"
              >
                {copied ? (
                  <>
                    <Check aria-hidden="true" className="h-3.5 w-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                    Copy link
                  </>
                )}
              </button>
            </div>
            <p className="mt-2 text-[12px] leading-5 text-[#8E918B]">
              {alreadyShared
                ? "This room is already marked as shared."
                : copied && !error
                  ? "Link copied — the room is now marked as shared."
                  : "Copying the link marks the room as shared."}
            </p>
          </>
        ) : (
          <Link
            className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-[8px] bg-[#003C33] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#0B4A3F]"
            href={`/deal-rooms/${room.id}`}
          >
            Open room to finish setup
            <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>
        )}

        {error ? <p className="mt-3 text-[12px] text-[#A86642]">{error}</p> : null}
      </div>
    </div>
  );
}
