import { NextResponse } from "next/server";
import { insertNote } from "@/lib/knowledge-notes";

export const dynamic = "force-dynamic";

const ALLOWED_ENTITY_TYPES = new Set([
  "Listing",
  "Buyer",
  "Owner",
  "Deal Room",
  "Market Note",
  "General",
]);

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    summary?: string;
    tags?: unknown;
    content?: string;
    entityType?: string;
    entityId?: string;
    entityLabel?: string;
    fileName?: string;
  };

  const content = (body.content ?? "").trim();
  if (!content) {
    return NextResponse.json({ error: "Nothing to save — the note is empty." }, { status: 400 });
  }

  const entityType = ALLOWED_ENTITY_TYPES.has(body.entityType ?? "") ? body.entityType! : "General";
  const entityId = entityType === "General" ? "general" : (body.entityId || "general");
  const entityLabel = entityType === "General" ? "General" : (body.entityLabel || "");
  const tags = Array.isArray(body.tags)
    ? body.tags.filter((t): t is string => typeof t === "string").slice(0, 8)
    : [];

  try {
    const result = await insertNote({
      title: (body.title || "Imported note").slice(0, 120),
      summary: (body.summary || "").slice(0, 400),
      tags,
      body: content,
      entityType,
      entityId,
      entityLabel,
      fileName: body.fileName,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the note.";
    console.error("knowledge-import save failed", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
