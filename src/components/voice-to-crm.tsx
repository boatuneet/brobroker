"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bot,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Mic,
  FilePenLine,
  Send,
  Sparkles,
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
import { formatCurrency, formatDate } from "@/lib/utils";
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

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

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

export function VoiceToCrmWorkspace({
  prefillBuyerId,
  segment,
  storedBuyers = [],
}: {
  prefillBuyerId?: string;
  segment?: BrokerSegment;
  storedBuyers?: BuyerProfile[];
}) {
  const persistedWorkspace = readPersisted<PersistedVoiceWorkspace | null>(activeVoiceKey, null);
  const [callSummary, setCallSummary] = useState(persistedWorkspace?.callSummary ?? "");
  const [parsedSummary, setParsedSummary] = useState(persistedWorkspace?.parsedSummary ?? "");
  const workflow = useMemo(() => getVoiceToCrmWorkflow(parsedSummary, segment), [parsedSummary, segment]);
  const [drafts, setDrafts] = useState<FollowUpDraft[]>(persistedWorkspace?.drafts ?? []);
  const [auditLog, setAuditLog] = useState<AuditEvent[]>(persistedWorkspace?.auditLog ?? []);
  const [activeRunId, setActiveRunId] = useState(persistedWorkspace?.activeRunId ?? "");
  const [savedRuns, setSavedRuns] = useState<PersistedVoiceRun[]>(() =>
    readPersisted<PersistedVoiceRun[]>(voiceRunsKey, []),
  );
  const [isDictating, setIsDictating] = useState(false);
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

  const hasParsed = parsedSummary.trim().length > 0;

  async function parseCurrentSummary() {
    const trimmed = callSummary.trim();
    if (!trimmed) return;
    const nextWorkflow = getVoiceToCrmWorkflow(callSummary, segment);
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

  function startDictation() {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor })
        .SpeechRecognition ??
      (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor })
        .webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setAuditLog((current) => [
        {
          id: `audit-dictation-unavailable-${current.length}`,
          actor: "System",
          label: "Dictation unavailable",
          detail: "This browser does not expose the Web Speech API. Paste or type the call summary instead.",
          occurredAt: nowIso,
        },
        ...current,
      ]);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(" ");
      setCallSummary((current) => [current, transcript].filter(Boolean).join(" "));
    };
    recognition.onend = () => setIsDictating(false);
    setIsDictating(true);
    recognition.start();
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

  useEffect(() => {
    if (!parsedSummary.trim() && drafts.length === 0 && auditLog.length === 0) return;
    writePersisted(activeVoiceKey, { activeRunId, callSummary, parsedSummary, drafts, auditLog });
  }, [activeRunId, auditLog, callSummary, drafts, parsedSummary]);

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
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

      {/* Page header — title-first, no eyebrow chip / no date (matches the
          rest of the workspaces; only the dashboard keeps the cockpit chip). */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="bb-display text-[2rem] font-medium leading-[1.04] text-[#171719] sm:text-[2.35rem]">
            Capture a call
          </h1>
          <p className="mt-3 max-w-xl text-[13.5px] leading-7 text-[#5F625E]">
            Parse a call summary into saved buyer memory, tasks, and editable follow-up drafts.
          </p>
        </div>
        {hasParsed ? (
          <button
            className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#D9DAD4] bg-white px-4 text-[13px] font-medium text-[#5F625E] transition-colors hover:border-[#003C33] hover:text-[#171719]"
            onClick={resetWorkspace}
            type="button"
          >
            Start over
          </button>
        ) : null}
      </header>

      {/* 3-tile metric fold band — Buyer detected / Urgency / Approvals. */}
      <section
        aria-label="Voice CRM at a glance"
        className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-3"
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
                : "New buyer from voice"
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
          {/* Capture mode + buyer-attach card — segmented control + combobox. */}
          <Card>
            <CardHeader
              eyebrow="Capture mode"
              title="Who is this call about?"
              description="Attach the parse to an existing saved buyer, or start a new buyer from this voice note."
              action={
                <CardHeaderIcon>
                  <Users className="h-4 w-4" aria-hidden="true" />
                </CardHeaderIcon>
              }
            />
            <div className="grid gap-4 px-6 py-5">
              <div
                aria-label="Capture mode"
                className="inline-flex rounded-full border border-[#D9DAD4] bg-[#F1F2EE] p-1 text-[13px] font-medium"
                role="tablist"
              >
                <button
                  aria-selected={captureMode === "existing"}
                  className={`inline-flex min-h-9 items-center gap-2 rounded-full px-4 transition-colors ${
                    captureMode === "existing"
                      ? "bg-white text-[#171719] shadow-sm"
                      : "text-[#8E918B] hover:text-[#5F625E]"
                  }`}
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
                  className={`inline-flex min-h-9 items-center gap-2 rounded-full px-4 transition-colors ${
                    captureMode === "new"
                      ? "bg-white text-[#171719] shadow-sm"
                      : "text-[#8E918B] hover:text-[#5F625E]"
                  }`}
                  onClick={() => setCaptureMode("new")}
                  role="tab"
                  type="button"
                >
                  <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                  New buyer from voice
                </button>
              </div>

              {captureMode === "existing" ? (
                storedBuyers.length ? (
                  <div className="grid gap-1.5">
                    <SelectMenu
                      label="Saved buyer"
                      onChange={(value) => setSelectedBuyerId(value)}
                      options={storedBuyers.map((buyer) => ({
                        value: buyer.id,
                        label: buyer.name,
                        meta: [buyer.company, buyer.country]
                          .filter(Boolean)
                          .join(" · "),
                      }))}
                      value={selectedBuyerId}
                    />
                    {selectedBuyer ? (
                      <span className="text-[12px] leading-6 text-[#8E918B]">
                        Parsed memory will upsert into {selectedBuyer.name}&apos;s buyer row — preferences, tasks, and drafts stay attached to this saved profile.
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-[#D9DAD4] bg-[#F1F2EE] px-4 py-3 text-[13px] leading-6 text-[#8E918B]">
                    No saved buyers in this segment yet. Switch to “New buyer from voice” to capture this call as a fresh profile.
                  </p>
                )
              ) : (
                <p className="rounded-xl border border-dashed border-[#D9DAD4] bg-[#F1F2EE] px-4 py-3 text-[13px] leading-6 text-[#8E918B]">
                  A new buyer record will be created from the parsed call. Move them to an existing buyer next time by selecting from the saved list above.
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Call note"
              title="Paste or dictate the call summary"
              description="Mention names, budgets, preferences, blockers, and follow-up timing."
              action={
                <CardHeaderIcon>
                  <Mic className="h-4 w-4" aria-hidden="true" />
                </CardHeaderIcon>
              }
            />
            <div className="grid gap-4 px-6 py-5">
              <textarea
                aria-label="Call summary"
                className="min-h-56 w-full rounded-xl border border-[#D9DAD4] bg-white p-4 text-[15px] leading-7 text-[#171719] outline-none placeholder:text-[#A9ABA5] focus:border-[#003C33] focus:ring-2 focus:ring-[#003C33]/15"
                onChange={(event) => setCallSummary(event.target.value)}
                placeholder="Describe the call in your own words — buyer name, size, budget, must-haves, deal-breakers, urgency, and follow-up timing."
                value={callSummary}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button disabled={!callSummary.trim()} onClick={() => void parseCurrentSummary()} type="button">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Parse & save to CRM
                </Button>
                <Button onClick={startDictation} type="button" variant="secondary">
                  <Mic className="h-4 w-4" aria-hidden="true" />
                  {isDictating ? "Listening" : "Dictate"}
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
                  <div className="mx-6 mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-[#D9DAD4] bg-[#F1F2EE] px-4 py-2.5 text-[12.5px] leading-6 text-[#5F625E]">
                    <Users className="h-3.5 w-3.5 text-[#8E918B]" aria-hidden="true" />
                    <span>
                      Attached to{" "}
                      <span className="font-medium text-[#171719]">{selectedBuyer.name}</span>
                      {selectedBuyer.company ? <> · {selectedBuyer.company}</> : null}
                    </span>
                  </div>
                ) : null}

                {/* Profile updates as mini-tiles + extracted preferences. */}
                <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
                  <div className="min-w-0">
                    <p className="bb-mono-label">Profile updates</p>
                    <div className="mt-3 grid gap-3">
                      {[
                        ["Buyer", displayBuyerName],
                        ["Budget memory", workflow.profileUpdates.budget],
                        ["Pipeline", workflow.profileUpdates.pipelineStage],
                        ["Urgency", workflow.profileUpdates.urgency],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="rounded-xl border border-[#E7E7E2] bg-[#F1F2EE] p-4"
                        >
                          <p className="bb-mono-label">{label}</p>
                          <p className="mt-1.5 text-[14px] font-medium leading-6 text-[#171719]">
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <p className="bb-mono-label">Extracted preferences</p>
                    {workflow.profileUpdates.preferences.length ? (
                      <ul className="mt-3 grid gap-2">
                        {workflow.profileUpdates.preferences.map((item) => (
                          <li
                            key={item}
                            className="rounded-xl border border-[#E7E7E2] bg-[#F1F2EE] px-4 py-2.5 text-[13px] leading-6 text-[#5F625E]"
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 rounded-xl border border-dashed border-[#D9DAD4] bg-[#F1F2EE] px-4 py-3 text-[13px] leading-6 text-[#8E918B]">
                        Add size, budget, interior, VAT, or timing language to extract preferences.
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-6 border-t border-[#E7E7E2] px-6 py-5 lg:grid-cols-2">
                  <div className="min-w-0">
                    <p className="bb-mono-label">Linked listings</p>
                    {workflow.linkedListings.length ? (
                      <ul className="mt-3 grid gap-2">
                        {workflow.linkedListings.map((listing) => (
                          <li key={listing.id}>
                            <Link
                              className="grid gap-1 rounded-xl border border-[#E7E7E2] bg-[#F1F2EE] px-4 py-3 transition-colors hover:border-[#D9DAD4] hover:bg-white sm:grid-cols-[1fr_auto] sm:items-center sm:gap-3"
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
                      <p className="mt-3 rounded-xl border border-dashed border-[#D9DAD4] bg-[#F1F2EE] px-4 py-3 text-[13px] leading-6 text-[#8E918B]">
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
                            className="rounded-xl border border-[#E7E7E2] bg-[#F1F2EE] p-4"
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
                      <p className="mt-3 rounded-xl border border-dashed border-[#D9DAD4] bg-[#F1F2EE] px-4 py-3 text-[13px] leading-6 text-[#8E918B]">
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
          {auditLog.length > 0 ? (
            <Card>
              <CardHeader
                eyebrow="Audit trail"
                title="Approval and edit events"
                action={
                  <CardHeaderIcon>
                    <Clock3 className="h-4 w-4" aria-hidden="true" />
                  </CardHeaderIcon>
                }
              />
              <ul className="divide-y divide-[#E7E7E2]">
                {auditLog.map((event) => (
                  <li key={event.id} className="grid gap-3 px-6 py-5 sm:grid-cols-[28px_1fr]">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#E7E7E2] bg-white text-[#171719]">
                      <FilePenLine className="h-3.5 w-3.5" aria-hidden="true" />
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
          ) : (
            <Card>
              <CardHeader
                eyebrow="Audit trail"
                title="Nothing approved yet"
                action={
                  <CardHeaderIcon>
                    <Bot className="h-4 w-4" aria-hidden="true" />
                  </CardHeaderIcon>
                }
              />
              <EmptyState
                title="Approval and edit events appear here"
                description="Parses, edits, and approvals are logged here."
              />
            </Card>
          )}

          {savedRuns.length > 0 ? (
            <Card id="voice-saved-captures">
              <CardHeader
                eyebrow="Persistent memory queue"
                title="Saved CRM captures"
                description="These are the parsed runs stored for follow-up. Open buyer memory to review the saved client side, or remove a capture if it was noise."
                action={
                  <CardHeaderIcon>
                    <Clock3 className="h-4 w-4" aria-hidden="true" />
                  </CardHeaderIcon>
                }
              />
              <ul className="divide-y divide-[#E7E7E2]">
                {savedRuns.slice(0, 4).map((run) => (
                  <li key={run.id} className="px-6 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-[14px] font-medium text-[#171719]">{run.buyerName}</p>
                      <Badge tone="success">Saved</Badge>
                    </div>
                    <p className="mt-1 text-[13px] leading-6 text-[#5F625E]">{run.summary}</p>
                    <p className="mt-2 text-[12px] uppercase tracking-[0.14em] text-[#8E918B]">
                      {run.taskCount} tasks · {run.draftCount} drafts
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Link
                        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-[#D9DAD4] bg-white px-4 text-[13px] font-medium text-[#171719] transition-colors hover:border-[#003C33]"
                        href="/buyers"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        Open buyers
                      </Link>
                      <Link
                        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-[#D9DAD4] bg-white px-4 text-[13px] font-medium text-[#171719] transition-colors hover:border-[#003C33]"
                        href="#voice-approval-queue"
                      >
                        Review drafts
                      </Link>
                      <Button
                        onClick={() => setPendingDeleteRunId(run.id)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Delete capture
                      </Button>
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
                    className="rounded-2xl border border-[#E7E7E2] bg-white p-5"
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
                        className="min-h-10 rounded-lg border border-[#D9DAD4] bg-white px-3 text-[14px] text-[#171719] outline-none focus:border-[#003C33] focus:ring-2 focus:ring-[#003C33]/15"
                        onChange={(event) => updateDraft(draft.id, "subject", event.target.value)}
                        value={draft.subject}
                      />
                    </label>
                    <label className="mt-3 grid gap-1.5 text-[13px] font-medium text-[#171719]">
                      <span className="bb-mono-label">Body</span>
                      <textarea
                        className="min-h-36 rounded-lg border border-[#D9DAD4] bg-white p-3 text-[14px] leading-7 text-[#171719] outline-none focus:border-[#003C33] focus:ring-2 focus:ring-[#003C33]/15"
                        onChange={(event) => updateDraft(draft.id, "body", event.target.value)}
                        value={draft.body}
                      />
                    </label>
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

