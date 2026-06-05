"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
  getListingSpecSummary,
  getVerificationTone,
} from "@/lib/services";
import { mirrorWorkflowEvent, readPersisted, writePersisted } from "@/lib/browser-persistence";
import type { AuditEvent, DealRoom } from "@/lib/types";
import { formatCurrency, formatDate, percentage } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardHeaderIcon,
  PageHeader,
  ProgressBar,
  StatusDot,
  WorkflowState,
} from "./ui";
import { AssetMedia } from "./asset-media";

export function PrivateDealRoom({ roomId }: { roomId: string }) {
  const persistedRooms = readPersisted<DealRoom[]>("brobroker:deal-rooms:saved", []);
  const model = useMemo(() => getDealRoomById(roomId, persistedRooms), [persistedRooms, roomId]);
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
    const result = answerScopedDealRoomQuestion(roomId, question, persistedRooms);
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
    <div className="min-h-dvh bg-white text-[#171719]">
      <main className="mx-auto w-full max-w-[1200px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
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

        <div className="mt-12 grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
          {/* Left — shortlist + comparison */}
          <div className="grid content-start gap-8">
            <Card>
              <CardHeader
                title="Recommended assets and trade-offs"
              />
              <ul className="grid gap-0 divide-y divide-[#E7E7E7]">
                {model.comparisonRows.map((row) => (
                  <li key={row.listing.id} className="px-6 py-6">
                    <div className="grid gap-5 lg:grid-cols-[140px_minmax(0,1fr)_160px]">
                      <AssetMedia className="min-h-32" compact listing={row.listing} />
                      <div className="min-w-0">
                        <h2 className="bb-display text-lg font-medium text-[#171719]">
                          {row.listing.name}
                        </h2>
                        <p className="mt-1 text-[13px] text-[#8E918B]">
                          {row.listing.builder} {row.listing.model} · {getListingSpecSummary(row.listing)}
                        </p>
                        <p className="mt-3 text-sm leading-6 text-[#5F625E]">{row.rationale}</p>
                        <p className="mt-2 text-[13px] leading-6 text-[#8E918B]">
                          Trade-off: {row.tradeOff}
                        </p>
                      </div>
                      <div className="rounded-[12px] bg-[#FBFBFB] p-4 lg:text-right">
                        <p className="bb-mono-label">Fit</p>
                        <p className="bb-display mt-2 text-2xl font-medium text-[#171719]">
                          {percentage(row.fitScore)}
                        </p>
                        <ProgressBar className="mt-3" value={row.fitScore} />
                        <p className="mt-3 font-mono text-[13px] font-medium text-[#171719]">
                          {formatCurrency(row.listing.priceEur)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardHeader eyebrow="Comparison" title="Shortlist at a glance" />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-[#E7E7E7] text-[11px] uppercase tracking-[0.16em] text-[#8E918B]">
                    <tr>
                      <th className="px-6 py-3 font-medium">Asset</th>
                      <th className="px-6 py-3 font-medium">Price</th>
                      <th className="px-6 py-3 font-medium">Specs</th>
                      <th className="px-6 py-3 font-medium">VAT</th>
                      <th className="px-6 py-3 font-medium">Docs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E7E7]">
                    {model.comparisonRows.map((row) => (
                      <tr key={row.listing.id}>
                        <td className="px-6 py-4 font-medium text-[#171719]">{row.listing.name}</td>
                        <td className="px-6 py-4 text-[#5F625E]">
                          {formatCurrency(row.listing.priceEur)}
                        </td>
                        <td className="px-6 py-4 text-[#5F625E]">
                          {getListingSpecSummary(row.listing)}
                        </td>
                        <td className="px-6 py-4 text-[#5F625E]">{row.listing.vatStatus}</td>
                        <td className="px-6 py-4 text-[#5F625E]">
                          {row.approvedDocumentCount} approved
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Right — itinerary, documents, Q&A, contact */}
          <div className="grid content-start gap-8">
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

            <Card>
              <CardHeader
                title="Ask from approved room content"
                action={
                  <CardHeaderIcon>
                    <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                  </CardHeaderIcon>
                }
              />
              <div className="grid gap-4 px-6 py-5">
                <textarea
                  aria-label="Question"
                  className="min-h-24 w-full rounded-[12px] border border-[#D9DAD4] bg-white p-3 text-[14px] leading-7 text-[#171719] outline-none focus:border-[#003C33] focus:ring-2 focus:ring-[#003C33]/15"
                  onChange={(event) => setQuestion(event.target.value)}
                  value={question}
                />
                <div>
                  <Button onClick={askQuestion} type="button">
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
                  <WorkflowState
                    description="Approved answers use room content; restricted details become follow-up tasks."
                    title="No questions asked yet"
                    tone="empty"
                  />
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
                title={model.brokerContact.name}
                action={
                  <CardHeaderIcon>
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  </CardHeaderIcon>
                }
              />
              <div className="grid gap-1.5 px-6 py-5 text-sm leading-6 text-[#5F625E]">
                <p className="text-[#8E918B]">{model.brokerContact.role}</p>
                <p>{model.brokerContact.email}</p>
                <p>{model.brokerContact.phone}</p>
                <Link
                  className="mt-3 inline-flex text-sm font-medium text-[#1863dc] hover:underline"
                  href="/deal-rooms"
                >
                  Broker room controls →
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
