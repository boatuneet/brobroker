import { NextResponse } from "next/server";
import {
  chatComplete,
  hasOpenAI,
  webSearchAnswer,
  type WebSearchSource,
} from "@/lib/openai-server";
import {
  DEFAULT_SCREENING_PROMPTS,
  renderPublicSearchPrompt,
  sanitizePromptOverride,
} from "@/lib/screening-prompts";

/* AI due-diligence screen, two halves:
   1. Plausibility — judges ONLY the context the broker entered (never
      fabricates external facts).
   2. Public record — a web search on the person/company (identity, company
      existence, sanctions/adverse-media mentions) with cited sources, so the
      broker can decide whether the buyer is worth real time. Degrades to
      null when the search tool is unavailable.

   Both prompts default from lib/screening-prompts.ts; the Trust tab's prompt
   drawer can send device-saved overrides in the POST body. */
export const dynamic = "force-dynamic";

type Assessment = "looks_credible" | "unclear" | "red_flags";

interface ScreeningResult {
  assessment: Assessment;
  summary: string;
  flags: string[];
  suggestedChecks: string[];
  publicProfile: { summary: string; sources: WebSearchSource[] } | null;
}

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

  /* Broker prompt overrides (from the Trust tab drawer) — sanitized and
     capped; anything missing falls back to the defaults. */
  const promptOverrides =
    body.prompts && typeof body.prompts === "object" && !Array.isArray(body.prompts)
      ? (body.prompts as Record<string, unknown>)
      : {};
  const plausibilityPrompt =
    sanitizePromptOverride(promptOverrides.plausibility) ??
    DEFAULT_SCREENING_PROMPTS.plausibility;
  const publicSearchTemplate =
    sanitizePromptOverride(promptOverrides.publicSearch) ??
    DEFAULT_SCREENING_PROMPTS.publicSearch;

  /* Run the context-plausibility screen and the public web lookup in
     parallel — the search half returning null never fails the request. */
  const [raw, publicResult] = await Promise.all([
    chatComplete(
      [
        { role: "system", content: plausibilityPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.2, maxTokens: 600, json: true },
    ),
    webSearchAnswer(renderPublicSearchPrompt(publicSearchTemplate, { name, company, country })),
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
