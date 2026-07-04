"use client";

import Link from "next/link";
import { ArrowRight, Check, Circle, Trophy, XCircle } from "lucide-react";
import type {
  BuyerProfile,
  Conversation,
  DealRoom,
  FollowUpDraft,
  MatchResult,
  VerificationCase,
} from "@/lib/types";
import { cn } from "@/lib/utils";

/* Six-step deal workflow shown at the top of a buyer detail page — the deal's
   spine. Every step is both a PLACE (click to go work on it) and an ACTION
   (the current step carries the concrete next move that advances the deal).

   State is DERIVED from real data — we never store step state on the buyer.
   In-progress states (unsent draft, draft deal room) show an amber dot so an
   unfinished flow doesn't silently disappear. */

type StepId = "capture" | "qualify" | "match" | "share" | "view" | "close";
type StepState = "done" | "current" | "in-progress" | "pending" | "won" | "lost";

/* Where a step (or its action) sends the broker. Tabs switch in-page; hrefs
   navigate; "stage" scrolls to the header stage control. */
export type WorkflowTab = "timeline" | "trust" | "matches";
type StepNav =
  | { kind: "tab"; tab: WorkflowTab }
  | { kind: "href"; href: string }
  | { kind: "stage" };

export type DealWorkflowInputs = {
  buyer: BuyerProfile;
  conversations: Conversation[];
  matches: MatchResult[];
  drafts: FollowUpDraft[];
  dealRoom?: DealRoom;
  verification?: VerificationCase;
};

type ResolvedStep = {
  id: StepId;
  label: string;
  state: StepState;
  hint?: string;
  /* Where clicking the step body goes. Absent → not interactive (a pending
     step with no meaningful destination yet). */
  nav?: StepNav;
  /* The concrete next action, shown as a button on the current/in-progress
     step. */
  action?: { label: string; nav: StepNav };
};

const STAGE_ORDER: BuyerProfile["currentStage"][] = [
  "New Inquiry",
  "Qualified",
  "Shortlist Sent",
  "Viewing Planned",
  "Negotiation",
  "Closed Won",
];

function stageIndex(stage: BuyerProfile["currentStage"]) {
  if (stage === "Closed Lost") return STAGE_ORDER.length - 1;
  return STAGE_ORDER.indexOf(stage);
}

