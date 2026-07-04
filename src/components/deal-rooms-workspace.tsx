"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  CheckCircle2,
  Link2,
  LockKeyhole,
  PlusCircle,
  Radio,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { type BrokerSegment, getBuyersForSegment } from "@/lib/broker-segments";
import {
  getBrokerDealRoomWorkspace,
  getDealRoomReadiness,
  getListingSpecSummary,
  type DealRoomDataPools,
  type DealRoomReadinessCheck,
} from "@/lib/services";
import { mirrorWorkflowEvent, readPersisted, writePersisted } from "@/lib/browser-persistence";
import { createClient } from "@/lib/supabase/client";
import { deleteDealRoom } from "@/lib/supabase/delete-deal-room";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { BuyerProfile, DealRoom, YachtListing } from "@/lib/types";
import { cn, formatDate, percentage } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  ProgressBar,
} from "./ui";
import { DealRoomReadinessPills } from "./deal-room-readiness";

type WorkspaceEntry = ReturnType<typeof getBrokerDealRoomWorkspace>[number];

/* Deal rooms index — a read-focused list of rooms. Creation lives on its
   own subscreen (/deal-rooms/new), reachable from the top-bar "New room"
   action, the dashboard, and the empty states below. All content sits on
   card surfaces so nothing floats illegibly on the dotted backdrop. */
