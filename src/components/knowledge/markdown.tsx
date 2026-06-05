import type { ReactNode } from "react";

/* ============================================================
   Lightweight markdown renderer for assistant answers.

   Dependency-free on purpose — it covers the subset the model
   actually emits: headings (#…), bold, italic, inline code,
   unordered (-, *, •) and ordered (1.) lists, and paragraphs.
   Anything it doesn't recognise renders as plain text, so it
   degrades gracefully rather than leaking raw symbols.
   ============================================================ */

type Block =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] };

const HEADING = /^\s{0,3}(#{1,6})\s+(.*)$/;
const BULLET = /^\s*[-*•]\s+(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ type: "heading", text: heading[2].trim() });
      i += 1;
      continue;
    }

    if (BULLET.test(line)) {
      const items: string[] = [];
      while (i < lines.length && BULLET.test(lines[i])) {
        items.push(BULLET.exec(lines[i])![1]);
        i += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    if (ORDERED.test(line)) {
      const items: string[] = [];
      while (i < lines.length && ORDERED.test(lines[i])) {
        items.push(ORDERED.exec(lines[i])![1]);
        i += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    // Paragraph: gather consecutive plain lines.
    const para: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !HEADING.test(lines[i]) &&
      !BULLET.test(lines[i]) &&
      !ORDERED.test(lines[i])
    ) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push({ type: "paragraph", text: para.join("\n") });
  }

  return blocks;
}

const INLINE = /(\*\*([^*]+)\*\*|`([^`]+)`|\*([^*\n]+)\*|_([^_\n]+)_)/g;

function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let n = 0;
  INLINE.lastIndex = 0;

  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const key = `${keyBase}-${n++}`;
    if (match[2] !== undefined) {
      nodes.push(
        <strong className="font-semibold text-[#171719]" key={key}>
          {match[2]}
        </strong>,
      );
    } else if (match[3] !== undefined) {
      nodes.push(
        <code className="rounded bg-[#F1F2EE] px-1 py-0.5 font-mono text-[12px] text-[#171719]" key={key}>
          {match[3]}
        </code>,
      );
    } else if (match[4] !== undefined) {
      nodes.push(<em key={key}>{match[4]}</em>);
    } else if (match[5] !== undefined) {
      nodes.push(<em key={key}>{match[5]}</em>);
    }
    lastIndex = INLINE.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export function Markdown({ text }: { text: string }) {
  const blocks = parseBlocks(text);

  return (
    <div className="space-y-2 text-[13.5px] leading-[1.6] text-[#171719]">
      {blocks.map((block, index) => {
        const key = `b-${index}`;
        if (block.type === "heading") {
          return (
            <p className="pt-1 text-[12.5px] font-semibold uppercase tracking-[0.04em] text-[#171719] first:pt-0" key={key}>
              {renderInline(block.text, key)}
            </p>
          );
        }
        if (block.type === "ul") {
          return (
            <ul className="space-y-1" key={key}>
              {block.items.map((item, itemIndex) => (
                <li className="flex gap-2" key={`${key}-${itemIndex}`}>
                  <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#003C33]" />
                  <span className="min-w-0 flex-1">{renderInline(item, `${key}-${itemIndex}`)}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === "ol") {
          return (
            <ol className="space-y-1" key={key}>
              {block.items.map((item, itemIndex) => (
                <li className="flex gap-2" key={`${key}-${itemIndex}`}>
                  <span className="mt-px shrink-0 font-mono text-[12px] tabular-nums text-[#8E918B]">
                    {itemIndex + 1}.
                  </span>
                  <span className="min-w-0 flex-1">{renderInline(item, `${key}-${itemIndex}`)}</span>
                </li>
              ))}
            </ol>
          );
        }
        return (
          <p className="whitespace-pre-wrap" key={key}>
            {renderInline(block.text, key)}
          </p>
        );
      })}
    </div>
  );
}
