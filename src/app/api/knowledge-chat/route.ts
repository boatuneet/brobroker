import { NextResponse } from "next/server";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { getBrokerSegmentMeta } from "@/lib/broker-segments";
import { isDemoModeEnabled } from "@/lib/demo-mode-server";
import {
  buildContextBlock,
  buildSystemPrompt,
  composeWikiFallbackAnswer,
  pageToCitation,
  retrieveRelevantPages,
  type ChatMessage,
} from "@/lib/knowledge-chat";
import { searchNotes, type NoteMatch } from "@/lib/knowledge-notes";
import { buildKnowledgeVault } from "@/lib/knowledge-vault";
import { getStoredBuyersForSegment } from "@/lib/supabase/buyers";
import { getStoredListingsForSegment } from "@/lib/supabase/listings";

/* Reads cookies (segment + demo flag), so this must never be cached. */
export const dynamic = "force-dynamic";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";
const MAX_TURNS = 8; // trailing turns sent to the model for conversational context

function notesToContext(notes: NoteMatch[]): string {
  return notes
    .map(
      (note) =>
        `### Imported note: ${note.title}${note.entityLabel ? ` — about ${note.entityLabel}` : ""}\n${note.snippet}\n[cite: ${note.title}]`,
    )
    .join("\n\n");
}

function appendNotesToFallback(answer: string, notes: NoteMatch[]): string {
  if (!notes.length) return answer;
  const lines = notes.map(
    (note) =>
      `• ${note.title}${note.entityLabel ? ` (about ${note.entityLabel})` : ""}: ${note.snippet
        .replace(/\s+/g, " ")
        .slice(0, 160)}…`,
  );
  return `${answer}\n\nImported notes:\n${lines.join("\n")}`;
}

function sanitizeMessages(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (m): m is ChatMessage =>
        !!m &&
        typeof m === "object" &&
        (m as ChatMessage).role !== undefined &&
        ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant") &&
        typeof (m as ChatMessage).content === "string",
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { messages?: unknown };
  const messages = sanitizeMessages(body.messages);
  const lastUser = [...messages].reverse().find((m) => m.role === "user");

  if (!lastUser || !lastUser.content.trim()) {
    return NextResponse.json({ error: "A user message is required." }, { status: 400 });
  }

  // Rebuild the vault server-side from the active segment + stored records so
  // the client never has to ship the (large) model with every request.
  const segment = await getActiveBrokerSegment();
  const includeDemo = await isDemoModeEnabled();
  const [storedListings, storedBuyers] = await Promise.all([
    getStoredListingsForSegment(segment),
    getStoredBuyersForSegment(segment),
  ]);
  const model = buildKnowledgeVault(segment, { storedListings, storedBuyers, includeDemo });

  const relevant = retrieveRelevantPages(model.pages, lastUser.content, 4);
  // Also pull any user-imported notes relevant to the question.
  const noteMatches = await searchNotes(lastUser.content, 3);
  const citations = [
    ...relevant.map(pageToCitation),
    ...noteMatches.map((note) => ({
      id: `note-${note.groupId}`,
      slug: "",
      title: note.title,
      category: "Note",
    })),
  ];

  const apiKey = process.env.OPENAI_API_KEY?.trim();

  // No key configured → smart vault lookup so the chat still works.
  if (!apiKey) {
    return NextResponse.json({
      answer: appendNotesToFallback(composeWikiFallbackAnswer(lastUser.content, relevant), noteMatches),
      citations,
      mode: "wiki" as const,
    });
  }

  try {
    const context = buildContextBlock(relevant);
    const systemPrompt = buildSystemPrompt(getBrokerSegmentMeta(segment).title);

    const payloadMessages = [
      { role: "system", content: systemPrompt },
      { role: "system", content: `Knowledge vault context:\n\n${context}` },
      ...(noteMatches.length
        ? [
            {
              role: "system",
              content: `Imported broker notes (user-added knowledge — treat as authoritative, cite by title):\n\n${notesToContext(noteMatches)}`,
            },
          ]
        : []),
      ...messages.slice(-MAX_TURNS),
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const response = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL,
        messages: payloadMessages,
        temperature: 0.2,
        max_tokens: 700,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("OpenAI request failed", response.status, detail.slice(0, 500));
      return NextResponse.json({
        answer: appendNotesToFallback(composeWikiFallbackAnswer(lastUser.content, relevant), noteMatches),
        citations,
        mode: "wiki" as const,
        notice: "OpenAI is unavailable right now — showing direct vault matches instead.",
      });
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const answer = data.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      return NextResponse.json({
        answer: appendNotesToFallback(composeWikiFallbackAnswer(lastUser.content, relevant), noteMatches),
        citations,
        mode: "wiki" as const,
        notice: "No model response — showing direct vault matches instead.",
      });
    }

    return NextResponse.json({ answer, citations, mode: "openai" as const });
  } catch (error) {
    console.error("Knowledge chat error", error);
    return NextResponse.json({
      answer: appendNotesToFallback(composeWikiFallbackAnswer(lastUser.content, relevant), noteMatches),
      citations,
      mode: "wiki" as const,
      notice: "Couldn't reach OpenAI — showing direct vault matches instead.",
    });
  }
}
