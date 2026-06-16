"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Bot,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Info,
  Mic,
  RotateCcw,
  Send,
  Sparkles,
  Target,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { type BrokerSegment } from "@/lib/broker-segments";
import { getVoiceToCrmWorkflow, nowIso } from "@/lib/services";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  mirrorWorkflowEvent,
  readPersisted,
  saveSessionBuyer,
  writePersisted,
} from "@/lib/browser-persistence";
import type {
  AuditEvent,
  BrokerTask,
  BuyerProfile,
  DraftStatus,
  FollowUpDraft,
} from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardHeaderIcon,
  EmptyState,
  StatusDot,
} from "./ui";
import { ConfirmDialog, ToastViewport } from "./app-feedback";
import { Tile } from "./dashboard/visuals";
import { SelectMenu } from "./select-menu";
import { VoiceRecorder } from "./voice-recorder";

type CaptureMode = "existing" | "new";

const exampleCallSummary =
  "Spoke with Daniel Brenner this morning. He wants a 60 to 75 foot yacht, modern light interior, EU VAT paid, ready before summer, budget around 3 million. He asked for a Ferretti and Azimut comparison, and needs viewing windows by tomorrow. Spouse cares about natural light. Prefers concise WhatsApp first, detailed email after the shortlist.";

type PersistedVoiceWorkspace = {
  callSummary: string;
  parsedSummary: string;
  drafts: FollowUpDraft[];
  auditLog: AuditEvent[];
  activeRunId?: string;
};

type PersistedVoiceRun = {
  id: string;
  buyerId?: string;
  buyerName: string;
  summary: string;
  taskCount: number;
  draftCount: number;
  createdAt: string;
};

const activeVoiceKey = "brobroker:voice:active";
const voiceRunsKey = "brobroker:voice:runs";

function createAuditId(id: string, action: string) {
  return `audit-${id}-${action}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function draftStatusTone(status: DraftStatus): "success" | "warning" | "neutral" {
  if (status === "Approved") return "success";
  if (status === "Edited") return "warning";
  return "neutral";
}

function taskPriorityTone(priority: string): "error" | "warning" | "info" | "neutral" {
  if (priority === "Critical") return "error";
  if (priority === "High") return "warning";
  if (priority === "Medium") return "info";
  return "neutral";
}

/* Channel-aware "open" link for a follow-up draft — pre-fills the user's email,
   WhatsApp, or SMS composer with the drafted subject/body. "Call Summary" has no
   send target, so it returns null (Copy is the only action there). */
function draftShareHref(draft: FollowUpDraft): string | null {
  const body = encodeURIComponent(draft.body);
  const combined = encodeURIComponent([draft.subject, draft.body].filter(Boolean).join("\n\n"));
  switch (draft.channel) {
    case "Email":
      return `mailto:?subject=${encodeURIComponent(draft.subject)}&body=${body}`;
    case "WhatsApp":
      return `https://api.whatsapp.com/send?text=${combined}`;
    case "SMS":
      return `sms:?&body=${combined}`;
    default:
      return null;
  }
}

/* Light-blue informational callout with a leading info icon. Re-key it (e.g.
   key={mode}) to replay the gentle expand-in animation on content change. */
function InfoNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "bb-expand-note flex items-start gap-2.5 rounded-[12px] border border-[#CBDDEB] bg-[#E0ECF2] px-4 py-3 text-[13px] leading-6 text-[#3D6F8F]",
        className,
      )}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0">{children}</span>
    </div>
  );
}

/* "Clear capture" lives in the AppShell top bar (pageActions), outside this
   component's tree, so it signals a reset via a window event. */
export const VOICE_CRM_CLEAR_EVENT = "bb:voice-crm-clear";

export function VoiceCrmClearButton() {
  return (
    <button
      className="inline-flex min-h-9 items-center gap-1.5 rounded-[8px] border border-[#E7E7E7] bg-white px-3 text-[13px] font-medium text-[#171719] transition-colors hover:border-[#003C33] hover:bg-[#F1F2EE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]"
      onClick={() => window.dispatchEvent(new CustomEvent(VOICE_CRM_CLEAR_EVENT))}
      type="button"
    >
      <RotateCcw className="h-4 w-4" aria-hidden="true" />
      Clear capture
    </button>
  );
}

