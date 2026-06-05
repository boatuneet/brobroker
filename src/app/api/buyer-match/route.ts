import { NextResponse } from "next/server";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { getListingsForSegment } from "@/lib/broker-segments";
import { isDemoModeEnabled } from "@/lib/demo-mode-server";
import { chatComplete, hasOpenAI } from "@/lib/openai-server";
import { buildRerankGuidance, normalizeRerankConfig } from "@/lib/rerank-config";
import { generateMatchesForBuyer, getBuyerMemoryProfile } from "@/lib/services";
import { getStoredBuyerById } from "@/lib/supabase/buyers";
import { getStoredListingsForSegment } from "@/lib/supabase/listings";
import type { BuyerProfile, YachtListing } from "@/lib/types";

export const dynamic = "force-dynamic";

const CANDIDATE_LIMIT = 15;

interface RankedMatch {
  listingId: string;
  fitScore: number;
  reason: string;
}

/* Merge an optional client-supplied requirement set onto the buyer's ask
   fields (validated loosely). Person-level fields are untouched. */
function applyRequirementSet(buyer: BuyerProfile, raw: unknown): BuyerProfile {
  if (!raw || typeof raw !== "object") return buyer;
  const set = raw as Record<string, unknown>;
  const num = (value: unknown, fallback: number) =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  const list = (value: unknown, fallback: string[]) =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : fallback;
  const sizeRangeFt: [number, number] =
    Array.isArray(set.sizeRangeFt) && set.sizeRangeFt.length === 2
      ? [num(set.sizeRangeFt[0], buyer.sizeRangeFt[0]), num(set.sizeRangeFt[1], buyer.sizeRangeFt[1])]
      : buyer.sizeRangeFt;
  return {
    ...buyer,
    budgetMinEur: num(set.budgetMinEur, buyer.budgetMinEur),
    budgetMaxEur: num(set.budgetMaxEur, buyer.budgetMaxEur),
    sizeRangeFt,
    preferredBrands: list(set.preferredBrands, buyer.preferredBrands),
    preferredLocations: list(set.preferredLocations, buyer.preferredLocations),
    mustHaves: list(set.mustHaves, buyer.mustHaves),
    dealBreakers: list(set.dealBreakers, buyer.dealBreakers),
    urgency: (set.urgency as BuyerProfile["urgency"]) ?? buyer.urgency,
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    buyerId?: string;
    config?: unknown;
    requirementSet?: unknown;
  };
  const buyerId = body.buyerId?.trim();
  const rerankConfig = normalizeRerankConfig(body.config);
  if (!buyerId) {
    return NextResponse.json({ error: "A buyerId is required." }, { status: 400 });
  }

  const segment = await getActiveBrokerSegment();
  const includeDemo = await isDemoModeEnabled();

  // Resolve buyer + the inventory it should match against (real buyer → real
  // listings; demo buyer → demo catalogue) — mirrors the buyer detail page.
  const demoProfile = includeDemo ? getBuyerMemoryProfile(buyerId, segment) : undefined;
  const storedBuyer = demoProfile ? undefined : await getStoredBuyerById(buyerId);
  const buyer: BuyerProfile | undefined = demoProfile?.buyer ?? storedBuyer;
  if (!buyer) {
    return NextResponse.json({ error: "Buyer not found." }, { status: 404 });
  }

  const inventory: YachtListing[] = storedBuyer
    ? await getStoredListingsForSegment(segment)
    : includeDemo
      ? getListingsForSegment(segment)
      : await getStoredListingsForSegment(segment);

  // Optional requirement-set override: matches the selected set's ask while
  // keeping the buyer's person-level memory (taste, relationship notes).
  const effectiveBuyer = applyRequirementSet(buyer, body.requirementSet);

  const candidates = generateMatchesForBuyer(effectiveBuyer, inventory, CANDIDATE_LIMIT);
  const byId = new Map(inventory.map((listing) => [listing.id, listing]));

  if (!candidates.length) {
    return NextResponse.json({ ranked: [] as RankedMatch[], mode: "deterministic" as const });
  }

  // Rule-based fallback (no key / failure) reuses the deterministic ranking.
  const deterministic: RankedMatch[] = candidates.map((match) => ({
    listingId: match.listingId,
    fitScore: match.fitScore,
    reason: match.rationale,
  }));

  if (!hasOpenAI()) {
    return NextResponse.json({ ranked: deterministic, mode: "deterministic" as const });
  }

  const buyerBlock = [
    `Budget: EUR ${effectiveBuyer.budgetMinEur.toLocaleString("en-GB")} – ${effectiveBuyer.budgetMaxEur.toLocaleString("en-GB")}`,
    `Size range: ${effectiveBuyer.sizeRangeFt[0]}-${effectiveBuyer.sizeRangeFt[1]} ft`,
    `Preferred brands: ${effectiveBuyer.preferredBrands.join(", ") || "—"}`,
    `Preferred locations: ${effectiveBuyer.preferredLocations.join(", ") || "—"}`,
    `Must-haves: ${effectiveBuyer.mustHaves.join("; ") || "—"}`,
    `Deal-breakers: ${effectiveBuyer.dealBreakers.join("; ") || "—"}`,
    `Lifestyle / taste: ${effectiveBuyer.lifestylePreferences.join("; ") || "—"}`,
    `Relationship notes: ${effectiveBuyer.relationshipNotes.join("; ") || "—"}`,
    `Urgency: ${effectiveBuyer.urgency} · Timeline: ${effectiveBuyer.decisionTimeline}`,
  ].join("\n");

  const candidateBlock = candidates
    .map((match) => {
      const listing = byId.get(match.listingId);
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
      ].join(" | ");
    })
    .filter(Boolean)
    .join("\n");

  try {
    const raw = await chatComplete(
      [
        {
          role: "system",
          content:
            "You are a yacht brokerage matching assistant. Rank the candidate listings for the buyer by true fit, " +
            "weighing budget, size, brand, and location alongside softer signals — must-haves, deal-breakers, lifestyle/taste, " +
            "and relationship notes. Return STRICT JSON: " +
            '{"ranked":[{"listingId":"<id>","fitScore":<0-100 integer>,"reason":"<one concise sentence>"}]}, ordered best fit first. ' +
            "Only use listingId values from the candidate list. Do not invent listings.",
        },
        {
          role: "system",
          content: `Broker-configured ranking logic — follow it:\n${buildRerankGuidance(rerankConfig)}`,
        },
        {
          role: "user",
          content: `Buyer profile:\n${buyerBlock}\n\nCandidate listings:\n${candidateBlock}`,
        },
      ],
      { json: true, temperature: 0.2, maxTokens: 900 },
    );

    if (!raw) {
      return NextResponse.json({ ranked: deterministic, mode: "deterministic" as const });
    }

    const parsed = JSON.parse(raw) as { ranked?: Array<{ listingId?: string; fitScore?: number; reason?: string }> };
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
    console.error("buyer-match AI ranking failed", error);
    return NextResponse.json({ ranked: deterministic, mode: "deterministic" as const });
  }
}
