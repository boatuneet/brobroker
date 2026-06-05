import type { KnowledgePage } from "./knowledge-vault";

/* ============================================================
   Knowledge chat — retrieval + prompt assembly.

   Pure, dependency-free helpers shared by the chat API route and
   its tests. The flow is:
     1. tokenize the user's question
     2. score every compiled vault page against those terms
     3. take the top-k pages as grounding context
     4. either hand that context to OpenAI (route) or compose a
        direct "wiki" answer when no API key is configured.
   ============================================================ */

export interface ChatCitation {
  id: string;
  slug: string;
  title: string;
  category: string;
  confidence: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/* Words too common to carry retrieval signal. Kept small on purpose —
   over-pruning hurts more than a few stop words help. */
const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for",
  "is", "are", "was", "were", "be", "been", "being", "it", "its", "this",
  "that", "these", "those", "with", "as", "at", "by", "from", "about",
  "into", "what", "which", "who", "whom", "how", "do", "does", "did",
  "can", "could", "should", "would", "will", "i", "you", "we", "me",
  "my", "our", "us", "give", "show", "tell", "list", "any", "all",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((term) => term.length >= 2 && !STOP_WORDS.has(term));
}

function countOccurrences(haystack: string, term: string): number {
  if (!haystack) return 0;
  let count = 0;
  let index = haystack.indexOf(term);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(term, index + term.length);
  }
  return count;
}

/* Weighted, field-aware relevance score. Title/tags/category hits matter
   more than a passing mention inside a section body or source label. */
export function scorePage(page: KnowledgePage, terms: string[]): number {
  if (!terms.length) return 0;

  const fields: Array<{ text: string; weight: number }> = [
    { text: page.title.toLowerCase(), weight: 6 },
    { text: page.tags.join(" ").toLowerCase(), weight: 4 },
    { text: page.category.toLowerCase(), weight: 4 },
    { text: page.summary.toLowerCase(), weight: 2 },
    {
      text: page.sections
        .map((section) =>
          [section.title, section.body ?? "", section.bullets?.join(" ") ?? "",
            section.stats?.map((stat) => `${stat.label} ${stat.value} ${stat.detail ?? ""}`).join(" ") ?? ""]
            .join(" "),
        )
        .join(" ")
        .toLowerCase(),
      weight: 1,
    },
    { text: page.openGaps.join(" ").toLowerCase(), weight: 2 },
    { text: page.sources.map((src) => src.label).join(" ").toLowerCase(), weight: 1 },
    { text: page.related.map((rel) => `${rel.label} ${rel.note ?? ""}`).join(" ").toLowerCase(), weight: 1 },
  ];

  let score = 0;
  for (const term of terms) {
    for (const field of fields) {
      score += countOccurrences(field.text, term) * field.weight;
    }
  }
  return score;
}

/* Rank pages for a query. Ties break on confidence so the more
   trustworthy page wins. When nothing matches we still return a small
   slice (overview + highest-confidence pages) so the assistant has
   something grounded to work from instead of hallucinating. */
export function retrieveRelevantPages(
  pages: KnowledgePage[],
  query: string,
  limit = 4,
): KnowledgePage[] {
  const terms = tokenize(query);
  const scored = pages
    .map((page) => ({ page, score: scorePage(page, terms) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.page.confidence - a.page.confidence);

  if (scored.length) {
    return scored.slice(0, limit).map((entry) => entry.page);
  }

  // Fallback: overview first (if present), then strongest pages.
  const overview = pages.find((page) => page.category === "Overview");
  const rest = pages
    .filter((page) => page.category !== "Overview")
    .sort((a, b) => b.confidence - a.confidence);
  return [overview, ...rest].filter(Boolean).slice(0, limit) as KnowledgePage[];
}

export function pageToCitation(page: KnowledgePage): ChatCitation {
  return {
    id: page.id,
    slug: page.slug,
    title: page.title,
    category: page.category,
    confidence: page.confidence,
  };
}

/* Compact, model-readable rendering of a page's grounding facts. */
function pageToContext(page: KnowledgePage): string {
  const facts: string[] = [];
  for (const section of page.sections) {
    if (section.stats?.length) {
      for (const stat of section.stats) {
        facts.push(`${stat.label}: ${stat.value}${stat.detail ? ` (${stat.detail})` : ""}`);
      }
    }
    if (section.body) facts.push(section.body);
    if (section.bullets?.length) {
      for (const bullet of section.bullets) facts.push(bullet);
    }
  }

  const lines = [
    `### ${page.title} — ${page.category} · confidence ${page.confidence}% · visibility ${page.visibility}`,
    `Summary: ${page.summary}`,
  ];
  if (facts.length) {
    lines.push("Key facts:");
    lines.push(...facts.slice(0, 10).map((fact) => `- ${fact}`));
  }
  if (page.openGaps.length) {
    lines.push(`Open gaps: ${page.openGaps.join("; ")}`);
  }
  if (page.sources.length) {
    lines.push(`Sources: ${page.sources.slice(0, 8).map((src) => src.label).join("; ")}`);
  }
  if (page.related.length) {
    lines.push(`Related: ${page.related.slice(0, 6).map((rel) => rel.label).join("; ")}`);
  }
  lines.push(`[cite: ${page.title}]`);
  return lines.join("\n");
}

export function buildContextBlock(pages: KnowledgePage[]): string {
  if (!pages.length) return "No matching vault pages were found.";
  return pages.map(pageToContext).join("\n\n");
}

export function buildSystemPrompt(segmentTitle: string): string {
  return [
    `You are the BroBroker Knowledge assistant for the ${segmentTitle} workspace.`,
    "You answer questions using ONLY the knowledge-vault context provided in the next message.",
    "The vault is compiled from the broker's own operational records (listings, buyers, owners, deal rooms, tasks, sources).",
    "",
    "Rules:",
    "- Ground every claim in the provided context. Never invent figures, names, or facts.",
    "- If the context does not contain the answer, say so plainly and suggest which page or record might hold it.",
    "- Be concise and broker-friendly: lead with the answer, then a few supporting specifics.",
    "- When you use a page, reference it by its title in square brackets, e.g. [Listing: Princess Y72].",
    "- Flag low-confidence pages or open gaps when they affect the reliability of your answer.",
    "- Never expose Owner-Sensitive details as if they were Buyer-Safe.",
  ].join("\n");
}

/* Direct-from-vault answer used when no OpenAI key is configured (or the
   API call fails). Keeps the chat useful as a smart search over the wiki. */
export function composeWikiFallbackAnswer(query: string, pages: KnowledgePage[]): string {
  if (!pages.length) {
    return `I couldn't find a vault page matching "${query.trim()}". Try a listing, buyer, owner, or deal-room name — or open the Pages panel to browse what's compiled.`;
  }

  const lines: string[] = [
    `Here's what the vault has on "${query.trim()}":`,
    "",
  ];

  for (const page of pages) {
    lines.push(`• ${page.title} — ${page.category} (${page.confidence}% confidence)`);
    lines.push(`  ${page.summary}`);
    const firstStat = page.sections.flatMap((section) => section.stats ?? [])[0];
    if (firstStat) {
      lines.push(`  ${firstStat.label}: ${firstStat.value}`);
    }
    if (page.openGaps.length) {
      lines.push(`  Open gap: ${page.openGaps[0]}`);
    }
    lines.push("");
  }

  lines.push("These are direct vault matches. Connect an OpenAI key to get synthesised, conversational answers.");
  return lines.join("\n").trim();
}