export function resolveWorkflowSteps({
  buyer,
  conversations,
  matches,
  drafts,
  dealRoom,
  verification,
}: DealWorkflowInputs): ResolvedStep[] {
  const stage = buyer.currentStage;
  const stageIdx = stageIndex(stage);
  const isClosedWon = stage === "Closed Won";
  const isClosedLost = stage === "Closed Lost";
  const hasConversations = conversations.length > 0;
  const conversationNeedsSummary = conversations.some((c) => c.needsSummary);
  const hasMatches = matches.length > 0;
  const hasDealRoom = Boolean(dealRoom);
  const dealRoomDraft = dealRoom?.status === "Draft";
  const hasUnsentDrafts = drafts.some((d) => d.status !== "Approved");
  const viewingReached = stageIdx >= STAGE_ORDER.indexOf("Viewing Planned");
  const hasItinerary = (dealRoom?.itinerary?.length ?? 0) > 0;

  const captureHref = `/voice-crm?buyer=${buyer.id}`;
  const roomHref = dealRoom ? `/deal-rooms/${dealRoom.id}` : `/deal-rooms/new?buyer=${buyer.id}`;

  // Capture — a call/note is on file. Always reachable via the Timeline tab.
  const capture: ResolvedStep = {
    id: "capture",
    label: "Capture",
    state: "done",
    hint: conversationNeedsSummary
      ? "Conversation needs summary"
      : hasConversations
        ? undefined
        : "No conversations yet",
    nav: { kind: "tab", tab: "timeline" },
    action: conversationNeedsSummary
      ? { label: "Finish summary", nav: { kind: "href", href: captureHref } }
      : { label: "Capture a call", nav: { kind: "href", href: captureHref } },
  };

  // Qualify — verification decided + stage advanced. Lives on the Trust tab.
  const qualifyDone = stageIdx >= STAGE_ORDER.indexOf("Qualified");
  const qualify: ResolvedStep = {
    id: "qualify",
    label: "Qualify",
    state: qualifyDone ? "done" : "pending",
    hint: verification ? `Verification · ${verification.status}` : "Not verified yet",
    nav: { kind: "tab", tab: "trust" },
    action: { label: "Review & verify", nav: { kind: "tab", tab: "trust" } },
  };

  // Match — matches surfaced; advances once a shortlist room is created.
  const matchState: StepState = hasMatches ? (hasDealRoom ? "done" : "in-progress") : "pending";
  const match: ResolvedStep = {
    id: "match",
    label: "Match",
    state: matchState,
    hint: hasMatches
      ? `${matches.length} candidate${matches.length === 1 ? "" : "s"}`
      : "No matches yet",
    nav: { kind: "tab", tab: "matches" },
    action: hasMatches
      ? {
          label: hasDealRoom ? "Review matches" : `Review ${matches.length} & build shortlist`,
          nav: { kind: "tab", tab: "matches" },
        }
      : undefined,
  };

  // Share — a deal room exists and is shared. Opens the buyer's room.
  const shareState: StepState = hasDealRoom ? (dealRoomDraft ? "in-progress" : "done") : "pending";
  const share: ResolvedStep = {
    id: "share",
    label: "Share",
    state: shareState,
    hint: hasDealRoom
      ? dealRoomDraft
        ? "Draft room, not shared"
        : hasUnsentDrafts
          ? "Draft follow-up pending"
          : "Shared"
      : hasMatches
        ? undefined
        : "Build a shortlist first",
    nav: hasDealRoom || hasMatches ? { kind: "href", href: roomHref } : undefined,
    action: hasDealRoom
      ? { label: dealRoomDraft ? "Open & share room" : "Open room", nav: { kind: "href", href: roomHref } }
      : hasMatches
        ? { label: "Create deal room", nav: { kind: "href", href: roomHref } }
        : undefined,
  };

  // View — a viewing is scheduled (itinerary on the room, or stage advanced).
  const viewState: StepState = viewingReached || hasItinerary ? "done" : "pending";
  const view: ResolvedStep = {
    id: "view",
    label: "View",
    state: viewState,
    hint: hasItinerary
      ? `${dealRoom!.itinerary.length} scheduled`
      : hasDealRoom
        ? undefined
        : "Share a room first",
    nav: hasDealRoom ? { kind: "href", href: roomHref } : undefined,
    action: hasDealRoom
      ? { label: "Schedule viewing", nav: { kind: "href", href: roomHref } }
      : undefined,
  };

  // Close — terminal outcome, recorded via the header Stage control.
  const close: ResolvedStep = {
    id: "close",
    label: "Close",
    state: isClosedWon ? "won" : isClosedLost ? "lost" : "pending",
    hint: isClosedWon
      ? buyer.closedValueEur
        ? `Won · ${(buyer.closedValueEur / 1_000_000).toFixed(1)}M`
        : "Won"
      : isClosedLost
        ? buyer.closedReason
          ? `Lost · ${buyer.closedReason}`
          : "Lost"
        : "Use the Stage button",
    nav: { kind: "stage" },
    action: isClosedWon || isClosedLost ? undefined : { label: "Mark won / lost", nav: { kind: "stage" } },
  };

  const steps = [capture, qualify, match, share, view, close];

  // Single focus: the earliest step that isn't done/terminal. If it's already
  // in-progress it stays the focus (amber); only promote a plain pending step
  // to "current" so we never double-highlight two steps.
  const focusIdx = steps.findIndex(
    (s) => s.state !== "done" && s.state !== "won" && s.state !== "lost",
  );
  if (focusIdx >= 0 && steps[focusIdx].state === "pending") {
    steps[focusIdx].state = "current";
  }

  return steps;
}

const TAB_FOR_STEP: Partial<Record<StepId, WorkflowTab>> = {
  capture: "timeline",
  qualify: "trust",
  match: "matches",
};

