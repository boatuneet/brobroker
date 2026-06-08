import {
  auditEvents,
  brokerTasks,
  buyers,
  conversations,
  dealRooms,
  followUpDrafts,
  matchResults,
  sellerReportInputs,
  sellers,
  verificationCases,
  yachtListings,
} from "./demo-data";
import type {
  AssetType,
  AuditEvent,
  BrokerTask,
  BuyerProfile,
  Conversation,
  DealRoom,
  FollowUpDraft,
  MatchResult,
  SellerProfile,
  SellerReportInput,
  VerificationCase,
  YachtListing,
} from "./types";

export type BrokerSegment = AssetType;

export const BROKER_SEGMENT_COOKIE = "brobroker_segment";
export const BROKER_SEGMENT_STORAGE_KEY = "brobroker:segment";
export const DEFAULT_BROKER_SEGMENT: BrokerSegment = "Yacht";

export const brokerSegments: Array<{
  id: BrokerSegment;
  label: string;
  title: string;
  description: string;
  imageSrc: string;
  accentClass: string;
}> = [
  {
    id: "Yacht",
    label: "Yachts",
    title: "Yacht brokerage",
    description: "Marine inventory, VAT context, surveys, owner updates, and buyer-safe sharing.",
    imageSrc: "/segments/broker-yachts.png",
    accentClass: "bg-[#e7ecef] text-[#233c45]",
  },
  {
    id: "Car",
    label: "Cars",
    title: "Collector cars",
    description: "Provenance, service files, discreet seller approval, and collector-ready packs.",
    imageSrc: "/segments/broker-cars.png",
    accentClass: "bg-[#ebe7e0] text-[#3c2f2f]",
  },
  {
    id: "Real Estate",
    label: "Real estate",
    title: "Luxury real estate",
    description: "Private viewings, owner discretion, document readiness, and qualified buyers.",
    imageSrc: "/segments/broker-real-estate.png",
    accentClass: "bg-[#e7ece7] text-[#263c32]",
  },
];

export function normalizeBrokerSegment(value?: string | null): BrokerSegment {
  return brokerSegments.some((segment) => segment.id === value)
    ? (value as BrokerSegment)
    : DEFAULT_BROKER_SEGMENT;
}

export function getBrokerSegmentMeta(segment?: string | null) {
  const normalized = normalizeBrokerSegment(segment);
  return brokerSegments.find((item) => item.id === normalized) ?? brokerSegments[0];
}

export function getListingAssetType(listing: YachtListing): BrokerSegment {
  return listing.assetType ?? DEFAULT_BROKER_SEGMENT;
}

export function getBuyerAssetTypes(buyer: BuyerProfile): BrokerSegment[] {
  if (buyer.assetTypes?.length) return buyer.assetTypes;

  const text = [
    buyer.preferredBrands.join(" "),
    buyer.preferredLocations.join(" "),
    buyer.lifestylePreferences.join(" "),
    buyer.tags.join(" "),
  ]
    .join(" ")
    .toLowerCase();

  if (text.includes("ferrari") || text.includes("porsche") || text.includes("range rover")) {
    return ["Car"];
  }

  if (text.includes("estate") || text.includes("villa") || text.includes("property")) {
    return ["Real Estate"];
  }

  return ["Yacht"];
}

export function getListingsForSegment(segment?: BrokerSegment): YachtListing[] {
  if (!segment) return yachtListings;
  return yachtListings.filter((listing) => getListingAssetType(listing) === segment);
}

export function getBuyersForSegment(segment?: BrokerSegment): BuyerProfile[] {
  if (!segment) return buyers;
  return buyers.filter((buyer) => getBuyerAssetTypes(buyer).includes(segment));
}

export function getSellersForSegment(segment?: BrokerSegment): SellerProfile[] {
  if (!segment) return sellers;
  const listingIds = new Set(getListingsForSegment(segment).map((listing) => listing.id));
  return sellers.filter((seller) => seller.assetIds.some((listingId) => listingIds.has(listingId)));
}

export function getVerificationCasesForSegment(segment?: BrokerSegment): VerificationCase[] {
  if (!segment) return verificationCases;
  const listingIds = new Set(getListingsForSegment(segment).map((listing) => listing.id));
  const buyerIds = new Set(getBuyersForSegment(segment).map((buyer) => buyer.id));
  return verificationCases.filter(
    (caseFile) => listingIds.has(caseFile.listingId) || buyerIds.has(caseFile.buyerId),
  );
}

export function getMatchResultsForSegment(segment?: BrokerSegment): MatchResult[] {
  if (!segment) return matchResults;
  const listingIds = new Set(getListingsForSegment(segment).map((listing) => listing.id));
  const buyerIds = new Set(getBuyersForSegment(segment).map((buyer) => buyer.id));
  return matchResults.filter(
    (match) => listingIds.has(match.listingId) && buyerIds.has(match.buyerId),
  );
}

