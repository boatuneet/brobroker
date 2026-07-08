"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Circle, Copy, ShieldAlert, X } from "lucide-react";
import { markRoomShared } from "@/lib/supabase/room-share";
import type { DealRoom, YachtListing } from "@/lib/types";
import { cn } from "@/lib/utils";

/* Share dialog for the buyer-detail Share step.

   A room is shareable when the BUYER is verified (the broker's Trust-tab
   decision — the authoritative gate) and the room has at least one listing.
   Broker approval + "shared" are granted by the share action itself, not
   required beforehand. When the buyer has several rooms the broker picks
   which one to share here.

   - Buyer not verified → route to the Trust tab (the real blocker).
   - Verified but empty room → link into the room to add listings.
   - Ready → the public /room link with a copy button; copying marks the
     room shared (status Active + broker-approved + payload.sharedAt). */
export function ShareRoomDialog({
  buyerVerified,
  rooms,
  defaultRoomId,
  listings,
  onClose,
  onShared,
  onVerifyBuyer,
}: {
  /* Broker's Trust-tab decision === "Verified". */
  buyerVerified: boolean;
  /* Every persisted room for this buyer, newest first. */
  rooms: DealRoom[];
  /* Room to open on — the active flow's room. Falls back to the newest. */
  defaultRoomId?: string;
  listings: YachtListing[];
  onClose: () => void;
  onShared: (next: DealRoom) => void;
  /* Close the dialog and jump to the Trust tab (offered when unverified). */
  onVerifyBuyer?: () => void;
}) {
  const [selectedRoomId, setSelectedRoomId] = useState(
    defaultRoomId && rooms.some((r) => r.id === defaultRoomId) ? defaultRoomId : rooms[0]?.id ?? "",
  );
  const room = rooms.find((r) => r.id === selectedRoomId) ?? rooms[0];

  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marking, startTransition] = useTransition();

  const roomListings = useMemo(
    () => listings.filter((listing) => room?.listingIds.includes(listing.id)),
    [listings, room],
  );
  const approvedDocCount = useMemo(
    () =>
      roomListings.flatMap((l) => l.documents).filter((d) => room?.approvedDocumentIds.includes(d.id))
        .length,
    [roomListings, room],
  );

  if (!room) return null;

  const hasListings = roomListings.length > 0;
  const canShare = buyerVerified && hasListings;
  const alreadyShared = room.status !== "Draft";
  const shareUrl =
    typeof window === "undefined" ? "" : `${window.location.origin}/room/${room.id}`;

  const checks: Array<{ label: string; done: boolean; hint?: string }> = [
    { label: "Buyer verified", done: buyerVerified, hint: buyerVerified ? undefined : "record on Trust" },
    { label: "Listings added", done: hasListings },
    {
      label: "Approved docs",
      done: approvedDocCount > 0,
      hint: approvedDocCount > 0 ? undefined : "recommended, not blocking",
    },
  ];

  function copyAndMarkShared() {
    void navigator.clipboard?.writeText(shareUrl).catch(() => undefined);
    setCopied(true);
    if (alreadyShared) return;
    startTransition(async () => {
      const result = await markRoomShared(room.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onShared({ ...room, status: "Active", brokerApprovalStatus: "Approved" });
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
              {canShare ? "Share this room" : "Room not ready to share"}
            </h3>
            <p className="mt-1.5 text-[13px] leading-6 text-[#5F625E]">
              {canShare
                ? "Send the private link below — the buyer sees only broker-approved content, no login needed."
                : buyerVerified
                  ? "Add at least one listing to this room, then come back for the link."
                  : "Clear this buyer to share on the Trust tab first — that's the gate for sending anything."}
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

        {/* Room picker — only when the buyer has more than one room. */}
        {rooms.length > 1 ? (
          <label className="mt-4 block">
            <span className="bb-mono-label">Room to share</span>
            <select
              className="mt-1.5 h-10 w-full rounded-[8px] border border-[#D9DAD4] bg-white px-3 text-[13px] text-[#171719] outline-none focus:border-[#003C33]"
              onChange={(event) => {
                setSelectedRoomId(event.target.value);
                setCopied(false);
                setError(null);
              }}
              value={room.id}
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                  {r.status !== "Draft" ? " · shared" : ""}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {/* Readiness checklist — the buyer-verified row is the real gate. */}
        <ul className="mt-4 grid gap-1.5">
          {checks.map((check) => (
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
                {check.hint ? (
                  <span className="ml-1.5 text-[11.5px] font-normal text-[#A9ABA5]">
                    {check.hint}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>

        {canShare ? (
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
        ) : !buyerVerified ? (
          <button
            className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-[8px] bg-[#003C33] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#0B4A3F]"
            onClick={() => (onVerifyBuyer ? onVerifyBuyer() : onClose())}
            type="button"
          >
            <ShieldAlert aria-hidden="true" className="h-4 w-4" />
            Go to Trust tab to verify
          </button>
        ) : (
          <Link
            className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-[8px] bg-[#003C33] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#0B4A3F]"
            href={`/deal-rooms/${room.id}`}
          >
            Open room to add listings
            <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>
        )}

        {error ? <p className="mt-3 text-[12px] text-[#A86642]">{error}</p> : null}
      </div>
    </div>
  );
}
