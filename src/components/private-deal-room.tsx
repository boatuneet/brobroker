"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Calendar,
  Check,
  CheckCircle2,
  Download,
  FileText,
  LockKeyhole,
  MailQuestion,
  MessageSquareText,
  Plus,
  ShieldCheck,
} from "lucide-react";
import {
  answerScopedDealRoomQuestion,
  getDealRoomById,
  getVerificationTone,
} from "@/lib/services";
import { readPersisted, writePersisted } from "@/lib/browser-persistence";
import type { BrokerSegment } from "@/lib/broker-segments";
import type { DealRoomDataPools } from "@/lib/services";
import type { BuyerProfile, DealRoom, YachtListing } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import {
  answerRoomQuestion,
  markRoomQuestionAnswered,
} from "@/lib/supabase/answer-room-question";
import type { RoomQuestion } from "@/lib/supabase/deal-room-questions";
import { saveRoomViewings } from "@/lib/supabase/room-viewings";
import { setRoomApprovedDocuments } from "@/lib/supabase/room-documents";
import { formatViewingLabel, sortViewings, type RoomViewing } from "@/lib/viewings";
// Type-only import — erased at compile time, so the server-only guard in
// service.ts never runs in this client bundle.
import type { PublicRoomQuestion } from "@/lib/supabase/service";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardHeaderIcon,
  PageHeader,
  StatusDot,
  WorkflowState,
} from "./ui";
import { AssetFitCard } from "./asset-fit-card";
import { ShortlistAtGlance } from "./shortlist-at-glance";

type BuyerAnswer = {
  question: string;
  answer: string;
  restricted: boolean;
  sentToBroker: boolean;
};

