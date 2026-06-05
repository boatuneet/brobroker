/* ============================================================
   Server-side OpenAI helpers (fetch-based, no SDK dependency).

   Shared by the knowledge-import and knowledge-chat routes. All
   helpers degrade gracefully: when no OPENAI_API_KEY is set (or a
   call fails) they return null so callers can fall back to
   keyword/heuristic behaviour.
   ============================================================ */

const OPENAI_BASE = "https://api.openai.com/v1";

export function openAIKey(): string {
  return process.env.OPENAI_API_KEY?.trim() ?? "";
}

export function hasOpenAI(): boolean {
  return openAIKey().length > 0;
}

function embedModel(): string {
  // text-embedding-3-small returns 1536 dims → matches memory_chunks.embedding.
  return process.env.OPENAI_EMBED_MODEL?.trim() || "text-embedding-3-small";
}

function chatModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, ms = 30_000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

/** Embed up to ~100 inputs in one request. Returns null on any failure. */
export async function embedMany(inputs: string[]): Promise<number[][] | null> {
  const key = openAIKey();
  if (!key || !inputs.length) return null;
  try {
    const res = await withTimeout((signal) =>
      fetch(`${OPENAI_BASE}/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: embedModel(),
          input: inputs.map((text) => text.slice(0, 8000)),
        }),
        signal,
      }),
    );
    if (!res.ok) {
      console.error("OpenAI embeddings failed", res.status, (await res.text().catch(() => "")).slice(0, 300));
      return null;
    }
    const data = (await res.json()) as { data?: Array<{ embedding: number[] }> };
    const vectors = data.data?.map((row) => row.embedding);
    return vectors && vectors.length === inputs.length ? vectors : null;
  } catch (error) {
    console.error("OpenAI embeddings error", error);
    return null;
  }
}

export async function embedText(text: string): Promise<number[] | null> {
  const result = await embedMany([text]);
  return result?.[0] ?? null;
}

/** Chat completion → trimmed string content, or null on failure. */
export async function chatComplete(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  options: { temperature?: number; maxTokens?: number; json?: boolean } = {},
): Promise<string | null> {
  const key = openAIKey();
  if (!key) return null;
  try {
    const res = await withTimeout((signal) =>
      fetch(`${OPENAI_BASE}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: chatModel(),
          messages,
          temperature: options.temperature ?? 0.2,
          max_tokens: options.maxTokens ?? 700,
          ...(options.json ? { response_format: { type: "json_object" } } : {}),
        }),
        signal,
      }),
    );
    if (!res.ok) {
      console.error("OpenAI chat failed", res.status, (await res.text().catch(() => "")).slice(0, 300));
      return null;
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (error) {
    console.error("OpenAI chat error", error);
    return null;
  }
}
