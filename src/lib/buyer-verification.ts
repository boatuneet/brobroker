import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { BuyerProfile, VerificationSignal, VerificationStatus } from "@/lib/types";

/* Broker-run verification for a stored buyer. There is no dedicated column on
   `buyers` for this yet, so the decision + evidence rides inside
   `payload.verification` — same read-merge-write pattern as buyer-stage.ts.

   No "use client" directive: the read helpers (readSavedVerification,
   deriveBaselineSignals, inferStatusFromSignals) run on the server too — the
   /verification page synthesizes the inbox server-side. saveBuyerVerification
   only ever runs from the Trust tab (a client component), so its browser-only
   supabase client is never touched during SSR. */

export type BuyerVerificationDecision = "Verified" | "Needs Review" | "High Risk";

export interface SavedBuyerScreening {
  assessment: "looks_credible" | "unclear" | "red_flags";
  summary: string;
  flags: string[];
  suggestedChecks: string[];
  ranAt: string;
}

export interface SavedBuyerVerification {
  status: BuyerVerificationDecision;
  signals: VerificationSignal[];
  screening?: SavedBuyerScreening;
  brokerNote?: string;
  decidedAt: string;
}

export type BuyerVerificationResult =
  | { ok: true }
  | { ok: false; error: string };

export async function saveBuyerVerification(
  buyerId: string,
  verification: SavedBuyerVerification,
): Promise<BuyerVerificationResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase not configured — verification is local only." };
  }

  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false, error: "Sign in required to save verification." };
  }

  // Read-merge-write to preserve the rest of payload (fields, summary, closure).
  const { data: existing, error: readError } = await supabase
    .from("buyers")
    .select("payload")
    .eq("id", buyerId)
    .maybeSingle();

  if (readError) return { ok: false, error: readError.message };

  const priorPayload =
    existing?.payload && typeof existing.payload === "object" && !Array.isArray(existing.payload)
      ? (existing.payload as Record<string, unknown>)
      : {};

  const nextPayload = {
    ...priorPayload,
    verification,
  };

  const { error } = await supabase
    .from("buyers")
    .update({ payload: nextPayload })
    .eq("id", buyerId)
    .eq("owner_user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/* Extract a saved verification from an arbitrary payload blob. Tolerant of
   partial/missing fields so old rows don't crash the UI. */
export function readSavedVerification(payload: unknown): SavedBuyerVerification | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  const verification = (payload as Record<string, unknown>).verification;
  if (!verification || typeof verification !== "object" || Array.isArray(verification)) return undefined;
  const v = verification as Record<string, unknown>;

  const status: BuyerVerificationDecision =
    v.status === "Verified" || v.status === "Needs Review" || v.status === "High Risk"
      ? v.status
      : "Needs Review";

  const signals: VerificationSignal[] = Array.isArray(v.signals)
    ? v.signals.filter(isSignal)
    : [];

  const screening = readScreening(v.screening);

  return {
    status,
    signals,
    screening,
    brokerNote: typeof v.brokerNote === "string" ? v.brokerNote : undefined,
    decidedAt: typeof v.decidedAt === "string" ? v.decidedAt : new Date().toISOString(),
  };
}

function isSignal(value: unknown): value is VerificationSignal {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.label === "string" &&
    (v.state === "Pass" || v.state === "Review" || v.state === "Fail") &&
    typeof v.detail === "string"
  );
}

function readScreening(value: unknown): SavedBuyerScreening | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const v = value as Record<string, unknown>;
  const assessment =
    v.assessment === "looks_credible" || v.assessment === "red_flags"
      ? v.assessment
      : "unclear";
  return {
    assessment,
    summary: typeof v.summary === "string" ? v.summary : "",
    flags: Array.isArray(v.flags) ? v.flags.filter((f): f is string => typeof f === "string") : [],
    suggestedChecks: Array.isArray(v.suggestedChecks)
      ? v.suggestedChecks.filter((f): f is string => typeof f === "string")
      : [],
    ranAt: typeof v.ranAt === "string" ? v.ranAt : new Date().toISOString(),
  };
}

