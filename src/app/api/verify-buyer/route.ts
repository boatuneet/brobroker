import { NextResponse } from "next/server";
import { chatComplete, hasOpenAI } from "@/lib/openai-server";

/* Rough AI due-diligence screen. Reads context the broker has already
   entered — never fabricates external facts about the person. */
export const dynamic = "force-dynamic";

type Assessment = "looks_credible" | "unclear" | "red_flags";

interface ScreeningResult {
  assessment: Assessment;
  summary: string;
  flags: string[];
  suggestedChecks: string[];
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

  const userPrompt = buildUserPrompt({
    name,
    company: typeof body.company === "string" ? body.company : undefined,
    country: typeof body.country === "string" ? body.country : undefined,
    inquirySummary: typeof body.inquirySummary === "string" ? body.inquirySummary : undefined,
    budgetRange: typeof body.budgetRange === "string" ? body.budgetRange : undefined,
  });

  const raw = await chatComplete(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    { temperature: 0.2, maxTokens: 600, json: true },
  );

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
  };

  return NextResponse.json(result);
}
