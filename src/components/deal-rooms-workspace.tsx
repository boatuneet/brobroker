"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  PlusCircle,
  Radio,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  type BrokerSegment,
  getBuyersForSegment,
  getListingsForSegment,
} from "@/lib/broker-segments";
import {
  createDealRoomFromBuyer,
  generateMatchesForBuyer,
  getBrokerDealRoomWorkspace,
  getListingById,
  getListingSpecSummary,
  getVerificationTone,
} from "@/lib/services";
import { mirrorWorkflowEvent, readPersisted, writePersisted } from "@/lib/browser-persistence";
import type { DealRoom } from "@/lib/types";
import { formatDate, percentage } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardHeaderIcon,
  EmptyState,
  PageHeader,
  ProgressBar,
  Stat,
  StatusDot,
} from "./ui";
import { SelectMenu } from "./select-menu";

export function DealRoomsWorkspace({ segment }: { segment?: BrokerSegment }) {
  const buyers = useMemo(() => getBuyersForSegment(segment), [segment]);
  const [savedRooms, setSavedRooms] = useState<DealRoom[]>(() =>
    readPersisted<DealRoom[]>("brobroker:deal-rooms:saved", []),
  );
  const existingRooms = useMemo(
    () => getBrokerDealRoomWorkspace(savedRooms, segment),
    [savedRooms, segment],
  );

  if (buyers.length === 0 && existingRooms.length === 0) {
    return <FirstRunDealRooms />;
  }

  return <DealRoomsOperational existingRooms={existingRooms} savedRooms={savedRooms} segment={segment} setSavedRooms={setSavedRooms} />;
}

