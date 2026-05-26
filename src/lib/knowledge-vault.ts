import {
  type BrokerSegment,
  getAuditEventsForSegment,
  getBuyersForSegment,
  getConversationsForSegment,
  getDealRoomsForSegment,
  getFollowUpDraftsForSegment,
  getListingsForSegment,
  getMatchResultsForSegment,
  getSellerReportInputsForSegment,
  getSellersForSegment,
  getTasksForSegment,
  getVerificationCasesForSegment,
} from "./broker-segments";
import {
  generateMatchesForBuyer,
  getDocumentCompleteness,
  getListingAssetType,
  getListingCoreFacts,
  getListingSpecSummary,
  nowIso,
} from "./services";
import type {
  AssetType,
  BuyerProfile,
  DealRoom,
  MatchResult,
  SellerProfile,
  YachtListing,
} from "./types";
import { formatCurrency, formatDate } from "./utils";

export type KnowledgePageCategory =
  | "Overview"
  | "Listing"
  | "Buyer"
  | "Owner"
  | "Deal Room"
  | "Market Note"
  | "Open Gaps"
  | "Source Log";

export type KnowledgeSourceType =
  | "listing"
  | "buyer"
  | "owner"
  | "document"
  | "task"
  | "match"
  | "verification"
  | "report"
  | "deal-room"
  | "conversation"
  | "draft"
  | "audit";

export type KnowledgeVisibility = "Broker Only" | "Buyer Safe" | "Owner Sensitive";

export interface KnowledgeSource {
  type: KnowledgeSourceType;
  id: string;
  label: string;
  href?: string;
  excerpt?: string;
}

export interface KnowledgeRelation {
  type: "listing" | "buyer" | "owner" | "deal-room" | "task" | "report";
  id: string;
  label: string;
  href?: string;
  note?: string;
}

export interface KnowledgeStat {
  label: string;
  value: string;
  detail?: string;
}

export interface KnowledgeSection {
  title: string;
  body?: string;
  bullets?: string[];
  stats?: KnowledgeStat[];
}

export interface KnowledgePage {
  id: string;
  slug: string;
  title: string;
  category: KnowledgePageCategory;
  segment: BrokerSegment;
  summary: string;
  tags: string[];
  confidence: number;
  updatedAt: string;
  visibility: KnowledgeVisibility;
  sources: KnowledgeSource[];
  related: KnowledgeRelation[];
  sections: KnowledgeSection[];
  openGaps: string[];
}

export interface KnowledgeHealthCheck {
  id: string;
  label: string;
  tone: "success" | "warning" | "error" | "info";
  count: number;
  detail: string;
  items: string[];
}

export interface KnowledgeVaultMetric {
  label: string;
  value: string;
}

export interface KnowledgeVaultModel {
  segment: BrokerSegment;
  generatedAt: string;
  pages: KnowledgePage[];
  selectedPage: KnowledgePage;
  categories: Array<{ label: KnowledgePageCategory; count: number }>;
  metrics: KnowledgeVaultMetric[];
  healthChecks: KnowledgeHealthCheck[];
}

export interface KnowledgeVaultInput {
  storedListings?: YachtListing[];
  storedBuyers?: BuyerProfile[];
}

