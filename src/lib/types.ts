export type VerificationStatus = "Verified" | "Needs Review" | "High Risk";

export type Priority = "Critical" | "High" | "Medium" | "Low";

export type TaskStatus = "Open" | "In Progress" | "Waiting" | "Done";

export type VatStatus = "EU VAT Paid" | "Not Paid" | "Unknown" | "Commercial";

export type ListingStatus = "Draft" | "Active" | "Pre-Market" | "Under Offer" | "Coming Soon";

export type DocumentStatus = "Approved" | "Missing" | "Internal" | "Restricted";

export type DraftStatus = "Draft" | "Edited" | "Approved";

export type DealRoomStatus = "Draft" | "Active" | "Paused";

export type AssetType = "Yacht" | "Car" | "Real Estate";

export type FollowUpDraftKind =
  | "Inquiry Reply"
  | "Post-Call Follow-Up"
  | "Viewing Recap"
  | "Negotiation Update";

export interface DocumentAsset {
  id: string;
  title: string;
  category: "Survey" | "Title" | "VAT" | "Maintenance" | "Media" | "Specs" | "Finance";
  status: DocumentStatus;
  updatedAt: string;
}

export interface ListingComp {
  name: string;
  priceEur: number;
  note: string;
}

export interface ListingFaq {
  question: string;
  answer: string;
  source: string;
}

export interface ListingObjection {
  buyerId?: string;
  label: string;
  detail: string;
  raisedAt: string;
}

export interface ListingCoordinates {
  lat: number;
  lng: number;
}

export interface ListingPhoto {
  id: string;
  src: string;
  alt: string;
  name?: string;
  storagePath?: string;
}

export interface ListingFact {
  label: string;
  value: string;
}

export interface YachtListing {
  id: string;
  assetType?: AssetType;
  name: string;
  builder: string;
  model: string;
  year: number;
  priceEur: number;
  lengthFt: number;
  cabins: number;
  engines: string;
  engineHours: number;
  location: string;
  address?: string;
  locationLabel?: string;
  locationPrecision?: "Exact" | "Area" | "Private";
  coordinates?: ListingCoordinates;
  vatStatus: VatStatus;
  availability: string;
  status: ListingStatus;
  ownerId: string;
  exteriorTone: string;
  interiorStyle: string;
  refitHistory: string[];
  highlights: string[];
  weaknesses: string[];
  idealBuyer: string;
  documents: DocumentAsset[];
  comps: ListingComp[];
  faqs: ListingFaq[];
  objections: ListingObjection[];
  missingInfo: string[];
  ownerNotes: string[];
  brokerOnlyNotes: string[];
  marketSignals: string[];
  coreFacts?: ListingFact[];
  photos?: ListingPhoto[];
  specSummary?: string;
  imagePrompt?: string;
  ownerProfile?: SellerProfile;
}

export interface RejectedAsset {
  listingId: string;
  reason: string;
  rejectedAt: string;
}

export interface BuyerProfile {
  id: string;
  assetTypes?: AssetType[];
  name: string;
  company?: string;
  country: string;
  budgetMinEur: number;
  budgetMaxEur: number;
  sizeRangeFt: [number, number];
  preferredBrands: string[];
  preferredLocations: string[];
  lifestylePreferences: string[];
  mustHaves: string[];
  dealBreakers: string[];
  objections: string[];
  rejectedAssets: RejectedAsset[];
  urgency: "Immediate" | "This Quarter" | "This Season" | "Exploratory";
  decisionTimeline: string;
  communicationStyle: string;
  relationshipNotes: string[];
  currentStage: "New Inquiry" | "Qualified" | "Shortlist Sent" | "Viewing Planned" | "Negotiation";
  lastContactedAt: string;
  nextActionDueAt: string;
  verificationCaseId: string;
  tags: string[];
  /* Where the lead came from. Optional so existing rows / demo data don't
     need to be backfilled. The Deal-source donut groups undefined values
     into "Other / unknown". */
  source?: BuyerSource;
}

export type BuyerSource =
  | "referral"
  | "website"
  | "voice_note"
  | "marketplace"
  | "email"
  | "social"
  | "other";