export function DealWorkflowStepper({
  onSelectTab,
  onFocusStage,
  activeTab,
  ...inputs
}: DealWorkflowInputs & {
  onSelectTab?: (tab: WorkflowTab) => void;
  onFocusStage?: () => void;
  /* The tab currently shown in the profile card, so the matching step reads
     as selected. */
  activeTab?: string;
}) {
  const steps = resolveWorkflowSteps(inputs);
  const current = steps.find((s) => s.state === "current" || s.state === "in-progress");

  function go(nav: StepNav) {
    if (nav.kind === "tab") onSelectTab?.(nav.tab);
    else if (nav.kind === "stage") onFocusStage?.();
  }

  return (
    <section
      aria-label="Deal workflow"
      className="rounded-[12px] border border-[#E7E7E7] bg-white px-4 py-4 sm:px-5"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="bb-mono-label">Deal workflow</p>
        {current?.action ? (
          <StepActionButton
            action={current.action}
            go={go}
            prominent
          />
        ) : (
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E918B]">
            Capture · Qualify · Match · Share · View · Close
          </p>
        )}
      </div>
      <ol className="mt-3 flex flex-wrap gap-2 sm:gap-1.5">
        {steps.map((step) => {
          const stepTab = TAB_FOR_STEP[step.id];
          const isActiveTab = stepTab !== undefined && stepTab === activeTab;
          return (
            <li key={step.id} className="flex min-w-0 flex-1 basis-[140px] items-stretch">
              <StepPill step={step} go={go} isActiveTab={isActiveTab} />
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function StepPill({
  step,
  go,
  isActiveTab,
}: {
  step: ResolvedStep;
  go: (nav: StepNav) => void;
  isActiveTab: boolean;
}) {
  const isDone = step.state === "done" || step.state === "won";
  const isCurrent = step.state === "current";
  const isProgress = step.state === "in-progress";
  const isLost = step.state === "lost";
  const isWon = step.state === "won";
  const interactive = Boolean(step.nav);

  const body = (
    <>
      <StepIcon state={step.state} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p
            className={cn(
              "truncate text-[13px] font-semibold leading-[1.2]",
              isWon ? "text-[#0F8F62]" : isLost ? "text-[#8E918B]" : "text-[#171719]",
            )}
          >
            {step.label}
          </p>
          {isProgress ? (
            <span
              aria-label="In progress"
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#A86642]"
            />
          ) : null}
          {interactive ? (
            <ArrowRight
              aria-hidden="true"
              className="ml-auto h-3 w-3 shrink-0 text-[#A9ABA5] opacity-0 transition-opacity group-hover:opacity-100"
            />
          ) : null}
        </div>
        {step.hint ? (
          <p className="mt-0.5 truncate text-[11.5px] leading-[1.4] text-[#5F625E]">{step.hint}</p>
        ) : null}
      </div>
    </>
  );

  const baseClass = cn(
    "group flex min-w-0 flex-1 items-start gap-2 rounded-[8px] border px-3 py-2.5 text-left transition-all",
    isCurrent && "border-[#003C33] bg-[#F1F2EE]",
    isProgress && "border-[#F0DDD0] bg-[#F0DDD0]/40",
    isDone && !isCurrent && "border-[#E1F1EA] bg-[#E1F1EA]/40",
    isLost && "border-[#E7E7E7] bg-white",
    !isDone && !isCurrent && !isProgress && !isLost && "border-[#E7E7E7] bg-white",
    isActiveTab && "ring-2 ring-[#003C33] ring-offset-1",
    interactive &&
      "cursor-pointer hover:border-[#003C33] hover:bg-[#F1F2EE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]",
  );

  if (!interactive) {
    return <div className={baseClass}>{body}</div>;
  }

  if (step.nav!.kind === "href") {
    return (
      <Link className={baseClass} href={step.nav!.href}>
        {body}
      </Link>
    );
  }

  return (
    <button className={baseClass} onClick={() => go(step.nav!)} type="button">
      {body}
    </button>
  );
}

function StepActionButton({
  action,
  go,
  prominent,
}: {
  action: { label: string; nav: StepNav };
  go: (nav: StepNav) => void;
  prominent?: boolean;
}) {
  const cls = cn(
    "inline-flex items-center gap-1.5 rounded-[8px] px-3 text-[12.5px] font-medium transition-colors",
    prominent
      ? "min-h-8 bg-[#003C33] text-white hover:bg-[#0B4A3F]"
      : "min-h-8 border border-[#E7E7E7] bg-white text-[#003C33] hover:border-[#003C33]",
  );
  const label = (
    <>
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">
        Next
      </span>
      {action.label}
      <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
    </>
  );

  if (action.nav.kind === "href") {
    return (
      <Link className={cls} href={action.nav.href}>
        {label}
      </Link>
    );
  }
  return (
    <button className={cls} onClick={() => go(action.nav)} type="button">
      {label}
    </button>
  );
}

function StepIcon({ state }: { state: StepState }) {
  if (state === "won") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0F8F62] text-white">
        <Trophy aria-hidden="true" className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (state === "lost") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#E7E7E7] bg-white text-[#8E918B]">
        <XCircle aria-hidden="true" className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (state === "done") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0F8F62] text-white">
        <Check aria-hidden="true" className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (state === "current") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-[#003C33] bg-white text-[#003C33]">
        <span className="h-2 w-2 rounded-full bg-[#003C33]" />
      </span>
    );
  }
  if (state === "in-progress") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-[#A86642] bg-white text-[#A86642]">
        <span className="h-2 w-2 rounded-full bg-[#A86642]" />
      </span>
    );
  }
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#E7E7E7] bg-white text-[#A9ABA5]">
      <Circle aria-hidden="true" className="h-3 w-3" />
    </span>
  );
}