/* Derive baseline signals from the buyer record itself — the broker has
   already entered this data during intake, so we surface it as a first-pass
   readiness check before any external verification. */
export function deriveBaselineSignals(
  buyer: BuyerProfile,
  opts: { hasConversations?: boolean } = {},
): VerificationSignal[] {
  const signals: VerificationSignal[] = [];

  // 1. Identity — name/company/country present?
  const hasName = Boolean(buyer.name && buyer.name.trim());
  const hasCompany = Boolean(buyer.company && buyer.company.trim());
  const hasCountry = Boolean(buyer.country && buyer.country.trim() && buyer.country !== "International");
  signals.push({
    label: "Identity basics",
    state: hasName && (hasCompany || hasCountry) ? "Pass" : hasName ? "Review" : "Fail",
    detail:
      hasName && hasCompany && hasCountry
        ? `Name, company (${buyer.company}), and country (${buyer.country}) on file.`
        : hasName
          ? `Name on file. ${hasCompany ? "" : "No company recorded. "}${hasCountry ? "" : "Country unspecified."}`.trim()
          : "Buyer name is missing — cannot proceed.",
  });

  // 2. Contact history — any conversations logged?
  const hasContact = Boolean(opts.hasConversations || buyer.lastContactedAt);
  signals.push({
    label: "Contact history",
    state: opts.hasConversations ? "Pass" : buyer.lastContactedAt ? "Review" : "Fail",
    detail: opts.hasConversations
      ? "Conversations logged with this buyer."
      : buyer.lastContactedAt
        ? `Last contact recorded ${buyer.lastContactedAt}, but no conversations captured.`
        : "No contact history recorded — log at least one conversation before granting access.",
  });

  // 3. Budget sanity — junk values (0 to 3 EUR) surface as Review.
  const { budgetMinEur: min, budgetMaxEur: max } = buyer;
  const budgetLooksReal = max >= 1000 && min <= max;
  const budgetPlaceholder = max < 1000 || (min === 0 && max === 0);
  signals.push({
    label: "Budget sanity",
    state: budgetLooksReal ? "Pass" : budgetPlaceholder ? "Review" : "Fail",
    detail: budgetLooksReal
      ? `Stated budget €${min.toLocaleString()}–€${max.toLocaleString()} looks realistic.`
      : budgetPlaceholder
        ? `Budget looks placeholder (€${min}–€${max}) — confirm real range with the buyer.`
        : `Budget range inverted (€${min}–€${max}). Fix during intake.`,
  });

  // 4. Inquiry quality — urgency + must-haves/preferences filled in?
  const hasUrgency = Boolean(buyer.urgency);
  const hasMustHaves = buyer.mustHaves.length > 0;
  const hasPreferences =
    buyer.preferredBrands.length > 0 ||
    buyer.preferredLocations.length > 0 ||
    buyer.lifestylePreferences.length > 0;
  const inquiryStrong = hasUrgency && hasMustHaves && hasPreferences;
  const inquiryOk = hasUrgency && (hasMustHaves || hasPreferences);
  signals.push({
    label: "Inquiry quality",
    state: inquiryStrong ? "Pass" : inquiryOk ? "Review" : "Fail",
    detail: inquiryStrong
      ? `Urgency ${buyer.urgency.toLowerCase()}, ${buyer.mustHaves.length} must-have(s), clear preferences captured.`
      : inquiryOk
        ? "Urgency captured but must-haves or preferences are thin — enrich before shortlisting."
        : "Inquiry is generic (missing urgency, must-haves, or preferences) — treat as tire-kicker until enriched.",
  });

  return signals;
}

/* Roll baseline signals up into an overall readiness status without any AI. */
export function inferStatusFromSignals(signals: VerificationSignal[]): VerificationStatus {
  if (signals.some((s) => s.state === "Fail")) return "High Risk";
  if (signals.some((s) => s.state === "Review")) return "Needs Review";
  return "Verified";
}
