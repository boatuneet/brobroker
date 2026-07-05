import { type BrokerSegment } from "@/lib/broker-segments";
import type { BuyerProfile, BuyerSource, RejectedAsset } from "@/lib/types";

export type StoredBuyerRow = {
  id: string;
  name: string;
  company: string | null;
  country: string | null;
  budget_min_eur: number | string | null;
  budget_max_eur: number | string | null;
  stage: string | null;
  urgency: string | null;
  verification_case_id: string | null;
  next_action_due_at: string | null;
  tags: string[] | null;
  preferences: unknown;
  rejected_assets: unknown;
  relationship_notes: string[] | null;
  payload: unknown;
  source: string | null;
  created_at: string;
  updated_at: string;
};

type StoredBuyerPreferences = {
  assetTypes?: BrokerSegment[];
  sizeRangeFt?: [number, number];
  metricLabel?: string;
  metricTitle?: string;
  preferredBrands?: string[];
  preferredLocations?: string[];
  lifestylePreferences?: string[];
  mustHaves?: string[];
  dealBreakers?: string[];
  objections?: string[];
  decisionTimeline?: string;
  communicationStyle?: string;
  lastContactedAt?: string;
  email?: string;
  phone?: string;
};

export function mapStoredBuyerToProfile(row: StoredBuyerRow): BuyerProfile {
  const preferences = asRecord(row.preferences) as StoredBuyerPreferences;
  const assetTypes = normalizeAssetTypes(preferences.assetTypes);
  const createdDate = row.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10);

  return {
    id: row.id,
    assetTypes,
    name: row.name,
    company: row.company ?? undefined,
    country: row.country ?? "International",
    email: typeof preferences.email === "string" && preferences.email.trim() ? preferences.email.trim() : undefined,
    phone: typeof preferences.phone === "string" && preferences.phone.trim() ? preferences.phone.trim() : undefined,
    budgetMinEur: readNumber(row.budget_min_eur),
    budgetMaxEur: readNumber(row.budget_max_eur),
    sizeRangeFt: normalizeRange(preferences.sizeRangeFt),
    preferredBrands: normalizeStringArray(preferences.preferredBrands),
    preferredLocations: normalizeStringArray(preferences.preferredLocations),
    lifestylePreferences: normalizeStringArray(preferences.lifestylePreferences),
    mustHaves: normalizeStringArray(preferences.mustHaves),
    dealBreakers: normalizeStringArray(preferences.dealBreakers),
    objections: normalizeStringArray(preferences.objections),
    rejectedAssets: normalizeRejectedAssets(row.rejected_assets),
    urgency: normalizeUrgency(row.urgency),
    decisionTimeline: preferences.decisionTimeline || "Timeline to confirm with buyer.",
    communicationStyle: preferences.communicationStyle || "Broker to confirm preferred cadence.",
    relationshipNotes: row.relationship_notes?.length
      ? row.relationship_notes
      : ["Captured from buyer intake; enrich after the next call."],
    currentStage: normalizeStage(row.stage),
    lastContactedAt: preferences.lastContactedAt || createdDate,
    nextActionDueAt: row.next_action_due_at ?? createdDate,
    verificationCaseId: row.verification_case_id ?? "",
    tags: row.tags ?? [],
    source: normalizeSource(row.source),
  };
}

const VALID_SOURCES: ReadonlyArray<BuyerSource> = [
  "referral",
  "website",
  "voice_note",
  "marketplace",
  "email",
  "social",
  "other",
];

export function normalizeSource(value: unknown): BuyerSource | undefined {
  if (typeof value !== "string") return undefined;
  return (VALID_SOURCES as ReadonlyArray<string>).includes(value)
    ? (value as BuyerSource)
    : undefined;
}

export function getStoredBuyerSegment(row: StoredBuyerRow): BrokerSegment | undefined {
  const preferences = asRecord(row.preferences) as StoredBuyerPreferences;
  return normalizeAssetTypes(preferences.assetTypes)[0];
}

function normalizeAssetTypes(value: unknown): BrokerSegment[] {
  const values = Array.isArray(value) ? value : [];
  const valid = values.filter(
    (item): item is BrokerSegment =>
      item === "Yacht" || item === "Car" || item === "Real Estate",
  );
  return valid.length ? valid : ["Yacht"];
}

function normalizeRange(value: unknown): [number, number] {
  if (!Array.isArray(value)) return [0, 0];
  const from = readNumber(value[0]);
  const to = readNumber(value[1]);
  if (!from && !to) return [0, 0];
  if (!to) return [from, from];
  if (!from) return [to, to];
  return from <= to ? [from, to] : [to, from];
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : [];
}

function normalizeRejectedAssets(value: unknown): RejectedAsset[] {
  return Array.isArray(value)
    ? value.filter(isRejectedAsset)
    : [];
}

function isRejectedAsset(value: unknown): value is RejectedAsset {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as RejectedAsset;
  return typeof candidate.listingId === "string" && typeof candidate.reason === "string";
}

function normalizeUrgency(value: unknown): BuyerProfile["urgency"] {
  if (value === "Immediate" || value === "This Quarter" || value === "This Season" || value === "Exploratory") {
    return value;
  }
  return "This Season";
}

function normalizeStage(value: unknown): BuyerProfile["currentStage"] {
  if (
    value === "Qualified" ||
    value === "Shortlist Sent" ||
    value === "Viewing Planned" ||
    value === "Negotiation" ||
    value === "Closed Won" ||
    value === "Closed Lost"
  ) {
    return value;
  }
  return "New Inquiry";
}

function readNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const number = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