export function DealRoomsWorkspace({
  includeDemo = true,
  segment,
  storedBuyers = [],
  storedListings = [],
  storedRooms = [],
}: {
  includeDemo?: boolean;
  segment?: BrokerSegment;
  /* Broker-owned records from Supabase, fetched server-side by the page.
     Stored rooms list before browser-saved drafts so the durable copy wins
     on id collisions. */
  storedBuyers?: BuyerProfile[];
  storedListings?: YachtListing[];
  storedRooms?: DealRoom[];
}) {
  const pools = useMemo<DealRoomDataPools>(
    () => ({ buyers: storedBuyers, listings: storedListings, includeDemo }),
    [storedBuyers, storedListings, includeDemo],
  );
  const buyers = useMemo(
    () => [...storedBuyers, ...(includeDemo ? getBuyersForSegment(segment) : [])],
    [storedBuyers, includeDemo, segment],
  );
  const [savedRooms] = useState<DealRoom[]>(() =>
    readPersisted<DealRoom[]>("brobroker:deal-rooms:saved", []),
  );
  /* Local override of brokerApprovalStatus per room — lets the "Mark as
     reviewed" chip flip the badge instantly without a full refetch.
     Persists to localStorage + Supabase (when signed in), mirroring how
     deal-room-create writes on Create. */
  const [approvalOverrides, setApprovalOverrides] = useState<Record<string, DealRoom["brokerApprovalStatus"]>>(
    {},
  );
  // Rooms removed this session — filtered out optimistically so the list
  // updates the instant the broker confirms a delete.
  const [removedRoomIds, setRemovedRoomIds] = useState<Set<string>>(new Set());
  const [pendingRemove, setPendingRemove] = useState<{ id: string; title: string } | null>(null);
  const [removing, setRemoving] = useState(false);
  const roomsWithOverrides = useMemo(
    () =>
      [...storedRooms, ...savedRooms]
        .filter((room) => !removedRoomIds.has(room.id))
        .map((room) =>
          approvalOverrides[room.id]
            ? { ...room, brokerApprovalStatus: approvalOverrides[room.id] }
            : room,
        ),
    [storedRooms, savedRooms, approvalOverrides, removedRoomIds],
  );
  const existingRooms = useMemo(
    () => getBrokerDealRoomWorkspace(roomsWithOverrides, segment, pools),
    [roomsWithOverrides, segment, pools],
  );
  const [copiedRoomId, setCopiedRoomId] = useState<string | null>(null);

  const markRoomReviewed = useCallback(async (room: DealRoom) => {
    /* Optimistic UI first — the chip flips green instantly. */
    setApprovalOverrides((current) => ({ ...current, [room.id]: "Approved" }));

    const updated: DealRoom = {
      ...room,
      brokerApprovalStatus: "Approved",
      lastUpdatedAt: new Date().toISOString(),
    };

    /* Update the localStorage draft mirror so a page refresh keeps the
       Approved state even before Supabase confirms. */
    const savedDrafts = readPersisted<DealRoom[]>("brobroker:deal-rooms:saved", []);
    const draftIndex = savedDrafts.findIndex((candidate) => candidate.id === room.id);
    if (draftIndex >= 0) {
      const next = [...savedDrafts];
      next[draftIndex] = updated;
      writePersisted("brobroker:deal-rooms:saved", next);
    }

    /* Persist to Supabase when possible — same pattern as room create. */
    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { error } = await supabase
            .from("deal_rooms")
            .update({
              broker_approval_status: "Approved",
              updated_at: updated.lastUpdatedAt,
            })
            .eq("id", room.id)
            .eq("owner_user_id", user.id);
          if (error) {
            console.warn("Could not save reviewed state to Supabase", error.message);
          }
        }
      } catch (error) {
        console.warn("Could not save reviewed state to Supabase", error);
      }
    }

    mirrorWorkflowEvent("deal_room_reviewed", room.id, { roomId: room.id });
  }, []);

  if (buyers.length === 0 && existingRooms.length === 0) {
    return <FirstRunDealRooms />;
  }

  async function copyRoomLink(roomId: string) {
    const url = `${window.location.origin}/deal-rooms/${roomId}`;
    writePersisted(`brobroker:deal-rooms:${roomId}:share`, { roomId, url });
    mirrorWorkflowEvent("deal_room_share_configured", roomId, { roomId, url });
    await navigator.clipboard?.writeText(url).catch(() => undefined);
    setCopiedRoomId(roomId);
  }

  async function confirmRemove() {
    if (!pendingRemove || removing) return;
    setRemoving(true);
    const { id } = pendingRemove;
    // Optimistic — drop from the list immediately.
    setRemovedRoomIds((current) => new Set(current).add(id));
    // Drop any localStorage draft mirror so it doesn't reappear on refresh.
    const savedDrafts = readPersisted<DealRoom[]>("brobroker:deal-rooms:saved", []);
    if (savedDrafts.some((room) => room.id === id)) {
      writePersisted("brobroker:deal-rooms:saved", savedDrafts.filter((room) => room.id !== id));
    }
    await deleteDealRoom(id).catch(() => undefined);
    setRemoving(false);
    setPendingRemove(null);
  }

  const persistedRoomIds = new Set(savedRooms.map((room) => room.id));
  const activeEntries = existingRooms.filter((entry) => entry.origin !== "suggested");
  const suggestedEntries = existingRooms.filter((entry) => entry.origin === "suggested");
  const readyCount = activeEntries.filter((entry) => getDealRoomReadiness(entry).isShareable).length;
  const pendingApproval = activeEntries.filter(
    (entry) => entry.room.brokerApprovalStatus !== "Approved",
  ).length;

  return (
    <div className="mx-auto w-full max-w-[1536px] px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
      <PageHeader
        metrics={[
          { label: "Active rooms", value: `${activeEntries.length}` },
          { label: "Ready to share", value: `${readyCount}` },
          { label: "Awaiting review", value: `${pendingApproval}` },
        ]}
      />

      <div className="mt-8 grid gap-8">
        <Card>
          <CardHeader
            title="Active rooms"
            description="Private, buyer-safe shortlists you've curated. Share a room once every readiness check clears."
            action={<NewRoomButton />}
          />
          {activeEntries.length === 0 ? (
            <EmptyState
              title="No active rooms yet"
              description="Create a room to curate a private shortlist for one buyer."
              action={<NewRoomButton />}
            />
          ) : (
            <ul className="divide-y divide-[#E7E7E7]">
              {activeEntries.map((entry) => (
                <RoomRow
                  key={entry.room.id}
                  copied={copiedRoomId === entry.room.id}
                  entry={entry}
                  onCopy={() => copyRoomLink(entry.room.id)}
                  onMarkReviewed={() => markRoomReviewed(entry.room)}
                  onRemove={() => setPendingRemove({ id: entry.room.id, title: entry.room.title })}
                  saved={persistedRoomIds.has(entry.room.id)}
                />
              ))}
            </ul>
          )}
        </Card>

        {suggestedEntries.length > 0 ? (
          <Card>
            <CardHeader
              title="Suggested rooms"
              description="Auto-matched from your buyers — open one to curate and save it."
            />
            <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
              {suggestedEntries.map((entry) => (
                <SuggestedRoomCard key={entry.room.id} entry={entry} />
              ))}
            </div>
          </Card>
        ) : null}
      </div>

      {pendingRemove ? (
        <div
          aria-labelledby="remove-room-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#171719]/30 p-4"
          onClick={() => !removing && setPendingRemove(null)}
          role="dialog"
        >
          <div
            className="w-full max-w-md rounded-[12px] border border-[#E7E7E7] bg-white p-6 shadow-[0_20px_48px_rgba(23,31,25,0.16)]"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="bb-display text-lg font-medium text-[#171719]" id="remove-room-title">
              Remove this room?
            </h2>
            <p className="mt-2 text-[13.5px] leading-6 text-[#5F625E]">
              “{pendingRemove.title}” will be deleted. The buyer’s private link stops working.
              This can’t be undone.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                className="inline-flex min-h-9 items-center rounded-[8px] border border-[#E7E7E7] bg-white px-4 text-[13px] font-medium text-[#5F625E] transition-colors hover:bg-[#F1F2EE] disabled:opacity-50"
                disabled={removing}
                onClick={() => setPendingRemove(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="inline-flex min-h-9 items-center gap-1.5 rounded-[8px] bg-[#A4361C] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#8E2E17] disabled:opacity-50"
                disabled={removing}
                onClick={confirmRemove}
                type="button"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                {removing ? "Removing…" : "Remove room"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NewRoomButton() {
  return (
    <Link
      className="inline-flex min-h-9 items-center gap-1.5 rounded-[8px] bg-[#003C33] px-3 text-[13px] font-medium text-white transition-colors hover:bg-[#0B4A3F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]"
      href="/deal-rooms/new"
    >
      <PlusCircle className="h-4 w-4" aria-hidden="true" />
      New room
    </Link>
  );
}

/* ---- Room rows --------------------------------------------------------- */

function RoomRow({
  entry,
  copied,
  onCopy,
  onMarkReviewed,
  onRemove,
  saved,
}: {
  entry: WorkspaceEntry;
  copied: boolean;
  onCopy: () => void;
  onMarkReviewed: () => void;
  onRemove: () => void;
  saved: boolean;
}) {
  const { room, buyer, listings, matches, approvedDocuments } = entry;
  const readiness = getDealRoomReadiness(entry);
  const statusTone =
    room.status === "Active" ? "success" : room.status === "Paused" ? "warning" : "neutral";
  const shownListings = listings.slice(0, 3);
  const moreCount = listings.length - shownListings.length;
  /* Compose the buyer-safe listings meta row from parts that actually have
     values — avoids the "— · 4 approved docs" artifact when avgFit is 0
     or approvedDocuments is empty. */
  const listingsMeta = [
    readiness.avgFit ? `${readiness.avgFit}% avg fit` : null,
    approvedDocuments.length
      ? `${approvedDocuments.length} approved doc${approvedDocuments.length === 1 ? "" : "s"}`
      : null,
  ].filter(Boolean);

  return (
    <li className="grid gap-5 px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="bb-display text-lg font-medium text-[#171719]">{room.title}</h3>
            <Badge tone={statusTone}>{room.status}</Badge>
          </div>
          <p className="mt-1 text-[13px] text-[#8E918B]">
            <span className="font-medium text-[#171719]">{buyer?.name ?? "Buyer"}</span>
            {buyer ? ` · ${buyer.currentStage}` : ""} · Updated {formatDate(room.lastUpdatedAt)}
            {saved ? " · Saved draft" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            className="inline-flex min-h-9 items-center gap-2 rounded-[8px] bg-[#003C33] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#0B4A3F]"
            href={`/deal-rooms/${room.id}`}
          >
            Open room
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          {readiness.isShareable ? (
            <Button onClick={onCopy} size="sm" type="button" variant="secondary">
              <Link2 className="h-4 w-4" aria-hidden="true" />
              {copied ? "Link copied" : "Copy private link"}
            </Button>
          ) : (
            /* Status label — no border/hover, not a button. Real actions
               live on the readiness chips below. */
            <span className="inline-flex items-center gap-1.5 px-1 text-[13px] font-medium text-[#8E918B]">
              <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
              Locked until ready
            </span>
          )}
          <button
            aria-label={`Remove ${room.title}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-[#E7E7E7] bg-white text-[#8E918B] transition-colors hover:border-[#A86642] hover:text-[#A86642] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A86642]"
            onClick={onRemove}
            title="Remove room"
            type="button"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="rounded-[12px] border border-[#E7E7E7] bg-[#FBFBFB] p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="bb-mono-label">Readiness</p>
          <p
            className={cn(
              "text-[12px] font-medium",
              readiness.isShareable ? "text-[#0F8F62]" : "text-[#8E918B]",
            )}
          >
            {readiness.isShareable ? "Ready to share" : `Needs ${firstBlocker(readiness.checks)}`}
          </p>
        </div>
        <div className="mt-3">
          <DealRoomReadinessPills
            checks={readiness.checks}
            context={{
              roomId: room.id,
              firstListingId: listings[0]?.id,
              onMarkReviewed,
            }}
          />
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="bb-mono-label">Buyer-safe listings</p>
          {listingsMeta.length ? (
            <p className="text-[12px] text-[#8E918B]">{listingsMeta.join(" · ")}</p>
          ) : null}
        </div>
        {listings.length === 0 ? (
          <p className="mt-2 text-[13px] text-[#8E918B]">No listings curated yet.</p>
        ) : (
          <ul className="mt-3 grid gap-2.5 lg:grid-cols-3">
            {shownListings.map((listing) => {
              const fit = matches.find((match) => match.listingId === listing.id)?.fitScore ?? 72;
              return (
                <li key={listing.id} className="rounded-[10px] border border-[#E7E7E7] bg-white p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 truncate text-[14px] font-medium text-[#171719]">
                      {listing.name}
                    </p>
                    <span className="flex items-baseline gap-1.5">
                      <span className="text-[11px] uppercase tracking-[0.14em] text-[#8E918B]">
                        Fit
                      </span>
                      <span className="font-mono text-[12px] font-semibold tabular-nums text-[#171719]">
                        {percentage(fit)}
                      </span>
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-[#8E918B]">
                    {listing.builder} {listing.model} · {getListingSpecSummary(listing)}
                  </p>
                  <ProgressBar className="mt-2.5" tone="green" value={fit} />
                </li>
              );
            })}
          </ul>
        )}
        {moreCount > 0 ? (
          <p className="mt-2 text-[12px] text-[#8E918B]">
            +{moreCount} more listing{moreCount === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function SuggestedRoomCard({ entry }: { entry: WorkspaceEntry }) {
  const { room, buyer, listings } = entry;
  const readiness = getDealRoomReadiness(entry);
  const topListing = listings[0];

  return (
    <Link
      className="group flex flex-col gap-3 rounded-[12px] border border-[#E7E7E7] bg-white p-5 transition-colors hover:border-[#003C33]"
      href={`/deal-rooms/${room.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium text-[#171719]">
            {buyer?.name ?? room.title}
          </p>
          <p className="mt-0.5 text-[12px] text-[#8E918B]">
            {buyer ? `${buyer.currentStage} · ${buyer.urgency}` : "Suggested"}
          </p>
        </div>
        <span className="shrink-0 font-mono text-[12px] font-semibold tabular-nums text-[#171719]">
          {readiness.avgFit ? `${readiness.avgFit}%` : "—"}
        </span>
      </div>
      <p className="text-[13px] leading-6 text-[#5F625E]">
        {topListing
          ? `${listings.length} matched · top: ${topListing.name}`
          : "No matched listings yet"}
      </p>
      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#171719]">
        Open &amp; curate
        <ArrowRight
          className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}

function firstBlocker(checks: DealRoomReadinessCheck[]): string {
  const blocking = checks.slice(0, 3).find((check) => !check.done);
  const fallback = checks.find((check) => !check.done);
  return (blocking?.label ?? fallback?.label ?? "review").toLowerCase();
}

/* First-run experience — clean editorial hero + three quick-start actions
   + an explainer card showing what each room contains. */
function FirstRunDealRooms() {
  return (
    <div className="mx-auto w-full max-w-[1536px] px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
      <Card>
        <CardHeader
          eyebrow="Quick start"
          title="Three paths to your first deal room"
          description="Each one ends with a verified buyer."
        />
        <div className="grid gap-4 px-6 py-6 md:grid-cols-3">
          <RoomsActionCard
            description="Paste a call or brief to capture shortlist context."
            href="/voice-crm"
            icon={Radio}
            step="01"
            title="Capture a call"
          />
          <RoomsActionCard
            description="Rank inventory and save the buyer profile."
            href="/matching"
            icon={Sparkles}
            step="02"
            title="Run a brief"
          />
          <RoomsActionCard
            description="Clear serious inquiries before sharing."
            href="/verification"
            icon={ShieldCheck}
            step="03"
            title="Open verification"
          />
        </div>
      </Card>

      <Card className="mt-8">
        <CardHeader title="A private space, scoped to one buyer" />
        <ul className="divide-y divide-[#E7E7E7]">
          <RoomsExplainerRow
            description="Rooms stay Draft until verification and broker approval clear."
            icon={ShieldCheck}
            title="Verification + broker approval state"
          />
          <RoomsExplainerRow
            description="Only selected listings and approved documents appear."
            icon={CheckCircle2}
            title="Curated, buyer-safe listings"
          />
          <RoomsExplainerRow
            description="Seller notes and risk scoring stay in the broker workspace."
            icon={LockKeyhole}
            title="Sensitive material hidden until cleared"
          />
        </ul>
      </Card>
    </div>
  );
}

function RoomsActionCard({
  description,
  href,
  icon: Icon,
  step,
  title,
}: {
  description: string;
  href: string;
  icon: LucideIcon;
  step: string;
  title: string;
}) {
  return (
    <Link
      className="group flex h-full flex-col justify-between gap-5 rounded-[12px] border border-[#E7E7E7] bg-white p-6 transition-colors hover:border-[#003C33]"
      href={href}
    >
      <div>
        <div className="flex items-center justify-between">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#003C33] text-white">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="bb-mono-label">{step}</span>
        </div>
        <h3 className="bb-display mt-5 text-lg font-medium text-[#171719]">{title}</h3>
        <p className="mt-2 text-[13px] leading-6 text-[#5F625E]">{description}</p>
      </div>
      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#171719]">
        Get started
        <ArrowRight
          className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}

function RoomsExplainerRow({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <li className="grid gap-4 px-6 py-5 sm:grid-cols-[36px_1fr]">
      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E7E7E7] bg-white text-[#003C33]">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-[14px] font-medium text-[#171719]">{title}</p>
        <p className="mt-1 text-[13px] leading-6 text-[#5F625E]">{description}</p>
      </div>
    </li>
  );
}
