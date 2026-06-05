import { describe, expect, test } from "vitest";
import {
  buildContextBlock,
  composeWikiFallbackAnswer,
  pageToCitation,
  retrieveRelevantPages,
  scorePage,
  tokenize,
} from "./knowledge-chat";
import type { KnowledgePage } from "./knowledge-vault";

function page(overrides: Partial<KnowledgePage>): KnowledgePage {
  return {
    id: "p1",
    slug: "p1",
    title: "Untitled",
    category: "Listing",
    segment: "Yacht",
    summary: "",
    tags: [],
    confidence: 80,
    updatedAt: "2026-05-24T09:00:00+03:00",
    visibility: "Broker Only",
    sources: [],
    related: [],
    sections: [],
    openGaps: [],
    ...overrides,
  } as KnowledgePage;
}

describe("tokenize", () => {
  test("lowercases, strips punctuation, drops stop words and short tokens", () => {
    expect(tokenize("What is the Princess Y72 price?")).toEqual([
      "princess",
      "y72",
      "price",
    ]);
  });
});

describe("scorePage", () => {
  test("weights title matches above body matches", () => {
    const titleMatch = page({ title: "Princess Y72" });
    const bodyMatch = page({
      title: "Sunseeker",
      sections: [{ title: "Notes", body: "Compared against the Princess range." }],
    });
    const terms = tokenize("princess");
    expect(scorePage(titleMatch, terms)).toBeGreaterThan(scorePage(bodyMatch, terms));
  });

  test("returns zero when no terms", () => {
    expect(scorePage(page({ title: "Princess" }), [])).toBe(0);
  });
});

describe("retrieveRelevantPages", () => {
  const pages = [
    page({ id: "overview", slug: "overview", title: "Yacht knowledge vault", category: "Overview", confidence: 90 }),
    page({ id: "y72", slug: "y72", title: "Princess Y72", confidence: 88, tags: ["VAT paid"] }),
    page({ id: "buyer", slug: "buyer", title: "Family buyer", category: "Buyer", confidence: 70 }),
  ];

  test("ranks the most relevant page first", () => {
    const result = retrieveRelevantPages(pages, "princess y72 vat", 2);
    expect(result[0].id).toBe("y72");
    expect(result.length).toBeLessThanOrEqual(2);
  });

  test("falls back to overview + strongest pages when nothing matches", () => {
    const result = retrieveRelevantPages(pages, "zzzzz nonexistent", 2);
    expect(result[0].id).toBe("overview");
    expect(result.length).toBe(2);
  });
});

describe("buildContextBlock", () => {
  test("includes summary, facts, and a cite marker", () => {
    const block = buildContextBlock([
      page({
        title: "Princess Y72",
        summary: "A 72ft family yacht.",
        sections: [{ title: "Core facts", stats: [{ label: "Price", value: "EUR 3.1m" }] }],
      }),
    ]);
    expect(block).toContain("Princess Y72");
    expect(block).toContain("A 72ft family yacht.");
    expect(block).toContain("Price: EUR 3.1m");
    expect(block).toContain("[cite: Princess Y72]");
  });
});

describe("composeWikiFallbackAnswer", () => {
  test("summarises matched pages and notes it's a direct lookup", () => {
    const answer = composeWikiFallbackAnswer("princess", [
      page({ title: "Princess Y72", summary: "A 72ft family yacht.", confidence: 88 }),
    ]);
    expect(answer).toContain("Princess Y72");
    expect(answer).toContain("OpenAI");
  });

  test("handles no matches gracefully", () => {
    const answer = composeWikiFallbackAnswer("nothing", []);
    expect(answer.toLowerCase()).toContain("couldn't find");
  });
});

describe("pageToCitation", () => {
  test("projects the fields the UI needs", () => {
    expect(pageToCitation(page({ id: "y72", slug: "y72", title: "Princess Y72", category: "Listing", confidence: 88 }))).toEqual({
      id: "y72",
      slug: "y72",
      title: "Princess Y72",
      category: "Listing",
      confidence: 88,
    });
  });
});
