import {
  buyers,
  yachtListings,
} from "./demo-data";
import {
  type BrokerSegment,
  filterDealRoomForSegment,
  getAuditEventsForSegment,
  getBuyersForSegment,
  getConversationsForSegment,
  getDealRoomsForSegment,
  getFollowUpDraftsForSegment,
  getListingAssetType as getSegmentListingAssetType,
  getListingsForSegment,
  getMatchResultsForSegment,
  getSellerReportInputsForSegment,
  getSellersForSegment,
  getTasksForSegment,
  getVerificationCasesForSegment,
} from "./broker-segments";
import type {
  AuditEvent,
  BrokerTask,
  BuyerProfile,
  DealRoom,
  ExtractedCallSummary,
  FollowUpDraft,
  MatchResult,
  ParsedClientBrief,
  Priority,
  SellerReportInput,
  VerificationCase,
  VerificationStatus,
  YachtListing,
} from "./types";
import { daysUntil } from "./utils";

export const nowIso = "2026-05-24T09:00:00+03:00";

export function getListingById(id: string, segment?: BrokerSegment) {
  return getListingsForSegment(segment).find((listing) => listing.id === id);
}

export function getBuyerById(id: string, segment?: BrokerSegment) {
  return getBuyersForSegment(segment).find((buyer) => buyer.id === id);
}

export function getSellerById(id: string, segment?: BrokerSegment) {
  return getSellersForSegment(segment).find((seller) => seller.id === id);
}

export function getListingAssetType(listing: YachtListing) {
  return getSegmentListingAssetType(listing);
}

export function getListingSpecSummary(listing: YachtListing) {
  return (
    listing.specSummary ??
    `${listing.year} · ${listing.lengthFt}ft · ${listing.cabins} cabins · ${listing.location}`
  );
}

export function getListingCoreFacts(listing: YachtListing): Array<[string, string]> {
  if (listing.coreFacts?.length) {
    return listing.coreFacts.map((fact) => [fact.label, fact.value]);
  }

  const type = getListingAssetType(listing);

  if (type === "Car") {
    return [
      ["Make", listing.builder],
      ["Model", listing.model],
      ["Powertrain", listing.engines],
      ["Registration", `${listing.year}`],
      ["Interior", listing.interiorStyle],
      ["Exterior", listing.exteriorTone],
    ];
  }

  if (type === "Real Estate") {
    return [
      ["Location", listing.location],
      ["Property type", listing.model],
      ["Area", `${listing.lengthFt} sqm`],
      ["Bedrooms", `${listing.cabins}`],
      ["Interior", listing.interiorStyle],
      ["Outdoor", listing.exteriorTone],
    ];
  }

  return [
    ["Builder", listing.builder],
    ["Model", listing.model],
    ["Engines", listing.engines],
    ["Engine hours", `${listing.engineHours}`],
    ["Interior", listing.interiorStyle],
    ["Exterior", listing.exteriorTone],
  ];
}

export function getListingAssetLabel(listing: YachtListing) {
  const type = getListingAssetType(listing).toLowerCase();
  return type === "real estate" ? "property" : type;
}

export function getVerificationForBuyer(buyerId: string, segment?: BrokerSegment) {
  return getVerificationCasesForSegment(segment).find(
    (verification) => verification.buyerId === buyerId,
  );
}

export function getDocumentCompleteness(listing: YachtListing) {
  const approved = listing.documents.filter((document) => document.status === "Approved").length;
  const total = listing.documents.length + listing.missingInfo.length;
  const percent = total === 0 ? 100 : Math.round((approved / total) * 100);

  return {
    approved,
    total,
    percent,
    missingCount: listing.missingInfo.length,
  };
}

export function getListingFitSignals(listing: YachtListing, segment?: BrokerSegment) {
  const generatedMatches = getBuyersForSegment(segment ?? getListingAssetType(listing))
    .map((buyer) => generateMatchesForBuyer(buyer, [listing])[0])
    .filter(Boolean)
    .sort((a, b) => b.fitScore - a.fitScore);

  const topMatches = generatedMatches.slice(0, 3).map((match) => ({
    match,
    buyer: getBuyerById(match.buyerId, segment),
  }));

  return {
    topMatches,
    hiddenOpportunities: generatedMatches.filter((match) => match.fitScore >= 76).length,
    highestScore: generatedMatches[0]?.fitScore ?? 0,
  };
}

export function searchListings(query?: string, segment?: BrokerSegment) {
  const normalized = query?.trim().toLowerCase();
  const listings = getListingsForSegment(segment);

  if (!normalized) {
    return listings;
  }

  return listings.filter((listing) =>
    [
      listing.name,
      listing.builder,
      listing.model,
      listing.location,
      listing.vatStatus,
      listing.status,
      listing.interiorStyle,
      listing.highlights.join(" "),
      listing.missingInfo.join(" "),
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalized),
  );
}

export function getListingBrain(listingId: string, segment?: BrokerSegment) {
  const listing = getListingById(listingId, segment);

  if (!listing) {
    return undefined;
  }

  return buildListingBrain(listing, segment);
}

export function buildListingBrain(listing: YachtListing, segment?: BrokerSegment) {
  const seller = getSellerById(listing.ownerId, segment) ?? listing.ownerProfile;
  const fitSignals = getListingFitSignals(listing, segment);
  const relatedMatches = getMatchResultsForSegment(segment).filter(
    (match) => match.listingId === listing.id,
  );
  const buyerObjections = getBuyerObjectionsForListing(listing.id, segment);
  const documentCompleteness = getDocumentCompleteness(listing);
  const comparisonInventory = getListingsForSegment(segment ?? getListingAssetType(listing));

  return {
    listing,
    seller,
    fitSignals,
    relatedMatches,
    buyerObjections,
    documentCompleteness,
    pitch: generateListingPitch(listing),
    comparison: compareListings(
      listing,
      comparisonInventory.find((candidate) => candidate.id !== listing.id),
    ),
  };
}

export function getVerificationTone(status: VerificationStatus) {
  if (status === "Verified") {
    return {
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
      dotClassName: "bg-emerald-500",
    };
  }

  if (status === "Needs Review") {
    return {
      className: "border-amber-200 bg-amber-50 text-amber-900",
      dotClassName: "bg-amber-500",
    };
  }

  return {
    className: "border-rose-200 bg-rose-50 text-rose-800",
    dotClassName: "bg-rose-500",
  };
}

export function getVerificationSignalSet(caseFile: VerificationCase) {
  const buyer = getBuyerById(caseFile.buyerId);
  const listing = getListingById(caseFile.listingId);
  const existingLabels = new Set(caseFile.signals.map((signal) => signal.label));
  const derivedSignals = [
    !existingLabels.has("Identity")
      ? {
          label: "Identity",
          state: caseFile.status === "High Risk" ? "Review" : "Pass",
          detail: caseFile.status === "High Risk" ? "Identity file needs refresh before access." : "Identity details are present in the buyer memory.",
        }
      : undefined,
    !existingLabels.has("Company") && buyer?.company
      ? {
          label: "Company",
          state: "Pass",
          detail: `${buyer.company} is recorded against the buyer profile.`,
        }
      : !existingLabels.has("Company")
        ? {
            label: "Company",
            state: "Review",
            detail: "Buying entity or company context is not yet recorded.",
          }
        : undefined,
    !existingLabels.has("Contact consistency")
      ? {
          label: "Contact consistency",
          state: caseFile.status === "High Risk" ? "Review" : "Pass",
          detail: caseFile.status === "High Risk" ? "Confirm current phone and email before sensitive sharing." : "Contact route aligns with the current buyer memory.",
        }
      : undefined,
    !existingLabels.has("Proof-of-funds readiness")
      ? {
          label: "Proof-of-funds readiness",
          state: caseFile.status === "Verified" ? "Pass" : caseFile.status === "Needs Review" ? "Review" : "Fail",
          detail:
            caseFile.status === "Verified"
              ? "Readiness signal is sufficient for broker-approved access."
              : caseFile.status === "Needs Review"
                ? "Request readiness evidence before restricted material."
                : "No readiness signal after previous requests.",
        }
      : undefined,
    !existingLabels.has("AML-style signals")
      ? {
          label: "AML-style signals",
          state: caseFile.status === "High Risk" ? "Fail" : "Pass",
          detail:
            caseFile.status === "High Risk"
              ? "Prototype risk flags require broker escalation before access."
              : "No prototype sanctions, PEP, watchlist, or adverse-media flag is represented in demo data.",
        }
      : undefined,
    !existingLabels.has("Inquiry quality")
      ? {
          label: "Inquiry quality",
          state: buyer?.urgency === "Exploratory" ? "Review" : "Pass",
          detail: `${buyer?.name ?? "Buyer"} requested ${caseFile.requestedAccess.toLowerCase()} for ${listing?.name ?? "the listing"}.`,
        }
      : undefined,
  ].filter(Boolean) as VerificationCase["signals"];

  return [...caseFile.signals, ...derivedSignals];
}

export function scoreVerification(caseFile: VerificationCase) {
  const signals = getVerificationSignalSet(caseFile);
  const signalScore = signals.reduce((total, signal) => {
    if (signal.state === "Pass") return total + 30;
    if (signal.state === "Review") return total + 12;
    return total - 18;
  }, -80);

  const score = Math.max(0, Math.min(100, signalScore));
  const status: VerificationStatus =
    score >= 80 ? "Verified" : score >= 50 ? "Needs Review" : "High Risk";

  return {
    score,
    status,
    recommendedAction:
      status === "Verified"
        ? "Proceed with broker-approved access."
        : status === "Needs Review"
          ? "Request missing qualification details before sharing sensitive material."
          : "Hold access and escalate with an audit trail.",
  };
}

export function getAccessGateWarnings(caseFile: VerificationCase) {
  const scored = scoreVerification(caseFile);
  const listing = getListingById(caseFile.listingId);
  const restrictedDocuments = listing?.documents.filter((document) => document.status === "Restricted" || document.status === "Internal") ?? [];
  const holdAccess = scored.status === "High Risk";
  const needsReview = scored.status === "Needs Review";

  return [
    {
      label: "Sensitive documents",
      status: holdAccess ? "Blocked" : needsReview || restrictedDocuments.length ? "Broker review" : "Ready",
      detail: holdAccess
        ? "Hold restricted documents and escalate before sharing."
        : needsReview
          ? "Request missing qualification details before sharing restricted material."
          : restrictedDocuments.length
            ? `${restrictedDocuments.length} restricted/internal documents still need broker approval.`
            : "Approved documents can be shared after broker confirmation.",
    },
    {
      label: "Private viewing",
      status: holdAccess ? "Blocked" : needsReview ? "Broker review" : "Ready",
      detail: holdAccess
        ? "Do not schedule seller-controlled viewing until risk is cleared."
        : needsReview
          ? "Confirm proof-of-funds readiness or buying entity before final viewing approval."
          : "Private viewing can proceed with normal broker confirmation.",
    },
    {
      label: "Seller introduction",
      status: scored.status === "Verified" ? "Ready" : "Blocked",
      detail:
        scored.status === "Verified"
          ? "Seller introduction can be broker-approved with audit context."
          : "Keep seller identity and motivation broker-controlled until verification improves.",
    },
    {
      label: "Deal-room activation",
      status: scored.status === "Verified" ? "Ready" : "Broker review",
      detail:
        scored.status === "Verified"
          ? "Buyer-safe room can be activated after broker approval."
          : "Limit deal-room access to approved facts and avoid sensitive documents.",
    },
  ];
}

export function getVerificationAuditTrail(caseFile: VerificationCase, segment?: BrokerSegment) {
  const scored = scoreVerification(caseFile);
  const signalChanges = getVerificationSignalSet(caseFile)
    .filter((signal) => signal.state !== "Pass")
    .map((signal) => `${signal.label}: ${signal.detail}`);

  return [
    {
      id: `audit-${caseFile.id}-created`,
      actor: "System",
      label: "Verification case created",
      detail: `${caseFile.requestedAccess} requested. Case linked to buyer and listing before sensitive access.`,
      occurredAt: caseFile.updatedAt,
    },
    {
      id: `audit-${caseFile.id}-scored`,
      actor: "System",
      label: "Verification status scored",
      detail: `Prototype signals classify this case as ${scored.status} with score ${scored.score}.`,
      occurredAt: nowIso,
    },
    ...(caseFile.status !== scored.status
      ? [
          {
            id: `audit-${caseFile.id}-status-change`,
            actor: "System" as const,
            label: "Status changed",
            detail: `${caseFile.status} -> ${scored.status}. Changed signals: ${signalChanges.join("; ") || "all required signals passed"}.`,
            occurredAt: nowIso,
          },
        ]
      : []),
    ...getAuditEventsForSegment(segment).filter((event) => event.detail.includes(caseFile.id) || event.detail.includes(getBuyerById(caseFile.buyerId, segment)?.name ?? "")),
  ];
}