export function VoiceToCrmWorkspace({
  includeDemo = true,
  prefillBuyerId,
  segment,
  storedBuyers = [],
}: {
  includeDemo?: boolean;
  prefillBuyerId?: string;
  segment?: BrokerSegment;
  storedBuyers?: BuyerProfile[];
}) {
  // The persisted workspace lives in localStorage (client-only). Seed to
  // SSR-safe defaults and hydrate after mount (see effect below) so the first
  // client render matches the server HTML — otherwise React throws a hydration
  // mismatch on values like the detected buyer name.
  const [callSummary, setCallSummary] = useState("");
  const [parsedSummary, setParsedSummary] = useState("");
  const workflow = useMemo(
    () => getVoiceToCrmWorkflow(parsedSummary, segment, { includeDemo }),
    [parsedSummary, segment, includeDemo],
  );
  const [drafts, setDrafts] = useState<FollowUpDraft[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEvent[]>([]);
  const [activeRunId, setActiveRunId] = useState("");
  const [savedRuns, setSavedRuns] = useState<PersistedVoiceRun[]>([]);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingDeleteRunId, setPendingDeleteRunId] = useState<string | null>(null);
  // Default to "existing" only if we actually have saved buyers; otherwise "new"
  // so the workspace isn't stuck with an empty combobox.
  const [captureMode, setCaptureMode] = useState<CaptureMode>(
    storedBuyers.length ? "existing" : "new",
  );
  // Pre-select via URL param (?buyer=<id>) when present — used by dashboard's
  // "Defer via voice note" link to deep-link into a specific buyer. Falls back
  // to the first saved buyer when the requested id isn't on file.
  const [selectedBuyerId, setSelectedBuyerId] = useState<string>(() => {
    if (prefillBuyerId && storedBuyers.some((buyer) => buyer.id === prefillBuyerId)) {
      return prefillBuyerId;
    }
    return storedBuyers[0]?.id ?? "";
  });

  const selectedBuyer = useMemo(
    () => storedBuyers.find((buyer) => buyer.id === selectedBuyerId),
    [storedBuyers, selectedBuyerId],
  );

  // `hydrated` is false on the server and on the first client render, then
  // flips true after hydration — useSyncExternalStore swaps server→client
  // snapshot without a hydration mismatch and without setState-in-effect.
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  // Seed the persisted workspace + saved runs once, at render time after
  // hydration (guarded by state — the allowed "adjust state during render"
  // pattern). Reading localStorage here is safe: it only runs post-hydration.
  const [seeded, setSeeded] = useState(false);
  if (hydrated && !seeded) {
    setSeeded(true);
    const persisted = readPersisted<PersistedVoiceWorkspace | null>(activeVoiceKey, null);
    if (persisted) {
      if (persisted.callSummary) setCallSummary(persisted.callSummary);
      if (persisted.parsedSummary) setParsedSummary(persisted.parsedSummary);
      if (persisted.drafts?.length) setDrafts(persisted.drafts);
      if (persisted.auditLog?.length) setAuditLog(persisted.auditLog);
      if (persisted.activeRunId) setActiveRunId(persisted.activeRunId);
    }
    const runs = readPersisted<PersistedVoiceRun[]>(voiceRunsKey, []);
    if (runs.length) setSavedRuns(runs);
  }

  const hasParsed = parsedSummary.trim().length > 0;

  async function parseCurrentSummary() {
    const trimmed = callSummary.trim();
    if (!trimmed) return;
    const nextWorkflow = getVoiceToCrmWorkflow(callSummary, segment, { includeDemo });
    const runId = `voice-run-${Date.now()}`;
    const runDrafts = nextWorkflow.drafts.map((draft) => ({
      ...draft,
      id: `${runId}-${draft.id}`,
    }));
    const runTasks = nextWorkflow.tasks.map((task) => ({
      ...task,
      id: `${runId}-${task.id}`,
    }));

    // Buyer-attach branching:
    // - "existing" mode → reuse selected buyer's id + name so the upsert lands
    //   on the same buyers row (Supabase upsert is keyed on id).
    // - "new" mode → fall back to extracted buyer or a synthetic voice-run id.
    const useExistingBuyer = captureMode === "existing" && selectedBuyer;
    const effectiveBuyerName = useExistingBuyer
      ? selectedBuyer.name
      : nextWorkflow.extracted.buyerName;
    const buyerId = useExistingBuyer
      ? selectedBuyer.id
      : (nextWorkflow.buyer?.id ?? buildVoiceBuyerId(runId, nextWorkflow.extracted.buyerName));

    // Carry the buyer-attach decision into downstream workflow snapshots so the
    // parsed CRM card and persistence both reference the same buyer name.
    const effectiveWorkflow = useExistingBuyer
      ? {
          ...nextWorkflow,
          extracted: {
            ...nextWorkflow.extracted,
            buyerName: effectiveBuyerName,
          },
        }
      : nextWorkflow;

    setParsedSummary(callSummary);
    setDrafts(runDrafts);
    setAuditLog(effectiveWorkflow.auditTrail);
    setActiveRunId(runId);
    setSyncMessage(null);
    setSyncError(null);
    const run = {
      id: runId,
      buyerId,
      buyerName: effectiveBuyerName,
      summary: effectiveWorkflow.extracted.pipelineUpdate,
      taskCount: effectiveWorkflow.tasks.length,
      draftCount: effectiveWorkflow.drafts.length,
      createdAt: nowIso,
    };
    setSavedRuns((currentRuns) => {
      const nextRuns = [
        run,
        ...currentRuns,
      ].slice(0, 8);
      writePersisted(voiceRunsKey, nextRuns);
      mirrorWorkflowEvent("voice_crm_parse", run.id, {
        extracted: effectiveWorkflow.extracted,
        tasks: effectiveWorkflow.tasks,
        drafts: effectiveWorkflow.drafts,
        buyerAttachMode: captureMode,
      });
      return nextRuns;
    });
    saveSessionBuyer({
      id: buyerId,
      name: effectiveBuyerName,
      source: "Voice CRM",
      summary: effectiveWorkflow.extracted.pipelineUpdate,
      budgetLabel: effectiveWorkflow.profileUpdates.budget,
      urgency: effectiveWorkflow.extracted.urgency,
      createdAt: nowIso,
    });

    try {
      const persisted = await persistVoiceRunToSupabase({
        callSummary,
        drafts: runDrafts,
        run,
        segment,
        tasks: runTasks,
        workflow: effectiveWorkflow,
      });
      setSyncMessage(
        persisted
          ? "Buyer memory, tasks, and follow-up drafts saved."
          : "Saved on this device. Sign in to keep it with your workspace.",
      );
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Could not save this voice CRM run.");
    }
  }

  function resetWorkspace() {
    setCallSummary("");
    setParsedSummary("");
    setDrafts([]);
    setAuditLog([]);
    setActiveRunId("");
    setSyncMessage(null);
    setSyncError(null);
    writePersisted(activeVoiceKey, null);
  }

  async function copyDraft(draft: FollowUpDraft) {
    const text = [draft.subject, draft.body].filter(Boolean).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setSyncError(null);
      setSyncMessage("Draft copied to clipboard.");
    } catch {
      setSyncMessage(null);
      setSyncError("Couldn’t copy automatically — select and copy the text manually.");
    }
  }

  function updateDraft(id: string, field: "subject" | "body", value: string) {
    setDrafts((currentDrafts) =>
      currentDrafts.map((draft) =>
        draft.id === id
          ? {
              ...draft,
              [field]: value,
              status: "Edited",
            }
          : draft,
      ),
    );

    setAuditLog((currentEvents) => {
      const editEventId = `audit-${id}-edited`;
      if (currentEvents.some((event) => event.id === editEventId)) {
        return currentEvents;
      }

      return [
        {
          id: editEventId,
          actor: "Broker",
          label: "Draft edited",
          detail: "Broker changed generated content. This draft now needs approval again before hand-off.",
          occurredAt: nowIso,
        },
        ...currentEvents,
      ];
    });
  }

  async function approveDraft(id: string) {
    const draft = drafts.find((candidate) => candidate.id === id);
    setDrafts((currentDrafts) =>
      currentDrafts.map((candidate) =>
        candidate.id === id ? { ...candidate, status: "Approved" } : candidate,
      ),
    );
    setAuditLog((currentEvents) => [
      {
        id: createAuditId(id, "approved"),
        actor: "Broker",
        label: "Draft approved",
        detail: `${draft?.kind ?? "Follow-up"} marked approved. No external message was sent from the prototype.`,
        occurredAt: nowIso,
      },
      ...currentEvents,
    ]);
    mirrorWorkflowEvent("voice_draft_approved", id, draft);
    setSyncError(null);

    if (!draft) return;

    try {
      const persisted = await persistDraftApprovalToSupabase(draft);
      setSyncMessage(
        persisted
          ? "Draft approved and saved."
          : "Draft approved on this device. No synced draft was found.",
      );
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Could not save this approval.");
    }
  }

  async function deleteSavedRun(runId: string) {
    const run = savedRuns.find((candidate) => candidate.id === runId);
    const nextRuns = savedRuns.filter((candidate) => candidate.id !== runId);

    setSavedRuns(nextRuns);
    writePersisted(voiceRunsKey, nextRuns);

    if (run?.buyerId) {
      const sessionBuyers = readPersisted<Array<{ id: string }>>("brobroker:buyers:session", []);
      writePersisted(
        "brobroker:buyers:session",
        sessionBuyers.filter((buyer) => buyer.id !== run.buyerId),
      );
    }

    if (activeRunId === runId) {
      resetWorkspace();
    }

    setSyncError(null);
    setPendingDeleteRunId(null);
    setSyncMessage("Removed the saved CRM capture from this browser.");

    try {
      const persisted = await deleteVoiceRunFromSupabase(run ?? { id: runId });
      if (persisted) {
        setSyncMessage("Deleted the saved CRM capture, generated tasks, and draft follow-ups.");
      }
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Could not delete this CRM capture.");
    }
  }

  const approvedCount = drafts.filter((draft) => draft.status === "Approved").length;
  // When the user attached this parse to an existing saved buyer, prefer that
  // buyer's real name over the placeholder ("New buyer") the parser extracts
  // from the call text. Falls back to the parser's match for new-buyer mode.
  const attachedBuyerName =
    captureMode === "existing" && selectedBuyer ? selectedBuyer.name : null;
  const displayBuyerName =
    attachedBuyerName ?? workflow.buyer?.name ?? workflow.extracted.buyerName;
  const buyerLabel = hasParsed ? displayBuyerName : "—";
  const urgencyLabel = hasParsed ? workflow.extracted.urgency : "—";
  const approvalsLabel = drafts.length > 0 ? `${approvedCount}/${drafts.length}` : "—";
  const pendingDeleteRun = savedRuns.find((run) => run.id === pendingDeleteRunId);
  // Build-shortlist hand-off: an attached saved buyer has a browsable detail
  // page (deep-link to its Matches tab); a brand-new voice buyer isn't saved as
  // a page yet, so fall back to the general matching workspace.
  const shortlistHref =
    captureMode === "existing" && selectedBuyer
      ? `/buyers/${selectedBuyer.id}?tab=matches`
      : "/matching";

  useEffect(() => {
    if (!parsedSummary.trim() && drafts.length === 0 && auditLog.length === 0) return;
    writePersisted(activeVoiceKey, { activeRunId, callSummary, parsedSummary, drafts, auditLog });
  }, [activeRunId, auditLog, callSummary, drafts, parsedSummary]);

  // The top-bar "Clear capture" button resets us via a window event. A ref
  // keeps the latest reset handler current without re-subscribing each render.
  const clearRef = useRef<() => void>(() => {});
  useEffect(() => {
    clearRef.current = resetWorkspace;
  });
  useEffect(() => {
    const handler = () => clearRef.current();
    window.addEventListener(VOICE_CRM_CLEAR_EVENT, handler);
    return () => window.removeEventListener(VOICE_CRM_CLEAR_EVENT, handler);
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1536px] px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
      <ToastViewport
        message={syncError ?? syncMessage}
        onDismiss={() => {
          setSyncMessage(null);
          setSyncError(null);
        }}
        tone={syncError ? "error" : "success"}
      />
      <ConfirmDialog
        confirmLabel="Delete capture"
        description={
          pendingDeleteRun
            ? `This will remove ${pendingDeleteRun.buyerName}'s saved CRM capture, generated tasks, and draft follow-ups.`
            : "This will remove the saved CRM capture, generated tasks, and draft follow-ups."
        }
        onCancel={() => setPendingDeleteRunId(null)}
        onConfirm={() => {
          if (pendingDeleteRunId) {
            void deleteSavedRun(pendingDeleteRunId);
          }
        }}
        open={Boolean(pendingDeleteRunId)}
        title="Delete saved CRM capture?"
      />

      {/* 3-tile metric fold band — Buyer detected / Urgency / Approvals.
          Title + "Clear capture" now live in the AppShell top bar. */}
      <section
        aria-label="Voice CRM at a glance"
        className="grid grid-cols-1 gap-4 md:grid-cols-3"
      >
        <Tile tone="paper">
          <p className="bb-mono-label">Buyer detected</p>
          <p className="bb-display mt-3 text-[1.5rem] font-medium leading-[1.1] text-[#171719]">
            {buyerLabel}
          </p>
          <p className="mt-2 text-[12.5px] leading-[1.5] text-[#5F625E]">
            {hasParsed
              ? captureMode === "existing"
                ? "Attached to saved buyer"
                : "New buyer"
              : "Awaiting parse"}
          </p>
        </Tile>
        <Tile tone="paper">
          <p className="bb-mono-label">Urgency</p>
          <p className="bb-display mt-3 text-[1.5rem] font-medium leading-[1.1] text-[#171719]">
            {urgencyLabel}
          </p>
          <p className="mt-2 text-[12.5px] leading-[1.5] text-[#5F625E]">
            {hasParsed ? workflow.extracted.pipelineUpdate : "Pipeline update appears after parse"}
          </p>
        </Tile>
        <Tile tone="paper">
          <p className="bb-mono-label">Approvals</p>
          <p className="bb-display mt-3 text-[1.5rem] font-medium leading-[1.1] text-[#171719] tabular-nums">
            {approvalsLabel}
          </p>
          <p className="mt-2 text-[12.5px] leading-[1.5] text-[#5F625E]">
            {drafts.length
              ? `${drafts.length - approvedCount} drafts pending review`
              : "No drafts generated yet"}
          </p>
        </Tile>
      </section>

      <div className="mt-8 grid gap-8">
          {/* One capture card: choose who the call is about, then type or
              dictate the note and parse — a single, logical flow. */}
          <Card>
            <CardHeader
              eyebrow="Voice CRM"
              title="Capture a call"
              description="Pick who the call is about, then paste or dictate the summary to parse it into CRM memory."
              action={
                <CardHeaderIcon>
                  <Mic className="h-4 w-4" aria-hidden="true" />
                </CardHeaderIcon>
              }
            />
            <div className="grid gap-5 px-6 py-5">
              {/* Compact segmented control (matches the buyer-detail tabs) sits
                  inline beside the saved-buyer select rather than full-width. */}
              <div className="flex flex-wrap items-end gap-3">
                <div className="grid gap-1.5">
                  <span className="block text-[11px] font-medium uppercase tracking-[0.12em] text-[#8E918B]">
                    Attach to
                  </span>
                  <div
                    aria-label="Capture mode"
                    className="inline-flex w-fit shrink-0 items-center gap-1 rounded-[8px] border border-[#D9DAD4] bg-white p-1 text-[13px] font-medium"
                    role="tablist"
                  >
                    <button
                      aria-selected={captureMode === "existing"}
                      className={cn(
                        "inline-flex min-h-9 shrink-0 items-center gap-2 rounded-[8px] px-3 transition-colors",
                        captureMode === "existing"
                          ? "bg-[#171719] text-white"
                          : "text-[#5F625E] hover:bg-[#F1F2EE]",
                      )}
                      disabled={!storedBuyers.length}
                      onClick={() => setCaptureMode("existing")}
                      role="tab"
                      type="button"
                    >
                      <Users className="h-3.5 w-3.5" aria-hidden="true" />
                      Existing buyer
                    </button>
                    <button
                      aria-selected={captureMode === "new"}
                      className={cn(
                        "inline-flex min-h-9 shrink-0 items-center gap-2 rounded-[8px] px-3 transition-colors",
                        captureMode === "new"
                          ? "bg-[#171719] text-white"
                          : "text-[#5F625E] hover:bg-[#F1F2EE]",
                      )}
                      onClick={() => {
                        // Starting a brand-new buyer means a clean slate — clear
                        // any restored/prior note + parse so nothing stale lingers.
                        if (captureMode !== "new") resetWorkspace();
                        setCaptureMode("new");
                      }}
                      role="tab"
                      type="button"
                    >
                      <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                      New buyer
                    </button>
                  </div>
                </div>

                {/* Saved buyer stays visible in both modes — just disabled when
                    capturing a new buyer (no more hide/show jump). */}
                {storedBuyers.length ? (
                  <SelectMenu
                    className="min-w-[220px] flex-1"
                    disabled={captureMode === "new"}
                    label="Saved buyer"
                    onChange={(value) => setSelectedBuyerId(value)}
                    options={storedBuyers.map((buyer) => ({
                      value: buyer.id,
                      label: buyer.name,
                      meta: [buyer.company, buyer.country].filter(Boolean).join(" · "),
                    }))}
                    value={selectedBuyerId}
                  />
                ) : null}
              </div>

              {/* Single info callout — light blue, info icon, re-keyed by mode so
                  it smoothly expands in when the broker switches tabs. */}
              <InfoNote key={captureMode}>
                {captureMode === "new"
                  ? "A new buyer record will be created from the parsed call. Move them to an existing buyer next time by selecting from the saved list above."
                  : storedBuyers.length
                    ? selectedBuyer
                      ? `Parsed memory will upsert into ${selectedBuyer.name}'s buyer row — preferences, tasks, and drafts stay attached to this saved profile.`
                      : "Select a saved buyer to attach this parse to their existing buyer row."
                    : "No saved buyers in this segment yet. Switch to “New buyer” to capture this call as a fresh profile."}
              </InfoNote>

              {/* Call note — type or dictate in one place. The recorder appends
                  to the text, it never replaces what's already there. */}
              <div className="grid gap-2">
                <span className="block text-[11px] font-medium uppercase tracking-[0.12em] text-[#8E918B]">
                  Call note
                </span>
                <div className="grid gap-4 sm:grid-cols-[7fr_3fr] sm:items-stretch">
                <textarea
                  aria-label="Call summary"
                  className="min-h-56 h-full w-full rounded-[12px] border border-[#D9DAD4] bg-white p-4 text-[15px] leading-7 text-[#171719] outline-none placeholder:text-[#A9ABA5] focus:border-[#003C33] focus:ring-2 focus:ring-[#003C33]/15"
                  onChange={(event) => setCallSummary(event.target.value)}
                  placeholder="Describe the call in your own words — buyer name, size, budget, must-haves, deal-breakers, urgency, and follow-up timing."
                  value={callSummary}
                />
                <VoiceRecorder
                  className="h-full min-h-56"
                  surfaceClassName="border-[#E1E3DC] bg-[#F1F2EE]"
                  onTranscribed={(transcript) =>
                    setCallSummary((current) => [current.trim(), transcript].filter(Boolean).join("\n\n"))
                  }
                />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button disabled={!callSummary.trim()} onClick={() => void parseCurrentSummary()} type="button">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Parse & save to CRM
                </Button>
                <Button
                  onClick={() => setCallSummary(exampleCallSummary)}
                  type="button"
                  variant="link"
                >
                  Load example
                </Button>
                {callSummary && callSummary !== parsedSummary ? (
                  <span className="text-[12px] uppercase tracking-[0.14em] text-[#8E918B]">
                    Unparsed changes
                  </span>
                ) : null}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Parsed CRM update"
              title="Buyer memory, tasks, and pipeline changes"
              description="Parsing saves the CRM capture for this workspace; approval only applies to follow-up drafts."
              action={
                <CardHeaderIcon>
                  <Bot className="h-4 w-4" aria-hidden="true" />
                </CardHeaderIcon>
              }
            />
            {hasParsed ? (
              <>
                {/* Attachment confirmation strip — only in existing mode with a real buyer selected. */}
                {captureMode === "existing" && selectedBuyer ? (
                  <div className="mx-6 mt-5 flex flex-wrap items-center gap-2 rounded-[12px] border border-[#E7E7E7] bg-white px-4 py-2.5 text-[12.5px] leading-6 text-[#5F625E]">
                    <Users className="h-3.5 w-3.5 text-[#8E918B]" aria-hidden="true" />
                    <span>
                      Attached to{" "}
                      <span className="font-medium text-[#171719]">{selectedBuyer.name}</span>
                      {selectedBuyer.company ? <> · {selectedBuyer.company}</> : null}
                    </span>
                  </div>
                ) : null}

                {/* Post-parse hand-off — turn the captured memory into a ranked
                    shortlist via the matching engine. */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5">
                  <p className="min-w-0 text-[12.5px] leading-6 text-[#5F625E]">
                    Memory and tasks are saved — build a ranked shortlist for this buyer next.
                  </p>
                  <Link
                    className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-[8px] bg-[#003C33] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#0a4a3f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]"
                    href={shortlistHref}
                  >
                    <Target className="h-4 w-4" aria-hidden="true" />
                    Build shortlist
                  </Link>
                </div>

                {/* Profile updates as a clean divided card + extracted preferences. */}
                <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
                  <div className="min-w-0">
                    <p className="bb-mono-label">Profile updates</p>
                    <div className="mt-3 overflow-hidden rounded-[12px] border border-[#E7E7E7] bg-white">
                      {[
                        ["Buyer", displayBuyerName],
                        ["Budget memory", workflow.profileUpdates.budget],
                        ["Pipeline", workflow.profileUpdates.pipelineStage],
                        ["Urgency", workflow.profileUpdates.urgency],
                      ].map(([label, value], index) => (
                        <div
                          key={label}
                          className={cn(
                            "flex items-baseline justify-between gap-4 px-4 py-3",
                            index > 0 && "border-t border-[#F1F2EE]",
                          )}
                        >
                          <span className="bb-mono-label shrink-0">{label}</span>
                          <span className="text-right text-[14px] font-medium leading-6 text-[#171719]">
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <p className="bb-mono-label">Extracted preferences</p>
                    {workflow.profileUpdates.preferences.length ? (
                      <div className="mt-3 overflow-hidden rounded-[12px] border border-[#E7E7E7] bg-white">
                        {workflow.profileUpdates.preferences.map((item, index) => (
                          <div
                            key={item}
                            className={cn(
                              "flex items-center gap-2.5 px-4 py-2.5 text-[13px] leading-6 text-[#5F625E]",
                              index > 0 && "border-t border-[#F1F2EE]",
                            )}
                          >
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#003C33]/40" aria-hidden="true" />
                            {item}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 rounded-[12px] border border-dashed border-[#E7E7E7] bg-white px-4 py-3 text-[13px] leading-6 text-[#8E918B]">
                        Add size, budget, interior, VAT, or timing language to extract preferences.
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-6 border-t border-[#E7E7E7] px-6 py-5 lg:grid-cols-2">
                  <div className="min-w-0">
                    <p className="bb-mono-label">Linked listings</p>
                    {workflow.linkedListings.length ? (
                      <ul className="mt-3 grid gap-2">
                        {workflow.linkedListings.map((listing) => (
                          <li key={listing.id}>
                            <Link
                              className="grid gap-1 rounded-[12px] border border-[#E7E7E7] bg-white px-4 py-3 transition-colors hover:border-[#003C33]/30 hover:bg-[#FBFBFB] sm:grid-cols-[1fr_auto] sm:items-center sm:gap-3"
                              href={`/listings/${listing.id}`}
                            >
                              <div className="min-w-0">
                                <p className="text-[14px] font-medium text-[#171719]">{listing.name}</p>
                                <p className="mt-0.5 text-[12.5px] text-[#8E918B]">
                                  {listing.builder} {listing.model} · {listing.lengthFt}ft ·{" "}
                                  {listing.location}
                                </p>
                              </div>
                              <span className="font-mono text-[13px] font-medium text-[#171719] tabular-nums">
                                {formatCurrency(listing.priceEur)}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 rounded-[12px] border border-dashed border-[#E7E7E7] bg-white px-4 py-3 text-[13px] leading-6 text-[#8E918B]">
                        Add inventory and mention a size range, area, brand, or model to auto-link matching listings here.
                      </p>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="bb-mono-label">Created tasks</p>
                    {workflow.tasks.length ? (
                      <ul className="mt-3 grid gap-2">
                        {workflow.tasks.map((task) => (
                          <li
                            key={task.id}
                            className="rounded-[12px] border border-[#E7E7E7] bg-white p-4"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge tone={taskPriorityTone(task.priority)}>{task.priority}</Badge>
                              <Badge tone="neutral">{task.kind}</Badge>
                            </div>
                            <h3 className="mt-2 text-[14px] font-medium leading-6 text-[#171719]">{task.title}</h3>
                            <p className="mt-1 text-[12.5px] leading-6 text-[#5F625E]">{task.reason}</p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 rounded-[12px] border border-dashed border-[#E7E7E7] bg-white px-4 py-3 text-[13px] leading-6 text-[#8E918B]">
                        Tasks appear here once the note mentions actions, viewings, or comparisons.
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <EmptyState
                title="No note parsed yet"
                description="Paste a call summary and run Parse to CRM to create memory and tasks."
              />
            )}
          </Card>
      </div>

      <div className="mt-8 grid items-start gap-8 xl:grid-cols-[minmax(0,0.9fr)_minmax(420px,1fr)]">
        <div className="grid content-start gap-8">
          {savedRuns.length > 0 ? (
            <Card id="voice-saved-captures">
              <CardHeader
                eyebrow="Recent captures"
                title="Recently saved"
                description="Recently parsed calls. Full buyer memory lives on the Buyers screen."
                action={
                  <CardHeaderIcon>
                    <Clock3 className="h-4 w-4" aria-hidden="true" />
                  </CardHeaderIcon>
                }
              />
              <ul className="divide-y divide-[#E7E7E7]">
                {savedRuns.slice(0, 5).map((run) => (
                  <li key={run.id} className="flex items-start justify-between gap-3 px-6 py-3.5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <p className="truncate text-[14px] font-medium text-[#171719]">{run.buyerName}</p>
                        <span className="shrink-0 text-[11px] uppercase tracking-[0.12em] text-[#8E918B]">
                          {run.taskCount} tasks · {run.draftCount} drafts
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[12.5px] leading-5 text-[#8E918B]">{run.summary}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Link
                        aria-label={`Open ${run.buyerName} in buyers`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#5F625E] transition-colors hover:bg-[#F1F2EE] hover:text-[#171719]"
                        href="/buyers"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                      <button
                        aria-label={`Delete ${run.buyerName} capture`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#8E918B] transition-colors hover:bg-[#F1F2EE] hover:text-[#A4361C]"
                        onClick={() => setPendingDeleteRunId(run.id)}
                        type="button"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <div className="grid content-start gap-8">
          <Card id="voice-approval-queue">
            <CardHeader
              eyebrow="Approval queue"
              title="Editable generated follow-ups"
              description="Edit subject or body here. Approval marks the draft broker-approved; it does not send an email, WhatsApp, or SMS."
              action={
                <CardHeaderIcon>
                  <Send className="h-4 w-4" aria-hidden="true" />
                </CardHeaderIcon>
              }
            />

            {drafts.length > 0 ? (
              <div className="grid gap-4 px-6 py-5">
                {approvedCount === drafts.length ? (
                  <Tile tone="cream">
                    <div className="flex flex-wrap items-start gap-2 text-[13px] leading-6 text-[#003C33]">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <p>
                        All {drafts.length} drafts approved. The prototype does not send messages
                        automatically — copy or hand off to your delivery channel.
                      </p>
                    </div>
                  </Tile>
                ) : null}

                {drafts.map((draft) => (
                  <article
                    key={draft.id}
                    className="rounded-[12px] border border-[#E7E7E7] bg-white p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={draftStatusTone(draft.status)}>
                          <StatusDot
                            className={
                              draft.status === "Approved"
                                ? "bg-[#0F8F62]"
                                : draft.status === "Edited"
                                  ? "bg-[#A86642]"
                                  : "bg-[#8E918B]"
                            }
                          />
                          {draft.status}
                        </Badge>
                        <Badge tone="neutral">{draft.kind}</Badge>
                        <Badge tone="neutral">{draft.channel}</Badge>
                      </div>
                      <Button
                        disabled={draft.status === "Approved"}
                        onClick={() => void approveDraft(draft.id)}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {draft.status === "Approved" ? "Approved" : "Approve"}
                      </Button>
                    </div>

                    <label className="mt-4 grid gap-1.5 text-[13px] font-medium text-[#171719]">
                      <span className="bb-mono-label">Subject</span>
                      <input
                        className="min-h-10 rounded-[8px] border border-[#D9DAD4] bg-white px-3 text-[14px] text-[#171719] outline-none focus:border-[#003C33] focus:ring-2 focus:ring-[#003C33]/15"
                        onChange={(event) => updateDraft(draft.id, "subject", event.target.value)}
                        value={draft.subject}
                      />
                    </label>
                    <label className="mt-3 grid gap-1.5 text-[13px] font-medium text-[#171719]">
                      <span className="bb-mono-label">Body</span>
                      <textarea
                        className="min-h-36 rounded-[8px] border border-[#D9DAD4] bg-white p-3 text-[14px] leading-7 text-[#171719] outline-none focus:border-[#003C33] focus:ring-2 focus:ring-[#003C33]/15"
                        onChange={(event) => updateDraft(draft.id, "body", event.target.value)}
                        value={draft.body}
                      />
                    </label>

                    {/* Hand-off actions — copy the text, or open it pre-filled in
                        the buyer's channel. The prototype never sends on its own. */}
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#E7E7E7] pt-4">
                      <Button onClick={() => void copyDraft(draft)} size="sm" type="button" variant="secondary">
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        Copy
                      </Button>
                      {draftShareHref(draft) ? (
                        <a
                          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-[8px] border border-[#D9DAD4] bg-white px-4 text-[13px] font-medium text-[#171719] transition-colors hover:border-[#003C33]"
                          href={draftShareHref(draft)!}
                          rel="noreferrer"
                          target={draft.channel === "WhatsApp" ? "_blank" : undefined}
                        >
                          <Send className="h-3.5 w-3.5" aria-hidden="true" />
                          Open in {draft.channel}
                        </a>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No drafts generated"
                description="Parse a call to create editable, broker-approved follow-up drafts."
              />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

async function persistVoiceRunToSupabase({
  callSummary,
  drafts,
  run,
  segment,
  tasks,
  workflow,
}: {
  callSummary: string;
  drafts: FollowUpDraft[];
  run: PersistedVoiceRun;
  segment?: BrokerSegment;
  tasks: BrokerTask[];
  workflow: ReturnType<typeof getVoiceToCrmWorkflow>;
}) {
  if (!isSupabaseConfigured()) return false;

  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return false;

  const buyerId = run.buyerId ?? workflow.buyer?.id ?? buildVoiceBuyerId(run.id, workflow.extracted.buyerName);
  const budget = parseBudgetRange(workflow.profileUpdates.budget);
  const relationshipNotes = [
    workflow.extracted.pipelineUpdate,
    callSummary,
  ].filter(Boolean);

  const { error: buyerError } = await supabase.from("buyers").upsert({
    id: buyerId,
    name: workflow.extracted.buyerName,
    company: workflow.buyer?.company ?? null,
    country: workflow.buyer?.country ?? "Unknown",
    budget_min_eur: workflow.buyer?.budgetMinEur ?? budget.min ?? null,
    budget_max_eur: workflow.buyer?.budgetMaxEur ?? budget.max ?? null,
    stage: workflow.buyer?.currentStage ?? "New Inquiry",
    urgency: workflow.extracted.urgency,
    next_action_due_at: "2026-05-25",
    tags: Array.from(
      new Set(
        [segment?.toLowerCase(), "voice crm", ...workflow.extracted.preferences.map((item) => item.toLowerCase())].filter(
          (item): item is string => Boolean(item),
        ),
      ),
    ),
    preferences: {
      assetTypes: segment ? [segment] : undefined,
      extractedPreferences: workflow.extracted.preferences,
      linkedListingIds: workflow.extracted.linkedListingIds,
      communication: workflow.extracted.preferences.find((item) => item.toLowerCase().includes("whatsapp")),
    },
    relationship_notes: relationshipNotes,
    payload: {
      source: "Voice CRM",
      runId: run.id,
      extracted: workflow.extracted,
    },
  });

  if (buyerError) throw new Error(buyerError.message);

  const { error: conversationError } = await supabase.from("conversations").upsert({
    id: `conversation-${run.id}`,
    buyer_id: buyerId,
    channel: "Call",
    summary: workflow.extracted.pipelineUpdate,
    sentiment: "Neutral",
    occurred_at: new Date().toISOString(),
    needs_summary: false,
    payload: {
      source: "Voice CRM",
      rawSummary: callSummary,
      extracted: workflow.extracted,
    },
  });

  if (conversationError) throw new Error(conversationError.message);

  if (tasks.length) {
    const { error: tasksError } = await supabase.from("broker_tasks").upsert(
      tasks.map((task) => ({
        id: task.id,
        title: task.title,
        kind: task.kind,
        priority: task.priority,
        status: task.status,
        due_at: task.dueAt,
        reason: task.reason,
        action_label: task.actionLabel,
        buyer_id: buyerId,
        payload: {
          source: "Voice CRM",
          runId: run.id,
          linkedListingId: task.listingId,
        },
      })),
    );

    if (tasksError) throw new Error(tasksError.message);
  }

  if (drafts.length) {
    const { error: draftsError } = await supabase.from("follow_up_drafts").upsert(
      drafts.map((draft) => ({
        id: draft.id,
        buyer_id: buyerId,
        kind: draft.kind,
        channel: draft.channel,
        status: draft.status,
        subject: draft.subject,
        body: draft.body,
        payload: {
          source: "Voice CRM",
          runId: run.id,
          linkedListingId: draft.listingId,
        },
      })),
    );

    if (draftsError) throw new Error(draftsError.message);
  }

  const { error: eventError } = await supabase.from("workflow_events").insert({
    kind: "voice_crm_run_saved",
    record_id: run.id,
    payload: {
      buyerId,
      taskCount: tasks.length,
      draftCount: drafts.length,
      extracted: workflow.extracted,
    },
  });

  if (eventError) throw new Error(eventError.message);

  return true;
}

async function persistDraftApprovalToSupabase(draft: FollowUpDraft) {
  if (!isSupabaseConfigured()) return false;

  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return false;

  const runId = getRunIdFromDraftId(draft.id);
  const { data, error } = await supabase
    .from("follow_up_drafts")
    .update({
      status: "Approved",
      subject: draft.subject,
      body: draft.body,
      payload: {
        approvedAt: new Date().toISOString(),
        runId,
        source: "Voice CRM",
      },
    })
    .eq("id", draft.id)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!data) return false;

  const { error: eventError } = await supabase.from("workflow_events").insert({
    kind: "voice_draft_approved",
    record_id: draft.id,
    payload: {
      ...draft,
      runId,
    },
  });

  if (eventError) throw new Error(eventError.message);

  return true;
}

async function deleteVoiceRunFromSupabase(run: Pick<PersistedVoiceRun, "id" | "buyerId">) {
  if (!isSupabaseConfigured()) return false;

  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return false;

  const generatedRowPrefix = `${run.id}-%`;
  const deleteRequests = [
    supabase.from("follow_up_drafts").delete().like("id", generatedRowPrefix),
    supabase.from("broker_tasks").delete().like("id", generatedRowPrefix),
    supabase.from("conversations").delete().eq("id", `conversation-${run.id}`),
    supabase.from("workflow_events").delete().eq("record_id", run.id),
    supabase.from("workflow_events").delete().like("record_id", generatedRowPrefix),
  ];

  const results = await Promise.all(deleteRequests);
  const firstError = results.find((result) => result.error)?.error;
  if (firstError) throw new Error(firstError.message);

  if (run.buyerId?.startsWith(`${run.id}-`)) {
    const { error: buyerError } = await supabase.from("buyers").delete().eq("id", run.buyerId);
    if (buyerError) throw new Error(buyerError.message);
  }

  return true;
}

function buildVoiceBuyerId(runId: string, buyerName: string) {
  const slug = buyerName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "buyer";
  return `${runId}-${slug}`;
}

function getRunIdFromDraftId(draftId: string) {
  const marker = "-voice-draft-";
  const markerIndex = draftId.indexOf(marker);
  return markerIndex > 0 ? draftId.slice(0, markerIndex) : undefined;
}

function parseBudgetRange(label: string) {
  const numbers = label
    .match(/[\d,.]+/g)
    ?.map((value) => Number(value.replace(/[,.]/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0) ?? [];

  if (numbers.length >= 2) return { min: Math.min(numbers[0], numbers[1]), max: Math.max(numbers[0], numbers[1]) };
  if (numbers.length === 1) return { min: undefined, max: numbers[0] };
  return { min: undefined, max: undefined };
}

