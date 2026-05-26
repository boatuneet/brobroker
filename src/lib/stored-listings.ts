import type {
  AssetType,
  DocumentAsset,
  ListingComp,
  ListingCoordinates,
  ListingFaq,
  ListingFact,
  ListingObjection,
  ListingPhoto,
  ListingStatus,
  SellerProfile,
  VatStatus,
  YachtListing,
} from "@/lib/types";

export type StoredAssetRow = {
  id: string;
  asset_type: AssetType;
  name: string;
  builder: string;
  model: string;
  year: number | null;
  price_eur: number | string | null;
  metric_value: number | string | null;
  metric_label: string | null;
  location: string;
  vat_status: VatStatus | null;
  status: ListingStatus | null;
  seller_id: string | null;
  spec_summary: string | null;
  documents: unknown;
  comps: unknown;
  faqs: unknown;
  objections: unknown;
  missing_info: string[] | null;
  owner_notes: string[] | null;
  broker_only_notes: string[] | null;
  market_signals: string[] | null;
  payload: unknown;
  created_at: string;
  updated_at: string;
};

export type StoredListingPayload = {
  address?: string;
  locationLabel?: string;
  locationPrecision?: "Exact" | "Area" | "Private";
  coordinates?: ListingCoordinates;
  availability?: string;
  exteriorTone?: string;
  interiorStyle?: string;
  refitHistory?: string[];
  highlights?: string[];
  weaknesses?: string[];
  idealBuyer?: string;
  coreFacts?: ListingFact[];
  photos?: ListingPhoto[];
  ownerProfile?: SellerProfile;
  fields?: Record<string, unknown>;
};

export function mapStoredAssetToListing(
  row: StoredAssetRow,
  photoUrls: Record<string, string> = {},
): YachtListing {
  const payload = asRecord(row.payload) as StoredListingPayload;
  const fields = asRecord(payload.fields);
  const assetType = row.asset_type;
  const metricValue = readNumber(row.metric_value);
  const photos = normalizePhotos(payload.photos, photoUrls, assetType);

  return {
    id: row.id,
    assetType,
    name: row.name,
    builder: row.builder,
    model: row.model,
    year: row.year ?? readNumber(fields.year) ?? new Date().getFullYear(),
    priceEur: readNumber(row.price_eur) ?? 0,
    lengthFt:
      metricValue ??
      readNumber(fields.lengthFt) ??
      readNumber(fields.areaSqm) ??
      readNumber(fields.mileageKm) ??
      0,
    cabins:
      readNumber(fields.cabins) ??
      readNumber(fields.rooms) ??
      readNumber(fields.bedrooms) ??
      0,
    engines:
      readString(fields.engines) ||
      readString(fields.powertrain) ||
      readString(fields.engine) ||
      readString(fields.condition) ||
      "To confirm",
    engineHours: readNumber(fields.engineHours) ?? readNumber(fields.mileageKm) ?? 0,
    location: row.location,
    address: payload.address,
    locationLabel: payload.locationLabel,
    locationPrecision: payload.locationPrecision,
    coordinates: payload.coordinates,
    vatStatus: row.vat_status ?? "Unknown",
    availability: payload.availability ?? readString(fields.availability) ?? "To confirm",
    status: row.status ?? "Draft",
    ownerId: row.seller_id ?? `seller-${row.id}`,
    exteriorTone: payload.exteriorTone ?? readString(fields.exteriorTone) ?? "To confirm",
    interiorStyle: payload.interiorStyle ?? readString(fields.interiorStyle) ?? "To confirm",
    refitHistory: payload.refitHistory ?? [],
    highlights: payload.highlights ?? buildFallbackHighlights(row, payload),
    weaknesses: payload.weaknesses ?? row.missing_info ?? [],
    idealBuyer:
      payload.idealBuyer ??
      readString(fields.idealBuyer) ??
      "Qualified buyer to confirm after broker review.",
    documents: asArray<DocumentAsset>(row.documents),
    comps: asArray<ListingComp>(row.comps),
    faqs: asArray<ListingFaq>(row.faqs),
    objections: asArray<ListingObjection>(row.objections),
    missingInfo: row.missing_info ?? [],
    ownerNotes: row.owner_notes ?? [],
    brokerOnlyNotes: row.broker_only_notes ?? [],
    marketSignals: row.market_signals ?? [],
    coreFacts: payload.coreFacts,
    photos,
    specSummary: row.spec_summary ?? undefined,
    ownerProfile: payload.ownerProfile,
  };
}

function buildFallbackHighlights(row: StoredAssetRow, payload: StoredListingPayload) {
  const facts = payload.coreFacts?.map((fact) => fact.value).filter(Boolean) ?? [];
  return [row.location, row.spec_summary, ...facts].filter(Boolean).slice(0, 3) as string[];
}

function normalizePhotos(
  photos: ListingPhoto[] | undefined,
  photoUrls: Record<string, string>,
  assetType: AssetType,
) {
  const fallback =
    assetType === "Car"
      ? "/segments/broker-cars.png"
      : assetType === "Real Estate"
        ? "/segments/broker-real-estate.png"
        : "/segments/broker-yachts.png";

  if (!photos?.length) return [{ id: "fallback-segment-image", src: fallback, alt: `${assetType} listing` }];

  return photos.map((photo) => ({
    ...photo,
    src: photo.storagePath ? photoUrls[photo.storagePath] ?? photo.src : photo.src,
  }));
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const number = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? number : undefined;
}
