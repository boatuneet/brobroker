"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Eye,
  Loader2,
  RefreshCcw,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import { Badge, Button } from "@/components/ui";
import {
  deriveBaselineSignals,
  inferStatusFromSignals,
  readSavedVerification,
  saveBuyerVerification,
  type BuyerVerificationDecision,
  type SavedBuyerScreening,
  type SavedBuyerVerification,
} from "@/lib/buyer-verification";
import {
  DEFAULT_SCREENING_PROMPTS,
  readStoredScreeningPrompts,
  writeStoredScreeningPrompts,
  type ScreeningPrompts,
} from "@/lib/screening-prompts";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { mapStoredBuyerToProfile, type StoredBuyerRow } from "@/lib/stored-buyers";
import type { BuyerProfile, VerificationCase, VerificationSignal, VerificationStatus } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

/* Trust tab is the primary verification surface for the buyer currently being
   viewed. Three modes:
   - Demo buyer with a canned VerificationCase → render the case (legacy).
   - Stored buyer with a saved payload.verification → render the saved decision.
   - Stored buyer with nothing yet → run flow (baseline signals, optional AI
     screening via /api/verify-buyer, broker decision persisted into
     payload.verification following the read-merge-write pattern from
     buyer-stage.ts). */

const STATUS_COPY: Record<VerificationStatus, { headline: string; tone: "success" | "warning" | "error" }> = {
  Verified: { headline: "Cleared to share", tone: "success" },
  "Needs Review": { headline: "Needs your review", tone: "warning" },
  "High Risk": { headline: "Hold access", tone: "error" },
};

type Assessment = "looks_credible" | "unclear" | "red_flags";
interface ScreeningApiResult {
  assessment: Assessment;
  summary: string;
  flags: string[];
  suggestedChecks: string[];
  /* Web-search public-record check with cited sources; null when the
     search tool wasn't available at run time. */
  publicProfile?: { summary: string; sources: Array<{ title: string; url: string }> } | null;
}
const ASSESSMENT_COPY: Record<Assessment, { label: string; tone: "success" | "warning" | "error" }> = {
  looks_credible: { label: "Looks credible", tone: "success" },
  unclear: { label: "Unclear", tone: "warning" },
  red_flags: { label: "Red flags", tone: "error" },
};

const DECISION_TONE: Record<BuyerVerificationDecision, "success" | "warning" | "error"> = {
  Verified: "success",
  "Needs Review": "warning",
  "High Risk": "error",
};

export function BuyerTrust({ verification }: { verification?: VerificationCase }) {
  // Demo path — a VerificationCase exists; render it as before.
  if (verification) {
    return <DemoVerificationView verification={verification} />;
  }

  // Stored path — pull buyer via useParams (Trust tab is rendered inside
  // /buyers/[id]) and drive the run-verification flow from Supabase.
  return <StoredBuyerVerification />;
}

/* ------------------------------------------------------------------ */
/* Demo view — the original layout, kept for demo buyers.             */
/* ------------------------------------------------------------------ */

