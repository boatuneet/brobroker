import { NextResponse } from "next/server";
import {
  chatComplete,
  hasOpenAI,
  webSearchAnswer,
  type WebSearchSource,
} from "@/lib/openai-server";

/* AI due-diligence screen, two halves:
   1. Plausibility — judges ONLY the context the broker entered (never
      fabricates external facts).
   2. Public record — a web search on the person/company (identity, company
      existence, sanctions/adverse-media mentions) with cited sources, so the
      broker can decide whether the buyer is worth real time. Degrades to
      null when the search tool is unavailable. */
export const dynamic = "force-dynamic";

type Assessment = "looks_credible" | "unclear" | "red_flags";

interface ScreeningResult {
  assessment: Assessment;
  summary: string;
  flags: string[];
  suggestedChecks: string[];
  publicProfile: { summary: string; sources: WebSearchSource[] } | null;
}

function buildPublicSearchPrompt(input: {
  name: string;
  company?: string;
  country?: string;
}): string {
  const who = [
    input.name,
    input.company ? `associated with "${input.company}"` : "",
    input.country ? `based in ${input.country}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  return `You are doing public due diligence for a yacht broker on a prospective high-net-worth buyer: ${who}.

Search the public web and report ONLY what you actually found, with citations:
1. Identity — can this person be reliably identified (role, profession, public profile)?
2. Company — does the stated company exist (registry, website, filings)? What does it do?
3. Risk — any sanctions, watchlist, fraud, litigation, or adverse-media mentions?
4. Wealth plausibility — public signals consistent (or inconsistent) with a luxury-asset buyer.

Rules: never guess or infer beyond sources; common names may match the wrong person — say when identification is ambiguous. If little or nothing reliable is found, state that plainly (that itself is useful signal). Maximum ~180 words, plain English, no markdown headings.`;
}

const SYSTEM_PROMPT = `You are a rough, cautious due-diligence screener for a yacht broker. You review a buyer inquiry and assess PLAUSIBILITY only.

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
No prose outside the JSON.`;

function buildUserPrompt(input: {
  name: string;
  company?: string;
  country?: string;
  inquirySummary?: string;
  budgetRange?: string;
}): string {
  const lines = [
    `Name: ${input.name}`,
    input.company ? `Company: ${input.company}` : "Company: (not provided)",
    input.country ? `Country: ${input.country}` : "Country: (not provided)",
    input.budgetRange ? `Stated budget: ${input.budgetRange}` : "Stated budget: (not provided)",
    "",
    "Inquiry context:",
    input.inquirySummary?.trim() || "(no inquiry text provided)",
  ];
  return lines.join("\n");
}

function coerceAssessment(value: unknown): Assessment {
  return value === "looks_credible" || value === "red_flags" ? value : "unclear";
}

function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).slice(0, 8);
}

export async function POST(request: Request) {
  if (!hasOpenAI()) {
    return NextResponse.json(
      { error: "Connect OpenAI to enable AI screening.", code: "openai_missing" },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const buyerId = typeof body.buyerId === "string" ? body.buyerId : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!buyerId || !name) {
    return NextResponse.json({ error: "buyerId and name are required." }, { status: 400 });
  }

  const company = typeof body.company === "string" ? body.company : undefined;
  const country = typeof body.country === "string" ? body.country : undefined;
  const userPrompt = buildUserPrompt({
    name,
    company,
    country,
    inquirySummary: typeof body.inquirySummary === "string" ? body.inquirySummary : undefined,
    budgetRange: typeof body.budgetRange === "string" ? body.budgetRange : undefined,
  });

  /* Run the context-plausibility screen and the public web lookup in
     parallel — the search half returning null never fails the request. */
  const [raw, publicResult] = await Promise.all([
    chatComplete(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.2, maxTokens: 600, json: true },
    ),
    webSearchAnswer(buildPublicSearchPrompt({ name, company, country })),
  ]);

  if (!raw) {
    return NextResponse.json({ error: "AI screening unavailable — try again shortly." }, { status: 502 });
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "AI returned an unreadable response." }, { status: 502 });
  }

  const result: ScreeningResult = {
    assessment: coerceAssessment(parsed.assessment),
    summary:
      typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary.trim()
        : "No summary returned.",
    flags: coerceStringArray(parsed.flags),
    suggestedChecks: coerceStringArray(parsed.suggestedChecks),
    publicProfile: publicResult
      ? { summary: publicResult.text, sources: publicResult.sources }
      : null,
  };

  return NextResponse.json(result);
}