export const BUYER_SOURCES: ReadonlyArray<{ value: BuyerSource; label: string }> = [
  { value: "referral", label: "Referral" },
  { value: "website", label: "Website" },
  { value: "voice_note", label: "Voice note" },
  { value: "marketplace", label: "Marketplace" },
  { value: "email", label: "Email" },
  { value: "social", label: "Social" },
  { value: "other", label: "Other" },
];

export interface SellerProfile {
  id: string;
  name: string;
  assetIds: string[];
  motivation: string;
  communicationExpectation: string;
  pricingSensitivity: string;
  feedbackHistory: string[];
  reportingCadence: string;
  nextOwnerUpdateDueAt: string;
}

export interface Conversation {
  id: string;
  buyerId?: string;
  sellerId?: string;
  listingId?: string;
  channel: "Call" | "Email" | "WhatsApp" | "SMS" | "Viewing" | "Sea Trial";
  summary: string;
  sentiment: "Positive" | "Neutral" | "Concerned";
  occurredAt: string;
  needsSummary: boolean;
}

export interface BrokerTask {
  id: string;
  title: string;
  kind:
    | "Follow-Up"
    | "Owner Update"
    | "Verification"
    | "Document"
    | "Matching"
    | "Viewing"
    | "CRM";
  priority: Priority;
  status: TaskStatus;
  dueAt: string;
  reason: string;
  actionLabel: string;
  buyerId?: string;
  sellerId?: string;
  listingId?: string;
}

export interface VerificationSignal {
  label: string;
  state: "Pass" | "Review" | "Fail";
  detail: string;
}

export interface VerificationCase {
  id: string;
  buyerId: string;
  listingId: string;
  requestedAccess: string;
  status: VerificationStatus;
  score: number;
  recommendedAction: string;
  signals: VerificationSignal[];
  updatedAt: string;
}

export interface MatchResult {
  id: string;
  buyerId: string;
  listingId: string;
  category: "Exact Match" | "Close Match" | "Smart Substitute";
  fitScore: number;
  rationale: string;
  criteriaMet: string[];
  missingCriteria: string[];
  talkingPoints: string[];
  /* Per-factor points that sum toward the fit score — powers the "why this
     score?" tooltip. Optional: only the deterministic matcher populates it. */
  scoreBreakdown?: { label: string; points: number; met: boolean }[];
}

export interface FollowUpDraft {
  id: string;
  buyerId?: string;
  sellerId?: string;
  listingId?: string;
  kind?: FollowUpDraftKind;
  channel: "Email" | "WhatsApp" | "SMS" | "Call Summary";
  status: DraftStatus;
  subject: string;
  body: string;
  createdAt: string;
}

export interface SellerReportInput {
  id: string;
  sellerId: string;
  listingId: string;
  period: string;
  inquiries: number;
  qualifiedLeads: number;
  viewings: number;
  commonObjections: string[];
  marketMovement: string[];
  nextWeekPlan: string[];
}

export interface DealRoom {
  id: string;
  buyerId: string;
  title: string;
  status: DealRoomStatus;
  verificationStatus: VerificationStatus;
  brokerApprovalStatus: "Not Requested" | "Pending" | "Approved";
  listingIds: string[];
  itinerary: string[];
  approvedDocumentIds: string[];
  lastUpdatedAt: string;
}

export interface AuditEvent {
  id: string;
  actor: "System" | "Broker";
  label: string;
  detail: string;
  occurredAt: string;
}

export interface ParsedClientBrief {
  budgetMaxEur?: number;
  model?: string;
  minYear?: number;
  cabins?: number;
  interiorStyle?: string;
  vatStatus?: VatStatus;
  sizeRangeFt?: [number, number];
  preferredLocations?: string[];
  availability?: string;
  mustHaves?: string[];
  dealBreakers?: string[];
  urgency?: string;
  raw: string;
}

export interface ExtractedCallSummary {
  buyerName: string;
  preferences: string[];
  tasks: string[];
  urgency: string;
  linkedListingIds: string[];
  pipelineUpdate: string;
}
