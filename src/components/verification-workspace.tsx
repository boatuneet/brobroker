"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Inbox,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from "lucide-react";
import type { BrokerSegment } from "@/lib/broker-segments";
import { getVerificationInbox, getVerificationTone, nowIso } from "@/lib/services";
import { mirrorWorkflowEvent, readPersisted, writePersisted } from "@/lib/browser-persistence";
import type {
  AuditEvent,
  BuyerProfile,
  VerificationCase,
  VerificationSignal,
  VerificationStatus,
} from "@/lib/types";
import type { SavedBuyerVerification } from "@/lib/buyer-verification";
import { formatDate } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardHeaderIcon,
  PageHeader,
  StatusDot,
} from "./ui";
import { cn } from "@/lib/utils";

type Assessment = "looks_credible" | "unclear" | "red_flags";
interface ScreeningResult {
  assessment: Assessment;
  summary: string;
  flags: string[];
  suggestedChecks: string[];
}

/* Row shapes used in this workspace. Demo rows come from getVerificationInbox
   (canned demo data with listings + gates). Stored rows are synthesized from
   real Supabase buyers so they show up here too — that's the whole reason the
   user's real "Daniel" was missing before. */
export type DemoInboxItem = ReturnType<typeof getVerificationInbox>[number] & {
  origin: "demo";
};

export interface StoredInboxItem {
  origin: "stored";
  id: string; // stable — used as the selection key
  buyer: BuyerProfile;
  hasSavedDecision: boolean;
  saved?: SavedBuyerVerification;
  // A "pseudo" status so counts + badges still work:
  status: VerificationStatus | "Not started";
  updatedAt: string;
}

export type InboxItem = DemoInboxItem | StoredInboxItem;

const STATE_COPY: Record<VerificationStatus | "Not started", { headline: string; helper: string }> = {
  Verified: {
    headline: "Cleared to share",
    helper: "Signals check out. You can proceed with broker-approved access.",
  },
  "Needs Review": {
    headline: "Needs your review",
    helper: "Some checks are incomplete. Resolve them before sharing sensitive material.",
  },
  "High Risk": {
    headline: "Hold access",
    helper: "Failing checks. Do not share sensitive documents until resolved or overridden.",
  },
  "Not started": {
    headline: "Not started",
    helper: "No verification has been run on this buyer yet.",
  },
};

const ASSESSMENT_COPY: Record<Assessment, { label: string; tone: "success" | "warning" | "error" }> = {
  looks_credible: { label: "Looks credible", tone: "success" },
  unclear: { label: "Unclear", tone: "warning" },
  red_flags: { label: "Red flags", tone: "error" },
};

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

function attentionSummary(caseFile: VerificationCase): string | null {
  const problems = caseFile.signals.filter((signal) => signal.state !== "Pass");
  if (!problems.length) return null;
  const labels = problems.map((signal) => signal.label.toLowerCase());
  const shown = labels.slice(0, 3).join(", ");
  const extra = labels.length > 3 ? ` +${labels.length - 3} more` : "";
  return `${problems.length} ${problems.length === 1 ? "check needs" : "checks need"} attention: ${shown}${extra}`;
}

function toneForStatus(status: VerificationStatus | "Not started") {
  if (status === "Not started") {
    return {
      className: "border-[#E7E7E7] bg-[#F1F2EE] text-[#5F625E]",
      dotClassName: "bg-[#8E918B]",
    };
  }
  return getVerificationTone(status);
}

function itemId(item: InboxItem): string {
  return item.origin === "demo" ? item.caseFile.id : item.id;
}

