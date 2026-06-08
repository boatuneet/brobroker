import { NextResponse } from "next/server";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { getListingsForSegment } from "@/lib/broker-segments";
import { isDemoModeEnabled } from "@/lib/demo-mode-server";
import { chatComplete, hasOpenAI } from "@/lib/openai-server";
import { buildRerankGuidance, normalizeRerankConfig } from "@/lib/rerank-config";
import { generateClientBriefShortlist } from "@/lib/services";
import { getStoredListingsForSegment } from "@/lib/supabase/listings";
import type { YachtListing } from "@/lib/types";

export const dynamic = "force-dynamic";

const CANDIDATE_LIMIT = 15;

function truncate(value: string, max: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

interface RankedMatch {
  listingId: string;
  fitScore: number;
  reason: string;
}

function mergeListings(primary: YachtListing[], fallback: YachtListing[]) {
  const seen = new Set<string>();
  return [...primary, ...fallback].filter((listing) => {
    if (seen.has(listing.id)) return false;
    seen.add(listing.id);
    return true;
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { brief?: string; config?: unknown };
  const brief = body.brief?.trim();
  const rerankConfig = normalizeRerankConfig(body.config);
  if (!brief) {
    return NextResponse.json({ error: "A brief is required." }, { status: 400 });
  }

  const segment = await getActiveBrokerSegment();
  const includeDemo = await isDemoModeEnabled();

  // Same inventory the Matching workspace scores against: stored listings, plus
  // the demo catalogue when demo mode is on.
  const stored = await getStoredListingsForSegment(segment);
  const inventory = mergeListings(stored, includeDemo ? getListingsForSegment(segment) : []);

  const shortlist = generateClientBriefShortlist(brief, segment, inventory);
  const candidates = shortlist.matches.slice(0, CANDIDATE_LIMIT);
  const byId = new Map(inventory.map((listing) => [listing.id, listing]));

  if (!candidates.length) {
    return NextResponse.json({ ranked: [] as RankedMatch[], mode: "deterministic" as const });
  }

  // Rule-based fallback (no key / failure) reuses the deterministic ranking.
  const deterministic: RankedMatch[] = candidates.map((match) => ({
    listingId: match.listing.id,
    fitScore: match.fitScore,
    reason: match.rationale,
  }));

  if (!hasOpenAI()) {
    return NextResponse.json({ ranked: deterministic, mode: "deterministic" as const });
  }

  const candidateBlock = candidates
    .map((match) => {
      const listing = byId.get(match.listing.id);
      if (!listing) return null;
      return [
        `- id: ${listing.id}`,
        `${listing.name}`,
        `${listing.builder} ${listing.model} ${listing.year}`,
        `${listing.lengthFt}ft`,
        `${listing.cabins} cabins`,
        `EUR ${listing.priceEur.toLocaleString("en-GB")}`,
        `${listing.vatStatus}`,
        `${listing.location}`,
        `highlights: ${listing.highlights.slice(0, 4).join(", ") || "—"}`,
        listing.description ? `description: ${truncate(listing.description, 600)}` : "",
        listing.specifications ? `specs: ${truncate(listing.specifications, 600)}` : "",
      ]
        .filter(Boolean)
        .join(" | ");
    })
    .filter(Boolean)
    .join("\n");

  try {
    const raw = await chatComplete(
      [
        {
          role: "system",
          content:
            "You are a yacht brokerage matching assistant. Rank the candidate listings against the buyer's free-text brief by true fit, " +
            "weighing budget, size, brand, model, year, and location alongside softer language about taste, must-haves, and deal-breakers. " +
            "Read each listing's description and specs and reason semantically about whether they satisfy the brief, not just keyword overlap. " +
            "Return STRICT JSON: " +
            '{"ranked":[{"listingId":"<id>","fitScore":<0-100 integer>,"reason":"<one concise sentence>"}]}, ordered best fit first. ' +
            "Only use listingId values from the candidate list. Do not invent listings.",
        },
        {
          role: "system",
          content: `Broker-configured ranking logic — follow it:\n${buildRerankGuidance(rerankConfig)}`,
        },
        {
          role: "user",
          content: `Buyer brief:\n${brief}\n\nCandidate listings:\n${candidateBlock}`,
        },
      ],
      { json: true, temperature: 0.2, maxTokens: 900 },
    );

    if (!raw) {
      return NextResponse.json({ ranked: deterministic, mode: "deterministic" as const });
    }

    const parsed = JSON.parse(raw) as {
      ranked?: Array<{ listingId?: string; fitScore?: number; reason?: string }>;
    };
    const ranked: RankedMatch[] = (parsed.ranked ?? [])
      .filter((entry) => entry.listingId && byId.has(entry.listingId))
      .map((entry) => ({
        listingId: entry.listingId!,
        fitScore: Math.max(0, Math.min(100, Math.round(Number(entry.fitScore) || 0))),
        reason: (entry.reason ?? "").slice(0, 280),
      }));

    if (!ranked.length) {
      return NextResponse.json({ ranked: deterministic, mode: "deterministic" as const });
    }
    return NextResponse.json({ ranked, mode: "ai" as const });
  } catch (error) {
    console.error("brief-match AI ranking failed", error);
    return NextResponse.json({ ranked: deterministic, mode: "deterministic" as const });
  }
}
