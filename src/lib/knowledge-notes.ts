import { randomUUID } from "node:crypto";
import type { BrokerSegment } from "./broker-segments";
import type { KnowledgePage, KnowledgeRelation } from "./knowledge-vault";
import { embedMany, embedText } from "./openai-server";
import { isSupabaseConfigured } from "./supabase/env";
import { createClient } from "./supabase/server";

/* ============================================================
   Imported knowledge ("notes") stored in the existing
   memory_chunks table.

   Each import becomes one or more chunk rows that share a
   metadata.groupId. Rows carry:
     entity_type / entity_id  → the vault page the note is about
                                 (e.g. "Buyer" / "buyer-123"), or
                                 "General" / "general".
     content                  → the chunk text (embedded for recall)
     embedding                → 1536-dim vector (null when no key)
     metadata                 → { kind:"note", groupId, title,
                                  summary, tags, entityLabel,
                                  chunkIndex, chunkTotal, fileName }
   ============================================================ */

const NOTE_KIND = "note";
const CHUNK_TARGET = 1500; // chars per chunk (paragraph-aware)
const MAX_CHUNKS = 24;

export interface KnowledgeNote {
  groupId: string;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  entityType: string;
  entityId: string;
  entityLabel: string;
  createdAt: string;
}

export interface NoteMatch {
  groupId: string;
  title: string;
  entityId: string;
  entityType: string;
  entityLabel: string;
  snippet: string;
  score: number;
}

interface NoteMetadata {
  kind?: string;
  groupId?: string;
  title?: string;
  summary?: string;
  tags?: string[];
  entityLabel?: string;
  chunkIndex?: number;
  chunkTotal?: number;
  fileName?: string;
}

interface ChunkRow {
  id: string;
  content: string;
  metadata: NoteMetadata;
  embedding: unknown;
  entity_type: string;
  entity_id: string;
  created_at: string;
}

function vectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

function parseEmbedding(value: unknown): number[] | null {
  if (Array.isArray(value)) return value as number[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as number[]) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return -1;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return -1;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/** Split text into paragraph-aware chunks of roughly CHUNK_TARGET chars. */
export function chunkText(text: string): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  if (clean.length <= CHUNK_TARGET) return [clean];

  const paragraphs = clean.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if ((current + "\n\n" + paragraph).length > CHUNK_TARGET && current) {
      chunks.push(current.trim());
      current = paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
    // A single huge paragraph: hard-split it.
    while (current.length > CHUNK_TARGET * 1.5) {
      chunks.push(current.slice(0, CHUNK_TARGET).trim());
      current = current.slice(CHUNK_TARGET);
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.slice(0, MAX_CHUNKS);
}

async function getOwnerAndClient() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, userId: user.id };
}

async function getNoteChunks(): Promise<ChunkRow[]> {
  const ctx = await getOwnerAndClient();
  if (!ctx) return [];
  const { data, error } = await ctx.supabase
    .from("memory_chunks")
    .select("id,content,metadata,embedding,entity_type,entity_id,created_at")
    .eq("owner_user_id", ctx.userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Could not read memory_chunks", error.message);
    return [];
  }
  return ((data ?? []) as ChunkRow[]).filter((row) => row.metadata?.kind === NOTE_KIND);
}

function groupChunks(chunks: ChunkRow[]): KnowledgeNote[] {
  const groups = new Map<string, ChunkRow[]>();
  for (const chunk of chunks) {
    const key = chunk.metadata?.groupId ?? chunk.id;
    const list = groups.get(key) ?? [];
    list.push(chunk);
    groups.set(key, list);
  }

  const notes: KnowledgeNote[] = [];
  for (const [groupId, list] of groups) {
    list.sort((a, b) => (a.metadata?.chunkIndex ?? 0) - (b.metadata?.chunkIndex ?? 0));
    const head = list[0];
    notes.push({
      groupId,
      title: head.metadata?.title ?? "Untitled note",
      summary: head.metadata?.summary ?? "",
      body: list.map((c) => c.content).join("\n\n"),
      tags: head.metadata?.tags ?? [],
      entityType: head.entity_type,
      entityId: head.entity_id,
      entityLabel: head.metadata?.entityLabel ?? "",
      createdAt: head.created_at,
    });
  }
  notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return notes;
}

export async function getNotesForOwner(): Promise<KnowledgeNote[]> {
  return groupChunks(await getNoteChunks());
}

const RELATION_TYPE: Record<string, KnowledgeRelation["type"]> = {
  Listing: "listing",
  Buyer: "buyer",
  Owner: "owner",
  "Deal Room": "deal-room",
  "Market Note": "report",
};

