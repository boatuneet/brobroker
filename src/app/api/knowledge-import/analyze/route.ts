import { NextResponse } from "next/server";
import { chatComplete, hasOpenAI } from "@/lib/openai-server";

export const dynamic = "force-dynamic";

interface Candidate {
  id: string;
  title: string;
  category: string;
}

function sanitizeCandidates(input: unknown): Candidate[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (c): c is Candidate =>
        !!c && typeof c === "object" && typeof (c as Candidate).id === "string" && typeof (c as Candidate).title === "string",
    )
    .slice(0, 40)
    .map((c) => ({ id: c.id, title: c.title, category: String((c as Candidate).category ?? "") }));
}

function heuristicTitle(text: string, fileName?: string): string {
  if (fileName) return fileName.replace(/\.[^.]+$/, "").slice(0, 90);
  const firstLine = text.trim().split(/\n/)[0]?.trim() ?? "";
  return (firstLine || "Imported note").slice(0, 90);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    text?: string;
    fileName?: string;
    candidates?: unknown;
  };
  const text = (body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "Paste or upload some text first." }, { status: 400 });
  }
  const candidates = sanitizeCandidates(body.candidates);

  // No key → heuristic title/summary, best keyword candidate (already ranked by the client).
  if (!hasOpenAI()) {
    return NextResponse.json({
      title: heuristicTitle(text, body.fileName),
      summary: text.replace(/\s+/g, " ").trim().slice(0, 220),
      tags: [],
      suggestedId: candidates[0]?.id ?? null,
      mode: "heuristic" as const,
    });
  }

  const candidateBlock = candidates.length
    ? candidates.map((c) => `- id: ${c.id} | ${c.title} (${c.category})`).join("\n")
    : "(no candidate records)";

  const raw = await chatComplete(
    [
      {
        role: "system",
        content:
          "You organise a yacht broker's imported knowledge. Given a pasted document, return strict JSON with: " +
          '"title" (<= 80 chars), "summary" (1-2 sentences), "tags" (3-6 short lowercase tags), and ' +
          '"suggestedId" — the id of the single candidate record this note is clearly about, or null if unclear or general. ' +
          "Only use an id from the provided candidate list.",
      },
      {
        role: "user",
        content: `Candidate records:\n${candidateBlock}\n\nDocument:\n"""\n${text.slice(0, 6000)}\n"""`,
      },
    ],
    { json: true, temperature: 0.1, maxTokens: 400 },
  );

  if (!raw) {
    return NextResponse.json({
      title: heuristicTitle(text, body.fileName),
      summary: text.replace(/\s+/g, " ").trim().slice(0, 220),
      tags: [],
      suggestedId: candidates[0]?.id ?? null,
      mode: "heuristic" as const,
    });
  }

  try {
    const parsed = JSON.parse(raw) as {
      title?: string;
      summary?: string;
      tags?: unknown;
      suggestedId?: string | null;
    };
    const validId =
      parsed.suggestedId && candidates.some((c) => c.id === parsed.suggestedId)
        ? parsed.suggestedId
        : null;
    return NextResponse.json({
      title: (parsed.title || heuristicTitle(text, body.fileName)).slice(0, 90),
      summary: parsed.summary || text.replace(/\s+/g, " ").trim().slice(0, 220),
      tags: Array.isArray(parsed.tags) ? parsed.tags.filter((t) => typeof t === "string").slice(0, 6) : [],
      suggestedId: validId,
      mode: "openai" as const,
    });
  } catch {
    return NextResponse.json({
      title: heuristicTitle(text, body.fileName),
      summary: text.replace(/\s+/g, " ").trim().slice(0, 220),
      tags: [],
      suggestedId: candidates[0]?.id ?? null,
      mode: "heuristic" as const,
    });
  }
}
