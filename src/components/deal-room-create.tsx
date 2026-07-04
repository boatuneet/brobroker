"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Search } from "lucide-react";
import {
  type BrokerSegment,
  getBuyersForSegment,
  getListingsForSegment,
} from "@/lib/broker-segments";
import {
  createDealRoomFromBuyer,
  generateMatchesForBuyer,
  getDealRoomReadiness,
  getListingSpecSummary,
  getVerificationTone,
  type DealRoomDataPools,
  type DealRoomReadinessCheck,
} from "@/lib/services";
import { mirrorWorkflowEvent, readPersisted, writePersisted } from "@/lib/browser-persistence";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { BuyerProfile, DealRoom, YachtListing } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  StatusDot,
} from "./ui";
import { SelectMenu } from "./select-menu";
import { DealRoomReadinessPills } from "./deal-room-readiness";

/* Focused "New deal room" flow — a dedicated subscreen (mirrors Add buyer /
   Add listing) instead of a side panel. Two columns: the form on the left
   (1. buyer, 2. shortlist), a sticky review card on the right so the
   readiness state and the Create action are always visible. */
export function DealRoomCreate({
  includeDemo = true,
  segment,
  storedBuyers = [],
  storedListings = [],
  initialBuyerId,
  initialListingIds = [],
}: {
  includeDemo?: boolean;
  segment?: BrokerSegment;
  /* Broker-owned records from Supabase, fetched server-side by the page.
     They list first so real buyers/inventory outrank the demo dataset. */
  storedBuyers?: BuyerProfile[];
  storedListings?: YachtListing[];
  /* Prefill from a buyer's Matches tab: which buyer the room is for, and the
     listings the broker multi-selected there to pre-check. */
  initialBuyerId?: string;
  initialListingIds?: string[];
}) {
  const router = useRouter();
  const pools = useMemo<DealRoomDataPools>(
    () => ({ buyers: storedBuyers, listings: storedListings, includeDemo }),
    [storedBuyers, storedListings, includeDemo],
  );
  const buyers = useMemo(
    () => mergeById(storedBuyers, includeDemo ? getBuyersForSegment(segment) : []),
    [storedBuyers, includeDemo, segment],
  );
  const listings = useMemo(
    () => mergeById(storedListings, includeDemo ? getListingsForSegment(segment) : []),
    [storedListings, includeDemo, segment],
  );

  /* Honor a prefilled buyer (from a Matches-tab "Add to deal room") when it
     resolves to a real record; otherwise fall back to the first buyer. */
  const resolvedInitialBuyerId =
    initialBuyerId && buyers.some((b) => b.id === initialBuyerId)
      ? initialBuyerId
      : buyers[0]?.id ?? "";
  const [buyerId, setBuyerId] = useState(resolvedInitialBuyerId);
  const selectedBuyer = buyers.find((buyer) => buyer.id === buyerId);

  /* Auto-suggest the top two matched listings on buyer change; the broker
     can then opt in/out via the checkboxes. */
  const suggestedListingIds = useMemo(() => {
    const buyer = buyers.find((candidate) => candidate.id === buyerId);
    if (!buyer) return [] as string[];
    return generateMatchesForBuyer(buyer, listings)
      .slice(0, 2)
      .map((match) => match.listingId);
  }, [buyerId, buyers, listings]);

  /* Seed selection: if the broker arrived from the Matches tab with explicit
     picks, honor exactly those (respect the curation they already did).
     Otherwise fall back to the top-two suggested matches. */
  const [selectedListingIds, setSelectedListingIds] = useState<string[]>(() => {
    const explicit = initialListingIds.filter((id) => listings.some((l) => l.id === id));
    if (explicit.length) return Array.from(new Set(explicit));
    const buyer = buyers.find((candidate) => candidate.id === resolvedInitialBuyerId);
    return buyer
      ? generateMatchesForBuyer(buyer, listings).slice(0, 2).map((match) => match.listingId)
      : [];
  });
  const [isSaving, setIsSaving] = useState(false);

  /* Room title is editable — one buyer can run several searches (multiple
     requirement sets), so "Shortlist for Daniel B." isn't enough to tell two
     rooms apart. Defaults to the buyer's name; broker can rename. Resets to
     the suggested title when the buyer changes. */
  const [roomTitle, setRoomTitle] = useState(() => {
    const buyer = buyers.find((candidate) => candidate.id === resolvedInitialBuyerId);
    return buyer ? buildShortlistTitle(buyer.name) : "";
  });

  function changeBuyer(nextBuyerId: string) {
    setBuyerId(nextBuyerId);
    const nextBuyer = buyers.find((buyer) => buyer.id === nextBuyerId);
    setRoomTitle(nextBuyer ? buildShortlistTitle(nextBuyer.name) : "");
    setSelectedListingIds(
      nextBuyer
        ? generateMatchesForBuyer(nextBuyer, listings)
            .slice(0, 2)
            .map((match) => match.listingId)
        : [],
    );
  }

  const [listingQuery, setListingQuery] = useState("");
  const filteredListings = useMemo(() => {
    const q = listingQuery.trim().toLowerCase();
    if (!q) return listings;
    return listings.filter((listing) =>
      [listing.name, listing.builder, listing.model, listing.location]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q)),
    );
  }, [listings, listingQuery]);

  function toggleListing(listingId: string) {
    setSelectedListingIds((current) =>
      current.includes(listingId)
        ? current.filter((id) => id !== listingId)
        : [...current, listingId],
    );
  }

  const baseRoom = selectedBuyer
    ? createDealRoomFromBuyer(selectedBuyer.id, selectedListingIds, segment, pools)
    : undefined;
  /* Rename verbose auto-titles ("Daniel Kudarauskas Private Asset Shortlist")
     to the friendlier "Shortlist for Daniel K." format. Applied here rather
     than in services.ts so the fix is scoped to the surface the user sees. */
  const room = baseRoom && selectedBuyer
    ? { ...baseRoom, title: roomTitle.trim() || buildShortlistTitle(selectedBuyer.name) }
    : baseRoom;
  const roomListings = room
    ? room.listingIds
        .map((id) => listings.find((listing) => listing.id === id))
        .filter((listing): listing is YachtListing => Boolean(listing))
    : [];
  const matches = selectedBuyer ? generateMatchesForBuyer(selectedBuyer, roomListings) : [];
  const approvedDocs = room
    ? roomListings.flatMap((listing) =>
        listing.documents.filter((document) => room.approvedDocumentIds.includes(document.id)),
      )
    : [];
  const readiness = room
    ? getDealRoomReadiness({
        room,
        listings: roomListings,
        matches,
        approvedDocuments: approvedDocs,
      })
    : null;
  const tone = room ? getVerificationTone(room.verificationStatus) : undefined;

  async function createRoom() {
    if (!room || isSaving) return;
    setIsSaving(true);
    const finalRoom: DealRoom = { ...room, lastUpdatedAt: new Date().toISOString() };

    /* Persist to Supabase when configured + signed in (mirrors buyer
       intake); fall back to localStorage so the flow still works in pure
       demo mode or while signed out. */
    let persisted = false;
    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          /* buyer_id is an FK to public.buyers — only set it for buyers
             that actually live there; demo buyers ride along in payload. */
          const isStoredBuyer = storedBuyers.some((buyer) => buyer.id === finalRoom.buyerId);
          const { error } = await supabase.from("deal_rooms").upsert({
            id: finalRoom.id,
            owner_user_id: user.id,
            buyer_id: isStoredBuyer ? finalRoom.buyerId : null,
            title: finalRoom.title,
            status: finalRoom.status,
            verification_status: finalRoom.verificationStatus,
            broker_approval_status: finalRoom.brokerApprovalStatus,
            asset_ids: finalRoom.listingIds,
            itinerary: finalRoom.itinerary,
            approved_document_ids: finalRoom.approvedDocumentIds,
            payload: { buyerId: finalRoom.buyerId },
            updated_at: finalRoom.lastUpdatedAt,
          });
          if (error) {
            console.warn("Could not save deal room to Supabase", error.message);
          } else {
            persisted = true;
          }
        }
      } catch (error) {
        console.warn("Could not save deal room to Supabase", error);
      }
    }

    if (!persisted) {
      const savedRooms = readPersisted<DealRoom[]>("brobroker:deal-rooms:saved", []);
      const nextRooms = [finalRoom, ...savedRooms.filter((candidate) => candidate.id !== finalRoom.id)];
      writePersisted("brobroker:deal-rooms:saved", nextRooms);
    }
    mirrorWorkflowEvent("deal_room_saved", finalRoom.id, finalRoom);
    router.push(`/deal-rooms/${finalRoom.id}`);
  }

  if (buyers.length === 0 || !selectedBuyer || !room || !tone || !readiness) {
    return (
      <div className="mx-auto w-full max-w-[1536px] px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
        <Card>
          <EmptyState
            title="No buyers yet"
            description="A deal room is scoped to one buyer. Capture a buyer first, then curate their private shortlist here."
            action={
              <Link
                className="inline-flex min-h-9 items-center gap-2 rounded-[8px] border border-[#D9DAD4] bg-white px-4 text-[13px] font-medium text-[#171719] hover:border-[#003C33]"
                href="/voice-crm"
              >
                Capture a buyer
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1536px] px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Left — the two form steps. */}
        <div className="grid content-start gap-8">
          <Card>
            <CardHeader
              eyebrow="Step 1"
              title="Choose the buyer"
              description="The room is private to this buyer — only they receive the link."
            />
            <div className="grid gap-4 px-6 py-5 sm:grid-cols-2 sm:items-start">
              <SelectMenu
                label="Buyer"
                onChange={changeBuyer}
                options={buyers.map((buyer) => ({
                  label: buyer.name,
                  value: buyer.id,
                  meta: `${buyer.currentStage} · ${buyer.urgency}`,
                }))}
                value={buyerId}
              />
              {/* Label + control styled to match SelectMenu exactly so the
                  buyer and room-name fields read as one aligned pair. */}
              <label className="block min-w-0">
                <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-[#8E918B]">
                  Room name
                </span>
                <input
                  className="h-11 w-full rounded-[10px] border border-[#D9DAD4] bg-white px-3.5 text-[14px] font-medium text-[#171719] outline-none transition-colors placeholder:font-normal placeholder:text-[#A9ABA5] hover:border-[#A9ABA5] focus:border-[#003C33] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[#4c6ee6]"
                  onChange={(event) => setRoomTitle(event.target.value)}
                  placeholder="e.g. Daniel — Sunseeker search"
                  type="text"
                  value={roomTitle}
                />
              </label>
            </div>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Step 2"
              title="Curate the shortlist"
              description="Top matches are pre-selected. Only checked listings and their approved documents appear in the room."
              action={
                <span className="text-[12px] text-[#8E918B]">
                  {selectedListingIds.length} of {listings.length} selected
                </span>
              }
            />
            <div className="px-6 py-5">
              {listings.length === 0 ? (
                <p className="text-[13px] leading-6 text-[#8E918B]">
                  Add inventory to curate a deal room shortlist.
                </p>
              ) : (
                <>
                  {/* Search — the segment can hold hundreds of listings, so
                      let the broker filter by name/builder/location instead of
                      scrolling the whole inventory. */}
                  <div className="relative">
                    <Search
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8E918B]"
                    />
                    <input
                      className="h-10 w-full rounded-[8px] border border-[#E7E7E7] bg-white pl-9 pr-3 text-[13px] text-[#171719] outline-none placeholder:text-[#A9ABA5] focus:border-[#003C33]"
                      onChange={(event) => setListingQuery(event.target.value)}
                      placeholder="Search listings by name, builder, or location"
                      type="search"
                      value={listingQuery}
                    />
                  </div>
                  {/* Capped height (~10 rows) with internal scroll so the page
                      stays compact regardless of inventory size. */}
                  {filteredListings.length === 0 ? (
                    <p className="mt-4 text-[13px] leading-6 text-[#8E918B]">
                      No listings match “{listingQuery}”.
                    </p>
                  ) : (
                    <ul className="mt-3 grid max-h-[640px] gap-2 overflow-y-auto pr-1">
                      {filteredListings.map((listing) => {
                        const isSelected = selectedListingIds.includes(listing.id);
                        const isSuggested = suggestedListingIds.includes(listing.id);
                        return (
                          <li key={listing.id}>
                            <label
                              className={cn(
                                "flex cursor-pointer items-start gap-3 rounded-[8px] border px-4 py-3 transition-colors",
                                isSelected
                                  ? "border-[#003C33] bg-[#F1F2EE]/40"
                                  : "border-[#E7E7E7] bg-white hover:border-[#003C33]",
                              )}
                            >
                              <input
                                checked={isSelected}
                                className="mt-1 h-4 w-4 cursor-pointer accent-[#003C33]"
                                onChange={() => toggleListing(listing.id)}
                                type="checkbox"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                  <p className="text-[13px] font-medium text-[#171719]">
                                    {listing.name}
                                  </p>
                                  {isSuggested ? (
                                    <span className="text-[11px] uppercase tracking-[0.14em] text-[#003C33]">
                                      Suggested
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-0.5 text-[12px] text-[#8E918B]">
                                  {listing.builder} {listing.model} · {getListingSpecSummary(listing)}
                                </p>
                              </div>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
            </div>
          </Card>
        </div>

        {/* Right — sticky review card: the Create action never scrolls away. */}
        <Card className="xl:sticky xl:top-20">
          <CardHeader eyebrow="Step 3" title="Review and create" />
          <div className="grid gap-5 px-6 py-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={tone.className}>
                  <StatusDot className={tone.dotClassName} />
                  {room.verificationStatus}
                </Badge>
                <Badge tone="neutral">{room.brokerApprovalStatus}</Badge>
              </div>
              <h2 className="bb-display mt-3 text-base font-medium text-[#171719]">
                {room.title}
              </h2>
              <p className="mt-1 text-[12px] text-[#8E918B]">
                {roomListings.length} listing{roomListings.length === 1 ? "" : "s"} ·{" "}
                {approvedDocs.length} approved docs
                {readiness.avgFit ? ` · ${readiness.avgFit}% avg fit` : ""}
              </p>
            </div>

            <div className="rounded-[12px] border border-[#E7E7E7] bg-[#FBFBFB] p-4">
              <p className="bb-mono-label">Readiness</p>
              <div className="mt-3">
                <DealRoomReadinessPills
                  checks={readiness.checks}
                  context={{ firstListingId: roomListings[0]?.id }}
                />
              </div>
              <p
                className={cn(
                  "mt-3 text-[12px] font-medium",
                  readiness.isShareable ? "text-[#0F8F62]" : "text-[#8E918B]",
                )}
              >
                {readiness.isShareable
                  ? "Ready to share once created."
                  : `Not shareable yet — needs ${firstBlocker(readiness.checks)}.`}
              </p>
            </div>

            <div className="grid gap-2">
              <Button
                disabled={selectedListingIds.length === 0 || isSaving}
                onClick={createRoom}
                type="button"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                {isSaving ? "Creating room…" : "Create room"}
              </Button>
              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-[8px] border border-[#D9DAD4] bg-white px-5 text-sm font-medium text-[#171719] hover:border-[#003C33]"
                href="/deal-rooms"
              >
                Cancel
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function firstBlocker(checks: DealRoomReadinessCheck[]): string {
  const blocking = checks.find((check) => !check.done);
  return (blocking?.label ?? "review").toLowerCase();
}

/* "Daniel Kudarauskas" -> "Shortlist for Daniel K." — falls back to just
   the first name (or the raw name) when a last initial can't be derived. */
function buildShortlistTitle(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Shortlist";
  const [first, ...rest] = parts;
  const lastInitial = rest.length ? rest[rest.length - 1]!.charAt(0).toUpperCase() : "";
  return lastInitial ? `Shortlist for ${first} ${lastInitial}.` : `Shortlist for ${first}`;
}

function mergeById<T extends { id: string }>(primary: T[], fallback: T[]): T[] {
  const seen = new Set<string>();
  return [...primary, ...fallback].filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