export function PrivateDealRoom({
  includeDemo = true,
  roomId,
  segment,
  storedBuyers = [],
  storedListings = [],
  storedRooms = [],
  viewer = "buyer",
  initialQuestions = [],
  initialViewings = [],
  documentUrls = {},
  publicQuestions = [],
}: {
  includeDemo?: boolean;
  roomId: string;
  segment?: BrokerSegment;
  /* Broker-owned records from Supabase, fetched server-side by the page. */
  storedBuyers?: BuyerProfile[];
  storedListings?: YachtListing[];
  storedRooms?: DealRoom[];
  viewer?: "buyer" | "broker";
  initialQuestions?: RoomQuestion[];
  /* Structured viewings for this room, read server-side from
     deal_rooms.payload.viewings. Broker view can edit; buyer view is
     read-only. */
  initialViewings?: RoomViewing[];
  /* Signed download URLs for approved documents (doc id → url), generated
     server-side by whichever page rendered us (public: service role;
     broker: authed client). Docs without a file simply have no entry. */
  documentUrls?: Record<string, string>;
  /* Buyer view only: the room's Q&A thread from the server, so the buyer
     sees the broker's replies — not just their own local history. */
  publicQuestions?: PublicRoomQuestion[];
}) {
  const [persistedRooms] = useState<DealRoom[]>(() =>
    readPersisted<DealRoom[]>("brobroker:deal-rooms:saved", []),
  );
  const pools = useMemo<DealRoomDataPools>(
    () => ({ buyers: storedBuyers, listings: storedListings, includeDemo }),
    [storedBuyers, storedListings, includeDemo],
  );
  /* Stored (Supabase) rooms list first so the durable copy wins over any
     browser-saved draft with the same id. */
  const extraRooms = useMemo(
    () => [...storedRooms, ...persistedRooms],
    [storedRooms, persistedRooms],
  );
  const model = useMemo(
    () => getDealRoomById(roomId, extraRooms, segment, pools),
    [roomId, extraRooms, segment, pools],
  );
  /* Broker view can approve/unapprove listing docs for the room — local
     state so toggles reflect instantly, persisted to Supabase with a revert
     on failure. Buyer view never mutates this. */
  const [approvedDocIds, setApprovedDocIds] = useState<string[]>(
    () => model?.room.approvedDocumentIds ?? [],
  );
  const [docError, setDocError] = useState<string | null>(null);

  if (!model) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <WorkflowState
          description="Ask your broker to confirm the private room link before sharing or relying on this page."
          title="Deal room not found"
          tone="error"
        />
      </div>
    );
  }

  const tone = getVerificationTone(model.room.verificationStatus);

  function toggleDoc(docId: string) {
    const prev = approvedDocIds;
    const next = prev.includes(docId)
      ? prev.filter((id) => id !== docId)
      : [...prev, docId];
    setApprovedDocIds(next);
    setDocError(null);
    void setRoomApprovedDocuments(roomId, next).then((res) => {
      if (!res.ok) {
        setApprovedDocIds(prev); // revert — the write didn't land
        setDocError(res.error);
      }
    });
  }

  return (
    <div className="text-[#171719]">
      <div className="mx-auto w-full max-w-[1536px] px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
        <Card className="px-6 py-6 sm:px-8 sm:py-7">
          <PageHeader
            title={model.room.title}
            description={`${model.buyerSafeBrief?.headline} This room contains broker-approved shortlist context, documents, itinerary, and next steps only.`}
            metrics={[
              { label: "Listings", value: `${model.listings.length}` },
              { label: "Approved docs", value: `${model.approvedDocuments.length}` },
              { label: "Updated", value: formatDate(model.room.lastUpdatedAt) },
            ]}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={tone.className}>
                  <StatusDot className={tone.dotClassName} />
                  {model.room.verificationStatus}
                </Badge>
                <Badge tone="neutral">
                  <LockKeyhole className="h-3 w-3" aria-hidden="true" />
                  {model.room.brokerApprovalStatus}
                </Badge>
              </div>
            }
          />
        </Card>

        <Card className="mt-8">
          <CardHeader
            title="Recommended assets and trade-offs"
            description="Every asset curated for this buyer, with fit and trade-offs."
          />
          <div className="grid gap-5 px-5 pb-6 pt-2 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
            {model.comparisonRows.map((row) => (
              <AssetFitCard
                key={row.listing.id}
                fitScore={row.fitScore}
                listing={row.listing}
                rationale={row.rationale}
                tradeOff={row.tradeOff}
              />
            ))}
          </div>
        </Card>

        <div className="mt-8">
          <ShortlistAtGlance
            rows={model.comparisonRows.map((row) => ({
              listing: row.listing,
              approvedDocumentCount: row.approvedDocumentCount,
            }))}
          />
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <PathForwardCard
            legacySteps={[...model.room.itinerary, ...model.nextSteps]}
            listings={model.listings}
            roomId={roomId}
            viewer={viewer}
            initialViewings={initialViewings}
          />

          {viewer === "broker" ? (
            <BrokerQuestionsPanel
              roomId={roomId}
              initialQuestions={initialQuestions}
            />
          ) : (
            <BuyerAskCard
              roomId={roomId}
              extraRooms={extraRooms}
              segment={segment}
              pools={pools}
              serverQuestions={publicQuestions}
            />
          )}

          {viewer === "broker" ? (
            <BrokerDocumentsCard
              listings={model.listings}
              approvedDocIds={approvedDocIds}
              documentUrls={documentUrls}
              onToggle={toggleDoc}
              error={docError}
            />
          ) : (
            <Card>
              <CardHeader
                title="Broker-controlled materials"
                action={
                  <CardHeaderIcon>
                    <FileText className="h-4 w-4" aria-hidden="true" />
                  </CardHeaderIcon>
                }
              />
              <div className="grid gap-0">
                {model.approvedDocuments.length ? (
                  <ul className="grid gap-0 divide-y divide-[#E7E7E7]">
                    {model.approvedDocuments.map((document) => {
                      const url = documentUrls[document.id];
                      return (
                        <li
                          key={document.id}
                          className="flex items-center gap-3 px-6 py-4"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-[14px] font-medium text-[#171719]">{document.title}</p>
                            <p className="mt-1 text-[13px] text-[#8E918B]">
                              {document.category} · updated {formatDate(document.updatedAt)}
                            </p>
                          </div>
                          {url ? (
                            <a
                              className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-[8px] border border-[#D9DAD4] bg-white px-3 text-[12.5px] font-medium text-[#171719] transition-colors hover:border-[#003C33] hover:bg-[#F1F2EE]"
                              href={url}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              <Download className="h-3.5 w-3.5" aria-hidden="true" />
                              Open
                            </a>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="px-6 py-5">
                    <WorkflowState
                      description="The broker has not approved any documents for this buyer room yet."
                      title="No approved documents"
                      tone="warning"
                    />
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card className="flex flex-col">
            <CardHeader
              title={model.brokerContact.name}
              action={
                <CardHeaderIcon>
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                </CardHeaderIcon>
              }
            />
            <div className="flex flex-1 flex-col px-6 py-5">
              <div className="grid gap-1.5 text-sm leading-6 text-[#5F625E]">
                <p className="text-[#8E918B]">{model.brokerContact.role}</p>
                <p>{model.brokerContact.email}</p>
                <p>{model.brokerContact.phone}</p>
              </div>
              <div className="mt-auto flex flex-wrap gap-3 pt-6">
                <a
                  className="inline-flex min-h-9 items-center gap-2 rounded-[8px] border border-[#D9DAD4] bg-white px-4 text-[13px] font-medium text-[#171719] transition-colors hover:border-[#003C33]"
                  href={`mailto:${model.brokerContact.email}`}
                >
                  Email broker
                </a>
                <a
                  className="inline-flex min-h-9 items-center gap-2 rounded-[8px] border border-[#D9DAD4] bg-white px-4 text-[13px] font-medium text-[#171719] transition-colors hover:border-[#003C33]"
                  href={`tel:${model.brokerContact.phone.replace(/\s+/g, "")}`}
                >
                  Call
                </a>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Structured viewings — broker edits inline, buyer sees schedule
   above the legacy itinerary/next-steps strings.
   ============================================================ */

/* Broker-only document control: per listing, toggle which docs are approved
   (buyer-visible) for this room. Uploading a NEW file still happens on the
   listing (that's where the file input lives), so each listing links to its
   Documents tab — and listings with no docs say so instead of showing an
   empty, dead section. */
function BrokerDocumentsCard({
  listings,
  approvedDocIds,
  documentUrls,
  onToggle,
  error,
}: {
  listings: YachtListing[];
  approvedDocIds: string[];
  documentUrls: Record<string, string>;
  onToggle: (docId: string) => void;
  error: string | null;
}) {
  const approvedCount = listings
    .flatMap((listing) => listing.documents)
    .filter((doc) => approvedDocIds.includes(doc.id)).length;

  return (
    <Card>
      <CardHeader
        title="Documents"
        description={`Approve which listing documents this buyer can see — ${approvedCount} approved. Add new files on each listing.`}
        action={
          <CardHeaderIcon>
            <FileText className="h-4 w-4" aria-hidden="true" />
          </CardHeaderIcon>
        }
      />
      {error ? (
        <p className="mx-6 mt-3 rounded-[8px] bg-[#F0DDD0]/60 px-3 py-2 text-[12.5px] text-[#A86642]">
          {error}
        </p>
      ) : null}
      <div className="divide-y divide-[#E7E7E7]">
        {listings.map((listing) => (
          <div key={listing.id} className="px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-[13px] font-semibold text-[#171719]">{listing.name}</p>
              <Link
                className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-[#003C33] hover:underline"
                href={`/listings/${listing.id}?tab=docs`}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add / manage docs
                <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </div>
            {listing.documents.length ? (
              <ul className="mt-3 grid gap-1.5">
                {listing.documents.map((doc) => {
                  const approved = approvedDocIds.includes(doc.id);
                  const url = documentUrls[doc.id];
                  return (
                    <li
                      key={doc.id}
                      className="flex flex-wrap items-center gap-2 rounded-[8px] bg-[#FBFBFB] px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-[#171719]">
                          {doc.title}
                        </p>
                        <p className="text-[11.5px] text-[#8E918B]">
                          {doc.category}
                          {doc.filePath ? "" : " · no file uploaded"}
                        </p>
                      </div>
                      {url ? (
                        <a
                          className="inline-flex min-h-7 items-center gap-1 rounded-[8px] border border-[#D9DAD4] bg-white px-2.5 text-[12px] font-medium text-[#171719] hover:border-[#003C33]"
                          href={url}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          <Download className="h-3 w-3" aria-hidden="true" />
                          Open
                        </a>
                      ) : null}
                      <button
                        aria-pressed={approved}
                        className={cn(
                          "inline-flex min-h-7 items-center gap-1.5 rounded-[8px] border px-2.5 text-[12px] font-medium transition-colors",
                          approved
                            ? "border-[#CDE7DC] bg-[#E1F1EA] text-[#0F8F62] hover:bg-[#D6EBE0]"
                            : "border-[#003C33] bg-white text-[#003C33] hover:bg-[#F1F2EE]",
                        )}
                        onClick={() => onToggle(doc.id)}
                        type="button"
                      >
                        {approved ? (
                          <>
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            Approved
                          </>
                        ) : (
                          "Approve for buyer"
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-[12.5px] leading-5 text-[#8E918B]">
                No documents on this listing yet. Add them on the listing, then approve them here
                for the buyer.
              </p>
            )}
          </div>
        ))}
        {listings.length === 0 ? (
          <div className="px-6 py-5">
            <WorkflowState
              description="Add listings to this room first — then approve their documents for the buyer."
              title="No listings in this room"
              tone="warning"
            />
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function PathForwardCard({
  legacySteps,
  listings,
  roomId,
  viewer,
  initialViewings,
}: {
  legacySteps: string[];
  listings: YachtListing[];
  roomId: string;
  viewer: "buyer" | "broker";
  initialViewings: RoomViewing[];
}) {
  const [viewings, setViewings] = useState<RoomViewing[]>(() => sortViewings(initialViewings));
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [listingId, setListingId] = useState<string>("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listingNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const l of listings) map[l.id] = l.name;
    return map;
  }, [listings]);

  async function persist(next: RoomViewing[]) {
    setSaving(true);
    setError(null);
    const res = await saveRoomViewings(roomId, next);
    setSaving(false);
    if (!res.ok) setError(res.error);
  }

  async function addViewing() {
    if (!date) return;
    const next = sortViewings([
      ...viewings,
      {
        id: newId(),
        date,
        ...(time ? { time } : {}),
        ...(listingId ? { listingId } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      },
    ]);
    setViewings(next);
    setDate("");
    setTime("");
    setListingId("");
    setNote("");
    await persist(next);
  }

  async function removeViewing(id: string) {
    const next = viewings.filter((v) => v.id !== id);
    setViewings(next);
    await persist(next);
  }

  return (
    <Card>
      <CardHeader
        title="Broker-approved path forward"
        action={
          <CardHeaderIcon>
            <Calendar className="h-4 w-4" aria-hidden="true" />
          </CardHeaderIcon>
        }
      />

      {viewings.length ? (
        <ul className="grid gap-0 divide-y divide-[#E7E7E7]">
          {viewings.map((v) => (
            <li key={v.id} className="flex items-start gap-3 px-6 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium text-[#171719]">
                  {formatViewingLabel(v)}
                  {v.listingId && listingNameById[v.listingId] ? (
                    <span className="text-[#5F625E]"> · {listingNameById[v.listingId]}</span>
                  ) : null}
                </p>
                {v.note ? (
                  <p className="mt-1 text-[12.5px] leading-5 text-[#8E918B]">{v.note}</p>
                ) : null}
              </div>
              {viewer === "broker" ? (
                <button
                  aria-label="Remove viewing"
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-[#D9DAD4] bg-white text-[#8E918B] transition-colors hover:border-[#003C33] hover:bg-[#F1F2EE] hover:text-[#171719]"
                  disabled={saving}
                  onClick={() => removeViewing(v.id)}
                  type="button"
                >
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {legacySteps.length ? (
        <ul className="grid gap-0 divide-y divide-[#E7E7E7] border-t border-[#E7E7E7]">
          {legacySteps.map((step) => (
            <li key={step} className="px-6 py-3.5 text-sm leading-6 text-[#5F625E]">
              {step}
            </li>
          ))}
        </ul>
      ) : null}

      {viewer === "broker" ? (
        <div className="border-t border-[#E7E7E7] px-6 py-4">
          <p className="bb-mono-label">Add viewing</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(140px,1fr)_minmax(110px,auto)_minmax(0,1.2fr)]">
            <input
              aria-label="Viewing date"
              className="h-10 w-full rounded-[8px] border border-[#D9DAD4] bg-white px-3 text-[13px] text-[#171719] outline-none focus:border-[#003C33]"
              onChange={(e) => setDate(e.target.value)}
              type="date"
              value={date}
            />
            <input
              aria-label="Viewing time"
              className="h-10 w-full rounded-[8px] border border-[#D9DAD4] bg-white px-3 text-[13px] text-[#171719] outline-none focus:border-[#003C33]"
              onChange={(e) => setTime(e.target.value)}
              type="time"
              value={time}
            />
            <select
              aria-label="Listing"
              className="h-10 w-full rounded-[8px] border border-[#D9DAD4] bg-white px-3 text-[13px] text-[#171719] outline-none focus:border-[#003C33]"
              onChange={(e) => setListingId(e.target.value)}
              value={listingId}
            >
              <option value="">Any listing</option>
              {listings.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <input
            aria-label="Note"
            className="mt-2 h-10 w-full rounded-[8px] border border-[#D9DAD4] bg-white px-3 text-[13px] text-[#171719] outline-none focus:border-[#003C33]"
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note (buyer name, marina, contact)"
            type="text"
            value={note}
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              disabled={saving || !date}
              onClick={addViewing}
              size="sm"
              type="button"
              variant="secondary"
            >
              Add viewing
            </Button>
            {error ? (
              <span className="text-[12px] text-[#A86642]">Couldn&apos;t save — {error}</span>
            ) : null}
          </div>
        </div>
      ) : null}

      {!viewings.length && !legacySteps.length && viewer !== "broker" ? (
        <div className="px-6 py-5 text-sm leading-6 text-[#5F625E]">No viewings scheduled yet.</div>
      ) : null}
    </Card>
  );
}

function newId(): string {
  // ponytail: sufficient for local viewing ids; not a security boundary.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/* ============================================================
   Buyer side — instant deterministic answer + fire-and-forget
   POST to the broker so the question is not just theatre.
   ============================================================ */

function BuyerAskCard({
  roomId,
  extraRooms,
  segment,
  pools,
  serverQuestions = [],
}: {
  roomId: string;
  extraRooms: DealRoom[];
  segment?: BrokerSegment;
  pools: DealRoomDataPools;
  serverQuestions?: PublicRoomQuestion[];
}) {
  const [question, setQuestion] = useState("What specs does the first listing have?");
  // Start empty so SSR and first client render match; hydrate the buyer's own
  // prior Q&A from localStorage after mount (avoids a hydration mismatch).
  const [answers, setAnswers] = useState<BuyerAnswer[]>([]);
  useEffect(() => {
    setAnswers(readPersisted<BuyerAnswer[]>(`brobroker:deal-rooms:${roomId}:qa`, []));
  }, [roomId]);

  async function askQuestion() {
    const trimmed = question.trim();
    if (!trimmed) return;
    const result = answerScopedDealRoomQuestion(roomId, trimmed, extraRooms, segment, pools);

    /* Fire-and-forget to the broker. Handle failure quietly — the buyer
       still gets the deterministic answer locally. */
    let sentToBroker = false;
    try {
      const res = await fetch("/api/room-question", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roomId,
          question: trimmed,
          autoAnswer: result.answer,
        }),
      });
      sentToBroker = res.ok;
    } catch {
      sentToBroker = false;
    }

    setAnswers((current) => {
      const next: BuyerAnswer[] = [
        {
          question: trimmed,
          answer: result.answer,
          restricted: result.restricted,
          sentToBroker,
        },
        ...current,
      ];
      writePersisted(`brobroker:deal-rooms:${roomId}:qa`, next);
      return next;
    });
    setQuestion("");
  }

  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Ask about this shortlist"
        action={
          <CardHeaderIcon>
            <MessageSquareText className="h-4 w-4" aria-hidden="true" />
          </CardHeaderIcon>
        }
      />
      <div className="flex flex-1 flex-col gap-4 px-6 py-5">
        <textarea
          aria-label="Question"
          className="min-h-24 w-full rounded-[12px] border border-[#D9DAD4] bg-white p-3 text-[14px] leading-7 text-[#171719] outline-none focus:border-[#003C33] focus:ring-2 focus:ring-[#003C33]/15"
          onChange={(event) => setQuestion(event.target.value)}
          value={question}
        />
        <div>
          <Button onClick={askQuestion} type="button" variant="secondary">
            Ask question
          </Button>
        </div>
        {answers.length ? (
          <ul className="grid gap-0 divide-y divide-[#E7E7E7]">
            {answers.map((item) => (
              <li key={`${item.question}-${item.answer}`} className="py-4">
                <Badge tone={item.restricted ? "warning" : "success"}>
                  {item.restricted ? "Sent to your broker" : "Answered from approved details"}
                </Badge>
                <p className="mt-2 text-[13px] text-[#8E918B]">You asked</p>
                <p className="mt-1 text-[14px] font-medium text-[#171719]">{item.question}</p>
                <p className="mt-2 text-[13px] leading-6 text-[#5F625E]">{item.answer}</p>
                {item.restricted && item.sentToBroker ? (
                  <p className="mt-2 flex items-start gap-2 text-[13px] leading-6 text-[#5F625E]">
                    <MailQuestion
                      className="mt-0.5 h-3.5 w-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    Sent to your broker — they&apos;ll follow up.
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="grid flex-1">
            <WorkflowState
              description="Ask anything about these listings. Approved details answer instantly; anything else is forwarded to your broker."
              title="No questions asked yet"
              tone="empty"
            />
          </div>
        )}

        {/* Broker replies, from the server — closes the loop so the buyer
            sees answers on their next visit instead of only hearing back
            through another channel. */}
        {serverQuestions.some((item) => item.status === "answered") ? (
          <div className="border-t border-[#E7E7E7] pt-4">
            <p className="bb-mono-label">From your broker</p>
            <ul className="mt-1 grid gap-0 divide-y divide-[#E7E7E7]">
              {serverQuestions
                .filter((item) => item.status === "answered" && item.brokerAnswer)
                .map((item) => (
                  <li key={item.id} className="py-4">
                    <p className="text-[13px] text-[#8E918B]">You asked</p>
                    <p className="mt-1 text-[14px] font-medium text-[#171719]">{item.question}</p>
                    <div className="mt-2 rounded-[10px] bg-[#F1F2EE] px-3.5 py-2.5">
                      <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#003C33]">
                        Broker reply
                      </p>
                      <p className="mt-1 text-[13.5px] leading-6 text-[#171719]">
                        {item.brokerAnswer}
                      </p>
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/* ============================================================
   Broker side — inbox of buyer questions with reply UI.
   ============================================================ */

function BrokerQuestionsPanel({
  roomId,
  initialQuestions,
}: {
  roomId: string;
  initialQuestions: RoomQuestion[];
}) {
  const [items, setItems] = useState<RoomQuestion[]>(initialQuestions);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  async function sendAnswer(item: RoomQuestion) {
    const draft = (drafts[item.id] ?? "").trim();
    if (!draft) return;
    setBusyId(item.id);
    setErrorId(null);
    const res = await answerRoomQuestion(item.id, draft);
    setBusyId(null);
    if (!res.ok) {
      setErrorId(item.id);
      return;
    }
    setItems((current) =>
      current.map((q) =>
        q.id === item.id
          ? {
              ...q,
              brokerAnswer: draft,
              status: "answered",
              answeredAt: new Date().toISOString(),
            }
          : q,
      ),
    );
    setDrafts((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });
  }

  async function markAnswered(item: RoomQuestion) {
    setBusyId(item.id);
    setErrorId(null);
    const res = await markRoomQuestionAnswered(item.id);
    setBusyId(null);
    if (!res.ok) {
      setErrorId(item.id);
      return;
    }
    setItems((current) =>
      current.map((q) =>
        q.id === item.id
          ? { ...q, status: "answered", answeredAt: new Date().toISOString() }
          : q,
      ),
    );
  }

  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Buyer questions"
        description="Questions submitted from the shared room link."
        action={
          <CardHeaderIcon>
            <MailQuestion className="h-4 w-4" aria-hidden="true" />
          </CardHeaderIcon>
        }
      />
      <div className="flex flex-1 flex-col gap-4 px-6 py-5">
        {items.length ? (
          <ul className="grid gap-0 divide-y divide-[#E7E7E7]">
            {items.map((item) => (
              <li key={item.id} className="grid gap-3 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={item.status === "answered" ? "success" : "warning"}>
                    {item.status === "answered" ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Answered
                      </>
                    ) : (
                      "Open"
                    )}
                  </Badge>
                  <span className="text-[12px] text-[#8E918B]">
                    Asked {formatDate(item.askedAt)}
                  </span>
                </div>
                <p className="text-[14px] font-medium leading-6 text-[#171719]">
                  {item.question}
                </p>
                {item.autoAnswer ? (
                  <div className="rounded-[8px] border border-[#E7E7E7] bg-[#FBFBFB] p-3">
                    <p className="bb-mono-label text-[#8E918B]">System auto-answer sent to buyer</p>
                    <p className="mt-1 text-[13px] leading-6 text-[#5F625E]">
                      {item.autoAnswer}
                    </p>
                  </div>
                ) : null}
                {item.status === "answered" ? (
                  item.brokerAnswer ? (
                    <div className="rounded-[8px] border border-[#E1F1EA] bg-[#F1F8F4] p-3">
                      <p className="bb-mono-label text-[#0F8F62]">Your reply</p>
                      <p className="mt-1 text-[13px] leading-6 text-[#171719]">
                        {item.brokerAnswer}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[13px] leading-6 text-[#5F625E]">
                      Marked answered {item.answeredAt ? `· ${formatDate(item.answeredAt)}` : ""}
                    </p>
                  )
                ) : (
                  <div className="grid gap-2">
                    <textarea
                      aria-label={`Reply to ${item.question}`}
                      className="min-h-20 w-full rounded-[8px] border border-[#D9DAD4] bg-white p-3 text-[13px] leading-6 text-[#171719] outline-none focus:border-[#003C33] focus:ring-2 focus:ring-[#003C33]/15"
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [item.id]: event.target.value,
                        }))
                      }
                      placeholder="Write a reply for the buyer to see next time they open the room…"
                      value={drafts[item.id] ?? ""}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={busyId === item.id || !(drafts[item.id] ?? "").trim()}
                        onClick={() => sendAnswer(item)}
                        size="sm"
                        type="button"
                      >
                        Send answer
                      </Button>
                      <Button
                        disabled={busyId === item.id}
                        onClick={() => markAnswered(item)}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        Mark answered
                      </Button>
                      {errorId === item.id ? (
                        <span className="text-[12px] text-[#A86642]">
                          Couldn&apos;t save — try again.
                        </span>
                      ) : null}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="grid flex-1">
            <WorkflowState
              description="They'll appear here when a buyer asks from the shared room."
              title="No buyer questions yet"
              tone="empty"
            />
          </div>
        )}
      </div>
    </Card>
  );
}
