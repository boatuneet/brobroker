"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  FileQuestion,
  FileText,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";
import {
  answerScopedDealRoomQuestion,
  getDealRoomById,
  getVerificationTone,
} from "@/lib/services";
import { mirrorWorkflowEvent, readPersisted, writePersisted } from "@/lib/browser-persistence";
import type { BrokerSegment } from "@/lib/broker-segments";
import type { DealRoomDataPools } from "@/lib/services";
import type { AuditEvent, BuyerProfile, DealRoom, YachtListing } from "@/lib/types";
import { formatDate } from "@/lib/utils";
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

export function PrivateDealRoom({
  includeDemo = true,
  roomId,
  segment,
  storedBuyers = [],
  storedListings = [],
  storedRooms = [],
}: {
  includeDemo?: boolean;
  roomId: string;
  segment?: BrokerSegment;
  /* Broker-owned records from Supabase, fetched server-side by the page. */
  storedBuyers?: BuyerProfile[];
  storedListings?: YachtListing[];
  storedRooms?: DealRoom[];
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
  const [question, setQuestion] = useState("What specs does the first listing have?");
  const [answers, setAnswers] = useState<
    Array<{ question: string; answer: string; task?: string; restricted: boolean }>
  >(() => readPersisted(`brobroker:deal-rooms:${roomId}:qa`, []));
  const [followUpTasks, setFollowUpTasks] = useState<AuditEvent[]>(() =>
    readPersisted<AuditEvent[]>(`brobroker:deal-rooms:${roomId}:tasks`, []),
  );

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

  function askQuestion() {
    const result = answerScopedDealRoomQuestion(roomId, question, extraRooms, segment, pools);
    setAnswers((current) => {
      const next = [
        { question, answer: result.answer, task: result.followUpTask, restricted: result.restricted },
        ...current,
      ];
      writePersisted(`brobroker:deal-rooms:${roomId}:qa`, next);
      return next;
    });
    if (result.followUpTask) {
      setFollowUpTasks((current) => {
        const next = [
          {
            id: `room-task-${Date.now()}`,
            actor: "System" as const,
            label: "Q&A follow-up task",
            detail: result.followUpTask ?? "",
            occurredAt: new Date().toISOString(),
          },
          ...current,
        ];
        writePersisted(`brobroker:deal-rooms:${roomId}:tasks`, next);
        mirrorWorkflowEvent("deal_room_qa_follow_up", next[0].id, {
          roomId,
          question,
          task: next[0],
        });
        return next;
      });
    }
  }

  const tone = getVerificationTone(model.room.verificationStatus);

  return (
    /* Rendered inside AppShell — the shell owns the chrome (sidebar, top bar
       with breadcrumb), so this is just the standard workspace container. */
    <div className="text-[#171719]">
      <div className="mx-auto w-full max-w-[1536px] px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
        {/* Header sits on a card surface so the title and brief stay legible
            over the dotted workspace backdrop. */}
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

        {/* Shortlist grid — every asset visible at a glance. */}
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

        {/* Full-width comparison */}
        <div className="mt-8">
          <ShortlistAtGlance
            rows={model.comparisonRows.map((row) => ({
              listing: row.listing,
              approvedDocumentCount: row.approvedDocumentCount,
            }))}
          />
        </div>

        {/* Itinerary + Q&A side by side (materials + contact pair below);
            stacks to one column on smaller screens. Cards stretch to equal
            row heights so the grid keeps clean, symmetric edges. */}
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Broker-approved path forward"
                action={
                  <CardHeaderIcon>
                    <Calendar className="h-4 w-4" aria-hidden="true" />
                  </CardHeaderIcon>
                }
              />
              <ul className="grid gap-0 divide-y divide-[#E7E7E7]">
                {[...model.room.itinerary, ...model.nextSteps].map((step) => (
                  <li key={step} className="px-6 py-3.5 text-sm leading-6 text-[#5F625E]">
                    {step}
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="flex flex-col">
              <CardHeader
                title="Ask from approved room content"
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
                      <li
                        key={`${item.question}-${item.answer}`}
                        className="py-4"
                      >
                        <Badge tone={item.restricted ? "warning" : "success"}>
                          {item.restricted ? "Broker follow-up" : "Approved answer"}
                        </Badge>
                        <p className="mt-2 text-[14px] font-medium text-[#171719]">{item.question}</p>
                        <p className="mt-2 text-[13px] leading-6 text-[#5F625E]">{item.answer}</p>
                        {item.task ? (
                          <p className="mt-2 flex items-start gap-2 text-[13px] leading-6 text-[#b45309]">
                            <FileQuestion
                              className="mt-0.5 h-3.5 w-3.5 shrink-0"
                              aria-hidden="true"
                            />
                            {item.task}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  /* Single-cell grid stretches the empty state to fill the
                     remaining card height, keeping the row symmetric. */
                  <div className="grid flex-1">
                    <WorkflowState
                      description="Approved answers use room content; restricted details become follow-up tasks."
                      title="No questions asked yet"
                      tone="empty"
                    />
                  </div>
                )}
                {followUpTasks.length ? (
                  <div className="rounded-[12px] bg-[#fff7ed] p-4">
                    <p className="bb-mono-label">Broker follow-ups saved</p>
                    <ul className="mt-2 grid gap-2">
                      {followUpTasks.slice(0, 3).map((task) => (
                        <li key={task.id} className="text-[13px] leading-6 text-[#9a3412]">
                          {task.detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </Card>

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
                    {model.approvedDocuments.map((document) => (
                      <li key={document.id} className="px-6 py-4">
                        <p className="text-[14px] font-medium text-[#171719]">{document.title}</p>
                        <p className="mt-1 text-[13px] text-[#8E918B]">
                          {document.category} · updated {formatDate(document.updatedAt)}
                        </p>
                      </li>
                    ))}
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