export function getTasksForSegment(segment?: BrokerSegment): BrokerTask[] {
  if (!segment) return brokerTasks;
  const listingIds = new Set(getListingsForSegment(segment).map((listing) => listing.id));
  const buyerIds = new Set(getBuyersForSegment(segment).map((buyer) => buyer.id));
  const sellerIds = new Set(getSellersForSegment(segment).map((seller) => seller.id));

  return brokerTasks.filter((task) => {
    if (task.listingId) return listingIds.has(task.listingId);
    if (task.buyerId) return buyerIds.has(task.buyerId);
    if (task.sellerId) return sellerIds.has(task.sellerId);
    return false;
  });
}

export function getConversationsForSegment(segment?: BrokerSegment): Conversation[] {
  if (!segment) return conversations;
  const listingIds = new Set(getListingsForSegment(segment).map((listing) => listing.id));
  const buyerIds = new Set(getBuyersForSegment(segment).map((buyer) => buyer.id));
  const sellerIds = new Set(getSellersForSegment(segment).map((seller) => seller.id));

  return conversations.filter((conversation) => {
    if (conversation.listingId) return listingIds.has(conversation.listingId);
    if (conversation.buyerId) return buyerIds.has(conversation.buyerId);
    if (conversation.sellerId) return sellerIds.has(conversation.sellerId);
    return false;
  });
}

export function getFollowUpDraftsForSegment(segment?: BrokerSegment): FollowUpDraft[] {
  if (!segment) return followUpDrafts;
  const listingIds = new Set(getListingsForSegment(segment).map((listing) => listing.id));
  const buyerIds = new Set(getBuyersForSegment(segment).map((buyer) => buyer.id));
  const sellerIds = new Set(getSellersForSegment(segment).map((seller) => seller.id));

  return followUpDrafts.filter((draft) => {
    if (draft.listingId) return listingIds.has(draft.listingId);
    if (draft.buyerId) return buyerIds.has(draft.buyerId);
    if (draft.sellerId) return sellerIds.has(draft.sellerId);
    return false;
  });
}

export function getSellerReportInputsForSegment(segment?: BrokerSegment): SellerReportInput[] {
  if (!segment) return sellerReportInputs;
  const listingIds = new Set(getListingsForSegment(segment).map((listing) => listing.id));
  return sellerReportInputs.filter((input) => listingIds.has(input.listingId));
}

export function filterDealRoomForSegment(
  room: DealRoom,
  segment?: BrokerSegment,
  /* Extra ids that should survive the filter — broker-stored (Supabase)
     listings/documents aren't in the demo dataset, so callers working with
     real data pass their ids here to keep those rooms intact. */
  extra?: { listingIds?: ReadonlySet<string>; documentIds?: ReadonlySet<string> },
): DealRoom | undefined {
  if (!segment) return room;

  const listingIds = new Set(getListingsForSegment(segment).map((listing) => listing.id));
  const documentIds = new Set(
    getListingsForSegment(segment).flatMap((listing) =>
      listing.documents.map((document) => document.id),
    ),
  );
  extra?.listingIds?.forEach((id) => listingIds.add(id));
  extra?.documentIds?.forEach((id) => documentIds.add(id));
  const roomListingIds = room.listingIds.filter((listingId) => listingIds.has(listingId));

  if (roomListingIds.length === 0) return undefined;

  return {
    ...room,
    listingIds: roomListingIds,
    approvedDocumentIds: room.approvedDocumentIds.filter((documentId) =>
      documentIds.has(documentId),
    ),
  };
}

export function getDealRoomsForSegment(segment?: BrokerSegment): DealRoom[] {
  if (!segment) return dealRooms;
  return dealRooms
    .map((room) => filterDealRoomForSegment(room, segment))
    .filter((room): room is DealRoom => Boolean(room));
}

export function getAuditEventsForSegment(segment?: BrokerSegment): AuditEvent[] {
  if (!segment) return auditEvents;
  const needles = [
    ...getListingsForSegment(segment).flatMap((listing) => [listing.id, listing.name]),
    ...getBuyersForSegment(segment).flatMap((buyer) => [buyer.id, buyer.name]),
    ...getSellersForSegment(segment).flatMap((seller) => [seller.id, seller.name]),
    ...getDealRoomsForSegment(segment).flatMap((room) => [room.id, room.title]),
  ].map((value) => value.toLowerCase());

  return auditEvents.filter(
    (event) => needles.some((needle) => event.detail.toLowerCase().includes(needle)),
  );
}