function mergeById<T extends { id: string }>(primary: T[], secondary: T[]) {
  const seen = new Set<string>();
  return [...primary, ...secondary].filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function sourceKey(source: KnowledgeSource) {
  return `${source.type}:${source.id}`;
}

function hrefForSource(type: KnowledgeSourceType, id: string) {
  if (type === "listing") return `/listings/${id}`;
  if (type === "buyer") return `/buyers/${id}`;
  if (type === "owner") return `/sellers/${id}`;
  if (type === "deal-room") return `/deal-rooms/${id}`;
  return undefined;
}

function source(type: KnowledgeSourceType, id: string, label: string, excerpt?: string): KnowledgeSource {
  return {
    type,
    id,
    label,
    href: hrefForSource(type, id),
    excerpt,
  };
}

function relation(
  type: KnowledgeRelation["type"],
  id: string,
  label: string,
  note?: string,
): KnowledgeRelation {
  const href =
    type === "listing"
      ? `/listings/${id}`
      : type === "buyer"
        ? `/buyers/${id}`
        : type === "owner"
          ? `/sellers/${id}`
          : type === "deal-room"
            ? `/deal-rooms/${id}`
            : undefined;

  return { type, id, label, href, note };
}

function latestDate(values: string[]) {
  const dates = values.filter(Boolean).map((value) => new Date(value).getTime()).filter(Number.isFinite);
  if (!dates.length) return nowIso;
  return new Date(Math.max(...dates)).toISOString();
}

function clampConfidence(value: number) {
  return Math.max(35, Math.min(99, Math.round(value)));
}

function categoryCount(pages: KnowledgePage[]) {
  const categories: KnowledgePageCategory[] = [
    "Overview",
    "Listing",
    "Buyer",
    "Owner",
    "Deal Room",
    "Market Note",
    "Open Gaps",
    "Source Log",
  ];

  return categories
    .map((label) => ({ label, count: pages.filter((page) => page.category === label).length }))
    .filter((category) => category.count > 0);
}

function assetMetricLabel(assetType: AssetType) {
  if (assetType === "Car") return "Mileage";
  if (assetType === "Real Estate") return "Area";
  return "Length";
}

function assetMetricValue(listing: YachtListing) {
  const assetType = getListingAssetType(listing);
  if (assetType === "Car") return `${listing.engineHours.toLocaleString("en-GB")} km`;
  if (assetType === "Real Estate") return `${listing.lengthFt.toLocaleString("en-GB")} sqm`;
  return `${listing.lengthFt}ft`;
}

function buyerMetricValue(buyer: BuyerProfile, segment: BrokerSegment) {
  const suffix = segment === "Car" ? "km" : segment === "Real Estate" ? "sqm" : "ft";
  return `${buyer.sizeRangeFt[0].toLocaleString("en-GB")}-${buyer.sizeRangeFt[1].toLocaleString("en-GB")} ${suffix}`;
}

function relationNameById<T extends { id: string; name?: string; title?: string }>(items: T[], id: string) {
  const item = items.find((candidate) => candidate.id === id);
  return item?.name ?? item?.title ?? id;
}

function getWorkspaceRecords(segment: BrokerSegment, input: KnowledgeVaultInput) {
  const storedListings = (input.storedListings ?? []).filter(
    (listing) => getListingAssetType(listing) === segment,
  );
  const storedBuyers = (input.storedBuyers ?? []).filter((buyer) =>
    buyer.assetTypes?.length ? buyer.assetTypes.includes(segment) : segment === "Yacht",
  );
  const listings = mergeById(storedListings, getListingsForSegment(segment));
  const buyers = mergeById(storedBuyers, getBuyersForSegment(segment));
  const storedOwners = listings
    .map((listing) => listing.ownerProfile)
    .filter((owner): owner is SellerProfile => Boolean(owner));
  const owners = mergeById(storedOwners, getSellersForSegment(segment));

  return {
    listings,
    buyers,
    owners,
    tasks: getTasksForSegment(segment),
    verificationCases: getVerificationCasesForSegment(segment),
    matchResults: getMatchResultsForSegment(segment),
    reports: getSellerReportInputsForSegment(segment),
    dealRooms: getDealRoomsForSegment(segment),
    conversations: getConversationsForSegment(segment),
    drafts: getFollowUpDraftsForSegment(segment),
    auditEvents: getAuditEventsForSegment(segment),
  };
}

function buildListingPage(
  listing: YachtListing,
  records: ReturnType<typeof getWorkspaceRecords>,
  segment: BrokerSegment,
): KnowledgePage {
  const owner = records.owners.find((candidate) => candidate.id === listing.ownerId) ?? listing.ownerProfile;
  const completeness = getDocumentCompleteness(listing);
  const generatedMatches = records.buyers
    .map((buyer) => ({ buyer, match: generateMatchesForBuyer(buyer, [listing])[0] }))
    .filter((item): item is { buyer: BuyerProfile; match: MatchResult } => Boolean(item.match))
    .sort((a, b) => b.match.fitScore - a.match.fitScore);
  const tasks = records.tasks.filter((task) => task.listingId === listing.id);
  const verificationCases = records.verificationCases.filter((caseFile) => caseFile.listingId === listing.id);
  const reports = records.reports.filter((report) => report.listingId === listing.id);
  const approvedDocuments = listing.documents.filter((document) => document.status === "Approved");
  const restrictedDocuments = listing.documents.filter((document) => document.status !== "Approved");
  const assetType = getListingAssetType(listing);

  return {
    id: `listing-${listing.id}`,
    slug: `listing/${listing.id}`,
    title: listing.name,
    category: "Listing",
    segment,
    summary: `${listing.name} is a ${getListingSpecSummary(listing)} ${assetType.toLowerCase()} in ${listing.location}. The vault knows ${approvedDocuments.length} approved documents and ${listing.missingInfo.length} open gaps.`,
    tags: [assetType, listing.status, listing.vatStatus, listing.location].filter(Boolean),
    confidence: clampConfidence(94 - listing.missingInfo.length * 8 - restrictedDocuments.length * 4),
    updatedAt: latestDate([
      ...listing.documents.map((document) => document.updatedAt),
      ...tasks.map((task) => task.dueAt),
      ...reports.map((report) => report.period),
    ]),
    visibility: "Broker Only",
    openGaps: listing.missingInfo,
    sources: [
      source("listing", listing.id, listing.name, getListingSpecSummary(listing)),
      ...listing.documents.map((document) =>
        source("document", document.id, document.title, `${document.category} · ${document.status}`),
      ),
      ...tasks.map((task) => source("task", task.id, task.title, task.reason)),
      ...verificationCases.map((caseFile) =>
        source("verification", caseFile.id, `${relationNameById(records.buyers, caseFile.buyerId)} access case`, caseFile.recommendedAction),
      ),
      ...reports.map((report) => source("report", report.id, `${owner?.name ?? "Owner"} report input`, report.period)),
    ],
    related: [
      owner ? relation("owner", owner.id, owner.name, "Seller profile") : undefined,
      ...generatedMatches.slice(0, 3).map(({ buyer, match }) =>
        relation("buyer", buyer.id, buyer.name, `${match.fitScore}% fit`),
      ),
      ...records.dealRooms
        .filter((room) => room.listingIds.includes(listing.id))
        .map((room) => relation("deal-room", room.id, room.title, room.status)),
    ].filter(Boolean) as KnowledgeRelation[],
    sections: [
      {
        title: "Core Facts",
        stats: [
          { label: "Ask", value: formatCurrency(listing.priceEur) },
          { label: assetMetricLabel(assetType), value: assetMetricValue(listing) },
          { label: "Documents", value: `${completeness.percent}%`, detail: `${completeness.approved}/${completeness.total} ready` },
          { label: "Top fit", value: generatedMatches[0] ? `${generatedMatches[0].match.fitScore}%` : "No fit" },
        ],
        bullets: getListingCoreFacts(listing).map(([label, value]) => `${label}: ${value}`),
      },
      {
        title: "Compiled Positioning",
        body: listing.idealBuyer,
        bullets: [
          ...listing.highlights.slice(0, 4).map((highlight) => `Strength: ${highlight}`),
          ...listing.weaknesses.slice(0, 3).map((weakness) => `Trade-off: ${weakness}`),
        ],
      },
      {
        title: "Owner And Market Memory",
        body: owner?.motivation ?? "Owner context will compile here once seller memory is attached.",
        bullets: [
          ...listing.ownerNotes.slice(0, 3),
          ...listing.marketSignals.slice(0, 3).map((signal) => `Market signal: ${signal}`),
        ],
      },
    ],
  };
}

function buildBuyerPage(
  buyer: BuyerProfile,
  records: ReturnType<typeof getWorkspaceRecords>,
  segment: BrokerSegment,
): KnowledgePage {
  const matches = generateMatchesForBuyer(buyer, records.listings);
  const tasks = records.tasks.filter((task) => task.buyerId === buyer.id);
  const cases = records.verificationCases.filter((caseFile) => caseFile.buyerId === buyer.id);
  const rooms = records.dealRooms.filter((room) => room.buyerId === buyer.id);
  const conversations = records.conversations.filter((conversation) => conversation.buyerId === buyer.id);
  const drafts = records.drafts.filter((draft) => draft.buyerId === buyer.id);
  const openGaps = [
    buyer.budgetMaxEur <= 0 ? "Budget ceiling not confirmed" : undefined,
    !buyer.company ? "Buying entity not confirmed" : undefined,
    !buyer.verificationCaseId ? "Verification case not attached" : undefined,
    ...matches.flatMap((match) => match.missingCriteria.slice(0, 1)),
  ].filter(Boolean) as string[];

  return {
    id: `buyer-${buyer.id}`,
    slug: `buyer/${buyer.id}`,
    title: buyer.name,
    category: "Buyer",
    segment,
    summary: `${buyer.name} is at ${buyer.currentStage.toLowerCase()} stage with ${buyer.urgency.toLowerCase()} urgency. The vault has ${buyer.mustHaves.length} must-haves, ${buyer.dealBreakers.length} deal-breakers, and ${matches.length} ranked fits.`,
    tags: [buyer.currentStage, buyer.urgency, buyer.country, ...buyer.tags].filter(Boolean),
    confidence: clampConfidence(88 - openGaps.length * 5 + conversations.length * 2),
    updatedAt: latestDate([buyer.lastContactedAt, buyer.nextActionDueAt, ...conversations.map((conversation) => conversation.occurredAt)]),
    visibility: "Broker Only",
    openGaps,
    sources: [
      source("buyer", buyer.id, buyer.name, buyer.company ?? buyer.country),
      ...matches.map((match) => source("match", match.id, relationNameById(records.listings, match.listingId), match.rationale)),
      ...tasks.map((task) => source("task", task.id, task.title, task.reason)),
      ...cases.map((caseFile) => source("verification", caseFile.id, caseFile.requestedAccess, caseFile.recommendedAction)),
      ...rooms.map((room) => source("deal-room", room.id, room.title, room.status)),
      ...conversations.map((conversation) => source("conversation", conversation.id, conversation.channel, conversation.summary)),
      ...drafts.map((draft) => source("draft", draft.id, draft.subject, draft.status)),
    ],
    related: [
      ...matches.slice(0, 4).map((match) =>
        relation("listing", match.listingId, relationNameById(records.listings, match.listingId), `${match.fitScore}% ${match.category.toLowerCase()}`),
      ),
      ...rooms.map((room) => relation("deal-room", room.id, room.title, room.status)),
      ...tasks.slice(0, 3).map((task) => relation("task", task.id, task.title, task.priority)),
    ],
    sections: [
      {
        title: "Buyer Brief",
        stats: [
          { label: "Budget", value: `${formatCurrency(buyer.budgetMinEur)}-${formatCurrency(buyer.budgetMaxEur)}` },
          { label: segment === "Real Estate" ? "Area" : segment === "Car" ? "Mileage" : "Size", value: buyerMetricValue(buyer, segment) },
          { label: "Stage", value: buyer.currentStage },
          { label: "Urgency", value: buyer.urgency },
        ],
        bullets: [
          `Preferred locations: ${buyer.preferredLocations.join(", ") || "To confirm"}`,
          `Preferred brands: ${buyer.preferredBrands.join(", ") || "Flexible"}`,
          `Communication: ${buyer.communicationStyle}`,
        ],
      },
      {
        title: "Remembered Preferences",
        body: buyer.relationshipNotes[0] ?? "No relationship note captured yet.",
        bullets: [
          ...buyer.lifestylePreferences.map((preference) => `Preference: ${preference}`),
          ...buyer.mustHaves.map((mustHave) => `Must-have: ${mustHave}`),
          ...buyer.dealBreakers.map((dealBreaker) => `Deal-breaker: ${dealBreaker}`),
        ].slice(0, 8),
      },
      {
        title: "Top Fit Rationale",
        body: matches[0]?.rationale ?? "No ranked fit yet.",
        bullets: matches.slice(0, 3).map((match) => `${relationNameById(records.listings, match.listingId)}: ${match.fitScore}% · ${match.criteriaMet.slice(0, 3).join(", ")}`),
      },
    ],
  };
}

function buildOwnerPage(
  owner: SellerProfile,
  records: ReturnType<typeof getWorkspaceRecords>,
  segment: BrokerSegment,
): KnowledgePage {
  const listings = records.listings.filter((listing) => owner.assetIds.includes(listing.id) || listing.ownerId === owner.id);
  const tasks = records.tasks.filter((task) => task.sellerId === owner.id || listings.some((listing) => listing.id === task.listingId));
  const reports = records.reports.filter((report) => report.sellerId === owner.id);
  const openGaps = [
    !owner.pricingSensitivity ? "Pricing posture not recorded" : undefined,
    reports.length === 0 ? "No owner report inputs attached" : undefined,
    tasks.filter((task) => task.status !== "Done").length
      ? `${tasks.filter((task) => task.status !== "Done").length} owner-linked tasks open`
      : undefined,
  ].filter(Boolean) as string[];

  return {
    id: `owner-${owner.id}`,
    slug: `owner/${owner.id}`,
    title: owner.name,
    category: "Owner",
    segment,
    summary: `${owner.name} owns or represents ${listings.length} ${segment.toLowerCase()} record${listings.length === 1 ? "" : "s"}. The vault tracks cadence, pricing posture, feedback history, and owner-report inputs.`,
    tags: ["Owner", owner.reportingCadence, ...listings.map((listing) => listing.name)].filter(Boolean),
    confidence: clampConfidence(84 - openGaps.length * 6 + owner.feedbackHistory.length * 2),
    updatedAt: latestDate([owner.nextOwnerUpdateDueAt, ...reports.map((report) => report.period), ...tasks.map((task) => task.dueAt)]),
    visibility: "Owner Sensitive",
    openGaps,
    sources: [
      source("owner", owner.id, owner.name, owner.motivation),
      ...listings.map((listing) => source("listing", listing.id, listing.name, getListingSpecSummary(listing))),
      ...reports.map((report) => source("report", report.id, report.period, `${report.inquiries} inquiries, ${report.qualifiedLeads} qualified leads`)),
      ...tasks.map((task) => source("task", task.id, task.title, task.reason)),
    ],
    related: [
      ...listings.map((listing) => relation("listing", listing.id, listing.name, listing.status)),
      ...reports.map((report) => relation("report", report.id, report.period, "Owner report input")),
    ],
    sections: [
      {
        title: "Owner Context",
        body: owner.motivation,
        bullets: [
          `Pricing posture: ${owner.pricingSensitivity}`,
          `Cadence: ${owner.reportingCadence}`,
          `Next update: ${formatDate(owner.nextOwnerUpdateDueAt)}`,
        ],
      },
      {
        title: "Feedback Memory",
        bullets: owner.feedbackHistory.length
          ? owner.feedbackHistory
          : ["No owner feedback history captured yet."],
      },
      {
        title: "Report Readiness",
        stats: [
          { label: "Reports", value: `${reports.length}` },
          { label: "Open tasks", value: `${tasks.filter((task) => task.status !== "Done").length}` },
          { label: "Assets", value: `${listings.length}` },
        ],
      },
    ],
  };
}

function buildDealRoomPage(
  room: DealRoom,
  records: ReturnType<typeof getWorkspaceRecords>,
  segment: BrokerSegment,
): KnowledgePage {
  const buyer = records.buyers.find((candidate) => candidate.id === room.buyerId);
  const listings = room.listingIds
    .map((listingId) => records.listings.find((listing) => listing.id === listingId))
    .filter((listing): listing is YachtListing => Boolean(listing));
  const verification = records.verificationCases.find((caseFile) => caseFile.buyerId === room.buyerId);
  const openGaps = [
    room.brokerApprovalStatus !== "Approved" ? "Broker approval still required" : undefined,
    room.verificationStatus !== "Verified" ? "Verification is not fully clear" : undefined,
    listings.flatMap((listing) => listing.missingInfo).length
      ? "Some room listings have open listing gaps"
      : undefined,
  ].filter(Boolean) as string[];

  return {
    id: `deal-room-${room.id}`,
    slug: `deal-room/${room.id}`,
    title: room.title,
    category: "Deal Room",
    segment,
    summary: `${room.title} is ${room.status.toLowerCase()} with ${room.verificationStatus.toLowerCase()} verification and ${room.approvedDocumentIds.length} buyer-safe document references.`,
    tags: [room.status, room.verificationStatus, room.brokerApprovalStatus],
    confidence: clampConfidence(86 - openGaps.length * 8 + room.approvedDocumentIds.length),
    updatedAt: room.lastUpdatedAt,
    visibility: "Buyer Safe",
    openGaps,
    sources: [
      source("deal-room", room.id, room.title, room.status),
      buyer ? source("buyer", buyer.id, buyer.name, buyer.currentStage) : undefined,
      ...listings.map((listing) => source("listing", listing.id, listing.name, getListingSpecSummary(listing))),
      verification ? source("verification", verification.id, verification.requestedAccess, verification.recommendedAction) : undefined,
    ].filter(Boolean) as KnowledgeSource[],
    related: [
      buyer ? relation("buyer", buyer.id, buyer.name, buyer.currentStage) : undefined,
      ...listings.map((listing) => relation("listing", listing.id, listing.name, listing.status)),
    ].filter(Boolean) as KnowledgeRelation[],
    sections: [
      {
        title: "Room State",
        stats: [
          { label: "Status", value: room.status },
          { label: "Verification", value: room.verificationStatus },
          { label: "Broker approval", value: room.brokerApprovalStatus },
          { label: "Docs", value: `${room.approvedDocumentIds.length}` },
        ],
      },
      {
        title: "Buyer-Safe Set",
        body: "The vault treats deal-room content as buyer-safe only after broker approval and source review.",
        bullets: room.itinerary.length ? room.itinerary : ["No itinerary is currently attached."],
      },
    ],
  };
}

function buildOpenGapsPage(
  records: ReturnType<typeof getWorkspaceRecords>,
  segment: BrokerSegment,
): KnowledgePage {
  const listingGaps = records.listings.flatMap((listing) =>
    listing.missingInfo.map((gap) => `${listing.name}: ${gap}`),
  );
  const buyerGaps = records.buyers.flatMap((buyer) => [
    !buyer.company ? `${buyer.name}: buying entity not confirmed` : undefined,
    buyer.budgetMaxEur <= 0 ? `${buyer.name}: budget ceiling not confirmed` : undefined,
    buyer.verificationCaseId ? undefined : `${buyer.name}: verification case not attached`,
  ]).filter(Boolean) as string[];
  const verificationGaps = records.verificationCases
    .filter((caseFile) => caseFile.status !== "Verified")
    .map((caseFile) => `${relationNameById(records.buyers, caseFile.buyerId)}: ${caseFile.recommendedAction}`);
  const staleTasks = records.tasks
    .filter((task) => task.status !== "Done")
    .map((task) => `${task.title}: ${task.reason}`);
  const openGaps = [...listingGaps, ...buyerGaps, ...verificationGaps, ...staleTasks];

  return {
    id: "open-gaps",
    slug: "open-gaps",
    title: "Open gaps and contradictions",
    category: "Open Gaps",
    segment,
    summary: `${openGaps.length} knowledge gaps need broker attention before the vault can safely answer or generate with high confidence.`,
    tags: ["Lint", "Missing intelligence", "Broker review"],
    confidence: clampConfidence(99 - openGaps.length * 2),
    updatedAt: nowIso,
    visibility: "Broker Only",
    openGaps,
    sources: [
      ...records.listings.map((listing) => source("listing", listing.id, listing.name, `${listing.missingInfo.length} listing gaps`)),
      ...records.buyers.map((buyer) => source("buyer", buyer.id, buyer.name, buyer.currentStage)),
      ...records.verificationCases.map((caseFile) => source("verification", caseFile.id, caseFile.requestedAccess, caseFile.status)),
      ...records.tasks.map((task) => source("task", task.id, task.title, task.status)),
    ],
    related: [
      ...records.listings.filter((listing) => listing.missingInfo.length).slice(0, 6).map((listing) =>
        relation("listing", listing.id, listing.name, `${listing.missingInfo.length} gaps`),
      ),
      ...records.tasks.filter((task) => task.status !== "Done").slice(0, 4).map((task) =>
        relation("task", task.id, task.title, task.priority),
      ),
    ],
    sections: [
      {
        title: "Missing Listing Intelligence",
        bullets: listingGaps.length ? listingGaps : ["No listing intelligence gaps currently flagged."],
      },
      {
        title: "Buyer And Verification Gaps",
        bullets: [...buyerGaps, ...verificationGaps].length
          ? [...buyerGaps, ...verificationGaps]
          : ["Buyer and verification context is complete enough for the current prototype."],
      },
      {
        title: "Open Workflow Signals",
        bullets: staleTasks.length ? staleTasks.slice(0, 10) : ["No open workflow blockers in this segment."],
      },
    ],
  };
}

function buildMarketPage(
  records: ReturnType<typeof getWorkspaceRecords>,
  segment: BrokerSegment,
): KnowledgePage {
  const marketSignals = records.listings.flatMap((listing) =>
    listing.marketSignals.map((signalText) => `${listing.name}: ${signalText}`),
  );
  const reportSignals = records.reports.flatMap((report) => [
    ...report.marketMovement.map((signalText) => `${relationNameById(records.listings, report.listingId)}: ${signalText}`),
    ...report.commonObjections.map((objection) => `Objection: ${objection}`),
  ]);
  const conversationSignals = records.conversations.map((conversation) => `${conversation.channel}: ${conversation.summary}`);

  return {
    id: "market-notes",
    slug: "market-notes",
    title: `${segment} market notes`,
    category: "Market Note",
    segment,
    summary: `Compiled market memory combines listing signals, owner-report inputs, and conversation movement for the ${segment.toLowerCase()} workspace.`,
    tags: ["Market movement", "Owner reports", "Conversations"],
    confidence: clampConfidence(78 + marketSignals.length + reportSignals.length),
    updatedAt: latestDate([...records.conversations.map((item) => item.occurredAt), ...records.reports.map((report) => report.period)]),
    visibility: "Broker Only",
    openGaps: marketSignals.length || reportSignals.length ? [] : ["Add owner report inputs or conversation summaries to strengthen market notes."],
    sources: [
      ...records.listings.map((listing) => source("listing", listing.id, listing.name, listing.location)),
      ...records.reports.map((report) => source("report", report.id, report.period, `${report.inquiries} inquiries`)),
      ...records.conversations.map((conversation) => source("conversation", conversation.id, conversation.channel, conversation.summary)),
    ],
    related: records.listings.slice(0, 8).map((listing) => relation("listing", listing.id, listing.name, listing.location)),
    sections: [
      {
        title: "Market Signals",
        bullets: marketSignals.length ? marketSignals : ["No listing-level market signals captured yet."],
      },
      {
        title: "Owner Report Movement",
        bullets: reportSignals.length ? reportSignals : ["No owner-report market movement captured yet."],
      },
      {
        title: "Conversation Feed",
        bullets: conversationSignals.length ? conversationSignals.slice(0, 8) : ["No conversations for this segment yet."],
      },
    ],
  };
}

function buildSourceLogPage(
  records: ReturnType<typeof getWorkspaceRecords>,
  segment: BrokerSegment,
  pageSources: KnowledgeSource[],
): KnowledgePage {
  const uniqueSources = new Map(pageSources.map((item) => [sourceKey(item), item]));
  const typeCounts = Array.from(uniqueSources.values()).reduce<Record<string, number>>((acc, item) => {
    acc[item.type] = (acc[item.type] ?? 0) + 1;
    return acc;
  }, {});
  const recentEvents = [
    ...records.auditEvents.map((event) => `${event.actor}: ${event.label} — ${event.detail}`),
    ...records.conversations.map((conversation) => `${conversation.channel}: ${conversation.summary}`),
  ].slice(0, 12);

  return {
    id: "source-log",
    slug: "source-log",
    title: "Source log",
    category: "Source Log",
    segment,
    summary: `The vault currently references ${uniqueSources.size} unique source records across ${Object.keys(typeCounts).length} record types.`,
    tags: ["Sources", "Lineage", "Audit"],
    confidence: 96,
    updatedAt: nowIso,
    visibility: "Broker Only",
    openGaps: [],
    sources: Array.from(uniqueSources.values()),
    related: [],
    sections: [
      {
        title: "Source Coverage",
        stats: Object.entries(typeCounts).map(([label, count]) => ({
          label,
          value: `${count}`,
        })),
      },
      {
        title: "Recent Timeline",
        bullets: recentEvents.length ? recentEvents : ["No timeline events found for this segment."],
      },
    ],
  };
}

function buildOverviewPage(
  records: ReturnType<typeof getWorkspaceRecords>,
  segment: BrokerSegment,
  pages: KnowledgePage[],
  healthChecks: KnowledgeHealthCheck[],
): KnowledgePage {
  const totalSources = new Set(pages.flatMap((page) => page.sources).map(sourceKey)).size;
  const openGaps = pages.flatMap((page) => page.openGaps);

  return {
    id: "overview",
    slug: "overview",
    title: `${segment} knowledge vault`,
    category: "Overview",
    segment,
    summary: `Compiled workspace memory across ${records.listings.length} listings, ${records.buyers.length} buyers, ${records.owners.length} owners, and ${totalSources} source records.`,
    tags: ["Index", "Generated", segment],
    confidence: clampConfidence(92 - healthChecks.filter((check) => check.tone !== "success").length * 3),
    updatedAt: nowIso,
    visibility: "Broker Only",
    openGaps: openGaps.slice(0, 10),
    sources: pages.flatMap((page) => page.sources).slice(0, 40),
    related: pages
      .filter((page) => page.category !== "Overview")
      .slice(0, 10)
      .map((page) => relation("report", page.id, page.title, page.category)),
    sections: [
      {
        title: "What This Vault Knows",
        stats: [
          { label: "Pages", value: `${pages.length + 1}` },
          { label: "Sources", value: `${totalSources}` },
          { label: "Open gaps", value: `${openGaps.length}` },
          { label: "Lower confidence", value: `${pages.filter((page) => page.confidence < 80).length}` },
        ],
        bullets: [
          "Operational records remain the source of truth.",
          "Vault pages are compiled views that can be regenerated as source data changes.",
          "Source references show which records informed each generated page.",
        ],
      },
      {
        title: "Knowledge Health",
        bullets: healthChecks.map((check) => `${check.label}: ${check.detail}`),
      },
    ],
  };
}

function buildHealthChecks(pages: KnowledgePage[], records: ReturnType<typeof getWorkspaceRecords>): KnowledgeHealthCheck[] {
  const openGaps = pages.flatMap((page) => page.openGaps);
  const lowConfidence = pages.filter((page) => page.confidence < 80);
  const sourceCount = new Set(pages.flatMap((page) => page.sources).map(sourceKey)).size;
  const staleTasks = records.tasks.filter((task) => task.status !== "Done");

  return [
    {
      id: "source-coverage",
      label: "Source coverage",
      tone: sourceCount > 0 ? "success" : "warning",
      count: sourceCount,
      detail: `${sourceCount} unique source records are linked into generated pages.`,
      items: Array.from(new Set(pages.flatMap((page) => page.sources).map((item) => item.type))).sort(),
    },
    {
      id: "open-gaps",
      label: "Open intelligence gaps",
      tone: openGaps.length ? "warning" : "success",
      count: openGaps.length,
      detail: openGaps.length
        ? `${openGaps.length} gaps should be resolved before confident external communication.`
        : "No open gaps found in the compiled pages.",
      items: openGaps.slice(0, 8),
    },
    {
      id: "confidence",
      label: "Lower-confidence pages",
      tone: lowConfidence.length ? "info" : "success",
      count: lowConfidence.length,
      detail: lowConfidence.length
        ? `${lowConfidence.length} pages need stronger source material.`
        : "All generated pages have strong source coverage.",
      items: lowConfidence.map((page) => `${page.title}: ${page.confidence}%`),
    },
    {
      id: "workflow-blockers",
      label: "Workflow blockers",
      tone: staleTasks.length ? "warning" : "success",
      count: staleTasks.length,
      detail: staleTasks.length
        ? `${staleTasks.length} open tasks are attached to this vault.`
        : "No open task blockers detected.",
      items: staleTasks.slice(0, 8).map((task) => `${task.title}: ${task.priority}`),
    },
  ];
}

export function buildKnowledgeVault(
  segment: BrokerSegment,
  input: KnowledgeVaultInput = {},
): KnowledgeVaultModel {
  const records = getWorkspaceRecords(segment, input);
  const entityPages = [
    ...records.listings.map((listing) => buildListingPage(listing, records, segment)),
    ...records.buyers.map((buyer) => buildBuyerPage(buyer, records, segment)),
    ...records.owners.map((owner) => buildOwnerPage(owner, records, segment)),
    ...records.dealRooms.map((room) => buildDealRoomPage(room, records, segment)),
  ];
  const openGapsPage = buildOpenGapsPage(records, segment);
  const marketPage = buildMarketPage(records, segment);
  const sourceLogPage = buildSourceLogPage(records, segment, [
    ...entityPages,
    openGapsPage,
    marketPage,
  ].flatMap((page) => page.sources));
  const withoutOverview = [...entityPages, openGapsPage, marketPage, sourceLogPage];
  const healthChecks = buildHealthChecks(withoutOverview, records);
  const overviewPage = buildOverviewPage(records, segment, withoutOverview, healthChecks);
  const pages = [overviewPage, ...withoutOverview];
  const uniqueSources = new Set(pages.flatMap((page) => page.sources).map(sourceKey));
  const openGapCount = new Set(pages.flatMap((page) => page.openGaps)).size;

  return {
    segment,
    generatedAt: nowIso,
    pages,
    selectedPage: overviewPage,
    categories: categoryCount(pages),
    metrics: [
      { label: "Pages", value: `${pages.length}` },
      { label: "Sources", value: `${uniqueSources.size}` },
      { label: "Open gaps", value: `${openGapCount}` },
      { label: "Lower confidence", value: `${pages.filter((page) => page.confidence < 80).length}` },
    ],
    healthChecks,
  };
}

export function findKnowledgePage(model: KnowledgeVaultModel, pageId?: string) {
  if (!pageId) return model.selectedPage;
  return model.pages.find((page) => page.id === pageId || page.slug === pageId) ?? model.selectedPage;
}