function DemoVerificationView({ verification }: { verification: VerificationCase }) {
  const copy = STATUS_COPY[verification.status];
  return (
    <div className="grid gap-5 px-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="bb-mono-label">Verification status</p>
          <p className="mt-2 bb-display text-[1.4rem] font-medium leading-[1.1] text-[#171719]">
            {copy.headline}
          </p>
        </div>
        <Badge tone={copy.tone}>{copy.headline}</Badge>
      </div>

      <section aria-label="Signals">
        <p className="bb-mono-label">Signals</p>
        <ul className="mt-3 divide-y divide-[#E7E7E7] rounded-[12px] border border-[#E7E7E7] bg-white">
          {verification.signals.map((signal, index) => (
            <SignalRow key={`${signal.label}-${index}`} signal={signal} />
          ))}
        </ul>
      </section>

      <section aria-label="Recommended action">
        <p className="bb-mono-label">Recommended action</p>
        <p className="mt-2 rounded-[10px] border border-[#E7E7E7] bg-[#FBFBFB] p-3.5 text-[13px] leading-[1.6] text-[#5F625E]">
          {verification.recommendedAction}
        </p>
      </section>

      <div>
        <Link
          className="inline-flex items-center gap-1 text-[13px] font-medium text-[#003C33] hover:underline"
          href={`/verification?buyer=${verification.buyerId}`}
        >
          Open full verification queue →
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stored buyer flow                                                   */
/* ------------------------------------------------------------------ */

function StoredBuyerVerification() {
  const params = useParams<{ id?: string }>();
  const buyerId = typeof params?.id === "string" ? params.id : undefined;

  const [buyer, setBuyer] = useState<BuyerProfile | null>(null);
  const [saved, setSaved] = useState<SavedBuyerVerification | undefined>(undefined);
  const [hasConversations, setHasConversations] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [screening, setScreening] = useState<ScreeningApiResult | undefined>(undefined);
  const [screeningLoading, setScreeningLoading] = useState(false);
  const [screeningError, setScreeningError] = useState<string | null>(null);
  const [savingDecision, setSavingDecision] = useState<BuyerVerificationDecision | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [brokerNote, setBrokerNote] = useState("");
  const [promptDrawerOpen, setPromptDrawerOpen] = useState(false);

  // Load buyer + existing verification + conversation count.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!buyerId) {
        setLoadError("Buyer id is not available on this route.");
        setLoading(false);
        return;
      }
      if (!isSupabaseConfigured()) {
        setLoadError("Supabase is not configured — verification requires a signed-in broker.");
        setLoading(false);
        return;
      }

      const supabase = createClient();
      const [{ data: buyerRow, error: buyerErr }, { count: convoCount }] = await Promise.all([
        supabase.from("buyers").select("*").eq("id", buyerId).maybeSingle(),
        supabase
          .from("conversations")
          .select("id", { count: "exact", head: true })
          .eq("buyer_id", buyerId),
      ]);

      if (cancelled) return;

      if (buyerErr || !buyerRow) {
        setLoadError(buyerErr?.message ?? "Could not load buyer from Supabase.");
        setLoading(false);
        return;
      }

      const profile = mapStoredBuyerToProfile(buyerRow as StoredBuyerRow);
      const savedVerification = readSavedVerification((buyerRow as StoredBuyerRow).payload);

      setBuyer(profile);
      setSaved(savedVerification);
      setHasConversations((convoCount ?? 0) > 0);
      if (savedVerification?.screening) {
        setScreening({
          assessment: savedVerification.screening.assessment,
          summary: savedVerification.screening.summary,
          flags: savedVerification.screening.flags,
          suggestedChecks: savedVerification.screening.suggestedChecks,
          publicProfile: savedVerification.screening.publicSummary
            ? {
                summary: savedVerification.screening.publicSummary,
                sources: savedVerification.screening.publicSources ?? [],
              }
            : null,
        });
      }
      if (savedVerification?.brokerNote) {
        setBrokerNote(savedVerification.brokerNote);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [buyerId]);

  const baselineSignals = useMemo<VerificationSignal[]>(
    () => (buyer ? deriveBaselineSignals(buyer, { hasConversations }) : []),
    [buyer, hasConversations],
  );
  const derivedStatus = useMemo(
    () => (baselineSignals.length ? inferStatusFromSignals(baselineSignals) : undefined),
    [baselineSignals],
  );

  const runScreening = useCallback(async () => {
    if (!buyer) return;
    setScreeningLoading(true);
    setScreeningError(null);

    const budgetRange =
      buyer.budgetMinEur && buyer.budgetMaxEur
        ? `${buyer.budgetMinEur.toLocaleString()}–${buyer.budgetMaxEur.toLocaleString()} EUR`
        : undefined;
    const inquirySummary = [
      buyer.urgency ? `Urgency: ${buyer.urgency}.` : "",
      buyer.mustHaves.length ? `Must-haves: ${buyer.mustHaves.join(", ")}.` : "",
      buyer.dealBreakers.length ? `Deal-breakers: ${buyer.dealBreakers.join(", ")}.` : "",
      buyer.preferredLocations.length ? `Preferred locations: ${buyer.preferredLocations.join(", ")}.` : "",
      buyer.relationshipNotes.length ? `Notes: ${buyer.relationshipNotes.join(" ")}` : "",
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
          // Device-saved prompt overrides (defaults when never edited).
          prompts: readStoredScreeningPrompts(),
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setScreeningError(
          res.status === 503
            ? "Connect OpenAI to enable AI screening. You can still record a decision below."
            : data.error || "AI screening failed. Try again shortly.",
        );
        return;
      }

      const result = (await res.json()) as ScreeningApiResult;
      setScreening(result);
    } catch {
      setScreeningError("Network error while contacting the AI screener.");
    } finally {
      setScreeningLoading(false);
    }
  }, [buyer]);

  const persistDecision = useCallback(
    async (decision: BuyerVerificationDecision) => {
      if (!buyer) return;
      setSavingDecision(decision);
      setSaveError(null);

      const record: SavedBuyerVerification = {
        status: decision,
        signals: baselineSignals,
        screening: screening
          ? {
              assessment: screening.assessment,
              summary: screening.summary,
              flags: screening.flags,
              suggestedChecks: screening.suggestedChecks,
              ranAt: new Date().toISOString(),
              publicSummary: screening.publicProfile?.summary,
              publicSources: screening.publicProfile?.sources,
            }
          : undefined,
        brokerNote: brokerNote.trim() || undefined,
        decidedAt: new Date().toISOString(),
      };

      const result = await saveBuyerVerification(buyer.id, record);
      setSavingDecision(null);
      if (!result.ok) {
        setSaveError(result.error);
        return;
      }
      setSaved(record);
    },
    [buyer, baselineSignals, screening, brokerNote],
  );

  const clearDecision = useCallback(() => {
    // Re-run mode: keep the saved record on Supabase but let the broker
    // re-evaluate. Persist happens again on the next click.
    setSaved(undefined);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 px-6 py-10 text-[13px] text-[#8E918B]">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading verification…
      </div>
    );
  }

  if (loadError || !buyer) {
    return (
      <div className="grid gap-3 px-6 py-8 text-center">
        <ShieldCheck className="mx-auto h-6 w-6 text-[#A9ABA5]" aria-hidden="true" />
        <div className="mx-auto max-w-md">
          <p className="text-[14px] font-semibold text-[#171719]">Verification unavailable</p>
          <p className="mt-2 text-[13px] leading-[1.55] text-[#5F625E]">
            {loadError ?? "Could not load this buyer for verification."}
          </p>
        </div>
      </div>
    );
  }

  // If a decision is already saved, show it in read mode with a re-run option.
  if (saved) {
    return (
      <SavedVerificationView
        buyerId={buyer.id}
        saved={saved}
        onReRun={clearDecision}
      />
    );
  }

  // Otherwise render the run-verification flow.
  const derivedCopy = derivedStatus ? STATUS_COPY[derivedStatus] : STATUS_COPY["Needs Review"];

  return (
    <div className="grid gap-5 px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="bb-mono-label">Verification status</p>
          <p className="mt-2 bb-display text-[1.4rem] font-medium leading-[1.1] text-[#171719]">
            Not verified yet
          </p>
          <p className="mt-2 max-w-md text-[13px] leading-[1.55] text-[#5F625E]">
            You haven&apos;t recorded a verification decision for {buyer.name.split(" ")[0]} yet.
            The checks below are read automatically from their record. Run an AI screening for a
            deeper look, then record your decision — it saves to this buyer.
          </p>
        </div>
        {derivedStatus ? (
          <div className="text-right">
            <p className="bb-mono-label">Checks suggest</p>
            <Badge className="mt-2" tone={derivedCopy.tone}>
              {derivedCopy.headline}
            </Badge>
          </div>
        ) : null}
      </div>

      <section aria-label="Signals">
        <p className="bb-mono-label">Signals from buyer record</p>
        <ul className="mt-3 divide-y divide-[#E7E7E7] rounded-[12px] border border-[#E7E7E7] bg-white">
          {baselineSignals.map((signal, index) => (
            <SignalRow key={`${signal.label}-${index}`} signal={signal} />
          ))}
        </ul>
      </section>

      <section aria-label="AI screening" className="rounded-[12px] border border-[#E7E7E7] bg-[#FBFBFB] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="bb-mono-label">AI screening</p>
            <p className="mt-1 text-[13px] leading-[1.55] text-[#5F625E]">
              Plausibility check on the inquiry plus a public-record web search — identity,
              company, sanctions and adverse-media mentions, with sources. Advisory only.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Gradient-border hero button — the border sweep (soft green →
                brand → coral) fades in on hover over the deep-green core. */}
            <button
              className="group relative inline-block rounded-[10px] bg-[#003C33] p-px text-white shadow-lg shadow-[#003C33]/25 transition-transform duration-300 hover:scale-[1.03] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]"
              disabled={screeningLoading}
              onClick={runScreening}
              type="button"
            >
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-[10px] bg-gradient-to-r from-[#0F8F62] via-[#7BC4A5] to-[#A86642] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              />
              <span className="relative z-10 block rounded-[9px] bg-[#003C33] px-4 py-2">
                <span className="flex items-center gap-2 text-[12.5px] font-medium">
                  {screeningLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles
                      aria-hidden="true"
                      className="h-3.5 w-3.5 transition-transform duration-500 group-hover:rotate-12"
                    />
                  )}
                  {screeningLoading
                    ? "Screening…"
                    : screening
                      ? "Re-run screening"
                      : "Run AI screening"}
                  <ArrowRight
                    aria-hidden="true"
                    className="h-3.5 w-3.5 transition-transform duration-500 group-hover:translate-x-1"
                  />
                </span>
              </span>
            </button>
            <button
              aria-label="View or edit the screening prompts"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[#D9DAD4] bg-white text-[#5F625E] transition-colors hover:border-[#003C33] hover:text-[#003C33] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]"
              onClick={() => setPromptDrawerOpen(true)}
              title="View / edit prompts"
              type="button"
            >
              <Eye aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>
        {screeningError ? (
          <p className="mt-3 rounded-[8px] border border-[#F1D9CE] bg-white px-3 py-2 text-[13px] leading-5 text-[#A86642]">
            {screeningError}
          </p>
        ) : null}
        {screening ? (
          <div className="mt-3 grid gap-3 rounded-[10px] border border-[#E7E7E7] bg-white p-3.5">
            {/* The assessment badge judges the INQUIRY only — the public
                record check below carries its own identity confidence, so
                both get explicit labels to avoid reading as one verdict. */}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="bb-mono-label">Inquiry plausibility</p>
                <Badge tone={ASSESSMENT_COPY[screening.assessment].tone}>
                  {ASSESSMENT_COPY[screening.assessment].label}
                </Badge>
              </div>
              <p className="mt-2 text-[13.5px] leading-[1.55] text-[#171719]">{screening.summary}</p>
            </div>
            {screening.flags.length ? (
              <div>
                <p className="bb-mono-label">Flags</p>
                <ul className="mt-1.5 grid gap-1 text-[12.5px] leading-[1.55] text-[#5F625E]">
                  {screening.flags.map((flag) => (
                    <li key={flag} className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#A86642]" aria-hidden="true" />
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {screening.suggestedChecks.length ? (
              <div>
                <p className="bb-mono-label">Suggested checks</p>
                <ul className="mt-1.5 grid gap-1 text-[12.5px] leading-[1.55] text-[#5F625E]">
                  {screening.suggestedChecks.map((check) => (
                    <li key={check} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0F8F62]" aria-hidden="true" />
                      {check}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <PublicRecordBlock profile={screening.publicProfile} />
          </div>
        ) : null}
      </section>

      {/* Free manual sources — always available, no keys, so the broker can
          dig on the person even without OpenAI configured. */}
      <ManualCheckLinks company={buyer.company} name={buyer.name} />

      <section aria-label="Broker decision" className="grid gap-3">
        <p className="bb-mono-label">Broker decision</p>
        <label className="grid gap-1.5 text-[12.5px] font-medium text-[#171719]" htmlFor="broker-note">
          <span className="text-[#5F625E]">Optional note (saved with the decision)</span>
          <textarea
            className="rounded-[8px] border border-[#D9DAD4] bg-white px-3 py-2 text-[13px] leading-[1.55] text-[#171719] outline-none focus:border-[#003C33]"
            id="broker-note"
            onChange={(event) => setBrokerNote(event.target.value)}
            placeholder="Add context — e.g. spoke with buyer, proof of funds requested."
            rows={2}
            value={brokerNote}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <DecisionButton
            decision="Verified"
            label="Cleared to share"
            onClick={() => persistDecision("Verified")}
            saving={savingDecision === "Verified"}
          />
          <DecisionButton
            decision="Needs Review"
            label="Needs review"
            onClick={() => persistDecision("Needs Review")}
            saving={savingDecision === "Needs Review"}
          />
          <DecisionButton
            decision="High Risk"
            label="Hold access"
            onClick={() => persistDecision("High Risk")}
            saving={savingDecision === "High Risk"}
          />
        </div>
        {saveError ? (
          <p className="rounded-[8px] border border-[#F1D9CE] bg-[#FBEFE8] px-3 py-2 text-[13px] leading-5 text-[#A86642]">
            {saveError}
          </p>
        ) : null}
      </section>

      <div>
        <Link
          className="inline-flex items-center gap-1 text-[13px] font-medium text-[#003C33] hover:underline"
          href={`/verification?buyer=${buyer.id}`}
        >
          Open full verification queue →
        </Link>
      </div>

      {promptDrawerOpen ? (
        <ScreeningPromptDrawer onClose={() => setPromptDrawerOpen(false)} />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Screening prompt drawer — view/edit what gets sent to OpenAI       */
/* ------------------------------------------------------------------ */

function ScreeningPromptDrawer({ onClose }: { onClose: () => void }) {
  const [prompts, setPrompts] = useState<ScreeningPrompts>(() => readStoredScreeningPrompts());
  const [savedNote, setSavedNote] = useState(false);
  const isDefault =
    prompts.plausibility === DEFAULT_SCREENING_PROMPTS.plausibility &&
    prompts.publicSearch === DEFAULT_SCREENING_PROMPTS.publicSearch;

  function save() {
    writeStoredScreeningPrompts({
      plausibility: prompts.plausibility.trim() || DEFAULT_SCREENING_PROMPTS.plausibility,
      publicSearch: prompts.publicSearch.trim() || DEFAULT_SCREENING_PROMPTS.publicSearch,
    });
    setSavedNote(true);
    window.setTimeout(onClose, 600);
  }

  return (
    <div
      aria-modal="true"
      className="bb-overlay-enter fixed inset-0 z-[80] bg-[#171719]/30 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="bb-drawer-enter absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l border-[#E7E7E7] bg-white shadow-[0_0_64px_rgba(23,31,25,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#E7E7E7] px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-[#171719]">Screening prompts</h2>
            <p className="mt-0.5 text-[12px] text-[#8E918B]">
              What gets sent to OpenAI when you run a screening. Saved on this device.
            </p>
          </div>
          <button
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#8E918B] transition-colors hover:bg-[#F1F2EE] hover:text-[#171719]"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <label className="grid gap-1.5">
            <span className="text-[13px] font-semibold text-[#171719]">
              Inquiry plausibility
            </span>
            <span className="text-[12px] leading-5 text-[#8E918B]">
              System prompt for the context-only check. The buyer&apos;s name, company,
              budget, and inquiry notes are appended as the user message. Keep the JSON
              contract at the end intact — the app parses it.
            </span>
            <textarea
              className="min-h-64 resize-y rounded-[10px] border border-[#D9DAD4] bg-white px-3 py-2.5 font-mono text-[12px] leading-[1.6] text-[#171719] outline-none transition-colors focus:border-[#003C33] focus:ring-2 focus:ring-[#003C33]/15"
              onChange={(event) =>
                setPrompts((current) => ({ ...current, plausibility: event.target.value }))
              }
              spellCheck={false}
              value={prompts.plausibility}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-[13px] font-semibold text-[#171719]">
              Public record search
            </span>
            <span className="text-[12px] leading-5 text-[#8E918B]">
              Instructions for the web-search lookup.{" "}
              <code className="rounded bg-[#F1F2EE] px-1 py-0.5 text-[11px]">{"{{name}}"}</code>
              {", "}
              <code className="rounded bg-[#F1F2EE] px-1 py-0.5 text-[11px]">{"{{company}}"}</code>
              {" and "}
              <code className="rounded bg-[#F1F2EE] px-1 py-0.5 text-[11px]">{"{{country}}"}</code>{" "}
              are replaced with the buyer&apos;s values at run time.
            </span>
            <textarea
              className="min-h-56 resize-y rounded-[10px] border border-[#D9DAD4] bg-white px-3 py-2.5 font-mono text-[12px] leading-[1.6] text-[#171719] outline-none transition-colors focus:border-[#003C33] focus:ring-2 focus:ring-[#003C33]/15"
              onChange={(event) =>
                setPrompts((current) => ({ ...current, publicSearch: event.target.value }))
              }
              spellCheck={false}
              value={prompts.publicSearch}
            />
          </label>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[#E7E7E7] px-5 py-4">
          <button
            className="inline-flex min-h-9 items-center gap-1.5 rounded-[8px] px-3 text-[12.5px] font-medium text-[#5F625E] transition-colors hover:bg-[#F1F2EE] hover:text-[#171719] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isDefault}
            onClick={() => setPrompts(DEFAULT_SCREENING_PROMPTS)}
            type="button"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Reset to defaults
          </button>
          <div className="flex items-center gap-2">
            {savedNote ? (
              <span className="text-[12px] font-medium text-[#0F8F62]">Saved</span>
            ) : null}
            <Button onClick={save} type="button">
              <Save className="h-4 w-4" aria-hidden="true" />
              Save prompts
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Saved decision view                                                */
/* ------------------------------------------------------------------ */

function SavedVerificationView({
  buyerId,
  saved,
  onReRun,
}: {
  buyerId: string;
  saved: SavedBuyerVerification;
  onReRun: () => void;
}) {
  const copy = STATUS_COPY[saved.status];
  return (
    <div className="grid gap-5 px-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="bb-mono-label">Verification status</p>
          <p className="mt-2 bb-display text-[1.4rem] font-medium leading-[1.1] text-[#171719]">
            {copy.headline}
          </p>
          <p className="mt-1 text-[12px] uppercase tracking-[0.14em] text-[#8E918B]">
            Decided {formatDate(saved.decidedAt)}
          </p>
        </div>
        <Badge tone={DECISION_TONE[saved.status]}>{copy.headline}</Badge>
      </div>

      {saved.brokerNote ? (
        <section aria-label="Broker note">
          <p className="bb-mono-label">Broker note</p>
          <p className="mt-2 rounded-[10px] border border-[#E7E7E7] bg-[#FBFBFB] p-3.5 text-[13px] leading-[1.6] text-[#5F625E]">
            {saved.brokerNote}
          </p>
        </section>
      ) : null}

      {saved.signals.length ? (
        <section aria-label="Signals">
          <p className="bb-mono-label">Signals at decision time</p>
          <ul className="mt-3 divide-y divide-[#E7E7E7] rounded-[12px] border border-[#E7E7E7] bg-white">
            {saved.signals.map((signal, index) => (
              <SignalRow key={`${signal.label}-${index}`} signal={signal} />
            ))}
          </ul>
        </section>
      ) : null}

      {saved.screening ? (
        <section aria-label="AI screening result" className="grid gap-3 rounded-[12px] border border-[#E7E7E7] bg-[#FBFBFB] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="bb-mono-label">AI screening · inquiry plausibility</p>
            <Badge tone={ASSESSMENT_COPY[saved.screening.assessment].tone}>
              {ASSESSMENT_COPY[saved.screening.assessment].label}
            </Badge>
          </div>
          <p className="text-[13.5px] leading-[1.55] text-[#171719]">{saved.screening.summary}</p>
          {saved.screening.flags.length ? (
            <ul className="grid gap-1 text-[12.5px] leading-[1.55] text-[#5F625E]">
              {saved.screening.flags.map((flag) => (
                <li key={flag} className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#A86642]" aria-hidden="true" />
                  {flag}
                </li>
              ))}
            </ul>
          ) : null}
          {saved.screening.publicSummary ? (
            <PublicRecordBlock
              profile={{
                summary: saved.screening.publicSummary,
                sources: saved.screening.publicSources ?? [],
              }}
            />
          ) : null}
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onReRun} size="sm" type="button" variant="secondary">
          <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Re-run verification
        </Button>
        <Link
          className="inline-flex items-center gap-1 text-[13px] font-medium text-[#003C33] hover:underline"
          href={`/verification?buyer=${buyerId}`}
        >
          Open full verification queue →
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared row + button                                                */
/* ------------------------------------------------------------------ */

function SignalRow({ signal }: { signal: VerificationSignal }) {
  const Icon = signal.state === "Pass" ? CheckCircle2 : signal.state === "Fail" ? XCircle : CircleAlert;
  const iconColor =
    signal.state === "Pass"
      ? "text-[#0F8F62]"
      : signal.state === "Fail"
        ? "text-[#A86642]"
        : "text-[#A86642]";
  const stateBadgeTone: "success" | "warning" | "error" =
    signal.state === "Pass" ? "success" : signal.state === "Fail" ? "error" : "warning";

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Icon aria-hidden="true" className={cn("mt-0.5 h-4 w-4 shrink-0", iconColor)} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] font-medium text-[#171719]">{signal.label}</p>
          <Badge tone={stateBadgeTone}>{signal.state}</Badge>
        </div>
        <p className="mt-1 text-[12.5px] leading-[1.55] text-[#5F625E]">{signal.detail}</p>
      </div>
    </li>
  );
}

function DecisionButton({
  decision,
  label,
  onClick,
  saving,
}: {
  decision: BuyerVerificationDecision;
  label: string;
  onClick: () => void;
  saving: boolean;
}) {
  const variant =
    decision === "Verified" ? "primary" : decision === "High Risk" ? "danger" : "secondary";
  return (
    <Button disabled={saving} onClick={onClick} size="sm" type="button" variant={variant}>
      {saving ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Saving…
        </>
      ) : (
        label
      )}
    </Button>
  );
}

/* ------------------------------------------------------------------ */
/* Public due diligence — web-search result + free manual sources     */
/* ------------------------------------------------------------------ */

function PublicRecordBlock({
  profile,
}: {
  profile?: { summary: string; sources: Array<{ title: string; url: string }> } | null;
}) {
  // undefined → legacy screening with no lookup on file; stay quiet.
  if (profile === undefined) return null;
  if (profile === null) {
    return (
      <p className="rounded-[8px] border border-[#E7E7E7] bg-white px-3 py-2 text-[12.5px] leading-5 text-[#8E918B]">
        Public web lookup was unavailable for this run — use the manual checks below.
      </p>
    );
  }
  return (
    <div className="rounded-[10px] border border-[#E2ECE9] bg-[#F7FAF9] p-3.5">
      <p className="bb-mono-label">Public record check</p>
      <div className="mt-2 grid gap-2 text-[13px] leading-[1.6] text-[#171719]">
        <MarkdownLite text={profile.summary} />
      </div>
      {profile.sources.length ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {profile.sources.map((source) => (
            <a
              className="inline-flex max-w-[260px] items-center gap-1 truncate rounded-[8px] border border-[#D0DFDC] bg-white px-2 py-0.5 text-[11.5px] font-medium text-[#003C33] transition-colors hover:border-[#003C33]"
              href={source.url}
              key={source.url}
              rel="noopener noreferrer"
              target="_blank"
              title={source.url}
            >
              {source.title}
            </a>
          ))}
        </div>
      ) : null}
      <p className="mt-2.5 text-[11.5px] leading-4 text-[#8E918B]">
        Common names can match the wrong person — confirm identity before acting on this.
      </p>
    </div>
  );
}

/* Free, no-key public sources the broker can open in one click. OpenSanctions
   covers sanctions/PEP lists; OpenCorporates covers company registries.
   ponytail: their APIs (free for non-commercial) are the upgrade path if we
   ever want these checks to run automatically. */
function ManualCheckLinks({ name, company }: { name: string; company?: string }) {
  const q = encodeURIComponent(name);
  const links: Array<{ label: string; hint: string; href: string }> = [
    {
      label: "OpenSanctions",
      hint: "sanctions & PEP",
      href: `https://www.opensanctions.org/search/?q=${q}`,
    },
    {
      label: "Google",
      hint: "news & profile",
      href: `https://www.google.com/search?q=${encodeURIComponent(`"${name}"${company ? ` ${company}` : ""}`)}`,
    },
    {
      label: "LinkedIn",
      hint: "role & company",
      href: `https://www.linkedin.com/search/results/all/?keywords=${q}`,
    },
  ];
  if (company) {
    links.push({
      label: "OpenCorporates",
      hint: "company registry",
      href: `https://opencorporates.com/companies?q=${encodeURIComponent(company)}`,
    });
  }
  return (
    <section aria-label="Manual checks">
      <p className="bb-mono-label">Manual checks · free public sources</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {links.map((link) => (
          <a
            className="inline-flex min-h-8 items-center gap-1.5 rounded-[8px] border border-[#D9DAD4] bg-white px-3 text-[12.5px] font-medium text-[#171719] transition-colors hover:border-[#003C33] hover:bg-[#F1F2EE]"
            href={link.href}
            key={link.label}
            rel="noopener noreferrer"
            target="_blank"
          >
            {link.label}
            <span className="text-[11px] font-normal text-[#8E918B]">{link.hint}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Markdown-lite renderer                                              */
/* ------------------------------------------------------------------ */

/* The web-search model answers in light markdown (**bold**, *emphasis*,
   "- " bullets, [label](url) links) despite the prompt asking for plain
   text. Render those four constructs instead of showing raw asterisks —
   a full markdown dependency would be overkill for this one surface.
   ponytail: swap for react-markdown if richer output ever matters. */

const INLINE_TOKEN = /(\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^)\s]+\)|\*[^*\n]+\*)/g;

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  return text.split(INLINE_TOKEN).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong className="font-semibold text-[#171719]" key={key}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <strong className="font-semibold text-[#171719]" key={key}>
          {part.slice(1, -1)}
        </strong>
      );
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (link) {
      return (
        <a
          className="font-medium text-[#003C33] underline decoration-[#B9CFC8] underline-offset-2 hover:decoration-[#003C33]"
          href={link[2]}
          key={key}
          rel="noopener noreferrer"
          target="_blank"
        >
          {link[1]}
        </a>
      );
    }
    return part;
  });
}

function MarkdownLite({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (!bullets.length) return;
    const items = bullets;
    bullets = [];
    blocks.push(
      <ul className="grid list-disc gap-1 pl-4" key={`ul-${blocks.length}`}>
        {items.map((item, index) => (
          <li key={`li-${index}`}>{renderInlineMarkdown(item, `li-${blocks.length}-${index}`)}</li>
        ))}
      </ul>,
    );
  };

  lines.forEach((line, index) => {
    // "- item" / "• item" / "* item" — note "* " needs the space so a
    // *bold heading* line isn't mistaken for a bullet.
    const bullet = line.match(/^\s*(?:[-•]|\*)\s+(.*\S)\s*$/);
    if (bullet) {
      bullets.push(bullet[1]);
      return;
    }
    flushBullets();
    if (!line.trim()) return;
    blocks.push(<p key={`p-${index}`}>{renderInlineMarkdown(line.trim(), `p-${index}`)}</p>);
  });
  flushBullets();

  return <>{blocks}</>;
}