/** Convert imported notes into browsable "Note" vault pages for the table. */
export function notesToPages(notes: KnowledgeNote[], segment: BrokerSegment): KnowledgePage[] {
  return notes.map((note) => {
    const relationType = RELATION_TYPE[note.entityType];
    const related: KnowledgeRelation[] =
      note.entityId && note.entityId !== "general" && relationType
        ? [
            {
              type: relationType,
              id: note.entityId,
              label: note.entityLabel || note.entityType,
              note: `Linked ${note.entityType.toLowerCase()}`,
            },
          ]
        : [];
    return {
      id: `note-${note.groupId}`,
      slug: `note/${note.groupId}`,
      title: note.title,
      category: "Note",
      segment,
      summary: note.summary || note.body.slice(0, 200),
      tags: note.tags,
      confidence: 100,
      updatedAt: note.createdAt,
      visibility: "Broker Only",
      sources: [],
      related,
      sections: [{ title: "Imported content", body: note.body }],
      openGaps: [],
    };
  });
}

/** Map of vault page id → notes linked to it (for the detail panel). */
export function notesByPageId(notes: KnowledgeNote[]): Record<string, KnowledgeNote[]> {
  const map: Record<string, KnowledgeNote[]> = {};
  for (const note of notes) {
    if (!note.entityId || note.entityId === "general") continue;
    (map[note.entityId] ??= []).push(note);
  }
  return map;
}

/** Semantic (embedding) search with keyword fallback. Returns distinct notes. */
export async function searchNotes(query: string, limit = 4): Promise<NoteMatch[]> {
  const chunks = await getNoteChunks();
  if (!chunks.length) return [];

  const queryEmbedding = await embedText(query);
  let ranked: Array<{ chunk: ChunkRow; score: number }>;

  if (queryEmbedding) {
    ranked = chunks
      .map((chunk) => {
        const embedding = parseEmbedding(chunk.embedding);
        return { chunk, score: embedding ? cosineSimilarity(queryEmbedding, embedding) : -1 };
      })
      .filter((entry) => entry.score > 0.15)
      .sort((a, b) => b.score - a.score);
  } else {
    const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
    ranked = chunks
      .map((chunk) => {
        const haystack = `${chunk.metadata?.title ?? ""} ${chunk.content}`.toLowerCase();
        const score = terms.reduce((acc, term) => acc + (haystack.includes(term) ? 1 : 0), 0);
        return { chunk, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  // Collapse to distinct notes (best-scoring chunk per group).
  const seen = new Set<string>();
  const matches: NoteMatch[] = [];
  for (const { chunk, score } of ranked) {
    const groupId = chunk.metadata?.groupId ?? chunk.id;
    if (seen.has(groupId)) continue;
    seen.add(groupId);
    matches.push({
      groupId,
      title: chunk.metadata?.title ?? "Untitled note",
      entityId: chunk.entity_id,
      entityType: chunk.entity_type,
      entityLabel: chunk.metadata?.entityLabel ?? "",
      snippet: chunk.content.slice(0, 600),
      score,
    });
    if (matches.length >= limit) break;
  }
  return matches;
}

/** Insert a note as one or more embedded chunks. Throws on failure. */
export async function insertNote(input: {
  title: string;
  summary: string;
  tags: string[];
  body: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  fileName?: string;
}): Promise<{ groupId: string; chunks: number; embedded: boolean }> {
  const ctx = await getOwnerAndClient();
  if (!ctx) throw new Error("Not authenticated or Supabase not configured.");

  const chunks = chunkText(input.body);
  if (!chunks.length) throw new Error("Nothing to save — the note is empty.");

  const groupId = randomUUID();
  const embeddings = await embedMany(chunks);

  const rows = chunks.map((content, index) => ({
    owner_user_id: ctx.userId,
    entity_type: input.entityType,
    entity_id: input.entityId,
    visibility: "broker",
    content,
    metadata: {
      kind: NOTE_KIND,
      groupId,
      title: input.title,
      summary: input.summary,
      tags: input.tags,
      entityLabel: input.entityLabel,
      chunkIndex: index,
      chunkTotal: chunks.length,
      fileName: input.fileName ?? null,
    },
    embedding: embeddings?.[index] ? vectorLiteral(embeddings[index]) : null,
  }));

  const { error } = await ctx.supabase.from("memory_chunks").insert(rows);
  if (error) throw new Error(error.message);

  return { groupId, chunks: rows.length, embedded: Boolean(embeddings) };
}
