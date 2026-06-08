import { NextResponse } from "next/server";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { getBuyersForSegment, getListingsForSegment } from "@/lib/broker-segments";
import { isDemoModeEnabled } from "@/lib/demo-mode-server";
import { chatComplete, hasOpenAI } from "@/lib/openai-server";
import { buildRerankGuidance, normalizeRerankConfig } from "@/lib/rerank-config";
import { generateMatchesForBuyer } from "@/lib/services";
import { getStoredBuyersForSegment } from "@/lib/supabase/buyers";
import { getStoredListingsForSegment } from "@/lib/supabase/listings";
import type { BuyerProfile, YachtListing } from "@/lib/types";

export const dynamic = "force-dynamic";

const CANDIDATE_LIMIT = 12;

function truncate(value: string, max: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

interface RankedBuyer {
  buyerId: string;
  fitScore: number;
  reason: string;
}

function mergeById<T extends { id: string }>(primary: T[], fallback: T[]) {
  const seen = new Set<string>();
  return [...primary, ...fallback].filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { listingId?: string; config?: unknown };
  const listingId = body.listingId?.trim();
  const rerankConfig = normalizeRerankConfig(body.config);
  if (!listingId) {
    return NextResponse.json({ error: "A listingId is required." }, { status: 400 });
  }

  const segment = await getActiveBrokerSegment();
  const includeDemo = await isDemoModeEnabled();

  const listings: YachtListing[] = mergeById(
    await getStoredListingsForSegment(segment),
    includeDemo ? getListingsForSegment(segment) : [],
  );
  const buyers: BuyerProfile[] = mergeById(
    await getStoredBuyersForSegment(segment),
    includeDemo ? getBuyersForSegment(segment) : [],
  );

  const listing = listings.find((entry) => entry.id === listingId);
  if (!listing) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  // Pre-rank deterministically, then hand the top candidates to the LLM.
  const candidates = buyers
    .map((buyer) => ({ buyer, score: generateMatchesForBuyer(buyer, [listing])[0]?.fitScore ?? 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, CANDIDATE_LIMIT);
  const byId = new Map(buyers.map((buyer) => [buyer.id, buyer]));

  if (!candidates.length) {
    return NextResponse.json({ ranked: [] as RankedBuyer[], mode: "deterministic" as const });
  }

  const deterministic: RankedBuyer[] = candidates.map((entry) => ({
    buyerId: entry.buyer.id,
    fitScore: entry.score,
    reason: `Deterministic fit ${entry.score}% against ${listing.name}.`,
  }));

  if (!hasOpenAI()) {
    return NextResponse.json({ ranked: deterministic, mode: "deterministic" as const });
  }

  const listingBlock = [
    `${listing.name}`,
    `${listing.builder} ${listing.model} ${listing.year}`,
    `${listing.lengthFt > 0 ? `${listing.lengthFt}ft` : "length unknown"}`,
    `${listing.cabins} cabins`,
    `EUR ${listing.priceEur.toLocaleString("en-GB")}`,
    `${listing.vatStatus}`,
    `${listing.location}`,
    `highlights: ${listing.highlights.slice(0, 5).join(", ") || "—"}`,
    listing.description ? `description: ${truncate(listing.description, 900)}` : "",
    listing.specifications ? `specs: ${truncate(listing.specifications, 900)}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  const candidateBlock = candidates
    .map(({ buyer }) =>
      [
        `- id: ${buyer.id}`,
        `${buyer.name}`,
        `budget EUR ${buyer.budgetMinEur.toLocaleString("en-GB")}–${buyer.budgetMaxEur.toLocaleString("en-GB")}`,
        `size ${buyer.sizeRangeFt[0]}-${buyer.sizeRangeFt[1]}ft`,
        `brands: ${buyer.preferredBrands.join(", ") || "—"}`,
        `locations: ${buyer.preferredLocations.join(", ") || "—"}`,
        `must-haves: ${buyer.mustHaves.join("; ") || "—"}`,
        `deal-breakers: ${buyer.dealBreakers.join("; ") || "—"}`,
        `urgency: ${buyer.urgency}`,
      ].join(" | "),
    )
    .join("\n");

  try {
    const raw = await chatComplete(
      [
        {
          role: "system",
          content:
            "You are a yacht brokerage matching assistant. Given one listing, rank which saved buyers it best fits, " +
            "weighing budget, size, brand, and location alongside softer signals — must-haves, deal-breakers, and urgency. " +
            "Read the listing's description and specs and reason semantically about which buyers' needs and taste they satisfy. " +
            "Return STRICT JSON: " +
            '{"ranked":[{"buyerId":"<id>","fitScore":<0-100 integer>,"reason":"<one concise sentence>"}]}, best fit first. ' +
            "Only use buyerId values from the candidate list. Do not invent buyers. Omit buyers that clearly do not fit.",
        },
        {
          role: "system",
          content: `Broker-configured ranking logic — follow it:\n${buildRerankGuidance(rerankConfig)}`,
        },
        {
          role: "user",
          content: `Listing:\n${listingBlock}\n\nCandidate buyers:\n${candidateBlock}`,
        },
      ],
      { json: true, temperature: 0.2, maxTokens: 900 },
    );

    if (!raw) {
      return NextResponse.json({ ranked: deterministic, mode: "deterministic" as const });
    }

    const parsed = JSON.parse(raw) as {
      ranked?: Array<{ buyerId?: string; fitScore?: number; reason?: string }>;
    };
    const ranked: RankedBuyer[] = (parsed.ranked ?? [])
      .filter((entry) => entry.buyerId && byId.has(entry.buyerId))
      .map((entry) => ({
        buyerId: entry.buyerId!,
        fitScore: Math.max(0, Math.min(100, Math.round(Number(entry.fitScore) || 0))),
        reason: (entry.reason ?? "").slice(0, 280),
      }));

    if (!ranked.length) {
      return NextResponse.json({ ranked: deterministic, mode: "deterministic" as const });
    }
    return NextResponse.json({ ranked, mode: "ai" as const });
  } catch (error) {
    console.error("listing-match AI ranking failed", error);
    return NextResponse.json({ ranked: deterministic, mode: "deterministic" as const });
  }
}