export function getVerificationInbox(
  segment?: BrokerSegment,
  options: { includeDemo?: boolean } = {},
) {
  if (options.includeDemo === false) return [];
  return getVerificationCasesForSegment(segment)
    .map((caseFile) => {
      const scored = scoreVerification(caseFile);
      const buyer = getBuyerById(caseFile.buyerId, segment);
      const listing = getListingById(caseFile.listingId, segment);

      return {
        caseFile: {
          ...caseFile,
          score: scored.score,
          status: scored.status,
          signals: getVerificationSignalSet(caseFile),
          recommendedAction: scored.recommendedAction,
        },
        buyer,
        listing,
        accessGates: getAccessGateWarnings(caseFile),
        auditTrail: getVerificationAuditTrail(caseFile, segment),
      };
    })
    .sort((a, b) => {
      const priority: Record<VerificationStatus, number> = {
        "High Risk": 0,
        "Needs Review": 1,
        Verified: 2,
      };

      return priority[a.caseFile.status] - priority[b.caseFile.status] || b.caseFile.score - a.caseFile.score;
    });
}

const KNOWN_BUILDERS = [
  "Princess",
  "Azimut",
  "Ferretti",
  "Pardo",
  "Riva",
  "Sunseeker",
  "Sanlorenzo",
  "Benetti",
  "Beneteau",
  "Lagoon",
  "Fairline",
  "Prestige",
  "Galeon",
  "Custom Line",
  "Ferrari",
  "Porsche",
  "Range Rover",
  "Monaco",
  "Provence",
  "Dubai",
];

const KNOWN_LOCATIONS = [
  "Mallorca",
  "Palma",
  "Ibiza",
  "France",
  "Cannes",
  "Monaco",
  "Antibes",
  "Sardinia",
  "Italy",
  "Naples",
  "Croatia",
  "Greece",
  "Athens",
  "Turkey",
  "Spain",
  "Barcelona",
  "Munich",
  "Germany",
  "Stuttgart",
  "London",
  "United Kingdom",
  "Gordes",
  "Dubai",
  "Palm Jumeirah",
];

/* Parses budget caps from a wide range of natural phrasings:
   - "under EUR 1.4M", "max 1.4m", "around 2 million", "up to 3M"
   - bare "1.4M", "1.4 million", "EUR 1.4M"
   - explicit "EUR 1,400,000" or "1,400,000 EUR" */
function parseBudget(raw: string, normalized: string): number | undefined {
  const millions = normalized.match(
    /(?:under|below|max|up to|around|approx(?:imately)?|near|budget(?: of)?|target)?\s*(?:€|eur|euros?)?\s*(\d+(?:[.,]\d+)?)\s*(?:m|mln|million)\b/,
  );
  if (millions) {
    return Math.round(Number.parseFloat(millions[1].replace(",", ".")) * 1_000_000);
  }

  const thousands = normalized.match(
    /(?:under|below|max|up to|around|approx(?:imately)?|near|budget(?: of)?|target)\s*(?:€|eur|euros?)?\s*(\d+(?:[.,]\d+)?)\s*(?:k|thousand)\b/,
  );
  if (thousands) {
    return Math.round(Number.parseFloat(thousands[1].replace(",", ".")) * 1_000);
  }

  const explicit = raw.match(/(?:€|EUR|eur)\s*([\d,]{4,})|([\d,]{6,})\s*(?:€|EUR|eur)/i);
  if (explicit) {
    const value = Number((explicit[1] ?? explicit[2]).replace(/,/g, ""));
    if (!Number.isNaN(value) && value >= 50_000) return value;
  }

  return undefined;
}

/* Parses model year cutoff:
   - "2018+", "2018 or newer", "after 2018", "since 2018", "from 2018"
   - "2018 onwards" */
function parseMinYear(normalized: string): number | undefined {
  const patterns: RegExp[] = [
    /(20\d{2})\+/,
    /(?:since|from|after|post)\s+(20\d{2})/,
    /(20\d{2})\s*(?:or newer|or later|onwards|and newer)/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern)?.[1];
    if (match) return Number.parseInt(match, 10);
  }
  return undefined;
}

/* Parses a size range. Supports:
   - "60 to 75 foot", "60-75ft", "60–75 feet"
   - "60ft" (single → ±5 ft window)
   - metres ("18 to 22 m") get converted to feet (×3.28) */
function parseSizeRangeFt(normalized: string): [number, number] | undefined {
  const range = normalized.match(
    /(\d{2,3})\s*(?:to|-|–|—|and)\s*(\d{2,3})\s*(ft|foot|feet|m|meter|metres)/,
  );
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    const isMetric = range[3].startsWith("m");
    return isMetric
      ? [Math.round(min * 3.28), Math.round(max * 3.28)]
      : [min, max];
  }

  const single = normalized.match(/(\d{2,3})\s*(ft|foot|feet|m|meter|metres)\b/);
  if (single) {
    const value = Number(single[1]);
    const isMetric = single[2].startsWith("m");
    const feet = isMetric ? Math.round(value * 3.28) : value;
    return [Math.max(20, feet - 5), feet + 5];
  }
  return undefined;
}

/* Finds the first "Brand Model" pair mentioned. Falls back to bare brand
   when no model number follows. */
function parseModel(raw: string): string | undefined {
  // When several brands are listed ("Princess or Sunseeker or Azimut") there is
  // no single requested model — leave it flexible so no one brand is favoured
  // (the AI re-rank handles multi-brand preference semantically).
  const mentioned = KNOWN_BUILDERS.filter((builder) =>
    new RegExp(`\\b${builder}\\b`, "i").test(raw),
  );
  if (mentioned.length > 1) return undefined;

  const builder = mentioned[0];
  if (!builder) return undefined;

  const match = raw.match(new RegExp(`\\b${builder}\\b(?:\\s+([A-Za-z0-9]+))?`, "i"));
  const token = match?.[1];
  // Ignore conjunctions / filler words so we never produce "Princess or".
  if (token && !/^(or|and|the|a|an)$/i.test(token)) {
    return `${builder} ${token}`;
  }
  return builder;
}

export function parseClientBrief(raw: string): ParsedClientBrief {
  const normalized = raw.toLowerCase();
  const cabinMatch = normalized.match(/([2-7])\s*cabin/);
  const sizeRangeFt = parseSizeRangeFt(normalized);

  const preferredLocations = KNOWN_LOCATIONS.filter((location) =>
    normalized.includes(location.toLowerCase()),
  );

  const mustHaves = [
    /\bvat[\s-]?paid\b|\beu[\s-]?vat\b/.test(normalized) ? "EU VAT paid" : undefined,
    normalized.includes("light interior") || /\blight\b/.test(normalized)
      ? "Light interior"
      : undefined,
    normalized.includes("low hour") ? "Low hours" : undefined,
    normalized.includes("immediate") || normalized.includes("ready before")
      ? "Immediate or ready access"
      : undefined,
    cabinMatch ? `${cabinMatch[1]} cabins` : undefined,
    normalized.includes("twin engine") ? "Twin engines" : undefined,
    normalized.includes("fly bridge") || normalized.includes("flybridge")
      ? "Flybridge"
      : undefined,
  ].filter(Boolean) as string[];

  const dealBreakers = [
    normalized.includes("no refit") || normalized.includes("avoid refit") || normalized.includes("no major refit")
      ? "Heavy refit required"
      : undefined,
    normalized.includes("no dark") || normalized.includes("avoid dark") || normalized.includes("dated interior")
      ? "Dark dated interior"
      : undefined,
    /\bvat[\s-]?paid\b|\beu[\s-]?vat\b/.test(normalized)
      ? "VAT not paid or unknown"
      : undefined,
    normalized.includes("no high hour") || normalized.includes("avoid high hour")
      ? "High engine hours"
      : undefined,
  ].filter(Boolean) as string[];

  return {
    raw,
    model: parseModel(raw),
    budgetMaxEur: parseBudget(raw, normalized),
    minYear: parseMinYear(normalized),
    cabins: cabinMatch ? Number.parseInt(cabinMatch[1], 10) : undefined,
    interiorStyle: /\blight\b/.test(normalized) ? "Light interior" : undefined,
    vatStatus: /\bvat[\s-]?paid\b|\beu[\s-]?vat\b/.test(normalized) ? "EU VAT Paid" : undefined,
    sizeRangeFt,
    preferredLocations,
    availability: normalized.includes("summer")
      ? "Before summer"
      : normalized.includes("immediate")
        ? "Immediate"
        : undefined,
    mustHaves,
    dealBreakers,
    urgency:
      normalized.includes("summer") ||
      normalized.includes("immediate") ||
      normalized.includes("asap") ||
      normalized.includes("urgent")
        ? "High"
        : normalized.includes("no rush") || normalized.includes("exploring")
          ? "Low"
          : "Medium",
  };
}

/* A blank buyer profile used as the base for a synthetic "ask" — only the
   scored fields (budget, size, brands, locations, must-haves, deal-breakers,
   taste) need to be accurate; the rest are placeholders. */
function emptyAsk(): BuyerProfile {
  return {
    id: "ask",
    name: "Buyer brief",
    country: "",
    budgetMinEur: 0,
    budgetMaxEur: 0,
    sizeRangeFt: [0, 0],
    preferredBrands: [],
    preferredLocations: [],
    lifestylePreferences: [],
    mustHaves: [],
    dealBreakers: [],
    objections: [],
    rejectedAssets: [],
    urgency: "Exploratory",
    decisionTimeline: "",
    communicationStyle: "",
    relationshipNotes: [],
    currentStage: "New Inquiry",
    lastContactedAt: "",
    nextActionDueAt: "",
    verificationCaseId: "",
    tags: [],
  };
}

/* All known builders mentioned in the brief → preferred brands. Captures
   multi-brand briefs ("XO or Azimut or Sunseeker") that parseModel leaves as
   "flexible". */
function extractBrands(raw: string): string[] {
  return KNOWN_BUILDERS.filter((builder) => new RegExp(`\\b${builder}\\b`, "i").test(raw));
}

/* Turn parsed brief criteria into a synthetic ask the weighted matcher scores. */
function buildAskFromBrief(criteria: ParsedClientBrief, raw: string): BuyerProfile {
  const mustHaves = [
    ...(criteria.mustHaves ?? []),
    criteria.cabins ? `${criteria.cabins} cabins` : undefined,
    criteria.vatStatus === "EU VAT Paid" ? "EU VAT paid" : undefined,
  ].filter((item): item is string => Boolean(item));
  return {
    ...emptyAsk(),
    budgetMaxEur: criteria.budgetMaxEur ?? 0,
    sizeRangeFt: criteria.sizeRangeFt ?? [0, 0],
    preferredBrands: extractBrands(raw),
    preferredLocations: criteria.preferredLocations ?? [],
    mustHaves,
    dealBreakers: criteria.dealBreakers ?? [],
    lifestylePreferences: criteria.interiorStyle ? [criteria.interiorStyle] : [],
  };
}

/* Present a saved buyer's structured ask as brief criteria for the Step 2
   "extracted criteria" display. */
function criteriaFromBuyer(buyer: BuyerProfile): ParsedClientBrief {
  return {
    raw: "",
    model: buyer.preferredBrands.length ? buyer.preferredBrands.join(" or ") : undefined,
    budgetMaxEur: buyer.budgetMaxEur > 0 ? buyer.budgetMaxEur : undefined,
    minYear: undefined,
    cabins: parseRequiredCabins(buyer.mustHaves) ?? undefined,
    interiorStyle: buyer.lifestylePreferences[0],
    vatStatus: requiresEuVat(buyer.mustHaves) ? "EU VAT Paid" : undefined,
    sizeRangeFt: buyer.sizeRangeFt[0] > 0 || buyer.sizeRangeFt[1] > 0 ? buyer.sizeRangeFt : undefined,
    preferredLocations: buyer.preferredLocations,
    availability: undefined,
    mustHaves: buyer.mustHaves,
    dealBreakers: buyer.dealBreakers,
    urgency: buyer.urgency,
  };
}

