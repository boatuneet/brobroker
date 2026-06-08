/* Turns the raw specs/equipment text from a listing PDF into structured
   sections (key/value rows + bullet lists) for a clean, scannable display.
   Tuned to the boats.com / YachtWorld "Full Details" export but degrades
   gracefully: anything it can't section is returned as a single text block. */

export interface SpecRow {
  label: string;
  value: string;
}

export interface SpecSection {
  title: string;
  rows: SpecRow[];
  bullets: string[];
  paragraph?: string;
}

/* Known section labels in the export, longest first so the split regex
   prefers the most specific match (e.g. "Outside Equipment/Extras"). */
const SECTION_TITLES = [
  "Information & Features",
  "Outside Equipment/Extras",
  "Outside Equipment",
  "Electrical Equipment",
  "Additional Equipment",
  "Inside Equipment",
  "Standard Equipment",
  "Electronics",
  "Dimensions",
  "Seating",
  "Tanks",
  "Other",
];

/* "Standard Equipment" sub-sections, rendered as their own blocks. */
const SUBHEADERS = [
  "HELM STATION",
  "MASTER CABIN",
  "GUEST CABIN",
  "ELECTRIC SYSTEM",
  "WATER SYSTEM",
  "FUEL SYSTEM",
  "STANDARD COLORS",
  "HEADROOM",
  "COCKPIT",
  "SAFETY",
  "DECK",
];

const KV_TITLES = new Set(["Information & Features", "Dimensions", "Seating", "Tanks", "Other"]);

const TITLE_RENAMES: Record<string, string> = {
  "Information & Features": "Engines & systems",
  Other: "Other details",
};

export function formatSpecSheet(raw: string): SpecSection[] {
  if (!raw || !raw.trim()) return [];

  // AI-formatted imports arrive as Markdown (## headings, "- " bullets);
  // raw boats.com exports are a single run-on string. Pick the right parser.
  if (looksLikeMarkdown(raw)) {
    const sections = parseMarkdownSpec(raw);
    if (sections.length) return sections;
  }

  try {
    const cleaned = raw
      .replace(/The Company offers the details of this vessel[\s\S]*?without notice\.?/gi, "")
      .replace(/The indicated price is public[\s\S]*?more information\.?/gi, "")
      .replace(/\bAdditional Information\b/gi, "")
      .trim();

    const headers = [...SECTION_TITLES, ...SUBHEADERS].sort((a, b) => b.length - a.length);
    const splitRe = new RegExp(`(${headers.map(escapeRegExp).join("|")})`, "g");
    const parts = cleaned.split(splitRe);

    const sections: SpecSection[] = [];
    // parts[0] is any text before the first header; the rest alternate
    // [header, content, header, content, ...].
    for (let i = 1; i < parts.length; i += 2) {
      const header = parts[i];
      const content = (parts[i + 1] ?? "").trim();
      if (!content) continue;

      const title = TITLE_RENAMES[header] ?? (isAllCaps(header) ? toTitleCase(header) : header);
      const section = KV_TITLES.has(header)
        ? buildKvSection(title, content)
        : buildListSection(title, content);
      if (section.rows.length || section.bullets.length || section.paragraph) {
        sections.push(section);
      }
    }

    return sections;
  } catch {
    return [];
  }
}

function looksLikeMarkdown(text: string): boolean {
  return /\n/.test(text) && /(^|\n)\s*(#{1,3}\s|[-*]\s)/.test(text);
}

/* Parse AI-formatted Markdown into the same SpecSection shape: '#' lines start
   a section, '- '/'* ' lines are bullets (or label/value rows when they read
   like "Label: value"), other lines append to the current paragraph. */
function parseMarkdownSpec(text: string): SpecSection[] {
  const sections: SpecSection[] = [];
  let current: SpecSection | null = null;

  const ensure = (title = "") => {
    if (!current) {
      current = { title, rows: [], bullets: [], paragraph: undefined };
      sections.push(current);
    }
    return current;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const heading = line.match(/^#{1,4}\s+(.*)$/);
    if (heading) {
      current = { title: stripInlineMarkdown(heading[1]).replace(/:$/, ""), rows: [], bullets: [] };
      sections.push(current);
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      const item = stripInlineMarkdown(bullet[1]);
      const kv = item.match(/^([^:]{1,40}):\s*(.+)$/);
      if (kv) ensure().rows.push({ label: kv[1].trim(), value: kv[2].trim() });
      else ensure().bullets.push(item);
      continue;
    }

    // Bold-only line acts as a sub-heading.
    const boldHeading = line.match(/^\*\*(.+?)\*\*:?$/);
    if (boldHeading) {
      current = { title: boldHeading[1].trim(), rows: [], bullets: [] };
      sections.push(current);
      continue;
    }

    const section = ensure();
    section.paragraph = section.paragraph ? `${section.paragraph} ${stripInlineMarkdown(line)}` : stripInlineMarkdown(line);
  }

  return sections.filter((section) => section.rows.length || section.bullets.length || section.paragraph);
}

function stripInlineMarkdown(value: string): string {
  return value.replace(/\*\*(.+?)\*\*/g, "$1").replace(/`(.+?)`/g, "$1").trim();
}

function buildKvSection(title: string, content: string): SpecSection {
  const rows: SpecRow[] = [];
  const bullets: string[] = [];

  // Lead text before the first "Label:" — e.g. an engine name line.
  const firstLabel = content.search(/[A-Za-z][A-Za-z0-9 /]*?:/);
  const lead = firstLabel > 0 ? content.slice(0, firstLabel).trim() : "";
  if (lead) bullets.push(...lead.split(/\s{2,}|\n+/).map((s) => s.trim()).filter(Boolean));

  const kvRe = /([A-Za-z][A-Za-z0-9 /]*?):\s*(.*?)(?=\s+[A-Za-z][A-Za-z0-9 /]*?:|$)/g;
  let match: RegExpExecArray | null;
  while ((match = kvRe.exec(content)) !== null) {
    const label = match[1].trim();
    const value = match[2].trim();
    // An engine model line repeats inside the value stream; surface it as a
    // bullet rather than a row when it carries an "(Engine N)" marker.
    if (/\(Engine\s*\d+\)/i.test(label) || /\(Engine\s*\d+\)/i.test(value)) {
      bullets.push(`${label}${value ? ` ${value}` : ""}`.replace(/\s+/g, " ").trim());
      continue;
    }
    if (label && value) rows.push({ label, value });
  }

  if (!rows.length && !bullets.length) return { title, rows: [], bullets: [], paragraph: content };
  return { title, rows, bullets };
}

function buildListSection(title: string, content: string): SpecSection {
  const bullets = content
    .split(/\n+|\s+[-•·]\s+/)
    .map((line) => line.replace(/^[-•·]\s*/, "").trim())
    .filter((line) => line.length > 1);

  // A single long blob (line breaks lost in the source) reads better as a
  // paragraph than one giant bullet.
  if (bullets.length <= 1) {
    const text = (bullets[0] ?? content).trim();
    return { title, rows: [], bullets: [], paragraph: text || undefined };
  }
  return { title, rows: [], bullets };
}

function isAllCaps(value: string): boolean {
  return value === value.toUpperCase() && /[A-Z]/.test(value);
}

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
