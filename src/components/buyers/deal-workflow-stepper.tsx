import Link from "next/link";
import { Check, Circle, Trophy, XCircle } from "lucide-react";
import type {
  BuyerProfile,
  Conversation,
  DealRoom,
  FollowUpDraft,
  MatchResult,
  VerificationCase,
} from "@/lib/types";
import { cn } from "@/lib/utils";

/* Six-step deal workflow shown at the top of a buyer detail page.
   State is DERIVED from real data — we never store step state on the buyer.
   "Draft-in-progress" states (unsent draft, draft deal room) show an amber
   dot so an unfinished flow doesn't silently disappear. */

type StepId = "capture" | "qualify" | "match" | "share" | "view" | "close";
type StepState = "done" | "current" | "in-progress" | "pending" | "won" | "lost";

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
  action?: { label: string; href: string };
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
  // Treat Closed Lost as terminal (no forward progress on active stages).
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

  // Capture: any buyer file exists; hint if a conversation needs a summary.
  const capture: ResolvedStep = {
    id: "capture",
    label: "Capture",
    state: "done",
    hint: conversationNeedsSummary
      ? "Conversation needs summary"
      : hasConversations
        ? undefined
        : "No conversations yet",
    action: conversationNeedsSummary
      ? { label: "Finish summary", href: "/voice-crm" }
      : undefined,
  };

  // Qualify: stage past New Inquiry OR verification cleared.
  const qualifyDone = stageIdx >= STAGE_ORDER.indexOf("Qualified");
  const qualify: ResolvedStep = {
    id: "qualify",
    label: "Qualify",
    state: qualifyDone ? "done" : "pending",
    hint: verification
      ? `Verification · ${verification.status}`
      : "No verification case",
  };

  // Match: matches exist. In progress if we have matches but no deal room.
  const matchState: StepState = hasMatches
    ? hasDealRoom
      ? "done"
      : "in-progress"
    : "pending";
  const match: ResolvedStep = {
    id: "match",
    label: "Match",
    state: matchState,
    hint: hasMatches ? `${matches.length} candidate${matches.length === 1 ? "" : "s"}` : undefined,
    action: hasMatches && !hasDealRoom
      ? { label: `Review ${matches.length} match${matches.length === 1 ? "" : "es"}`, href: `/buyers/${buyer.id}?tab=matches` }
      : undefined,
  };

  // Share: deal room exists. In-progress if it's still Draft.
  const shareState: StepState = hasDealRoom
    ? dealRoomDraft
      ? "in-progress"
      : "done"
    : "pending";
  const share: ResolvedStep = {
    id: "share",
    label: "Share",
    state: shareState,
    hint: hasDealRoom
      ? dealRoomDraft
        ? "Draft room, not shared"
        : hasUnsentDrafts
          ? "Draft follow-up pending"
          : undefined
      : undefined,
    action: hasDealRoom
      ? undefined
      : hasMatches
        ? { label: "Create deal room", href: `/deal-rooms/new?buyer=${buyer.id}` }
        : undefined,
  };

  // View: stage reached Viewing Planned or itinerary exists in the deal room.
  const viewState: StepState = viewingReached || hasItinerary ? "done" : "pending";
  const view: ResolvedStep = {
    id: "view",
    label: "View",
    state: viewState,
    hint: hasItinerary ? `${dealRoom!.itinerary.length} scheduled` : undefined,
  };

  // Close: terminal outcome. Won green, Lost muted.
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
        : undefined,
  };

  const steps = [capture, qualify, match, share, view, close];

  // Mark the first non-done, non-terminal step as "current" — that's the one
  // that carries the primary next-action link.
  const currentIdx = steps.findIndex(
    (s) => s.state !== "done" && s.state !== "won" && s.state !== "lost",
  );
  if (currentIdx >= 0 && steps[currentIdx].state !== "in-progress") {
    steps[currentIdx].state = "current";
  }

  return steps;
}

export function DealWorkflowStepper(props: DealWorkflowInputs) {
  const steps = resolveWorkflowSteps(props);

  return (
    <section
      aria-label="Deal workflow"
      className="rounded-[12px] border border-[#E7E7E7] bg-white px-4 py-4 sm:px-5"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="bb-mono-label">Deal workflow</p>
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E918B]">
          Capture · Qualify · Match · Share · View · Close
        </p>
      </div>
      <ol className="mt-3 flex flex-wrap gap-2 sm:gap-1.5">
        {steps.map((step, index) => (
          <li key={step.id} className="flex min-w-0 flex-1 basis-[140px] items-stretch">
            <StepPill step={step} isLast={index === steps.length - 1} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function StepPill({ step, isLast }: { step: ResolvedStep; isLast: boolean }) {
  const isDone = step.state === "done" || step.state === "won";
  const isCurrent = step.state === "current";
  const isProgress = step.state === "in-progress";
  const isLost = step.state === "lost";
  const isWon = step.state === "won";

  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-start gap-2 rounded-[8px] border px-3 py-2.5 transition-colors",
        isCurrent && "border-[#003C33] bg-[#F1F2EE]",
        isDone && !isCurrent && "border-[#E1F1EA] bg-[#E1F1EA]/40",
        isProgress && "border-[#F0DDD0] bg-[#F0DDD0]/40",
        isLost && "border-[#E7E7E7] bg-white",
        !isDone && !isCurrent && !isProgress && !isLost && "border-[#E7E7E7] bg-white",
        isLast ? "" : "mr-0",
      )}
    >
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
        </div>
        {step.hint ? (
          <p className="mt-0.5 truncate text-[11.5px] leading-[1.4] text-[#5F625E]">
            {step.hint}
          </p>
        ) : null}
        {step.action && isCurrent ? (
          <Link
            className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-medium text-[#003C33] hover:underline"
            href={step.action.href}
          >
            {step.action.label} →
          </Link>
        ) : null}
      </div>
    </div>
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