/* Shared shortlist builder — one engine (generateMatchesForBuyer / weighted %
   model) powers both the free-text brief and the saved-buyer paths, so the
   Matching screen scores identically to the Buyers → Matches tab. */
function buildShortlist(ask: BuyerProfile, criteria: ParsedClientBrief, inventory: YachtListing[]) {
  const byId = new Map(inventory.map((listing) => [listing.id, listing]));
  const matches = generateMatchesForBuyer(ask, inventory, 6)
    .map((result) => {
      const listing = byId.get(result.listingId);
      if (!listing) return null;
      return {
        id: `brief-${listing.id}`,
        listing,
        category: result.category,
        fitScore: result.fitScore,
        criteriaMet: result.criteriaMet.slice(0, 6),
        missingCriteria: result.missingCriteria.slice(0, 5),
        tradeOffs: result.missingCriteria.length
          ? result.missingCriteria.slice(0, 4).map((item) => `Verify ${item.toLowerCase()}`)
          : ["No major trade-off flagged by the matcher"],
        rationale: result.rationale,
        talkingPoints: result.talkingPoints.length
          ? result.talkingPoints
          : [listing.highlights[0] ?? "Strong inventory option"],
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const best = matches[0];
  return {
    criteria,
    matches,
    comparisonRows: matches.slice(0, 4).map((match) => ({
      listing: match.listing,
      category: match.category,
      fitScore: match.fitScore,
      priceEur: match.listing.priceEur,
      sizeFt: match.listing.lengthFt,
      year: match.listing.year,
      cabins: match.listing.cabins,
      vatStatus: match.listing.vatStatus,
      topTradeOff: match.tradeOffs[0],
    })),
    missingCriteria: [...new Set(matches.flatMap((match) => match.missingCriteria))].slice(0, 8),
    tradeOffs: matches.slice(0, 3).flatMap((match) => match.tradeOffs.map((tradeOff) => `${match.listing.name}: ${tradeOff}`)),
    outreachMessage: best
      ? `I found ${best.listing.name} as the strongest current fit, with ${matches[1]?.listing.name ?? "one close alternative"} as the comparison point. The main reason is ${best.criteriaMet.slice(0, 3).join(", ").toLowerCase() || "overlap with the stated criteria"}; before sending, I would verify ${best.missingCriteria.slice(0, 2).join(", ").toLowerCase() || "viewing timing and final buyer priorities"}.`
      : "No shortlist is ready yet. Add budget, size, location, brand, or must-have criteria to generate one.",
  };
}

export function generateClientBriefShortlist(
  raw: string,
  segment?: BrokerSegment,
  inventoryOverride?: YachtListing[],
) {
  const criteria = parseClientBrief(raw);
  const ask = buildAskFromBrief(criteria, raw);
  return buildShortlist(ask, criteria, inventoryOverride ?? getListingsForSegment(segment));
}

/* Saved-buyer shortlist — runs the weighted matcher directly on the buyer's
   structured ask (no lossy text round-trip), so it matches the Buyers tab. */
export function generateBuyerShortlist(
  buyer: BuyerProfile,
  segment?: BrokerSegment,
  inventoryOverride?: YachtListing[],
) {
  return buildShortlist(buyer, criteriaFromBuyer(buyer), inventoryOverride ?? getListingsForSegment(segment));
}

export function discoverHiddenOpportunities(
  listingId: string,
  segment?: BrokerSegment,
  inventoryOverride?: YachtListing[],
  buyersOverride?: BuyerProfile[],
) {
  const inventory = inventoryOverride ?? getListingsForSegment(segment);
  // Resolve from the passed inventory first — getListingById only knows the demo
  // catalogue, so a stored listing would otherwise fall back to inventory[0] and
  // match buyers against the wrong boat.
  const listing =
    inventory.find((entry) => entry.id === listingId) ?? getListingById(listingId, segment) ?? inventory[0];

  if (!listing) {
    return [];
  }

  return (buyersOverride ?? getBuyersForSegment(segment ?? getListingAssetType(listing)))
    .map((buyer) => {
      const match = generateMatchesForBuyer(buyer, [listing])[0];
      const rejected = buyer.rejectedAssets.some((rejection) => rejection.listingId === listing.id);
      const memorySignals = [
        buyer.lifestylePreferences.some((preference) =>
          `${listing.interiorStyle} ${listing.highlights.join(" ")}`.toLowerCase().includes(preference.toLowerCase().split(" ")[0]),
        )
          ? "Memory taste signal"
          : undefined,
        (buyer.budgetMinEur > 0 || buyer.budgetMaxEur > 0) &&
        inRangeOrOpen(listing.priceEur, buyer.budgetMinEur, buyer.budgetMaxEur)
          ? "Budget overlap"
          : undefined,
        (buyer.sizeRangeFt[0] > 0 || buyer.sizeRangeFt[1] > 0) &&
        inRangeOrOpen(listing.lengthFt, buyer.sizeRangeFt[0], buyer.sizeRangeFt[1])
          ? "Size overlap"
          : undefined,
        buyer.mustHaves.includes("EU VAT paid") && listing.vatStatus === "EU VAT Paid" ? "VAT must-have" : undefined,
        buyer.urgency === "Immediate" || buyer.urgency === "This Season" ? "Timing pressure" : undefined,
      ].filter(Boolean) as string[];

      return {
        buyer,
        listing,
        match,
        score: Math.max(0, match.fitScore - (rejected ? 25 : 0)),
        memorySignals,
        blocker: rejected ? "Buyer previously rejected this asset" : match.missingCriteria[0],
        recommendedAction: rejected
          ? "Do not resurface unless the listing changed materially."
          : `Queue a broker-approved ${listing.name} angle for ${buyer.name.split(" ")[0]}.`,
      };
    })
    .filter((opportunity) => opportunity.score >= 58 || opportunity.memorySignals.length >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export function answerListingQuestion(listing: YachtListing, question: string) {
  const normalized = question.toLowerCase();
  const assetType = getListingAssetType(listing);

  if (normalized.includes("low maintenance") || normalized.includes("maintenance")) {
    const maintenanceAngle =
      assetType === "Car"
        ? `${listing.refitHistory.join(", ").toLowerCase()} and documented service history`
        : assetType === "Real Estate"
          ? `${listing.refitHistory.join(", ").toLowerCase()} and known running-cost disclosures`
          : `${listing.refitHistory.join(", ").toLowerCase()} and ${listing.engineHours} engine hours`;

    return {
      answer: `${listing.name} can be positioned around ${maintenanceAngle}. The strongest support comes from approved documents and broker-verified records.`,
      sources: listing.documents
        .filter((document) => ["Survey", "Maintenance", "Specs"].includes(document.category))
        .map((document) => document.title),
      missing: listing.missingInfo.filter((item) => item.toLowerCase().includes("oil") || item.toLowerCase().includes("service")),
    };
  }

  if (normalized.includes("weakness") || normalized.includes("objection")) {
    return {
      answer: `${listing.name}'s likely objections are ${listing.weaknesses.join(", ").toLowerCase()}. Prepare a direct trade-off explanation before sending to qualified buyers.`,
      sources: ["Broker objection notes", "Buyer feedback memory"],
      missing: [],
    };
  }

  if (normalized.includes("documents") || normalized.includes("missing")) {
    return {
      answer: listing.missingInfo.length
        ? `${listing.name} is missing ${listing.missingInfo.join(", ")}. These should be cleared before sensitive sharing or final shortlist approval.`
        : `${listing.name} has no missing information currently flagged in the listing brain.`,
      sources: listing.documents.map((document) => document.title),
      missing: listing.missingInfo,
    };
  }

  return {
    answer: `The listing brain does not have enough approved source material to answer that confidently for ${listing.name}. Ask the broker to confirm it before using this in buyer-facing communication.`,
    sources: [],
    missing: ["Approved source for requested detail"],
  };
}

export function generateListingPitch(listing: YachtListing) {
  const buyerAngle = listing.idealBuyer.replace(/\.$/, "");
  const strongestFacts = listing.highlights.slice(0, 3).join(", ").toLowerCase();
  const caveat = listing.weaknesses[0]?.toLowerCase() ?? "buyer-specific trade-offs";
  const assetLabel = getListingAssetLabel(listing);
  const specSummary = getListingSpecSummary(listing);

  return {
    short: `${listing.name} is best pitched as a ${listing.builder} ${listing.model} ${assetLabel} for a ${buyerAngle.toLowerCase()}, with ${strongestFacts}.`,
    thirtySecond: `${listing.name} gives a qualified buyer ${strongestFacts} in ${listing.location}. The honest caveat is ${caveat}, so the broker should frame it as a clear trade-off rather than hide it.`,
    buyerSafe: `${listing.name} is a strong ${assetLabel} fit (${specSummary}) for buyers prioritizing ${listing.highlights.slice(0, 2).join(" and ").toLowerCase()} with a clear next step around viewing and document review.`,
  };
}

export function compareListings(primary: YachtListing, secondary?: YachtListing) {
  if (!secondary) {
    return {
      title: "No comparison available",
      points: ["Add another listing to generate a competitive comparison."],
    };
  }

  const priceDelta = primary.priceEur - secondary.priceEur;
  const sizeDelta = primary.lengthFt - secondary.lengthFt;
  const bothYachts = getListingAssetType(primary) === "Yacht" && getListingAssetType(secondary) === "Yacht";

  return {
    title: `${primary.name} vs ${secondary.name}`,
    points: [
      bothYachts
        ? `${primary.name} is ${Math.abs(sizeDelta)}ft ${sizeDelta >= 0 ? "larger" : "smaller"} than ${secondary.name}.`
        : `${primary.name} is ${getListingSpecSummary(primary)}, while ${secondary.name} is ${getListingSpecSummary(secondary)}.`,
      `${primary.name} is ${priceDelta >= 0 ? "priced above" : "priced below"} ${secondary.name} by EUR ${Math.abs(priceDelta).toLocaleString("en-GB")}.`,
      `${primary.name} offers ${primary.highlights[0].toLowerCase()}, while ${secondary.name} is strongest on ${secondary.highlights[0].toLowerCase()}.`,
      primary.vatStatus === secondary.vatStatus
        ? `Both carry ${primary.vatStatus} status.`
        : `${primary.name} has ${primary.vatStatus} status; ${secondary.name} has ${secondary.vatStatus} status.`,
    ],
  };
}

export function getBuyerObjectionsForListing(listingId: string, segment?: BrokerSegment) {
  const listing = getListingById(listingId, segment);
  const directObjections =
    listing?.objections.map((objection) => ({
      buyer: objection.buyerId ? getBuyerById(objection.buyerId) : undefined,
      label: objection.label,
      detail: objection.detail,
      raisedAt: objection.raisedAt,
      source: "Listing intelligence",
    })) ?? [];

  const memoryObjections = getBuyersForSegment(segment).flatMap((buyer) =>
    buyer.rejectedAssets
      .filter((rejection) => rejection.listingId === listingId)
      .map((rejection) => ({
        buyer,
        label: "Rejected asset",
        detail: rejection.reason,
        raisedAt: rejection.rejectedAt,
        source: "Buyer memory",
      })),
  );

  return [...directObjections, ...memoryObjections];
}

/* Reads a minimum cabin count out of free-text must-haves like
   "At least 3 cabins", "3+ cabins", "min 4 cabins". Returns null when the
   buyer hasn't expressed a cabin requirement. */
function parseRequiredCabins(mustHaves: string[]): number | null {
  for (const item of mustHaves) {
    const match = item.match(/(\d+)\s*\+?\s*cabins?/i);
    if (match) return Number.parseInt(match[1], 10);
  }
  return null;
}

/* Range check where a non-positive bound counts as "open": an empty min means
   "from 0", an empty max means "to any". When both bounds are unset the range
   is fully open (always true), so the caller can treat it as "no preference". */
function inRangeOrOpen(value: number, min: number, max: number): boolean {
  const lo = min > 0 ? min : 0;
  const hi = max > 0 ? max : Number.POSITIVE_INFINITY;
  return value >= lo && value <= hi;
}

/* True when any must-have mentions VAT (e.g. "EU VAT paid", "VAT cleared"). */
function requiresEuVat(mustHaves: string[]): boolean {
  return mustHaves.some((item) => /\bvat\b/i.test(item));
}

/* Substring match of the listing's location/label against the buyer's
   preferred locations (e.g. "Monaco" matches "Monaco, Monaco"). */
function matchesPreferredLocation(listing: YachtListing, preferredLocations: string[]): boolean {
  if (!preferredLocations.length) return false;
  const haystack = `${listing.location} ${listing.locationLabel ?? ""}`.toLowerCase();
  return preferredLocations.some((location) => {
    const trimmed = location.trim().toLowerCase();
    return trimmed.length > 0 && haystack.includes(trimmed);
  });
}

/* Relative importance of each criterion when the buyer specifies it. The score
   is a weighted % over ONLY the criteria the buyer filled — empty fields mean
   "no preference" and are excluded entirely (they neither help nor hurt). */
const MATCH_WEIGHTS = {
  brand: 30,
  budget: 25,
  size: 20,
  mustHaves: 15,
  location: 10,
  specText: 10,
  taste: 5,
} as const;

/* Common words to ignore when matching a buyer's free-text intent against a
   listing's description / specifications. */
const SPEC_STOPWORDS = new Set([
  "the", "and", "for", "with", "without", "want", "wants", "wanted", "need",
  "needs", "needed", "looking", "would", "like", "likes", "prefer", "prefers",
  "must", "have", "has", "should", "boat", "yacht", "vessel", "from", "that",
  "this", "their", "they", "some", "any", "more", "very", "good", "great",
  "nice", "ideal", "buyer", "asset", "asset",
]);

/* Distinct meaningful keywords from a set of free-text buyer signals. */
function extractIntentTerms(...sources: string[]): string[] {
  const terms = new Set<string>();
  for (const source of sources) {
    for (const token of source.toLowerCase().split(/[^a-z0-9]+/)) {
      if (token.length > 3 && !SPEC_STOPWORDS.has(token)) terms.add(token);
    }
  }
  return [...terms];
}

/* 0–1 keyword-overlap of the buyer's free-text intent against a listing's
   description, specifications, and other free text. A practical proxy for
   semantic fit in the deterministic scorer; the AI routes do the deeper
   semantic reasoning over the same text. */
function specDescriptionFit(listing: YachtListing, terms: string[]): number {
  if (terms.length === 0) return 0;
  const haystack = [
    listing.description ?? "",
    listing.specifications ?? "",
    listing.highlights.join(" "),
    listing.interiorStyle,
    listing.refitHistory.join(" "),
  ]
    .join(" ")
    .toLowerCase();
  if (!haystack.trim()) return 0;
  const hits = terms.filter((term) => haystack.includes(term)).length;
  return hits / terms.length;
}

/* Budget fit (0–1) with ±10% margins. When only a max is given we imply a
   floor of 50% of max (so a €10M-max buyer isn't shown €500k boats); when only
   a min is given there's no ceiling. Returns null when the price is unknown. */
function budgetFit(price: number, min: number, max: number): number | null {
  if (price <= 0) return null;
  let lo: number;
  let hi: number;
  if (min > 0 && max > 0) {
    lo = min;
    hi = max;
  } else if (max > 0) {
    lo = max * 0.5;
    hi = max;
  } else {
    lo = min;
    hi = Number.POSITIVE_INFINITY;
  }
  const loAdj = lo > 0 ? lo * 0.9 : 0;
  const hiAdj = hi === Number.POSITIVE_INFINITY ? hi : hi * 1.1;
  if (price >= loAdj && price <= hiAdj) return 1;
  const loSoft = loAdj > 0 ? loAdj * 0.9 : 0;
  const hiSoft = hiAdj === Number.POSITIVE_INFINITY ? hiAdj : hiAdj * 1.1;
  if (price >= loSoft && price <= hiSoft) return 0.4;
  return 0;
}

/* Size fit (0–1) with ±10% margins. Empty min = from 0, empty max = no ceiling.
   Returns null when the listing length is unknown. */
function sizeFit(lengthFt: number, min: number, max: number): number | null {
  if (lengthFt <= 0) return null;
  const lo = min > 0 ? min : 0;
  const hi = max > 0 ? max : Number.POSITIVE_INFINITY;
  const loAdj = lo > 0 ? lo * 0.9 : 0;
  const hiAdj = hi === Number.POSITIVE_INFINITY ? hi : hi * 1.1;
  if (lengthFt >= loAdj && lengthFt <= hiAdj) return 1;
  const loSoft = loAdj > 0 ? loAdj * 0.9 : 0;
  const hiSoft = hiAdj === Number.POSITIVE_INFINITY ? hiAdj : hiAdj * 1.1;
  if (lengthFt >= loSoft && lengthFt <= hiSoft) return 0.5;
  return 0;
}

/* Fuzzy brand match: does any preferred brand term appear in the listing's
   builder / model / name? (Case-insensitive substring — so "Sunreef" matches
   "Sunreef 100 Power", which exact-equality missed.) */
function brandFit(listing: YachtListing, preferredBrands: string[]): number {
  const haystack = `${listing.builder} ${listing.model} ${listing.name}`.toLowerCase();
  return preferredBrands.some((brand) => {
    const term = brand.trim().toLowerCase();
    return term.length > 0 && haystack.includes(term);
  })
    ? 1
    : 0;
}

export function generateMatchesForBuyer(
  buyer: BuyerProfile,
  inventory: YachtListing[] = yachtListings,
  limit = 4,
): MatchResult[] {
  const requiredCabins = parseRequiredCabins(buyer.mustHaves);
  const vatRequired = requiresEuVat(buyer.mustHaves);
  // Only machine-checkable must-haves count toward scoring; free-text we can't
  // verify is ignored rather than penalised.
  const checkableMustHaves = (requiredCabins != null ? 1 : 0) + (vatRequired ? 1 : 0);
  // Free-text intent keywords, matched against listing description + specs.
  const intentTerms = extractIntentTerms(
    buyer.mustHaves.join(" "),
    buyer.lifestylePreferences.join(" "),
  );

  const scored = inventory.map((listing) => {
    const criteriaMet: string[] = [];
    const missingCriteria: string[] = [];
    // Each entry is a specified criterion: its 0–1 match and its weight.
    const factors: { label: string; match: number; weight: number }[] = [];

    if (buyer.preferredBrands.length) {
      const m = brandFit(listing, buyer.preferredBrands);
      factors.push({ label: "Preferred brand", match: m, weight: MATCH_WEIGHTS.brand });
      if (m >= 1) criteriaMet.push("Preferred brand");
      else missingCriteria.push("Preferred brand");
    }

    if (buyer.budgetMinEur > 0 || buyer.budgetMaxEur > 0) {
      const m = budgetFit(listing.priceEur, buyer.budgetMinEur, buyer.budgetMaxEur);
      if (m != null) {
        factors.push({ label: "Budget", match: m, weight: MATCH_WEIGHTS.budget });
        if (m >= 1) criteriaMet.push("Inside budget");
        else if (m > 0) criteriaMet.push("Near budget");
        else missingCriteria.push("Budget fit");
      }
    }

    if (buyer.sizeRangeFt[0] > 0 || buyer.sizeRangeFt[1] > 0) {
      const m = sizeFit(listing.lengthFt, buyer.sizeRangeFt[0], buyer.sizeRangeFt[1]);
      if (m != null) {
        factors.push({ label: "Size range", match: m, weight: MATCH_WEIGHTS.size });
        if (m >= 1) criteriaMet.push("Size range");
        else if (m > 0) criteriaMet.push("Near size range");
        else missingCriteria.push("Size range");
      }
    }

    let unmetMustHave = false;
    if (checkableMustHaves > 0) {
      let satisfied = 0;
      if (requiredCabins != null) {
        if (listing.cabins >= requiredCabins) {
          satisfied += 1;
          criteriaMet.push(`${requiredCabins}+ cabins`);
        } else {
          unmetMustHave = true;
          missingCriteria.push(`${requiredCabins} cabins`);
        }
      }
      if (vatRequired) {
        if (listing.vatStatus === "EU VAT Paid") {
          satisfied += 1;
          criteriaMet.push("EU VAT paid");
        } else {
          unmetMustHave = true;
          missingCriteria.push("EU VAT paid");
        }
      }
      factors.push({
        label: "Must-haves",
        match: satisfied / checkableMustHaves,
        weight: MATCH_WEIGHTS.mustHaves,
      });
    }

    if (buyer.preferredLocations.length) {
      const m = matchesPreferredLocation(listing, buyer.preferredLocations) ? 1 : 0;
      factors.push({ label: "Preferred location", match: m, weight: MATCH_WEIGHTS.location });
      if (m >= 1) criteriaMet.push("Preferred location");
      else missingCriteria.push("Preferred location");
    }

    if (buyer.lifestylePreferences.length) {
      const m = buyer.lifestylePreferences.some((preference) =>
        `${listing.interiorStyle} ${listing.highlights.join(" ")}`
          .toLowerCase()
          .includes(preference.toLowerCase().split(" ")[0]),
      )
        ? 1
        : 0;
      factors.push({ label: "Taste signal", match: m, weight: MATCH_WEIGHTS.taste });
      if (m >= 1) criteriaMet.push("Taste signal");
    }

    // Spec & description fit: how much of the buyer's free-text intent
    // (must-haves + lifestyle/taste) is reflected in the listing's
    // description and specifications. Only scored when the buyer expressed
    // free-text intent, so listings aren't penalised when there's nothing
    // to match against.
    if (intentTerms.length) {
      const m = specDescriptionFit(listing, intentTerms);
      factors.push({ label: "Spec & description fit", match: m, weight: MATCH_WEIGHTS.specText });
      if (m >= 0.5) criteriaMet.push("Spec & description fit");
      else if (m > 0) criteriaMet.push("Partial spec match");
    }

    // Normalise: % fit over the criteria the buyer actually specified. No flat
    // base — a listing that matches none of the stated criteria scores low.
    const totalWeight = factors.reduce((sum, factor) => sum + factor.weight, 0);
    const earned = factors.reduce((sum, factor) => sum + factor.weight * factor.match, 0);
    let raw = totalWeight > 0 ? (earned / totalWeight) * 100 : 50;

    // Hard rules: deal-breakers near-disqualify; an unmet must-have caps the score.
    const previouslyRejected = buyer.rejectedAssets.some((r) => r.listingId === listing.id);
    const commercialBlocked =
      buyer.dealBreakers.some((d) => /commercial/i.test(d)) && listing.vatStatus === "Commercial";
    if (previouslyRejected) missingCriteria.push("Previously rejected");
    if (commercialBlocked) missingCriteria.push("Commercial registration");
    if (unmetMustHave) raw = Math.min(raw, 65);
    if (previouslyRejected || commercialBlocked) raw = Math.min(raw, 20);

    const fitScore = Math.round(Math.max(0, Math.min(100, raw)));
    const category =
      fitScore >= 85 ? "Exact Match" : fitScore >= 65 ? "Close Match" : "Smart Substitute";

    // Each factor's contribution to the final % (they sum to ~fitScore before
    // any cap). Powers the "why this score?" tooltip.
    const scoreBreakdown: { label: string; points: number; met: boolean }[] =
      totalWeight > 0
        ? factors.map((factor) => ({
            label: factor.label,
            points: Math.round((factor.weight * factor.match * 100) / totalWeight),
            met: factor.match > 0,
          }))
        : [{ label: "No criteria set", points: 0, met: false }];
    if (unmetMustHave) scoreBreakdown.push({ label: "Capped: unmet must-have", points: 0, met: false });
    if (previouslyRejected || commercialBlocked) {
      scoreBreakdown.push({ label: "Capped: deal-breaker", points: 0, met: false });
    }

    const headlineReasons = criteriaMet.slice(0, 3).join(", ").toLowerCase();

    return {
      id: `generated-${buyer.id}-${listing.id}`,
      buyerId: buyer.id,
      listingId: listing.id,
      category,
      fitScore,
      rationale: `${listing.name} fits ${buyer.name} at ${fitScore}% — ${headlineReasons || "limited overlap with the stated criteria"}.`,
      criteriaMet,
      missingCriteria,
      talkingPoints: listing.highlights.slice(0, 2),
      scoreBreakdown,
    } satisfies MatchResult;
  });

  return scored.sort((a, b) => b.fitScore - a.fitScore).slice(0, limit);
}

/* Extracts a buyer name from natural broker language. Tries several common
   phrasings before falling back to "New buyer". */
function extractBuyerName(raw: string): string {
  const patterns: RegExp[] = [
    /(?:spoke with|call with|met with|met|talked with|from|note from|reached out from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
    /(?:Caller|Prospect|Buyer|Client)\s*[:\-–]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:called|reached out|wants|is interested|inquired|asked|requested)/,
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern)?.[1]?.trim();
    if (match) return match;
  }

  return "New buyer";
}

/* Extracts an "AA to BB ft" size range from natural language. Supports ft / foot
   / feet / m / meter and en-dash separators. */
function extractSizeRange(raw: string): string | undefined {
  const match = raw.match(
    /(\d{2,3})\s*(?:to|-|–|—|and)\s*(\d{2,3})\s*(?:foot|feet|ft|m|meter|metres)/i,
  );
  if (match) return `${match[1]} to ${match[2]} foot`;

  const single = raw.match(/(\d{2,3})\s*(?:foot|feet|ft)/i);
  return single ? `${single[1]} foot` : undefined;
}

/* Extracts a budget label like "Around EUR3M" or "Budget EUR500k". */
function extractBudgetLabel(raw: string): string | undefined {
  const around = raw.match(
    /(?:budget|around|approx(?:imately)?|near|target)?\s*(?:€|eur|euros?|usd|\$)?\s*([\d]+(?:[.,]\d+)?)\s*(million|mln|m|thousand|k)\b/i,
  );
  if (around) {
    const amount = around[1].replace(",", ".");
    const unit = around[2].toLowerCase();
    if (unit.startsWith("m")) return `Budget around EUR${amount}M`;
    return `Budget around EUR${amount}k`;
  }

  const explicit = raw.match(/(?:€|eur|euros?)\s*([\d,]{4,})/i);
  if (explicit) {
    const value = Number(explicit[1].replace(/,/g, ""));
    if (!Number.isNaN(value) && value > 0) {
      return `Budget around EUR${(value / 1_000_000).toFixed(1)}M`;
    }
  }

  return undefined;
}

/* Parses a size-range preference back into [min, max] feet so callers can
   filter listings without re-parsing the original text. */
function parseSizeRange(preference: string | undefined): [number, number] | undefined {
  if (!preference) return undefined;
  const range = preference.match(/(\d{2,3})\s*to\s*(\d{2,3})/);
  if (range) {
    return [Number(range[1]), Number(range[2])];
  }
  const single = preference.match(/(\d{2,3})/);
  if (single) {
    const value = Number(single[1]);
    return [value - 5, value + 5];
  }
  return undefined;
}

/* Heuristic urgency tier. */
function extractUrgency(raw: string): "High" | "Medium" | "Low" {
  const normalized = raw.toLowerCase();
  if (
    normalized.includes("tomorrow") ||
    normalized.includes("today") ||
    normalized.includes("asap") ||
    normalized.includes("urgent") ||
    normalized.includes("this week") ||
    normalized.includes("end of week")
  ) {
    return "High";
  }
  if (
    normalized.includes("before summer") ||
    normalized.includes("this month") ||
    normalized.includes("next week") ||
    normalized.includes("by end of") ||
    normalized.includes("by end-of")
  ) {
    return "High";
  }
  if (
    normalized.includes("no rush") ||
    normalized.includes("no hurry") ||
    normalized.includes("exploring") ||
    normalized.includes("just looking")
  ) {
    return "Low";
  }
  return "Medium";
}

export function extractCallSummary(raw: string): ExtractedCallSummary {
  const buyerName = extractBuyerName(raw);
  const normalized = raw.toLowerCase();

  const matchedBuyer = buyers.find((buyer) =>
    buyer.name.toLowerCase().includes(buyerName.toLowerCase().split(" ")[0]),
  );

  const sizePreference = extractSizeRange(raw);
  const budgetPreference = extractBudgetLabel(raw);

  const preferences = [
    sizePreference,
    budgetPreference,
    normalized.includes("light interior") || normalized.includes("modern interior")
      ? "Modern light interior"
      : undefined,
    /\bvat[\s-]?paid\b|\beu[\s-]?vat\b/.test(normalized) ? "EU VAT paid" : undefined,
    normalized.includes("before summer") || normalized.includes("summer ready")
      ? "Ready before summer"
      : undefined,
    /\b(\d+)\s*cabin/.exec(normalized)?.[0]
      ? `${/\b(\d+)\s*cabin/.exec(normalized)?.[1]} cabins`
      : undefined,
    normalized.includes("family") ? "Family use" : undefined,
    normalized.includes("charter") ? "Charter potential" : undefined,
    normalized.includes("whatsapp") ? "Prefers WhatsApp" : undefined,
  ].filter(Boolean) as string[];

  const urgency = extractUrgency(raw);

  /* Link any listings that fall within the extracted size range — this works
     even when no buyer profile exists yet so first-run notes still surface
     inventory. */
  const sizeRange = parseSizeRange(sizePreference);
  const sizeLinked = sizeRange
    ? yachtListings
        .filter((listing) => listing.lengthFt >= sizeRange[0] - 2 && listing.lengthFt <= sizeRange[1] + 2)
        .slice(0, 3)
        .map((listing) => listing.id)
    : [];

  const matchedListings = matchedBuyer
    ? generateMatchesForBuyer(matchedBuyer).slice(0, 3).map((match) => match.listingId)
    : sizeLinked;

  /* Tasks are derived from the actual signal in the note so the workspace
     doesn't fabricate work that wasn't promised. */
  const tasks: string[] = [];
  if (preferences.length > 0 || matchedListings.length > 0) {
    tasks.push("Send ranked shortlist");
  }
  if (normalized.includes("viewing") || normalized.includes("see the boat") || normalized.includes("see the asset") || normalized.includes("visit")) {
    tasks.push("Confirm viewing windows");
  }
  if (normalized.includes("compare") || normalized.includes("comparison") || normalized.includes("vs ")) {
    tasks.push("Attach buyer-safe comparison");
  }
  if (!matchedBuyer && buyerName !== "New buyer") {
    tasks.push("Save buyer to memory");
  }
  if (tasks.length === 0 && raw.trim().length > 0) {
    tasks.push("Capture remaining criteria on next call");
  }

  const pipelineUpdate = matchedBuyer
    ? `Existing buyer ${matchedBuyer.name} updated — ${urgency.toLowerCase()} urgency, shortlist follow-up due.`
    : preferences.length > 0
      ? `New buyer captured with ${preferences.length} criteria — ${urgency.toLowerCase()} urgency, shortlist follow-up due.`
      : "Draft buyer captured — awaiting more criteria before shortlist.";

  return {
    buyerName,
    preferences,
    tasks,
    urgency,
    linkedListingIds: matchedListings,
    pipelineUpdate,
  };
}

export function generateFollowUpDraft(buyer: BuyerProfile, matches: MatchResult[] = generateMatchesForBuyer(buyer)) {
  const primary = matches[0];
  const listing = primary ? getListingById(primary.listingId) : undefined;

  return {
    subject: listing ? `${listing.builder} ${listing.model} shortlist` : "Asset shortlist",
    body: listing
      ? `Great speaking today. Based on your preference for ${buyer.lifestylePreferences.slice(0, 2).join(" and ").toLowerCase()}, ${listing.name} is the strongest fit because ${primary.rationale.toLowerCase()} I would suggest we compare it with ${matches[1] ? getListingById(matches[1].listingId)?.name : "one close alternative"} before booking viewings.`
      : "Great speaking today. I will prepare a concise shortlist with fit rationale and trade-offs.",
  };
}

export function generateVoiceToCrmDrafts(
  buyer: BuyerProfile,
  extracted: ExtractedCallSummary,
  matches: MatchResult[] = generateMatchesForBuyer(buyer),
): FollowUpDraft[] {
  const primaryMatch = matches.find((match) => extracted.linkedListingIds.includes(match.listingId)) ?? matches[0];
  const primaryListing = primaryMatch ? getListingById(primaryMatch.listingId) : undefined;
  const secondListing = matches.find((match) => match.listingId !== primaryMatch?.listingId);
  const secondListingName = secondListing ? getListingById(secondListing.listingId)?.name : undefined;
  const firstName = buyer.name.split(" ")[0];
  const preferenceLine = extracted.preferences.join(", ").toLowerCase();

  return [
    {
      id: "voice-draft-inquiry",
      buyerId: buyer.id,
      listingId: primaryListing?.id,
      kind: "Inquiry Reply",
      channel: "Email",
      status: "Draft",
      subject: `${primaryListing?.builder ?? "Asset"} shortlist for your brief`,
      body: `${firstName}, thanks for the detailed brief. I have captured ${preferenceLine} and will keep the shortlist focused on assets that are ready for a fast decision. ${primaryListing?.name ?? "The leading option"} is currently the strongest starting point, with ${secondListingName ?? "one close alternative"} as the trade-off comparison.`,
      createdAt: nowIso,
    },
    {
      id: "voice-draft-post-call",
      buyerId: buyer.id,
      listingId: primaryListing?.id,
      kind: "Post-Call Follow-Up",
      channel: "WhatsApp",
      status: "Draft",
      subject: "Call follow-up",
      body: `${firstName}, I have noted the size range, VAT-paid requirement, light interior preference, and summer timing. I will send a ranked Ferretti/Azimut comparison with honest trade-offs and viewing windows next.`,
      createdAt: nowIso,
    },
    {
      id: "voice-draft-viewing-recap",
      buyerId: buyer.id,
      listingId: primaryListing?.id,
      kind: "Viewing Recap",
      channel: "Email",
      status: "Draft",
      subject: `Viewing recap template for ${primaryListing?.name ?? "shortlisted asset"}`,
      body: `After the viewing, I will recap how ${primaryListing?.name ?? "the asset"} performs against your remembered criteria: fit, ownership readiness, maintenance confidence, timing, and buyer priorities. I will also call out any objection directly rather than bury it.`,
      createdAt: nowIso,
    },
    {
      id: "voice-draft-negotiation",
      buyerId: buyer.id,
      listingId: primaryListing?.id,
      kind: "Negotiation Update",
      channel: "Email",
      status: "Draft",
      subject: "Negotiation position and next step",
      body: `${firstName}, if you want to move forward, I would position the offer around speed, verified readiness, and clean terms rather than price alone. I will confirm the seller's flexibility only after we have the viewing window and document questions cleared.`,
      createdAt: nowIso,
    },
  ];
}

/* Builds the same four-draft pack as `generateVoiceToCrmDrafts` but without
   requiring a persisted buyer profile. Used on first-run / unmatched callers
   so the approval queue is never empty when a note is parsed. */
export function generateVoiceToCrmDraftsFromExtracted(
  extracted: ExtractedCallSummary,
  linkedListings: YachtListing[] = [],
): FollowUpDraft[] {
  const firstName = extracted.buyerName.split(" ")[0] || "there";
  const primaryListing = linkedListings[0];
  const secondListingName = linkedListings[1]?.name;
  const preferenceLine = extracted.preferences.length
    ? extracted.preferences.join(", ").toLowerCase()
    : "the criteria you shared";

  return [
    {
      id: "voice-draft-inquiry",
      buyerId: undefined,
      listingId: primaryListing?.id,
      kind: "Inquiry Reply",
      channel: "Email",
      status: "Draft",
      subject: primaryListing
        ? `${primaryListing.builder} ${primaryListing.model} shortlist for your brief`
        : "Initial shortlist for your brief",
      body: `${firstName}, thanks for the brief. I have captured ${preferenceLine} and will keep the shortlist tight so we move fast. ${primaryListing ? `${primaryListing.name} is the strongest starting point` : "I will line up the strongest starting point"}${secondListingName ? `, with ${secondListingName} as the trade-off comparison.` : "."}`,
      createdAt: nowIso,
    },
    {
      id: "voice-draft-post-call",
      buyerId: undefined,
      listingId: primaryListing?.id,
      kind: "Post-Call Follow-Up",
      channel: "WhatsApp",
      status: "Draft",
      subject: "Call follow-up",
      body: `${firstName}, noted ${preferenceLine}. Sending a ranked shortlist with honest trade-offs and viewing windows next.`,
      createdAt: nowIso,
    },
    {
      id: "voice-draft-viewing-recap",
      buyerId: undefined,
      listingId: primaryListing?.id,
      kind: "Viewing Recap",
      channel: "Email",
      status: "Draft",
      subject: primaryListing
        ? `Viewing recap template for ${primaryListing.name}`
        : "Viewing recap template",
      body: `After the viewing, I will recap how ${primaryListing?.name ?? "the asset"} performs against your remembered criteria and call out any objection directly rather than bury it.`,
      createdAt: nowIso,
    },
    {
      id: "voice-draft-negotiation",
      buyerId: undefined,
      listingId: primaryListing?.id,
      kind: "Negotiation Update",
      channel: "Email",
      status: "Draft",
      subject: "Negotiation position and next step",
      body: `${firstName}, if you want to move forward I will position the offer around speed, verified readiness, and clean terms — and confirm seller flexibility only after viewing windows and document questions are cleared.`,
      createdAt: nowIso,
    },
  ];
}

export function getVoiceToCrmWorkflow(
  raw: string,
  segment?: BrokerSegment,
  options?: { includeDemo?: boolean },
) {
  const includeDemo = options?.includeDemo !== false;
  const trimmed = raw.trim();
  const extracted = extractCallSummary(raw);
  const buyer = includeDemo
    ? getBuyersForSegment(segment).find((candidate) =>
        candidate.name.toLowerCase().includes(extracted.buyerName.toLowerCase().split(" ")[0]),
      )
    : undefined;
  const matches = buyer && includeDemo
    ? generateMatchesForBuyer(buyer, getListingsForSegment(segment))
    : [];
  const linkedListings = includeDemo
    ? extracted.linkedListingIds
        .map((id) => getListingById(id, segment))
        .filter((listing): listing is YachtListing => Boolean(listing))
    : [];

  const tasks: BrokerTask[] = extracted.tasks.map((task, index) => {
    const kind: BrokerTask["kind"] = task.toLowerCase().includes("viewing")
      ? "Viewing"
      : task.toLowerCase().includes("shortlist")
        ? "Matching"
        : task.toLowerCase().includes("buyer")
          ? "CRM"
          : "Follow-Up";

    return {
      id: `voice-task-${index + 1}`,
      title: task,
      kind,
      priority: extracted.urgency === "High" ? "High" : extracted.urgency === "Low" ? "Low" : "Medium",
      status: index === 0 ? "In Progress" : "Open",
      dueAt: "2026-05-25",
      reason: buyer
        ? `Created from ${buyer.name}'s call summary: ${extracted.pipelineUpdate}`
        : `Created from a fresh voice note: ${extracted.pipelineUpdate}`,
      actionLabel: index === 0 ? "Review draft" : "Create task",
      buyerId: buyer?.id,
      listingId: linkedListings[index % Math.max(1, linkedListings.length)]?.id,
    } satisfies BrokerTask;
  });

  const drafts: FollowUpDraft[] = trimmed
    ? buyer
      ? generateVoiceToCrmDrafts(buyer, extracted, matches)
      : generateVoiceToCrmDraftsFromExtracted(extracted, linkedListings)
    : [];

  /* Audit trail only contains events that actually happened — no fabricated
     "drafts generated" entry when no drafts exist. */
  const auditTrail: AuditEvent[] = [];
  if (trimmed) {
    auditTrail.push({
      id: "voice-audit-generated",
      actor: "System",
      label: "Call summary parsed",
      detail: buyer
        ? `${buyer.name}'s note was converted into profile updates, linked listings, tasks, and draft follow-ups.`
        : `Voice note parsed into a buyer profile${extracted.preferences.length ? ` with ${extracted.preferences.length} extracted criteria` : ""}. The Voice CRM screen saves this capture for the active workspace.`,
      occurredAt: nowIso,
    });
  }
  if (drafts.length > 0) {
    auditTrail.push({
      id: "voice-audit-drafts",
      actor: "System",
      label: "Drafts generated",
      detail: `${drafts.length} follow-up drafts are waiting for broker approval. Nothing is sent automatically.`,
      occurredAt: nowIso,
    });
  }

  return {
    extracted,
    buyer,
    profileUpdates: buyer
      ? {
          budget: `${buyer.budgetMinEur.toLocaleString("en-GB")} to ${buyer.budgetMaxEur.toLocaleString("en-GB")} EUR`,
          preferences: extracted.preferences.length ? extracted.preferences : buyer.lifestylePreferences,
          urgency: extracted.urgency,
          pipelineStage: extracted.pipelineUpdate,
        }
      : {
          budget:
            extracted.preferences.find((preference) => preference.toLowerCase().startsWith("budget")) ??
            "Not yet captured",
          preferences: extracted.preferences,
          urgency: extracted.urgency,
          pipelineStage: extracted.pipelineUpdate,
        },
    linkedListings,
    tasks,
    drafts,
    auditTrail,
  };
}

export function generateSellerReport(input: SellerReportInput, segment?: BrokerSegment) {
  const seller = getSellerById(input.sellerId, segment);
  const listing = getListingById(input.listingId, segment);

  return {
    title: `${listing?.name ?? "Listing"} owner update`,
    summary: `${input.period}: ${input.inquiries} inquiries, ${input.qualifiedLeads} qualified leads, and ${input.viewings} viewings. ${seller?.name ?? "Owner"} should see the strongest objections and next-week action plan clearly.`,
    sections: [
      {
        label: "Lead quality",
        value: `${input.qualifiedLeads} of ${input.inquiries} inquiries look qualified`,
      },
      {
        label: "Common objections",
        value: input.commonObjections.join("; "),
      },
      {
        label: "Market movement",
        value: input.marketMovement.join("; "),
      },
      {
        label: "Next week",
        value: input.nextWeekPlan.join("; "),
      },
    ],
  };
}

export function getEditableSellerReports(
  segment?: BrokerSegment,
  options: { includeDemo?: boolean } = {},
) {
  if (options.includeDemo === false) return [];
  return getSellerReportInputsForSegment(segment).map((input) => {
    const seller = getSellerById(input.sellerId, segment);
    const listing = getListingById(input.listingId, segment);
    const report = generateSellerReport(input, segment);
    const inquiries = getConversationsForSegment(segment).filter((conversation) => conversation.listingId === input.listingId);
    const relatedTasks = getTasksForSegment(segment).filter((task) => task.sellerId === input.sellerId || task.listingId === input.listingId);

    return {
      input,
      seller,
      listing,
      report,
      inquiries,
      relatedTasks,
      editableDraft: [
        report.summary,
        `Lead quality: ${input.qualifiedLeads} qualified from ${input.inquiries} inquiries, with ${input.viewings} viewings completed.`,
        `Buyer feedback: ${input.commonObjections.join("; ")}.`,
        `Market movement: ${input.marketMovement.join("; ")}.`,
        `Suggested actions: ${input.nextWeekPlan.join("; ")}.`,
        `Next-week plan: keep ${seller?.name ?? "owner"} updated on verified buyer quality, viewing windows, and pricing read.`,
      ].join("\n\n"),
      auditTrail: [
        {
          id: `audit-${input.id}-generated`,
          actor: "System" as const,
          label: "Seller report generated",
          detail: `${report.title} prepared from inquiries, viewings, objections, market movement, and next-week plan.`,
          occurredAt: nowIso,
        },
        ...getAuditEventsForSegment(segment).filter((event) => event.detail.includes(listing?.name ?? "") || event.detail.includes(seller?.name ?? "")),
      ],
    };
  });
}

/* ---- Reports performance summary -------------------------------------- */

export interface ReportTrendDelta {
  current: number;
  previous: number;
  delta: number;
  /* Percent change vs the previous period, or null when there's no prior
     period or the previous value was zero (avoids divide-by-zero / ∞%). */
  pct: number | null;
}

export interface ReportFunnelStage {
  label: string;
  value: number;
  /* Share of the previous stage (0..1), or null for the first stage. */
  ofPrevious: number | null;
  /* Share of the top of the funnel (inquiries), 0..1 — used for bar width. */
  ofTop: number;
}

export interface ReportPriceComp {
  name: string;
  priceEur: number;
  note: string;
  /* Position on the padded min→max scale, 0..1. */
  fraction: number;
}

export interface ReportPricePosition {
  askingEur: number;
  median: number;
  min: number;
  max: number;
  /* (asking − comp median) / comp median, or null if no comps. */
  pctVsMedian: number | null;
  askFraction: number;
  comps: ReportPriceComp[];
}

export interface ReportPerformance {
  inquiries: number;
  qualifiedLeads: number;
  viewings: number;
  qualifiedRate: number; // qualified / inquiries, 0..1
  viewingRate: number; // viewings / qualified, 0..1
  funnel: ReportFunnelStage[];
  trend: {
    period: string;
    inquiries: ReportTrendDelta;
    qualifiedLeads: ReportTrendDelta;
    viewings: ReportTrendDelta;
  } | null;
  series: {
    labels: string[];
    inquiries: number[];
    qualifiedLeads: number[];
    viewings: number[];
  };
  price: ReportPricePosition | null;
}

function safeRate(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0;
}

function trendDelta(current: number, previous: number): ReportTrendDelta {
  const delta = current - previous;
  return {
    current,
    previous,
    delta,
    pct: previous > 0 ? delta / previous : null,
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/* Turns a single seller-report input + its listing into the numbers the
   Reports screen visualises: conversion funnel, week-over-week trend, a
   small time series for the sparkline, and where the asking price sits
   against comparable listings. Pure and deterministic so it can be unit
   tested without touching React. */
export function summarizeReportPerformance(
  input: SellerReportInput,
  listing?: YachtListing,
): ReportPerformance {
  const { inquiries, qualifiedLeads, viewings } = input;

  const funnel: ReportFunnelStage[] = [
    { label: "Inquiries", value: inquiries, ofPrevious: null, ofTop: 1 },
    {
      label: "Qualified leads",
      value: qualifiedLeads,
      ofPrevious: safeRate(qualifiedLeads, inquiries),
      ofTop: safeRate(qualifiedLeads, inquiries),
    },
    {
      label: "Viewings",
      value: viewings,
      ofPrevious: safeRate(viewings, qualifiedLeads),
      ofTop: safeRate(viewings, inquiries),
    },
  ];

  const history = input.history ?? [];
  const previous = history[history.length - 1];
  const trend = previous
    ? {
        period: previous.period,
        inquiries: trendDelta(inquiries, previous.inquiries),
        qualifiedLeads: trendDelta(qualifiedLeads, previous.qualifiedLeads),
        viewings: trendDelta(viewings, previous.viewings),
      }
    : null;

  const ordered = [...history, { period: input.period, inquiries, qualifiedLeads, viewings }];
  const series = {
    labels: ordered.map((week) => week.period),
    inquiries: ordered.map((week) => week.inquiries),
    qualifiedLeads: ordered.map((week) => week.qualifiedLeads),
    viewings: ordered.map((week) => week.viewings),
  };

  let price: ReportPricePosition | null = null;
  if (listing && listing.priceEur > 0) {
    const comps = (listing.comps ?? []).filter((comp) => comp.priceEur > 0);
    const askingEur = listing.priceEur;
    const compPrices = comps.map((comp) => comp.priceEur);
    const allPrices = [askingEur, ...compPrices];
    const min = Math.min(...allPrices);
    const max = Math.max(...allPrices);
    const span = max - min;
    // Pad the scale so the extreme markers aren't pinned to the very edges.
    const pad = span > 0 ? span * 0.12 : Math.max(askingEur * 0.1, 1);
    const lo = min - pad;
    const hi = max + pad;
    const fractionOf = (value: number) => (hi > lo ? (value - lo) / (hi - lo) : 0.5);
    const med = compPrices.length ? median(compPrices) : askingEur;

    price = {
      askingEur,
      median: med,
      min,
      max,
      pctVsMedian: compPrices.length && med > 0 ? (askingEur - med) / med : null,
      askFraction: fractionOf(askingEur),
      comps: comps.map((comp) => ({
        name: comp.name,
        priceEur: comp.priceEur,
        note: comp.note,
        fraction: fractionOf(comp.priceEur),
      })),
    };
  }

  return {
    inquiries,
    qualifiedLeads,
    viewings,
    qualifiedRate: safeRate(qualifiedLeads, inquiries),
    viewingRate: safeRate(viewings, qualifiedLeads),
    funnel,
    trend,
    series,
    price,
  };
}

/* Broker-stored (Supabase) records to consider alongside the demo dataset.
   Every deal-room helper accepts this optionally — omitted, behavior is
   identical to before, so demo flows and tests are unaffected. Set
   includeDemo: false to work exclusively with stored data. */
export interface DealRoomDataPools {
  buyers?: BuyerProfile[];
  listings?: YachtListing[];
  includeDemo?: boolean;
}

function poolBuyers(segment?: BrokerSegment, pools?: DealRoomDataPools): BuyerProfile[] {
  const demo = pools?.includeDemo === false ? [] : getBuyersForSegment(segment);
  const seen = new Set<string>();
  return [...(pools?.buyers ?? []), ...demo].filter((buyer) => {
    if (seen.has(buyer.id)) return false;
    seen.add(buyer.id);
    return true;
  });
}

function poolListings(segment?: BrokerSegment, pools?: DealRoomDataPools): YachtListing[] {
  const demo = pools?.includeDemo === false ? [] : getListingsForSegment(segment);
  const seen = new Set<string>();
  return [...(pools?.listings ?? []), ...demo].filter((listing) => {
    if (seen.has(listing.id)) return false;
    seen.add(listing.id);
    return true;
  });
}

function resolveBuyer(id: string, segment?: BrokerSegment, pools?: DealRoomDataPools) {
  return pools?.buyers?.find((buyer) => buyer.id === id) ?? getBuyerById(id, segment);
}

function resolveListing(id: string, segment?: BrokerSegment, pools?: DealRoomDataPools) {
  return pools?.listings?.find((listing) => listing.id === id) ?? getListingById(id, segment);
}

function poolFilterExtras(pools?: DealRoomDataPools) {
  if (!pools?.listings?.length) return undefined;
  return {
    listingIds: new Set(pools.listings.map((listing) => listing.id)),
    documentIds: new Set(
      pools.listings.flatMap((listing) => listing.documents.map((document) => document.id)),
    ),
  };
}

export function createDealRoomFromBuyer(
  buyerId: string,
  selectedListingIds?: string[],
  segment?: BrokerSegment,
  pools?: DealRoomDataPools,
): DealRoom | undefined {
  const buyer = resolveBuyer(buyerId, segment, pools);

  if (!buyer) {
    return undefined;
  }

  const verification = getVerificationForBuyer(buyer.id, segment);
  const matches = generateMatchesForBuyer(buyer, poolListings(segment, pools));
  const listingIds = selectedListingIds?.length ? selectedListingIds : matches.slice(0, 2).map((match) => match.listingId);
  const listings = listingIds.map((id) => resolveListing(id, segment, pools)).filter((listing): listing is YachtListing => Boolean(listing));
  const approvedDocumentIds = listings.flatMap((listing) =>
    listing.documents
      .filter((document) => document.status === "Approved")
      .slice(0, 2)
      .map((document) => document.id),
  );

  return {
    id: `room-${buyer.id}-generated`,
    buyerId: buyer.id,
    title: `${buyer.name} Private Asset Shortlist`,
    status: verification?.status === "Verified" ? "Active" : "Draft",
    verificationStatus: verification?.status ?? "Needs Review",
    brokerApprovalStatus: verification?.status === "Verified" ? "Approved" : "Pending",
    listingIds,
    itinerary: [
      "Broker review of buyer-safe shortlist",
      "Confirm preferred viewing windows",
      "Share approved document pack after access check",
      "Follow-up call with comparison trade-offs",
    ],
    approvedDocumentIds,
    lastUpdatedAt: nowIso,
  } satisfies DealRoom;
}

export type DealRoomOrigin = "saved" | "seeded" | "suggested";

export function getBrokerDealRoomWorkspace(
  extraRooms: DealRoom[] = [],
  segment?: BrokerSegment,
  pools?: DealRoomDataPools,
) {
  const filterExtras = poolFilterExtras(pools);
  const generatedRooms = poolBuyers(segment, pools)
    .map((buyer) => createDealRoomFromBuyer(buyer.id, undefined, segment, pools))
    .filter((room): room is DealRoom => Boolean(room));
  /* Tag each room by where it came from so the UI can separate rooms the
     broker actually created/seeded ("Active") from per-buyer auto-matches
     ("Suggested"). Saved rooms win over seeded/suggested on id collision. */
  const seededRooms = pools?.includeDemo === false ? [] : getDealRoomsForSegment(segment);
  const tagged: Array<{ room: DealRoom; origin: DealRoomOrigin }> = [
    ...extraRooms.map((room) => ({ room, origin: "saved" as const })),
    ...seededRooms.map((room) => ({ room, origin: "seeded" as const })),
    ...generatedRooms.map((room) => ({ room, origin: "suggested" as const })),
  ];
  const roomIds = new Set<string>();
  const rooms = tagged
    .map((entry) => {
      const room = filterDealRoomForSegment(entry.room, segment, filterExtras);
      return room ? { room, origin: entry.origin } : null;
    })
    .filter((entry): entry is { room: DealRoom; origin: DealRoomOrigin } => Boolean(entry))
    .filter((entry) => {
      if (roomIds.has(entry.room.id)) return false;
      roomIds.add(entry.room.id);
      return true;
    });

  return rooms.map(({ room, origin }) => {
    const buyer = resolveBuyer(room.buyerId, segment, pools);
    const listings = room.listingIds.map((id) => resolveListing(id, segment, pools)).filter((listing): listing is YachtListing => Boolean(listing));
    const verification = buyer ? getVerificationForBuyer(buyer.id, segment) : undefined;
    const matches = buyer ? generateMatchesForBuyer(buyer, listings) : [];
    const accessWarning =
      room.verificationStatus === "Verified"
        ? "Buyer can receive broker-approved materials."
        : "Require explicit broker approval before activating or sharing sensitive material.";

    return {
      origin,
      room,
      buyer,
      listings,
      verification,
      matches,
      approvedDocuments: listings.flatMap((listing) =>
        listing.documents.filter((document) => room.approvedDocumentIds.includes(document.id)),
      ),
      accessWarning,
      buyerSafeRationale: buyer ? generateBuyerSafeBrief(buyer, matches.length ? matches : generateMatchesForBuyer(buyer, poolListings(segment, pools))) : undefined,
    };
  });
}

export interface DealRoomReadinessCheck {
  label: string;
  done: boolean;
}

export interface DealRoomReadiness {
  checks: DealRoomReadinessCheck[];
  readyCount: number;
  total: number;
  /* A room is shareable once the buyer is verified, the broker has approved
     it, and at least one listing is curated in. Approved documents are
     recommended (shown as a check) but don't hard-block sharing. */
  isShareable: boolean;
  avgFit: number;
}

export function getDealRoomReadiness(entry: {
  room: DealRoom;
  listings: YachtListing[];
  matches: MatchResult[];
  approvedDocuments: { id: string }[];
}): DealRoomReadiness {
  const checks: DealRoomReadinessCheck[] = [
    { label: "Buyer verified", done: entry.room.verificationStatus === "Verified" },
    { label: "Broker approved", done: entry.room.brokerApprovalStatus === "Approved" },
    { label: "Listings added", done: entry.listings.length > 0 },
    { label: "Approved docs", done: entry.approvedDocuments.length > 0 },
  ];
  const readyCount = checks.filter((check) => check.done).length;
  const isShareable =
    entry.room.verificationStatus === "Verified" &&
    entry.room.brokerApprovalStatus === "Approved" &&
    entry.listings.length > 0;
  const avgFit = entry.matches.length
    ? Math.round(entry.matches.reduce((sum, match) => sum + match.fitScore, 0) / entry.matches.length)
    : 0;
  return { checks, readyCount, total: checks.length, isShareable, avgFit };
}

export function getDealRoomById(
  roomId: string,
  extraRooms: DealRoom[] = [],
  segment?: BrokerSegment,
  pools?: DealRoomDataPools,
) {
  const filterExtras = poolFilterExtras(pools);
  const generatedRooms = poolBuyers(segment, pools)
    .map((buyer) => createDealRoomFromBuyer(buyer.id, undefined, segment, pools))
    .filter((candidate): candidate is DealRoom => Boolean(candidate));
  const seededRooms = pools?.includeDemo === false ? [] : getDealRoomsForSegment(segment);
  const room = [...extraRooms, ...seededRooms, ...generatedRooms]
    .map((candidate) => filterDealRoomForSegment(candidate, segment, filterExtras))
    .filter((candidate): candidate is DealRoom => Boolean(candidate))
    .find((candidate) => candidate.id === roomId);

  if (!room) {
    return undefined;
  }

  const buyer = resolveBuyer(room.buyerId, segment, pools);
  const listings = room.listingIds.map((id) => resolveListing(id, segment, pools)).filter((listing): listing is YachtListing => Boolean(listing));
  const matches = buyer ? generateMatchesForBuyer(buyer, listings) : [];
  const approvedDocuments = listings.flatMap((listing) =>
    listing.documents.filter((document) => room.approvedDocumentIds.includes(document.id)),
  );
  const comparisonRows = listings.map((listing) => {
    const match = matches.find((candidate) => candidate.listingId === listing.id);

    return {
      listing,
      fitScore: match?.fitScore ?? 72,
      rationale: match?.rationale ?? generateListingPitch(listing).buyerSafe,
      tradeOff: listing.weaknesses[0] ?? "Confirm final buyer priorities with broker.",
      approvedDocumentCount: listing.documents.filter((document) => room.approvedDocumentIds.includes(document.id)).length,
    };
  });

  return {
    room,
    buyer,
    listings,
    matches,
    approvedDocuments,
    comparisonRows,
    buyerSafeBrief: buyer ? generateBuyerSafeBrief(buyer, matches.length ? matches : generateMatchesForBuyer(buyer, poolListings(segment, pools))) : undefined,
    brokerContact: {
      name: "Elena Markovic",
      role: "Senior High-Ticket Broker",
      email: "elena@brobroker.example",
      phone: "+34 600 000 142",
    },
    nextSteps: [
      "Confirm which two assets should move to viewing",
      "Ask the broker for any missing or restricted details",
      "Review approved documents before the next call",
    ],
  };
}

export function getDealRoomIds() {
  return getBrokerDealRoomWorkspace().map(({ room }) => room.id);
}

export function answerScopedDealRoomQuestion(
  roomId: string,
  question: string,
  extraRooms: DealRoom[] = [],
  segment?: BrokerSegment,
  pools?: DealRoomDataPools,
) {
  const model = getDealRoomById(roomId, extraRooms, segment, pools);
  const listing = model?.listings[0];

  if (!model || !listing) {
    return {
      answer: "The broker will confirm this detail before it is used in the deal room.",
      followUpTask: "Confirm missing deal-room context",
      restricted: true,
    };
  }

  const normalized = question.toLowerCase();
  const answer = answerDealRoomQuestion(question, listing);
  const restricted =
    normalized.includes("owner") ||
    normalized.includes("seller motivation") ||
    normalized.includes("lowest") ||
    normalized.includes("broker note") ||
    answer.includes("broker should confirm") ||
    answer.includes("broker-controlled");

  return {
    answer,
    followUpTask: restricted
      ? `Broker follow-up: confirm whether "${question}" can be answered for ${model.buyer?.name ?? "buyer"}.`
      : undefined,
    restricted,
  };
}

export function answerDealRoomQuestion(question: string, listing: YachtListing) {
  const normalized = question.toLowerCase();

  if (normalized.includes("cabin")) {
    return `${listing.name} has ${listing.cabins} cabins. This is approved listing information.`;
  }

  if (normalized.includes("bed") || normalized.includes("room")) {
    return `${listing.name} is summarized as ${getListingSpecSummary(listing)}. This is approved listing information.`;
  }

  if (normalized.includes("seat") || normalized.includes("mileage") || normalized.includes("km")) {
    return `${listing.name} is summarized as ${getListingSpecSummary(listing)}. This is approved listing information.`;
  }

  if (normalized.includes("refit") || normalized.includes("service")) {
    return `${listing.name}'s approved refit notes: ${listing.refitHistory.join(", ")}.`;
  }

  if (normalized.includes("owner") || normalized.includes("seller motivation")) {
    return "That detail is broker-controlled. I will ask the broker to confirm what can be shared.";
  }

  return `I can answer from approved listing material only. The broker should confirm this detail for ${listing.name}.`;
}

export function getDashboardModel(
  segment?: BrokerSegment,
  options: { includeDemo?: boolean } = {},
) {
  /* When demo mode is off, return empty arrays from the segment helpers so
     the dashboard renders only the broker's Supabase-backed data. Stored
     listings/buyers/etc. are passed in separately by the page. */
  const includeDemo = options.includeDemo !== false;
  const segmentBuyers = includeDemo ? getBuyersForSegment(segment) : [];
  const segmentListings = includeDemo ? getListingsForSegment(segment) : [];
  const segmentSellers = includeDemo ? getSellersForSegment(segment) : [];
  const segmentTasks = includeDemo ? getTasksForSegment(segment) : [];
  const segmentVerificationCases = includeDemo
    ? getVerificationCasesForSegment(segment)
    : [];
  const segmentConversations = includeDemo
    ? getConversationsForSegment(segment)
    : [];
  const segmentFollowUpDrafts = includeDemo
    ? getFollowUpDraftsForSegment(segment)
    : [];
  const segmentDealRooms = includeDemo ? getDealRoomsForSegment(segment) : [];
  const segmentSellerReports = includeDemo
    ? getSellerReportInputsForSegment(segment)
    : [];
  const segmentMatches = includeDemo ? getMatchResultsForSegment(segment) : [];

  const hotBuyers = segmentBuyers
    .map((buyer) => ({
      buyer,
      verification: getVerificationForBuyer(buyer.id, segment),
      daysUntilAction: daysUntil(buyer.nextActionDueAt),
      topMatch: segmentMatches.find((match) => match.buyerId === buyer.id) ?? generateMatchesForBuyer(buyer, segmentListings)[0],
    }))
    .sort((a, b) => a.daysUntilAction - b.daysUntilAction)
    .slice(0, 4);

  const overdueTasks = segmentTasks
    .filter((task) => task.status !== "Done" && daysUntil(task.dueAt) <= 0)
    .sort((a, b) => daysUntil(a.dueAt) - daysUntil(b.dueAt));

  const missingDocuments = segmentListings
    .flatMap((listing) =>
      listing.missingInfo.map((missing) => ({
        listing,
        missing,
      })),
    )
    .slice(0, 5);

  const ownerUpdates = segmentSellers
    .filter((seller) => daysUntil(seller.nextOwnerUpdateDueAt) <= 4)
    .map((seller) => ({
      seller,
      daysUntilDue: daysUntil(seller.nextOwnerUpdateDueAt),
    }));

  const hasAnyData =
    segmentBuyers.length > 0 ||
    segmentSellers.length > 0 ||
    segmentListings.length > 0 ||
    segmentTasks.length > 0 ||
    segmentVerificationCases.length > 0 ||
    segmentDealRooms.length > 0;

  const verificationsOpen = segmentVerificationCases.filter((item) => item.status !== "Verified").length;

  const metrics = hasAnyData
    ? [
        {
          label: "Qualified pipeline",
          value: `${segmentBuyers.length}`,
          detail: "Buyers tracked across all stages",
          trend: `${segmentBuyers.filter((buyer) => buyer.currentStage !== "New Inquiry").length} past intake`,
        },
        {
          label: "Active inventory",
          value: `${segmentListings.length}`,
          detail: "Listings with broker context",
          trend: `${segmentListings.filter((listing) => listing.status === "Active").length} marketable`,
        },
        {
          label: "Open tasks",
          value: `${segmentTasks.filter((task) => task.status !== "Done").length}`,
          detail: "Across follow-ups and verifications",
          trend: `${overdueTasks.length} overdue`,
        },
        {
          label: "Verification queue",
          value: `${verificationsOpen}`,
          detail: "Cases needing broker action",
          trend: `${segmentVerificationCases.filter((item) => item.status === "High Risk").length} high risk`,
        },
      ]
    : [
        {
          label: "Qualified pipeline",
          value: "0",
          detail: "No buyers added yet",
          trend: "Start by capturing an inquiry",
        },
        {
          label: "Active inventory",
          value: "0",
          detail: "No listings on file",
          trend: "Add a listing to populate the brain",
        },
        {
          label: "Open tasks",
          value: "0",
          detail: "No broker tasks queued",
          trend: "Tasks will land here once created",
        },
        {
          label: "Verification queue",
          value: "0",
          detail: "No access requests yet",
          trend: "Inbox is clear",
        },
      ];

  return {
    metrics,
    hotBuyers,
    buyers: segmentBuyers,
    listings: segmentListings,
    matchResults: segmentMatches,
    tasks: segmentTasks,
    overdueTasks,
    missingDocuments,
    ownerUpdates,
    verificationCases: segmentVerificationCases,
    conversations: segmentConversations,
    followUpDrafts: segmentFollowUpDrafts,
    dealRooms: segmentDealRooms,
    sellerReport: segmentSellerReports[0] ? generateSellerReport(segmentSellerReports[0], segment) : undefined,
    hasAnyData,
  };
}

export function getTaskTone(task: BrokerTask) {
  if (task.priority === "Critical") return "border-rose-200 bg-rose-50 text-rose-800";
  if (task.priority === "High") return "border-amber-200 bg-amber-50 text-amber-900";
  if (task.priority === "Medium") return "border-sky-200 bg-sky-50 text-sky-800";
  return "border-zinc-200 bg-zinc-50 text-zinc-700";
}

export function searchBuyers(query?: string, segment?: BrokerSegment) {
  const normalized = query?.trim().toLowerCase();
  const segmentBuyers = getBuyersForSegment(segment);

  if (!normalized) {
    return segmentBuyers;
  }

  return segmentBuyers.filter((buyer) =>
    [
      buyer.name,
      buyer.company,
      buyer.country,
      buyer.currentStage,
      buyer.urgency,
      buyer.preferredBrands.join(" "),
      buyer.preferredLocations.join(" "),
      buyer.lifestylePreferences.join(" "),
      buyer.mustHaves.join(" "),
      buyer.tags.join(" "),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalized),
  );
}

export function getBuyerMemoryProfile(buyerId: string, segment?: BrokerSegment) {
  const buyer = getBuyerById(buyerId, segment);

  if (!buyer) {
    return undefined;
  }

  const verification = getVerificationForBuyer(buyer.id, segment);
  const matches = generateMatchesForBuyer(buyer, getListingsForSegment(segment));
  const tasks = getTasksForSegment(segment).filter((task) => task.buyerId === buyer.id && task.status !== "Done");
  const buyerConversations = getConversationsForSegment(segment).filter((conversation) => conversation.buyerId === buyer.id);
  const drafts = getFollowUpDraftsForSegment(segment).filter((draft) => draft.buyerId === buyer.id);
  const rejectedListings = buyer.rejectedAssets.map((rejection) => ({
    rejection,
    listing: getListingById(rejection.listingId, segment),
  }));

  return {
    buyer,
    verification,
    matches,
    tasks,
    conversations: buyerConversations,
    drafts,
    rejectedListings,
    nextActions: deriveBuyerNextActions(buyer, segment),
    buyerSafeBrief: generateBuyerSafeBrief(buyer, matches),
  };
}

export function getSellerMemoryProfile(sellerId: string, segment?: BrokerSegment) {
  const seller = getSellerById(sellerId, segment);

  if (!seller) {
    return undefined;
  }

  const assets = seller.assetIds.map((id) => getListingById(id, segment)).filter((listing): listing is YachtListing => Boolean(listing));
  const tasks = getTasksForSegment(segment).filter((task) => task.sellerId === seller.id && task.status !== "Done");
  const sellerConversations = getConversationsForSegment(segment).filter((conversation) => conversation.sellerId === seller.id);
  const reports = getSellerReportInputsForSegment(segment).filter((report) => report.sellerId === seller.id).map((input) => generateSellerReport(input, segment));

  return {
    seller,
    assets,
    tasks,
    conversations: sellerConversations,
    reports,
    nextActions: deriveSellerNextActions(seller, segment),
  };
}

export function deriveBuyerNextActions(buyer: BuyerProfile, segment?: BrokerSegment) {
  const actions: Array<{
    label: string;
    reason: string;
    priority: Priority;
    dueAt: string;
    kind: string;
  }> = [];

  getTasksForSegment(segment)
    .filter((task) => task.buyerId === buyer.id && task.status !== "Done")
    .forEach((task) =>
      actions.push({
        label: task.title,
        reason: task.reason,
        priority: task.priority,
        dueAt: task.dueAt,
        kind: task.kind,
      }),
    );

  const dueDelta = daysUntil(buyer.nextActionDueAt);
  if (dueDelta <= 0) {
    actions.push({
      label: "Send remembered-context follow-up",
      reason: `${buyer.name}'s next action is ${dueDelta < 0 ? `${Math.abs(dueDelta)}d overdue` : "due today"} and should reference current preferences, objections, and stage.`,
      priority: dueDelta < 0 ? "High" : "Medium",
      dueAt: buyer.nextActionDueAt,
      kind: "Follow-Up",
    });
  }

  const verification = getVerificationForBuyer(buyer.id, segment);
  if (verification?.status !== "Verified") {
    actions.push({
      label: "Resolve access readiness",
      reason: "Sensitive materials or private access should wait for broker approval and missing qualification details.",
      priority: verification?.status === "High Risk" ? "Critical" : "High",
      dueAt: verification?.updatedAt.slice(0, 10) ?? buyer.nextActionDueAt,
      kind: "Verification",
    });
  }

  const topMatch = generateMatchesForBuyer(buyer, getListingsForSegment(segment))[0];
  if (topMatch?.missingCriteria.length) {
    actions.push({
      label: "Confirm missing criteria before shortlist",
      reason: `${topMatch.missingCriteria.join(", ")} must be checked before presenting ${getListingById(topMatch.listingId, segment)?.name ?? "the top asset"}.`,
      priority: "Medium",
      dueAt: buyer.nextActionDueAt,
      kind: "Matching",
    });
  }

  return actions.sort((a, b) => {
    const priorityOrder: Record<Priority, number> = {
      Critical: 0,
      High: 1,
      Medium: 2,
      Low: 3,
    };

    return priorityOrder[a.priority] - priorityOrder[b.priority] || daysUntil(a.dueAt) - daysUntil(b.dueAt);
  });
}

export function deriveSellerNextActions(
  seller: NonNullable<ReturnType<typeof getSellerById>>,
  segment?: BrokerSegment,
) {
  const actions: Array<{
    label: string;
    reason: string;
    priority: Priority;
    dueAt: string;
    kind: string;
  }> = [];

  getTasksForSegment(segment)
    .filter((task) => task.sellerId === seller.id && task.status !== "Done")
    .forEach((task) =>
      actions.push({
        label: task.title,
        reason: task.reason,
        priority: task.priority,
        dueAt: task.dueAt,
        kind: task.kind,
      }),
    );

  const updateDelta = daysUntil(seller.nextOwnerUpdateDueAt);
  if (updateDelta <= 2) {
    actions.push({
      label: "Prepare owner update",
      reason: `${seller.name} expects ${seller.reportingCadence.toLowerCase()} reporting and the next owner update is ${updateDelta <= 0 ? "due now" : `due in ${updateDelta}d`}.`,
      priority: updateDelta <= 0 ? "High" : "Medium",
      dueAt: seller.nextOwnerUpdateDueAt,
      kind: "Owner Update",
    });
  }

  const missingDocuments = seller.assetIds
    .map((id) => getListingById(id, segment))
    .filter((listing): listing is YachtListing => Boolean(listing))
    .flatMap((listing) => listing.missingInfo.map((missing) => `${listing.name}: ${missing}`));

  if (missingDocuments.length) {
    actions.push({
      label: "Clear asset blockers",
      reason: missingDocuments.slice(0, 3).join("; "),
      priority: "Medium",
      dueAt: seller.nextOwnerUpdateDueAt,
      kind: "Document",
    });
  }

  return actions.sort((a, b) => daysUntil(a.dueAt) - daysUntil(b.dueAt));
}

export function generateBuyerSafeBrief(
  buyer: BuyerProfile,
  matches: MatchResult[] = generateMatchesForBuyer(buyer),
) {
  const primary = matches[0];
  const listing = primary ? getListingById(primary.listingId) : undefined;

  return {
    headline: `${buyer.name.split(" ")[0]}, I kept the shortlist focused on the criteria you gave me.`,
    body: [
      `Budget fit: ${buyer.budgetMinEur.toLocaleString("en-GB")} to ${buyer.budgetMaxEur.toLocaleString("en-GB")} EUR.`,
      buyer.lifestylePreferences.length
        ? `Preferences: ${buyer.lifestylePreferences.slice(0, 3).join(", ").toLowerCase()}.`
        : "Preferences: Flexible.",
      listing
        ? `Best current fit: ${listing.name}, because it lines up with ${primary.criteriaMet.slice(0, 3).join(", ").toLowerCase()}.`
        : "I am still checking the right current fit before recommending a specific asset.",
      buyer.rejectedAssets.length
        ? "I avoided options that repeat the same rejection pattern from prior feedback."
        : "No rejected-asset pattern is currently blocking the shortlist.",
    ],
    approvedFacts: [
      buyer.decisionTimeline,
      buyer.communicationStyle,
      ...buyer.mustHaves.slice(0, 3),
      ...(listing ? listing.highlights.slice(0, 2) : []),
    ],
    removedInternalFields: [
      "verification status and risk score",
      "broker-only seller notes",
      "seller motivation or pressure points",
      "internal tags and risk labels",
      "unapproved document restrictions",
    ],
  };
}
