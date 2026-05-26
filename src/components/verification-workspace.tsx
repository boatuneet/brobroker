"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Gauge,
  Inbox,
  LockKeyhole,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import type { BrokerSegment } from "@/lib/broker-segments";
import { getVerificationInbox, getVerificationTone, nowIso } from "@/lib/services";
import { mirrorWorkflowEvent, readPersisted, writePersisted } from "@/lib/browser-persistence";
import type { AuditEvent, VerificationStatus } from "@/lib/types";
import { formatDate } from "@/lib/utils";
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
import { cn } from "@/lib/utils";

function gateBadgeTone(status: string): "success" | "warning" | "error" {
  if (status === "Ready") return "success";
  if (status === "Blocked") return "error";
  return "warning";
}

function signalBadgeTone(state: string): "success" | "warning" | "error" {
  if (state === "Pass") return "success";
  if (state === "Fail") return "error";
  return "warning";
}

export function VerificationWorkspace({ segment }: { segment?: BrokerSegment }) {
  const inbox = useMemo(() => getVerificationInbox(segment), [segment]);
  const [selectedCaseId, setSelectedCaseId] = useState(inbox[0]?.caseFile.id ?? "");
  const [decisionEvents, setDecisionEvents] = useState<AuditEvent[]>(() =>
    readPersisted<AuditEvent[]>("brobroker:verification:decisions", []),
  );
  const selected = inbox.find((item) => item.caseFile.id === selectedCaseId) ?? inbox[0];

  useEffect(() => {
    writePersisted("brobroker:verification:decisions", decisionEvents);
  }, [decisionEvents]);

  if (!selected) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <WorkflowState
          description="Serious inquiries appear here before sensitive sharing is approved."
          title="No verification cases"
        />
      </div>
    );
  }

  function recordBrokerDecision(label: string, detail: string) {
    const event = {
      id: `audit-broker-${selected.caseFile.id}-${decisionEvents.length}`,
      actor: "Broker" as const,
      label,
      detail,
      occurredAt: nowIso,
    };
    setDecisionEvents((currentEvents) => [
      event,
      ...currentEvents,
    ]);
    mirrorWorkflowEvent("verification_broker_decision", event.id, {
      caseId: selected.caseFile.id,
      event,
    });
  }

  const counts = inbox.reduce(
    (total, item) => ({
      ...total,
      [item.caseFile.status]: total[item.caseFile.status] + 1,
    }),
    { Verified: 0, "Needs Review": 0, "High Risk": 0 } satisfies Record<VerificationStatus, number>,
  );
  const selectedTone = getVerificationTone(selected.caseFile.status);
  const auditTrail = [
    ...decisionEvents.filter((event) => event.id.includes(selected.caseFile.id)),
    ...selected.auditTrail,
  ];

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <PageHeader
        eyebrow="Verification trust gate"
        title="Buyer access review"
        description="Check risk signals and keep broker approval in control before sensitive sharing."
        metrics={[
          { label: "Verified", value: `${counts.Verified}` },
          { label: "Needs review", value: `${counts["Needs Review"]}` },
          { label: "High risk", value: `${counts["High Risk"]}` },
        ]}
      />

      <div className="mt-12 grid items-start gap-8 xl:grid-cols-[340px_minmax(0,1fr)]">
        {/* Inbox list */}
        <Card className="overflow-hidden">
          <CardHeader
            eyebrow="Verification inbox"
            title="Inquiry cases"
            action={
              <CardHeaderIcon>
                <Inbox className="h-4 w-4" aria-hidden="true" />
              </CardHeaderIcon>
            }
          />
          <ul className="grid gap-0 divide-y divide-[#f2f2f2]">
            {inbox.map((item) => {
              const tone = getVerificationTone(item.caseFile.status);
              const active = selected.caseFile.id === item.caseFile.id;
              return (
                <li key={item.caseFile.id}>
                  <button
                    className={cn(
                      "block w-full px-6 py-5 text-left transition-colors hover:bg-[#f7f7f9]",
                      active && "bg-[#f7f7f9]",
                    )}
                    onClick={() => setSelectedCaseId(item.caseFile.id)}
                    type="button"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[15px] font-medium text-[#17171c]">
                          {item.buyer?.name}
                        </p>
                        <p className="mt-1 text-[13px] text-[#75758a]">
                          {item.listing?.name} · {item.caseFile.requestedAccess}
                        </p>
                      </div>
                      <Badge className={tone.className}>
                        <StatusDot className={tone.dotClassName} />
                        {item.caseFile.status}
                      </Badge>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-[13px]">
                      <span className="text-[#75758a]">Score</span>
                      <span className="font-mono font-medium text-[#17171c]">
                        {item.caseFile.score}
                      </span>
                    </div>
                    <ProgressBar className="mt-2" value={item.caseFile.score} />
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Selected case */}
        <div className="grid content-start gap-8">
          <Card>
            <CardHeader
              eyebrow="Selected case"
              title={`${selected.buyer?.name ?? "Buyer"} access review`}
              action={
                <Badge className={selectedTone.className}>
                  <StatusDot className={selectedTone.dotClassName} />
                  {selected.caseFile.status}
                </Badge>
              }
            />
            <div className="grid gap-6 px-6 py-5 lg:grid-cols-[1fr_220px] lg:items-start">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[15px] font-medium">
                  <Link
                    className="text-[#17171c] hover:text-[#1863dc]"
                    href={`/buyers/${selected.caseFile.buyerId}`}
                  >
                    {selected.buyer?.name}
                  </Link>
                  <span className="text-[#9b9ba6]">/</span>
                  <Link
                    className="text-[#17171c] hover:text-[#1863dc]"
                    href={`/listings/${selected.caseFile.listingId}`}
                  >
                    {selected.listing?.name}
                  </Link>
                </div>
                <p className="mt-3 text-sm leading-6 text-[#3f3f46]">
                  {selected.caseFile.recommendedAction}
                </p>
                <p className="mt-2 text-[13px] leading-6 text-[#75758a]">
                  Requested access: {selected.caseFile.requestedAccess}. Last updated{" "}
                  {formatDate(selected.caseFile.updatedAt)}.
                </p>
              </div>
              <div className="rounded-2xl bg-[#f7f7f9] p-5 text-right lg:text-left">
                <p className="bb-mono-label">Risk score</p>
                <p className="bb-display mt-2 text-3xl font-medium text-[#17171c]">
                  {selected.caseFile.score}
                </p>
                <ProgressBar className="mt-3" value={selected.caseFile.score} />
                <p className="mt-3 text-[13px] leading-6 text-[#616161]">
                  Prototype scoring only. Broker approval remains required.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-[#f2f2f2] px-6 py-5">
              <Button
                disabled={selected.caseFile.status !== "Verified"}
                onClick={() =>
                  recordBrokerDecision(
                    "Access approved",
                    `${selected.buyer?.name} approved for broker-controlled access to ${selected.caseFile.requestedAccess}.`,
                  )
                }
                type="button"
              >
                <UserCheck className="h-4 w-4" aria-hidden="true" />
                Approve access
              </Button>
              <Button
                onClick={() =>
                  recordBrokerDecision(
                    "More information requested",
                    `Broker requested missing verification details before ${selected.caseFile.requestedAccess.toLowerCase()}.`,
                  )
                }
                type="button"
                variant="secondary"
              >
                Request more info
              </Button>
              <Button
                onClick={() =>
                  recordBrokerDecision(
                    "Access held",
                    `Broker held access for ${selected.buyer?.name}; sensitive sharing remains blocked.`,
                  )
                }
                type="button"
                variant="danger"
              >
                Hold access
              </Button>
            </div>
          </Card>

          <div className="grid items-start gap-8">
            <Card className="overflow-hidden">
              <CardHeader
                eyebrow="Signal scoring"
                title="Verification signals"
                description="Identity, company, funds, and inquiry quality."
                action={
                  <CardHeaderIcon>
                    <Gauge className="h-4 w-4" aria-hidden="true" />
                  </CardHeaderIcon>
                }
              />
              <ul className="grid gap-0 divide-y divide-[#f2f2f2]">
                {selected.caseFile.signals.map((signal) => (
                  <li key={signal.label} className="grid gap-3 px-6 py-4">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                      <h2 className="text-[14px] font-medium leading-6 text-[#17171c]">
                        {signal.label}
                      </h2>
                      <Badge tone={signalBadgeTone(signal.state)}>{signal.state}</Badge>
                    </div>
                    <p className="text-[13px] leading-6 text-[#616161]">{signal.detail}</p>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader
                eyebrow="Access gates"
                title="Access gates"
                description="Warnings before sensitive actions."
                action={
                  <CardHeaderIcon>
                    <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                  </CardHeaderIcon>
                }
              />
              <ul className="grid gap-0 divide-y divide-[#f2f2f2]">
                {selected.accessGates.map((gate) => (
                  <li key={gate.label} className="grid gap-3 px-6 py-4">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                      <div className="flex min-w-0 items-start gap-2">
                        {gate.status === "Ready" ? (
                          <CheckCircle2
                            className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-600"
                            aria-hidden="true"
                          />
                        ) : gate.status === "Blocked" ? (
                          <LockKeyhole
                            className="mt-1 h-3.5 w-3.5 shrink-0 text-rose-600"
                            aria-hidden="true"
                          />
                        ) : (
                          <AlertTriangle
                            className="mt-1 h-3.5 w-3.5 shrink-0 text-amber-600"
                            aria-hidden="true"
                          />
                        )}
                        <h2 className="text-[14px] font-medium leading-6 text-[#17171c]">
                          {gate.label}
                        </h2>
                      </div>
                      <Badge tone={gateBadgeTone(gate.status)}>{gate.status}</Badge>
                    </div>
                    <p className="text-[13px] leading-6 text-[#616161]">{gate.detail}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card>
            <CardHeader
              eyebrow="Audit trail"
              title="Status and broker decisions"
              action={
                <CardHeaderIcon>
                  <FileText className="h-4 w-4" aria-hidden="true" />
                </CardHeaderIcon>
              }
            />
            <ul className="grid gap-0 divide-y divide-[#f2f2f2]">
              {auditTrail.map((event) => (
                <li key={event.id} className="grid gap-3 px-6 py-5 sm:grid-cols-[28px_1fr]">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#e5e7eb] bg-white text-[#17171c]">
                    {event.actor === "Broker" ? (
                      <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={event.actor === "Broker" ? "coral" : "neutral"}>
                        {event.actor}
                      </Badge>
                      <span className="text-[12px] uppercase tracking-[0.14em] text-[#75758a]">
                        {formatDate(event.occurredAt)}
                      </span>
                    </div>
                    <h3 className="mt-2 text-[14px] font-medium text-[#17171c]">{event.label}</h3>
                    <p className="mt-1 text-[13px] leading-6 text-[#616161]">{event.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
