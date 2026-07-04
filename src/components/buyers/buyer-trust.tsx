"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
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
            Not started
          </p>
          <p className="mt-2 max-w-md text-[13px] leading-[1.55] text-[#5F625E]">
            Baseline signals below are derived from what you have on file. Run AI screening or
            skip straight to a broker decision — this stays on {buyer.name}&apos;s record.
          </p>
        </div>
        {derivedStatus ? (
          <div className="text-right">
            <p className="bb-mono-label">Baseline reads as</p>
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
              Rough plausibility check on the inquiry. Advisory only.
            </p>
          </div>
          <Button
            disabled={screeningLoading}
            onClick={runScreening}
            size="sm"
            type="button"
            variant="secondary"
          >
            {screeningLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                Screening…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                {screening ? "Re-run screening" : "Run AI screening"}
              </>
            )}
          </Button>
        </div>
        {screeningError ? (
          <p className="mt-3 rounded-[8px] border border-[#F1D9CE] bg-white px-3 py-2 text-[13px] leading-5 text-[#A86642]">
            {screeningError}
          </p>
        ) : null}
        {screening ? (
          <div className="mt-3 grid gap-3 rounded-[10px] border border-[#E7E7E7] bg-white p-3.5">
            <div>
              <Badge tone={ASSESSMENT_COPY[screening.assessment].tone}>
                {ASSESSMENT_COPY[screening.assessment].label}
              </Badge>
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
          </div>
        ) : null}
      </section>

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
            <p className="bb-mono-label">AI screening</p>
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
