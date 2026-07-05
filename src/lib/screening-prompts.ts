/* Prompts for the buyer AI screening — shared by the /api/verify-buyer route
   (defaults + rendering) and the Trust tab's prompt drawer (view/edit).

   Broker overrides persist on the device (localStorage) and ride along in the
   POST body, mirroring how the AI re-rank config works. No "use client":
   the read/write helpers guard on `window` so the route can import defaults. */

export interface ScreeningPrompts {
  /* System prompt for the inquiry-plausibility screen (no placeholders —
     the buyer context is sent as the user message). */
  plausibility: string;
  /* Template for the public web-search lookup. {{name}}, {{company}} and
     {{country}} are replaced with the buyer's values at run time. */
  publicSearch: string;
}

export const DEFAULT_SCREENING_PROMPTS: ScreeningPrompts = {
  plausibility: `You are a rough, cautious due-diligence screener for a yacht broker. You review a buyer inquiry and assess PLAUSIBILITY only.

Hard rules:
- Do NOT fabricate facts about the real person (no invented history, sanctions, wealth, or affiliations).
- Judge only what the broker gave you: name/company plausibility, coherence of the inquiry, whether stated budget/urgency/asks fit a genuine HNW buyer versus a tire-kicker or impersonator.
- Prefer "unclear" over guessing. Reserve "red_flags" for concrete inconsistencies visible in the provided context (contradictions, implausible budget vs. asks, generic/templated phrasing, mismatched company/country signals, evasive framing).
- Suggested checks must be actionable broker steps (e.g. "Request proof of funds", "Verify company via registry").

Return STRICT JSON matching:
{
  "assessment": "looks_credible" | "unclear" | "red_flags",
  "summary": "2-3 sentences, plain English, no hedging fluff",
  "flags": ["short concrete concern", ...],
  "suggestedChecks": ["actionable next step", ...]
}
No prose outside the JSON.`,
  publicSearch: `You are doing public due diligence for a yacht broker on a prospective high-net-worth buyer: {{name}}{{company}}{{country}}.

Search the public web and report ONLY what you actually found, with citations:
1. Identity — can this person be reliably identified (role, profession, public profile)?
2. Company — does the stated company exist (registry, website, filings)? What does it do?
3. Risk — any sanctions, watchlist, fraud, litigation, or adverse-media mentions?
4. Wealth plausibility — public signals consistent (or inconsistent) with a luxury-asset buyer.

Rules: never guess or infer beyond sources; common names may match the wrong person — say when identification is ambiguous. If little or nothing reliable is found, state that plainly (that itself is useful signal). Maximum ~180 words, plain English, no markdown headings.`,
};

const MAX_PROMPT_CHARS = 6000;

/* Fill the public-search template. {{company}}/{{country}} render as
   ', associated with "X"' / ', based in Y' so the sentence stays readable
   when either is missing. */
export function renderPublicSearchPrompt(
  template: string,
  input: { name: string; company?: string; country?: string },
): string {
  return template
    .replaceAll("{{name}}", input.name)
    .replaceAll("{{company}}", input.company ? `, associated with "${input.company}"` : "")
    .replaceAll("{{country}}", input.country ? `, based in ${input.country}` : "");
}

/* Coerce untrusted override values (from the POST body or storage). */
export function sanitizePromptOverride(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_PROMPT_CHARS);
}

/* ---------------- device persistence (Trust tab drawer) ------------- */

const STORAGE_KEY = "brobroker:screening-prompts";

export function readStoredScreeningPrompts(): ScreeningPrompts {
  if (typeof window === "undefined") return DEFAULT_SCREENING_PROMPTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SCREENING_PROMPTS;
    const parsed = JSON.parse(raw) as Partial<ScreeningPrompts>;
    return {
      plausibility:
        sanitizePromptOverride(parsed.plausibility) ?? DEFAULT_SCREENING_PROMPTS.plausibility,
      publicSearch:
        sanitizePromptOverride(parsed.publicSearch) ?? DEFAULT_SCREENING_PROMPTS.publicSearch,
    };
  } catch {
    return DEFAULT_SCREENING_PROMPTS;
  }
}

export function writeStoredScreeningPrompts(prompts: ScreeningPrompts): void {
  if (typeof window === "undefined") return;
  const isDefault =
    prompts.plausibility === DEFAULT_SCREENING_PROMPTS.plausibility &&
    prompts.publicSearch === DEFAULT_SCREENING_PROMPTS.publicSearch;
  if (isDefault) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
}