/* Operational workspace — assumes at least one buyer or existing room exists. */
function DealRoomsOperational({
  existingRooms,
  savedRooms,
  segment,
  setSavedRooms,
}: {
  existingRooms: ReturnType<typeof getBrokerDealRoomWorkspace>;
  savedRooms: DealRoom[];
  segment?: BrokerSegment;
  setSavedRooms: (rooms: DealRoom[]) => void;
}) {
  const buyers = useMemo(() => getBuyersForSegment(segment), [segment]);
  const listings = useMemo(() => getListingsForSegment(segment), [segment]);
  const [buyerId, setBuyerId] = useState(buyers[0]?.id ?? "");
  const selectedBuyer = buyers.find((buyer) => buyer.id === buyerId);

  /* Auto-suggest the top two matched listings on buyer change; broker can
     then opt in/out by checking the boxes. Memo keyed on buyerId so suggestions
     don't churn while the broker is curating. */
  const suggestedListingIds = useMemo(() => {
    const buyer = buyers.find((candidate) => candidate.id === buyerId);
    if (!buyer) return [] as string[];
    return generateMatchesForBuyer(buyer, listings)
      .slice(0, 2)
      .map((match) => match.listingId);
  }, [buyerId, buyers, listings]);

  const [selectedListingIds, setSelectedListingIds] = useState<string[]>(suggestedListingIds);
  const [committedBuyerId, setCommittedBuyerId] = useState<string | null>(null);
  const [shareAccess, setShareAccess] = useState("Broker-approved link");
  const [passcode, setPasscode] = useState("BRO-" + (buyers[0]?.name.split(" ")[0].toUpperCase() ?? "ROOM"));
  const [shareCopied, setShareCopied] = useState(false);

  function changeBuyer(nextBuyerId: string) {
    setBuyerId(nextBuyerId);
    const nextSuggestions = (() => {
      const nextBuyer = buyers.find((buyer) => buyer.id === nextBuyerId);
      if (!nextBuyer) return [] as string[];
      return generateMatchesForBuyer(nextBuyer, listings)
        .slice(0, 2)
        .map((match) => match.listingId);
    })();
    setSelectedListingIds(nextSuggestions);
    setCommittedBuyerId(null);
    setPasscode("BRO-" + (buyers.find((buyer) => buyer.id === nextBuyerId)?.name.split(" ")[0].toUpperCase() ?? "ROOM"));
  }

  function toggleListing(listingId: string) {
    setSelectedListingIds((current) =>
      current.includes(listingId)
        ? current.filter((id) => id !== listingId)
        : [...current, listingId],
    );
  }

  function commitRoom() {
    if (!generatedRoom) return;
    const nextRooms = [generatedRoom, ...savedRooms.filter((room) => room.id !== generatedRoom.id)];
    setSavedRooms(nextRooms);
    writePersisted("brobroker:deal-rooms:saved", nextRooms);
    mirrorWorkflowEvent("deal_room_saved", generatedRoom.id, generatedRoom);
    setCommittedBuyerId(buyerId);
  }

  async function copyShareLink() {
    if (!generatedRoom) return;
    const payload = {
      roomId: generatedRoom.id,
      access: shareAccess,
      passcode,
      url: `${window.location.origin}/deal-rooms/${generatedRoom.id}`,
    };
    writePersisted(`brobroker:deal-rooms:${generatedRoom.id}:share`, payload);
    mirrorWorkflowEvent("deal_room_share_configured", generatedRoom.id, payload);
    await navigator.clipboard?.writeText(`${payload.url} · passcode ${passcode}`).catch(() => undefined);
    setShareCopied(true);
  }

  const generatedRoom = selectedBuyer
    ? createDealRoomFromBuyer(selectedBuyer.id, selectedListingIds, segment)
    : undefined;
  const generatedListings = generatedRoom
    ? generatedRoom.listingIds
        .map((id) => getListingById(id, segment))
        .filter((listing): listing is NonNullable<ReturnType<typeof getListingById>> => Boolean(listing))
    : [];
  const generatedTone = generatedRoom
    ? getVerificationTone(generatedRoom.verificationStatus)
    : undefined;
  const isCommitted = committedBuyerId === buyerId;
  const persistedRoomIds = new Set(savedRooms.map((room) => room.id));

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <PageHeader
        title="Private deal rooms"
        description="Create buyer-safe shortlists with approved listings and documents."
        metrics={[
          { label: "Rooms", value: `${existingRooms.length}` },
          {
            label: "Approved docs",
            value: `${existingRooms.reduce((total, room) => total + room.approvedDocuments.length, 0)}`,
          },
          {
            label: "Pending approval",
            value: `${existingRooms.filter(({ room }) => room.brokerApprovalStatus !== "Approved").length}`,
          },
        ]}
      />

      <div className="mt-12 grid gap-8 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Curate buyer-facing shortlist"
            action={
              <CardHeaderIcon>
                <PlusCircle className="h-4 w-4" aria-hidden="true" />
              </CardHeaderIcon>
            }
          />
          {!selectedBuyer || !generatedRoom || !generatedTone ? (
            <EmptyState
              title="No buyers yet"
              description="Add a buyer first, then curate a private room here."
              action={
                <Link
                  className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#D9DAD4] bg-white px-4 text-[13px] font-medium text-[#171719] hover:border-[#003C33]"
                  href="/voice-crm"
                >
                  Capture a buyer
                </Link>
              }
            />
          ) : (
            <div className="grid gap-5 px-6 py-5">
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

              <div>
                <p className="bb-mono-label">Listings in the room</p>
                {listings.length === 0 ? (
                  <p className="mt-2 text-[13px] leading-6 text-[#8E918B]">
                    Add inventory to curate a deal room shortlist.
                  </p>
                ) : (
                  <ul className="mt-3 grid max-h-72 gap-1.5 overflow-y-auto pr-1">
                    {listings.map((listing) => {
                      const isSelected = selectedListingIds.includes(listing.id);
                      const isSuggested = suggestedListingIds.includes(listing.id);
                      return (
                        <li key={listing.id}>
                          <label
                            className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                              isSelected
                                ? "border-[#003C33] bg-[#E7EFEA]/40"
                                : "border-[#E7E7E2] bg-white hover:border-[#003C33]"
                            }`}
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
                <p className="mt-2 text-[12px] text-[#8E918B]">
                  {selectedListingIds.length} of {listings.length} listings selected.
                </p>
              </div>

              <div className="rounded-2xl bg-[#F6F6F3] p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={generatedTone.className}>
                    <StatusDot className={generatedTone.dotClassName} />
                    {generatedRoom.verificationStatus}
                  </Badge>
                  <Badge tone="neutral">{generatedRoom.brokerApprovalStatus}</Badge>
                  {isCommitted || persistedRoomIds.has(generatedRoom.id) ? <Badge tone="success">Saved</Badge> : null}
                </div>
                <h2 className="bb-display mt-3 text-base font-medium text-[#171719]">
                  {generatedRoom.title}
                </h2>
                <p className="mt-2 text-[13px] leading-6 text-[#5F625E]">
                  {selectedBuyer.communicationStyle}. {generatedListings.length} listings ·{" "}
                  {generatedRoom.approvedDocumentIds.length} approved docs.
                </p>
              </div>

              <div className="grid gap-3 rounded-2xl border border-[#E7E7E2] bg-white p-4">
                <p className="bb-mono-label">Share controls</p>
                <SelectMenu
                  label="Access mode"
                  onChange={setShareAccess}
                  options={[
                    { label: "Broker-approved link", value: "Broker-approved link" },
                    { label: "Passcode required", value: "Passcode required" },
                    { label: "Paused until verification", value: "Paused until verification" },
                  ]}
                  value={shareAccess}
                />
                <label className="grid gap-1.5 text-[13px] font-medium text-[#171719]">
                  <span>Room passcode</span>
                  <input
                    className="min-h-10 rounded-lg border border-[#D9DAD4] bg-white px-3 text-[14px] text-[#171719] outline-none focus:border-[#003C33] focus:ring-2 focus:ring-[#003C33]/15"
                    onChange={(event) => setPasscode(event.target.value)}
                    value={passcode}
                  />
                </label>
                <Button onClick={copyShareLink} type="button" variant="secondary" size="sm">
                  {shareCopied ? "Share settings saved" : "Copy private link"}
                </Button>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={selectedListingIds.length === 0 || isCommitted}
                  onClick={commitRoom}
                  type="button"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  {isCommitted ? "Room saved" : "Save room draft"}
                </Button>
                <Link
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#D9DAD4] bg-white px-5 text-sm font-medium text-[#171719] hover:border-[#003C33]"
                  href={`/deal-rooms/${generatedRoom.id}`}
                >
                  Preview buyer-facing room
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          )}
        </Card>

        <div className="grid content-start gap-8">
          {existingRooms.length === 0 ? (
            <Card>
              <CardHeader eyebrow="Existing rooms" title="No deal rooms yet" />
              <EmptyState
                title="Deal rooms appear here once saved"
                description="Saved rooms show status, approved documents, and buyer-safe listings."
              />
            </Card>
          ) : (
            existingRooms.map(
              ({ room, buyer, listings, matches, approvedDocuments, accessWarning }) => {
                const tone = getVerificationTone(room.verificationStatus);
                return (
                  <Card key={room.id}>
                    <CardHeader
                      title={room.title}
                      action={
                        <Badge className={tone.className}>
                          <StatusDot className={tone.dotClassName} />
                          {room.verificationStatus}
                        </Badge>
                      }
                    />
                    <div className="grid gap-6 px-6 py-5 lg:grid-cols-[1fr_240px]">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-[12px] uppercase tracking-[0.14em] text-[#8E918B]">
                          <Badge tone="neutral">{room.status}</Badge>
                          <Badge tone="neutral">{room.brokerApprovalStatus}</Badge>
                          {persistedRoomIds.has(room.id) ? <Badge tone="success">Saved draft</Badge> : null}
                          <span>Updated {formatDate(room.lastUpdatedAt)}</span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[#5F625E]">
                          <span className="font-medium text-[#171719]">{buyer?.name}</span> ·{" "}
                          {accessWarning}
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {listings.map((listing) => {
                            const match = matches.find(
                              (candidate) => candidate.listingId === listing.id,
                            );
                            return (
                              <div
                                key={listing.id}
                                className="rounded-xl border border-[#E7E7E2] bg-white p-4"
                              >
                                <p className="text-[14px] font-medium text-[#171719]">
                                  {listing.name}
                                </p>
                                <p className="mt-1 text-[13px] text-[#8E918B]">
                                  {listing.builder} {listing.model} · {getListingSpecSummary(listing)}
                                </p>
                                <ProgressBar className="mt-3" value={match?.fitScore ?? 72} />
                                <p className="mt-2 text-[12px] font-medium uppercase tracking-[0.12em] text-[#171719]">
                                  {percentage(match?.fitScore ?? 72)} buyer fit
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="grid content-start gap-4 border-l border-[#E7E7E2] pl-5">
                        <Stat
                          label="Access"
                          value={room.verificationStatus}
                          detail={room.brokerApprovalStatus}
                        />
                        <Stat
                          label="Approved docs"
                          value={`${approvedDocuments.length}`}
                          detail="Buyer-safe only"
                        />
                        <Stat
                          label="Private route"
                          value="Ready"
                          detail={`/deal-rooms/${room.id}`}
                        />
                        <Link
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#D9DAD4] bg-white px-4 text-sm font-medium text-[#171719] hover:border-[#003C33]"
                          href={`/deal-rooms/${room.id}`}
                        >
                          Open buyer room
                        </Link>
                      </div>
                    </div>
                  </Card>
                );
              },
            )
          )}
        </div>
      </div>
    </div>
  );
}

/* First-run experience — clean editorial hero + three quick-start actions
   + an explainer card showing what each room contains. */
function FirstRunDealRooms() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <PageHeader
        title="Build private buyer rooms"
        description="Curate approved listings and buyer-safe rationale while seller notes stay internal."
        actions={
          <Link
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#003C33] px-5 text-sm font-medium text-white hover:bg-[#0B4A3F]"
            href="/voice-crm"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Capture by voice
          </Link>
        }
      />

      <section aria-labelledby="rooms-quick-start" className="mt-12">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="bb-mono-label">Quick start</p>
            <h2
              className="bb-display mt-2 text-xl font-medium text-[#171719]"
              id="rooms-quick-start"
            >
              Three paths to your first deal room
            </h2>
          </div>
          <p className="hidden text-[13px] text-[#8E918B] sm:block">
            Each one ends with a verified buyer.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
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
      </section>

      <Card className="mt-12">
        <CardHeader
          title="A private space, scoped to one buyer"
        />
        <ul className="divide-y divide-[#E7E7E2]">
          <RoomsExplainerRow
            icon={ShieldCheck}
            title="Verification + broker approval state"
            description="Rooms stay Draft until verification and broker approval clear."
          />
          <RoomsExplainerRow
            icon={CheckCircle2}
            title="Curated, buyer-safe listings"
            description="Only selected listings and approved documents appear."
          />
          <RoomsExplainerRow
            icon={LockKeyhole}
            title="Sensitive material hidden until cleared"
            description="Seller notes and risk scoring stay in the broker workspace."
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
      className="group flex h-full flex-col justify-between gap-5 rounded-2xl border border-[#E7E7E2] bg-white p-6 transition-colors hover:border-[#003C33]"
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
      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E7E7E2] bg-white text-[#003C33]">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-[14px] font-medium text-[#171719]">{title}</p>
        <p className="mt-1 text-[13px] leading-6 text-[#5F625E]">{description}</p>
      </div>
    </li>
  );
}