export function VerificationWorkspace({
  includeDemo = true,
  segment,
  storedInbox = [],
  initialSelectedId,
}: {
  includeDemo?: boolean;
  segment?: BrokerSegment;
  storedInbox?: StoredInboxItem[];
  initialSelectedId?: string;
}) {
  const inbox: InboxItem[] = useMemo(() => {
    const demo: DemoInboxItem[] = getVerificationInbox(segment, { includeDemo }).map((row) => ({
      ...row,
      origin: "demo" as const,
    }));

    // Real buyers first — they're the ones the broker is actually working on.
    // Within each group, prioritize items that need attention.
    const priority: Record<VerificationStatus | "Not started", number> = {
      "High Risk": 0,
      "Needs Review": 1,
      "Not started": 2,
      Verified: 3,
    };
    const stored = [...storedInbox].sort(
      (a, b) => priority[a.status] - priority[b.status],
    );
    const demoSorted = demo.sort(
      (a, b) => priority[a.caseFile.status] - priority[b.caseFile.status],
    );

    return [...stored, ...demoSorted];
  }, [segment, includeDemo, storedInbox]);

  const [selectedId, setSelectedId] = useState<string>(() => {
    if (initialSelectedId) {
      const target = inbox.find((item) => {
        if (item.origin === "stored") return item.buyer.id === initialSelectedId;
        return item.caseFile.buyerId === initialSelectedId;
      });
      if (target) return itemId(target);
    }
    return inbox[0] ? itemId(inbox[0]) : "";
  });

  const [decisionEvents, setDecisionEvents] = useState<AuditEvent[]>(() =>
    readPersisted<AuditEvent[]>("brobroker:verification:decisions", []),
  );
  const [screenings, setScreenings] = useState<Record<string, ScreeningResult>>({});
  const [screeningLoadingFor, setScreeningLoadingFor] = useState<string | null>(null);
  const [screeningErrors, setScreeningErrors] = useState<Record<string, string>>({});
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  const selected: InboxItem | undefined =
    inbox.find((item) => itemId(item) === selectedId) ?? inbox[0];

  useEffect(() => {
    writePersisted("brobroker:verification:decisions", decisionEvents);
  }, [decisionEvents]);

  useEffect(() => {
    setOverrideOpen(false);
    setOverrideReason("");
  }, [selectedId]);

  if (!selected) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Card>
          <div className="grid gap-3 px-6 py-10 text-center">
            <ShieldCheck className="mx-auto h-6 w-6 text-[#A9ABA5]" aria-hidden="true" />
            <p className="text-[14px] font-semibold text-[#171719]">No verification cases</p>
            <p className="mx-auto max-w-md text-[13px] leading-[1.55] text-[#5F625E]">
              Buyers you save will appear here for a broker readiness check before sensitive
              sharing. Add a buyer or turn on demo data to see how the queue works.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  function recordBrokerDecision(label: string, detail: string) {
    if (!selected) return;
    const key = itemId(selected);
    const event: AuditEvent = {
      id: `audit-broker-${key}-${Date.now()}-${decisionEvents.length}`,
      actor: "Broker",
      label,
      detail,
      occurredAt: nowIso,
    };
    setDecisionEvents((currentEvents) => [event, ...currentEvents]);
    mirrorWorkflowEvent("verification_broker_decision", event.id, {
      caseId: key,
      event,
    });
  }

  async function runScreening() {
    if (!selected || selected.origin !== "demo" || !selected.buyer) return;
    const caseId = selected.caseFile.id;
    setScreeningLoadingFor(caseId);
    setScreeningErrors((errors) => {
      const next = { ...errors };
      delete next[caseId];
      return next;
    });

    const buyer = selected.buyer;
    const budgetRange =
      buyer.budgetMinEur && buyer.budgetMaxEur
        ? `${buyer.budgetMinEur.toLocaleString()}–${buyer.budgetMaxEur.toLocaleString()} EUR`
        : undefined;
    const inquirySummary = [
      selected.listing?.name ? `Listing of interest: ${selected.listing.name}.` : "",
      selected.caseFile.requestedAccess ? `Requested access: ${selected.caseFile.requestedAccess}.` : "",
      buyer.urgency ? `Urgency: ${buyer.urgency}.` : "",
      buyer.mustHaves?.length ? `Must-haves: ${buyer.mustHaves.join(", ")}.` : "",
      buyer.dealBreakers?.length ? `Deal-breakers: ${buyer.dealBreakers.join(", ")}.` : "",
      buyer.relationshipNotes?.length ? `Notes: ${buyer.relationshipNotes.join(" ")}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    try {
      const res = await fetch("/api/verify-buyer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerId: buyer.id,
          name: buyer.name,
          company: buyer.company,
          country: buyer.country,
          inquirySummary,
          budgetRange,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setScreeningErrors((errors) => ({
          ...errors,
          [caseId]:
            res.status === 503
              ? "Connect OpenAI to enable AI screening."
              : data.error || "AI screening failed. Try again shortly.",
        }));
        return;
      }

      const result = (await res.json()) as ScreeningResult;
      setScreenings((prev) => ({ ...prev, [caseId]: result }));
    } catch {
      setScreeningErrors((errors) => ({
        ...errors,
        [caseId]: "Network error while contacting the AI screener.",
      }));
    } finally {
      setScreeningLoadingFor(null);
    }
  }

  // Counts across the whole inbox. "Not started" gets folded into "Needs review"
  // for the header metric so brokers see one bucket that means "action needed".
  const counts = inbox.reduce(
    (total, item) => {
      const status = item.origin === "demo" ? item.caseFile.status : item.status;
      if (status === "Verified") total.Verified += 1;
      else if (status === "High Risk") total["High Risk"] += 1;
      else total["Needs Review"] += 1; // includes "Not started"
      return total;
    },
    { Verified: 0, "Needs Review": 0, "High Risk": 0 } as Record<VerificationStatus, number>,
  );

  const selectedStatus: VerificationStatus | "Not started" =
    selected.origin === "demo" ? selected.caseFile.status : selected.status;
  const selectedTone = toneForStatus(selectedStatus);
  const stateCopy = STATE_COPY[selectedStatus];

  function submitOverride() {
    if (!selected || selected.origin !== "demo") return;
    const reason = overrideReason.trim();
    if (reason.length < 8) return;
    recordBrokerDecision(
      "Access approved (override)",
      `Override granted despite ${selected.caseFile.status}. Reason: ${reason}`,
    );
    setOverrideOpen(false);
    setOverrideReason("");
  }

  return (
    <div className="mx-auto w-full max-w-[1536px] px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
      <PageHeader
        metrics={[
          { label: "Cleared to share", value: `${counts.Verified}` },
          { label: "Needs review", value: `${counts["Needs Review"]}` },
          { label: "Hold access", value: `${counts["High Risk"]}` },
        ]}
      />

      <div className="mt-12 grid items-start gap-8 xl:grid-cols-[340px_minmax(0,1fr)]">
        {/* Inbox list */}
        <Card className="overflow-hidden">
          <CardHeader
            title="Inquiry cases"
            action={
              <CardHeaderIcon>
                <Inbox className="h-4 w-4" aria-hidden="true" />
              </CardHeaderIcon>
            }
          />
          <ul className="grid gap-0 divide-y divide-[#E7E7E7]">
            {inbox.map((item) => (
              <InboxRow
                key={itemId(item)}
                active={itemId(item) === itemId(selected)}
                item={item}
                onSelect={setSelectedId}
              />
            ))}
          </ul>
        </Card>

        {/* Selected item */}
        <div className="grid content-start gap-8">
          {selected.origin === "stored" ? (
            <StoredBuyerCard
              item={selected}
              stateCopy={stateCopy}
              tone={selectedTone}
            />
          ) : (
            <DemoCaseWorkspace
              auditTrail={([
                ...decisionEvents.filter((event) =>
                  event.id.includes(selected.caseFile.id),
                ),
                ...selected.auditTrail,
              ]) as AuditEvent[]}
              currentError={screeningErrors[selected.caseFile.id]}
              currentScreening={screenings[selected.caseFile.id]}
              isScreeningLoading={screeningLoadingFor === selected.caseFile.id}
              onOverrideReasonChange={setOverrideReason}
              onOverrideSubmit={submitOverride}
              onOverrideToggle={() => setOverrideOpen((open) => !open)}
              onRecordDecision={recordBrokerDecision}
              onRunScreening={runScreening}
              overrideOpen={overrideOpen}
              overrideReason={overrideReason}
              selected={selected}
              selectedTone={selectedTone}
              stateCopy={stateCopy}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inbox row — shared for both origins                                 */
/* ------------------------------------------------------------------ */

function InboxRow({
  active,
  item,
  onSelect,
}: {
  active: boolean;
  item: InboxItem;
  onSelect: (id: string) => void;
}) {
  if (item.origin === "demo") {
    const tone = getVerificationTone(item.caseFile.status);
    const attention = attentionSummary(item.caseFile);
    const headline = STATE_COPY[item.caseFile.status].headline;
    return (
      <li>
        <button
          className={cn(
            "block w-full px-6 py-5 text-left transition-colors hover:bg-[#F1F2EE]",
            active && "bg-[#F1F2EE]",
          )}
          onClick={() => onSelect(item.caseFile.id)}
          type="button"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] font-medium text-[#171719]">{item.buyer?.name}</p>
              <p className="mt-1 text-[13px] text-[#8E918B]">
                {item.listing?.name} · {item.caseFile.requestedAccess}
              </p>
            </div>
            <Badge className={tone.className}>
              <StatusDot className={tone.dotClassName} />
              {headline}
            </Badge>
          </div>
          <p className="mt-3 text-[13px] leading-5 text-[#5F625E]">
            {attention ?? "All checks passing."}
          </p>
        </button>
      </li>
    );
  }

  const tone = toneForStatus(item.status);
  const headline = STATE_COPY[item.status].headline;
  const attention =
    item.status === "Not started"
      ? "No verification run yet — review the buyer to start."
      : item.saved?.signals.filter((s) => s.state !== "Pass").length
        ? `${item.saved.signals.filter((s) => s.state !== "Pass").length} check(s) need attention.`
        : "All checks passing.";

  return (
    <li>
      <button
        className={cn(
          "block w-full px-6 py-5 text-left transition-colors hover:bg-[#F1F2EE]",
          active && "bg-[#F1F2EE]",
        )}
        onClick={() => onSelect(item.id)}
        type="button"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-medium text-[#171719]">{item.buyer.name}</p>
            <p className="mt-1 text-[13px] text-[#8E918B]">
              {item.buyer.company || item.buyer.country} · Real buyer
            </p>
          </div>
          <Badge className={tone.className}>
            <StatusDot className={tone.dotClassName} />
            {headline}
          </Badge>
        </div>
        <p className="mt-3 text-[13px] leading-5 text-[#5F625E]">{attention}</p>
      </button>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Stored buyer card — lightweight, routes back to /buyers/[id]?tab=trust */
/* ------------------------------------------------------------------ */

function StoredBuyerCard({
  item,
  stateCopy,
  tone,
}: {
  item: StoredInboxItem;
  stateCopy: (typeof STATE_COPY)[VerificationStatus | "Not started"];
  tone: { className: string; dotClassName: string };
}) {
  const { buyer, saved } = item;
  const savedSignals = saved?.signals ?? [];
  return (
    <>
      <Card>
        <CardHeader
          title={`${buyer.name} access review`}
          action={
            <Badge className={tone.className}>
              <StatusDot className={tone.dotClassName} />
              {stateCopy.headline}
            </Badge>
          }
        />
        <div className="grid gap-6 px-6 py-5 lg:grid-cols-[1fr_240px] lg:items-start">
          <div className="min-w-0">
            <Link
              className="text-[15px] font-medium text-[#171719] hover:text-[#1863dc]"
              href={`/buyers/${buyer.id}?tab=trust`}
            >
              {buyer.name}
            </Link>
            <p className="bb-display mt-3 text-2xl leading-8 text-[#171719]">
              {stateCopy.headline}
            </p>
            <p className="mt-2 text-sm leading-6 text-[#5F625E]">{stateCopy.helper}</p>
            <p className="mt-4 text-[13px] leading-6 text-[#8E918B]">
              {buyer.company ? `${buyer.company} · ` : ""}
              {buyer.country}
              {saved ? ` · Decided ${formatDate(saved.decidedAt)}` : ""}
            </p>
          </div>
          <div className="rounded-[12px] border border-[#E7E7E7] bg-[#FBFBFB] p-5">
            <p className="bb-mono-label">Summary</p>
            {saved ? (
              <>
                <p className="mt-2 text-[15px] font-medium text-[#171719]">
                  {savedSignals.filter((s) => s.state !== "Pass").length
                    ? `${savedSignals.filter((s) => s.state !== "Pass").length} check(s) need attention`
                    : "All checks passing"}
                </p>
                {saved.brokerNote ? (
                  <p className="mt-2 text-[13px] leading-6 text-[#5F625E]">{saved.brokerNote}</p>
                ) : null}
              </>
            ) : (
              <p className="mt-2 text-[15px] font-medium text-[#171719]">
                No verification run yet
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-[#E7E7E7] px-6 py-5">
          <Link
            className="inline-flex min-h-10 items-center gap-2 rounded-[8px] bg-[#003C33] px-5 text-sm font-medium text-white hover:bg-[#0B4A3F]"
            href={`/buyers/${buyer.id}?tab=trust`}
          >
            <UserCheck className="h-4 w-4" aria-hidden="true" />
            Review buyer
          </Link>
          <span className="text-[12px] text-[#8E918B]">
            Verification is run on the buyer&apos;s Trust tab — real buyers have full context there.
          </span>
        </div>
      </Card>

      {savedSignals.length ? (
        <Card className="overflow-hidden">
          <CardHeader
            title="Verification signals"
            description="Captured at the time this decision was recorded."
            action={
              <CardHeaderIcon>
                <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              </CardHeaderIcon>
            }
          />
          <ul className="grid gap-0 divide-y divide-[#E7E7E7]">
            {savedSignals.map((signal: VerificationSignal) => (
              <li key={signal.label} className="grid gap-3 px-6 py-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <h2 className="text-[14px] font-medium leading-6 text-[#171719]">
                    {signal.label}
                  </h2>
                  <Badge tone={signalBadgeTone(signal.state)}>{signal.state}</Badge>
                </div>
                <p className="text-[13px] leading-6 text-[#5F625E]">{signal.detail}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {saved?.screening ? (
        <Card className="overflow-hidden">
          <CardHeader
            title="AI screening"
            description="Advisory result from the last screening run."
            action={
              <CardHeaderIcon>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </CardHeaderIcon>
            }
          />
          <div className="grid gap-3 px-6 py-5">
            <Badge tone={ASSESSMENT_COPY[saved.screening.assessment].tone}>
              {ASSESSMENT_COPY[saved.screening.assessment].label}
            </Badge>
            <p className="text-[14px] leading-6 text-[#171719]">{saved.screening.summary}</p>
            {saved.screening.flags.length ? (
              <ul className="grid gap-1 text-[13px] leading-6 text-[#5F625E]">
                {saved.screening.flags.map((flag) => (
                  <li key={flag} className="flex items-start gap-2">
                    <AlertTriangle className="mt-1 h-3.5 w-3.5 shrink-0 text-[#A86642]" aria-hidden="true" />
                    {flag}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </Card>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Demo case workspace — the original flow, isolated for readability   */
/* ------------------------------------------------------------------ */

function DemoCaseWorkspace({
  auditTrail,
  currentError,
  currentScreening,
  isScreeningLoading,
  onOverrideReasonChange,
  onOverrideSubmit,
  onOverrideToggle,
  onRecordDecision,
  onRunScreening,
  overrideOpen,
  overrideReason,
  selected,
  selectedTone,
  stateCopy,
}: {
  auditTrail: AuditEvent[];
  currentError?: string;
  currentScreening?: ScreeningResult;
  isScreeningLoading: boolean;
  onOverrideReasonChange: (value: string) => void;
  onOverrideSubmit: () => void;
  onOverrideToggle: () => void;
  onRecordDecision: (label: string, detail: string) => void;
  onRunScreening: () => void;
  overrideOpen: boolean;
  overrideReason: string;
  selected: DemoInboxItem;
  selectedTone: { className: string; dotClassName: string };
  stateCopy: { headline: string; helper: string };
}) {
  const failingSignals = selected.caseFile.signals.filter(
    (signal) => signal.state !== "Pass",
  );
  const failingLabels = failingSignals.map((signal) => signal.label.toLowerCase());
  const isHighRisk = selected.caseFile.status === "High Risk";
  const isNeedsReview = selected.caseFile.status === "Needs Review";
  const canApprove = selected.caseFile.status === "Verified";
  const approveDisabledReason = isHighRisk
    ? "Resolve failing checks or override below"
    : isNeedsReview
      ? "Resolve outstanding checks before approving"
      : undefined;

  const verdictLine =
    selected.caseFile.status === "Verified"
      ? "All required checks passed — access can be broker-approved."
      : failingLabels.length
        ? `Because ${failingLabels.slice(0, 2).join(" and ")} ${failingLabels.length === 1 ? "needs" : "need"} review → ${isHighRisk ? "hold access and request documents." : "request the missing details before sharing sensitive material."}`
        : selected.caseFile.recommendedAction;

  return (
    <>
      <Card>
        <CardHeader
          title={`${selected.buyer?.name ?? "Buyer"} access review`}
          action={
            <Badge className={selectedTone.className}>
              <StatusDot className={selectedTone.dotClassName} />
              {stateCopy.headline}
            </Badge>
          }
        />
        <div className="grid gap-6 px-6 py-5 lg:grid-cols-[1fr_240px] lg:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[15px] font-medium">
              <Link
                className="text-[#171719] hover:text-[#1863dc]"
                href={`/buyers/${selected.caseFile.buyerId}`}
              >
                {selected.buyer?.name}
              </Link>
              <span className="text-[#A9ABA5]">/</span>
              <Link
                className="text-[#171719] hover:text-[#1863dc]"
                href={`/listings/${selected.caseFile.listingId}`}
              >
                {selected.listing?.name}
              </Link>
            </div>
            <p className="bb-display mt-3 text-2xl leading-8 text-[#171719]">
              {stateCopy.headline}
            </p>
            <p className="mt-2 text-sm leading-6 text-[#5F625E]">{stateCopy.helper}</p>
            <p className="mt-4 text-[13px] leading-6 text-[#8E918B]">
              Requested access: {selected.caseFile.requestedAccess}. Last updated{" "}
              {formatDate(selected.caseFile.updatedAt)}.
            </p>
            <p className="mt-3 text-[13px] leading-6 text-[#5F625E]">
              Advisory check — the final decision is always yours.
            </p>
          </div>
          <div className="rounded-[12px] border border-[#E7E7E7] bg-[#FBFBFB] p-5">
            <p className="bb-mono-label">Signal summary</p>
            {failingSignals.length ? (
              <>
                <p className="mt-2 text-[15px] font-medium text-[#171719]">
                  {failingSignals.length}{" "}
                  {failingSignals.length === 1 ? "check needs" : "checks need"} attention
                </p>
                <ul className="mt-2 space-y-1 text-[13px] leading-5 text-[#5F625E]">
                  {failingSignals.slice(0, 4).map((signal) => (
                    <li key={signal.label} className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-block h-1.5 w-1.5 rounded-full",
                          signal.state === "Fail" ? "bg-rose-500" : "bg-amber-500",
                        )}
                        aria-hidden="true"
                      />
                      {signal.label}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-2 text-[15px] font-medium text-[#171719]">
                All checks passing
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-[#E7E7E7] px-6 py-5">
          <Button
            aria-disabled={!canApprove}
            disabled={!canApprove}
            onClick={() =>
              onRecordDecision(
                "Access approved",
                `${selected.buyer?.name} approved for broker-controlled access to ${selected.caseFile.requestedAccess}.`,
              )
            }
            title={approveDisabledReason}
            type="button"
          >
            <UserCheck className="h-4 w-4" aria-hidden="true" />
            Approve access
          </Button>
          <Button
            onClick={() =>
              onRecordDecision(
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
              onRecordDecision(
                "Access held",
                `Broker held access for ${selected.buyer?.name}; sensitive sharing remains blocked.`,
              )
            }
            type="button"
            variant="danger"
          >
            Hold access
          </Button>
          {!canApprove ? (
            <div className="ml-auto flex flex-col items-end gap-1">
              {approveDisabledReason ? (
                <span className="text-[12px] text-[#8E918B]">{approveDisabledReason}</span>
              ) : null}
              <Button onClick={onOverrideToggle} type="button" variant="link">
                {overrideOpen ? "Cancel override" : "Approve anyway (override)"}
              </Button>
            </div>
          ) : null}
        </div>

        {overrideOpen && !canApprove ? (
          <div className="border-t border-[#E7E7E7] bg-[#FBFBFB] px-6 py-5">
            <label className="bb-mono-label text-[#171719]" htmlFor="override-reason">
              Override reason (required, logged to audit trail)
            </label>
            <textarea
              className="mt-2 w-full rounded-[8px] border border-[#D9DAD4] bg-white px-3 py-2 text-sm leading-6 text-[#171719] outline-none focus:border-[#003C33]"
              id="override-reason"
              onChange={(event) => onOverrideReasonChange(event.target.value)}
              placeholder="Explain why this buyer can proceed despite the failing checks."
              rows={3}
              value={overrideReason}
            />
            <div className="mt-3 flex items-center gap-3">
              <Button
                disabled={overrideReason.trim().length < 8}
                onClick={onOverrideSubmit}
                type="button"
                variant="danger"
              >
                Confirm override
              </Button>
              <span className="text-[12px] text-[#8E918B]">
                Minimum 8 characters. This action is recorded against your broker profile.
              </span>
            </div>
          </div>
        ) : null}
      </Card>

      <div className="grid items-start gap-8">
        <Card className="overflow-hidden">
          <CardHeader
            title="Verification signals"
            description="Identity, company, funds, and inquiry quality."
            action={
              <CardHeaderIcon>
                <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              </CardHeaderIcon>
            }
          />
          <ul className="grid gap-0 divide-y divide-[#E7E7E7]">
            {selected.caseFile.signals.map((signal) => (
              <li key={signal.label} className="grid gap-3 px-6 py-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <h2 className="text-[14px] font-medium leading-6 text-[#171719]">
                    {signal.label}
                  </h2>
                  <Badge tone={signalBadgeTone(signal.state)}>{signal.state}</Badge>
                </div>
                <p className="text-[13px] leading-6 text-[#5F625E]">{signal.detail}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Access gates"
            description="Warnings before sensitive actions."
            action={
              <CardHeaderIcon>
                <LockKeyhole className="h-4 w-4" aria-hidden="true" />
              </CardHeaderIcon>
            }
          />
          <ul className="grid gap-0 divide-y divide-[#E7E7E7]">
            {selected.accessGates.map((gate) => (
              <li key={gate.label} className="grid gap-3 px-6 py-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    {gate.status === "Ready" ? (
                      <CheckCircle2
                        className="mt-1 h-3.5 w-3.5 shrink-0 text-[#0F8F62]"
                        aria-hidden="true"
                      />
                    ) : gate.status === "Blocked" ? (
                      <LockKeyhole
                        className="mt-1 h-3.5 w-3.5 shrink-0 text-[#A86642]"
                        aria-hidden="true"
                      />
                    ) : (
                      <AlertTriangle
                        className="mt-1 h-3.5 w-3.5 shrink-0 text-[#A86642]"
                        aria-hidden="true"
                      />
                    )}
                    <h2 className="text-[14px] font-medium leading-6 text-[#171719]">
                      {gate.label}
                    </h2>
                  </div>
                  <Badge tone={gateBadgeTone(gate.status)}>{gate.status}</Badge>
                </div>
                <p className="text-[13px] leading-6 text-[#5F625E]">{gate.detail}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Recommended action"
            description="Conclusion drawn from the signals and gates above."
            action={
              <CardHeaderIcon>
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              </CardHeaderIcon>
            }
          />
          <div className="px-6 py-5">
            <p className="text-[15px] leading-7 text-[#171719]">{verdictLine}</p>
            <p className="mt-2 text-[13px] leading-6 text-[#8E918B]">
              Advisory check — the final decision is always yours.
            </p>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="AI screening"
            description="Rough plausibility check on the inquiry. Verify independently before granting access."
            action={
              <CardHeaderIcon>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </CardHeaderIcon>
            }
          />
          <div className="px-6 py-5">
            {!currentScreening ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  disabled={isScreeningLoading}
                  onClick={onRunScreening}
                  type="button"
                  variant="secondary"
                >
                  {isScreeningLoading ? "Screening…" : "Run AI screening"}
                </Button>
                <span className="text-[13px] text-[#8E918B]">
                  Assesses plausibility of the inquiry — does not verify real-world identity.
                </span>
              </div>
            ) : (
              <div className="grid gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone={ASSESSMENT_COPY[currentScreening.assessment].tone}>
                    {ASSESSMENT_COPY[currentScreening.assessment].label}
                  </Badge>
                  <Button
                    disabled={isScreeningLoading}
                    onClick={onRunScreening}
                    type="button"
                    variant="link"
                  >
                    {isScreeningLoading ? "Re-running…" : "Re-run"}
                  </Button>
                </div>
                <p className="text-[14px] leading-6 text-[#171719]">
                  {currentScreening.summary}
                </p>
                {currentScreening.flags.length ? (
                  <div>
                    <p className="bb-mono-label">Flags</p>
                    <ul className="mt-2 grid gap-1 text-[13px] leading-6 text-[#5F625E]">
                      {currentScreening.flags.map((flag) => (
                        <li key={flag} className="flex items-start gap-2">
                          <AlertTriangle
                            className="mt-1 h-3.5 w-3.5 shrink-0 text-[#A86642]"
                            aria-hidden="true"
                          />
                          {flag}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {currentScreening.suggestedChecks.length ? (
                  <div>
                    <p className="bb-mono-label">Suggested checks</p>
                    <ul className="mt-2 grid gap-1 text-[13px] leading-6 text-[#5F625E]">
                      {currentScreening.suggestedChecks.map((check) => (
                        <li key={check} className="flex items-start gap-2">
                          <CheckCircle2
                            className="mt-1 h-3.5 w-3.5 shrink-0 text-[#0F8F62]"
                            aria-hidden="true"
                          />
                          {check}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <p className="text-[12px] leading-5 text-[#8E918B]">
                  Advisory only — verify independently before granting access.
                </p>
              </div>
            )}
            {currentError ? (
              <p className="mt-4 rounded-[8px] border border-[#F1D9CE] bg-[#FBEFE8] px-3 py-2 text-[13px] leading-5 text-[#A86642]">
                {currentError}
              </p>
            ) : null}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Status and broker decisions"
          action={
            <CardHeaderIcon>
              <FileText className="h-4 w-4" aria-hidden="true" />
            </CardHeaderIcon>
          }
        />
        <ul className="grid gap-0 divide-y divide-[#E7E7E7]">
          {auditTrail.map((event) => (
            <li key={event.id} className="grid gap-3 px-6 py-5 sm:grid-cols-[28px_1fr]">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#E7E7E7] bg-white text-[#171719]">
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
                  <span className="text-[12px] uppercase tracking-[0.14em] text-[#8E918B]">
                    {formatDate(event.occurredAt)}
                  </span>
                </div>
                <h3 className="mt-2 text-[14px] font-medium text-[#171719]">{event.label}</h3>
                <p className="mt-1 text-[13px] leading-6 text-[#5F625E]">{event.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
