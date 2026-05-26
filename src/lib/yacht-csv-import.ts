import type { ListingFact, ListingPhoto, VatStatus } from "@/lib/types";

export type YachtCsvRow = {
  id?: string;
  title?: string;
  manufacturer?: string;
  model?: string;
  propulsion?: string;
  start_of_production?: string;
  country?: string;
  condition?: string;
  hulls?: string;
  price?: string;
  currency?: string;
  description?: string;
  source_url?: string;
  slug?: string;
  scraped_sections?: string;
  created_at?: string;
  approved_at?: string;
};

export type YachtImageCsvRow = {
  id?: string;
  yacht_id?: string;
  image_url?: string;
  storage_path?: string;
  position?: string;
  created_at?: string;
};

export type NormalizedYachtImport = {
  sourceId: string;
  assetId: string;
  name: string;
  builder: string;
  model: string;
  year: number | null;
  priceEur: number;
  originalPrice: number;
  originalCurrency: string;
  lengthFt: number | null;
  cabins: number | null;
  engines: string;
  engineHours: number | null;
  propulsion: string;
  condition: string;
  location: string;
  vatStatus: VatStatus;
  specSummary: string;
  coreFacts: ListingFact[];
  fields: Record<string, unknown>;
  importSource: {
    csvId: string;
    sourceUrl?: string;
    slug?: string;
    importedFrom: "new_yachts_rows.csv";
  };
};

export const YACHT_CSV_REQUIRED_HEADERS = [
  "id",
  "manufacturer",
  "model",
  "propulsion",
  "start_of_production",
  "country",
  "condition",
  "price",
  "currency",
  "description",
  "source_url",
  "slug",
  "scraped_sections",
];

export const YACHT_IMAGE_CSV_REQUIRED_HEADERS = [
  "id",
  "yacht_id",
  "image_url",
  "storage_path",
  "position",
];

export function normalizeYachtImport(row: YachtCsvRow): NormalizedYachtImport | null {
  const sourceId = clean(row.id);
  if (!sourceId) return null;

  const scraped = parseScrapedSections(row.scraped_sections);
  const description = asRecord(scraped.description);
  const capacities = asRecord(scraped.capacities);
  const engines = asRecord(scraped.engines);
  const dimensions = asRecord(scraped.dimensions);
  const additionalDetails = asRecord(scraped.additionalDetails);
  const primaryInformation = asRecord(scraped.primaryInformation);
  const title = clean(description.title) || clean(row.title);
  const builder = clean(row.manufacturer) || clean(primaryInformation.manufacturer) || "Unknown builder";
  const model = clean(row.model) || clean(primaryInformation.model) || "Model to confirm";
  const year = readInteger(row.start_of_production) ?? readInteger(primaryInformation.year);
  const name = title || [year, builder, model].filter(Boolean).join(" ") || `${builder} ${model}`;
  const originalPrice = readNumber(row.price) ?? readNumber(primaryInformation.price) ?? 0;
  const originalCurrency = clean(row.currency) || clean(primaryInformation.currency) || "EUR";
  const priceEur = convertToEur(originalPrice, originalCurrency);
  const lengthFt = extractLengthFt(dimensions);
  const cabins = readInteger(capacities.cabins);
  const engineHours = readInteger(engines.engine_hours) ?? readInteger(additionalDetails["Engine Hours"]);
  const engineSummary =
    clean(engines.engine_configuration) ||
    clean(engines.engine_make) ||
    clean(engines.engine_model) ||
    clean(engines.engine_power) ||
    clean(engines.total_horsepower) ||
    "To confirm";
  const propulsion = normalizePropulsion(clean(row.propulsion) || clean(primaryInformation.propulsion));
  const condition = normalizeCondition(
    clean(row.condition) || clean(primaryInformation.condition) || clean(additionalDetails.condition),
  );
  const location = clean(description.location) || clean(row.country) || "Location to confirm";
  const vatStatus = inferVatStatus(primaryInformation.vat_status);
  const specSummary = buildSpecSummary({ lengthFt, cabins, propulsion, condition, engineHours, location });
  const fields = {
    builder,
    model,
    year: year ? String(year) : "",
    lengthFt: lengthFt ? String(Math.round(lengthFt * 10) / 10) : "",
    cabins: cabins ? String(cabins) : "",
    engines: engineSummary,
    propulsion,
    condition,
    engineHours: engineHours ? String(engineHours) : "",
    vatStatus,
    priceEur: priceEur ? String(priceEur) : "",
    location,
    description: clean(row.description),
    originalCurrency,
    originalPrice,
    sourceUrl: clean(row.source_url),
    slug: clean(row.slug),
    scrapedSections: scraped,
  };
  const coreFacts = buildCoreFacts({ builder, model, year, lengthFt, cabins, engineSummary, propulsion, condition, location });

  return {
    sourceId,
    assetId: `imported-yacht-${sourceId}`,
    name,
    builder,
    model,
    year,
    priceEur,
    originalPrice,
    originalCurrency,
    lengthFt,
    cabins,
    engines: engineSummary,
    engineHours,
    propulsion,
    condition,
    location,
    vatStatus,
    specSummary,
    coreFacts,
    fields,
    importSource: {
      csvId: sourceId,
      sourceUrl: clean(row.source_url),
      slug: clean(row.slug),
      importedFrom: "new_yachts_rows.csv",
    },
  };
}

export function normalizeYachtImageRows(rows: YachtImageCsvRow[]) {
  const grouped = new Map<string, YachtImageCsvRow[]>();

  for (const row of rows) {
    const yachtId = clean(row.yacht_id);
    const imageUrl = clean(row.image_url);
    if (!yachtId || !imageUrl) continue;
    grouped.set(yachtId, [...(grouped.get(yachtId) ?? []), row]);
  }

  for (const [yachtId, images] of grouped) {
    grouped.set(
      yachtId,
      images.sort((a, b) => (readInteger(a.position) ?? 0) - (readInteger(b.position) ?? 0)),
    );
  }

  return grouped;
}

export function buildImportedPhoto(row: YachtImageCsvRow, src: string, storagePath?: string): ListingPhoto {
  const position = readInteger(row.position);
  return {
    id: `imported-photo-${clean(row.id) || crypto.randomUUID()}`,
    src,
    alt: `Imported yacht photo${position ? ` ${position}` : ""}`,
    name: storagePath?.split("/").pop() ?? clean(row.storage_path)?.split("/").pop() ?? undefined,
    storagePath,
  };
}

export function validateHeaders(headers: string[], required: string[]) {
  const available = new Set(headers.map((header) => header.trim()));
  return required.filter((header) => !available.has(header));
}

export function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function readInteger(value: unknown): number | null {
  const number = readNumber(value);
  return number === null ? null : Math.round(number);
}

export function readNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = clean(value);
  if (!text) return null;
  const number = Number(text.replace(/,/g, "").match(/-?\d+(\.\d+)?/)?.[0]);
  return Number.isFinite(number) ? number : null;
}

function parseScrapedSections(value: unknown): Record<string, unknown> {
  try {
    const parsed = JSON.parse(clean(value) || "{}");
    return asRecord(parsed);
  } catch {
    return {};
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function convertToEur(price: number, currency: string) {
  const normalized = currency.toUpperCase();
  const rate =
    normalized === "USD"
      ? 0.92
      : normalized === "GBP"
        ? 1.17
        : normalized === "CHF"
          ? 1.03
          : 1;

  return Math.round(price * rate);
}

function extractLengthFt(dimensions: Record<string, unknown>) {
  const candidates = [
    dimensions.length_overall,
    dimensions.overall_length,
    dimensions.Length,
    dimensions.length,
    dimensions["Length Overall"],
  ];

  for (const candidate of candidates) {
    const value = clean(candidate);
    const number = readNumber(value);
    if (!number) continue;
    return /\bm\b|meter|metre/i.test(value) ? number * 3.28084 : number;
  }

  return null;
}

function normalizePropulsion(value: string) {
  if (!value) return "";
  const normalized = value.toLowerCase();
  if (normalized.includes("hybrid")) return "Hybrid";
  if (normalized.includes("electric")) return "Electric";
  if (normalized.includes("sail")) return "Sail";
  if (normalized.includes("diesel")) return normalized.includes("twin") ? "Twin diesel" : "Diesel";
  if (normalized.includes("motor")) return "Motor";
  return value;
}

function normalizeCondition(value: string) {
  if (!value) return "";
  const normalized = value.toLowerCase();
  if (normalized.includes("brand new") || normalized === "new") return "New";
  if (normalized.includes("used")) return "Used";
  if (normalized.includes("refit")) return "Refit";
  if (normalized.includes("project")) return "Project / needs work";
  return value;
}

function inferVatStatus(value: unknown): VatStatus {
  const normalized = clean(value).toLowerCase();
  if (!normalized) return "Unknown";
  if (normalized.includes("paid")) return "EU VAT Paid";
  if (normalized.includes("excl") || normalized.includes("not")) return "Not Paid";
  if (normalized.includes("commercial")) return "Commercial";
  return "Unknown";
}

function buildSpecSummary({
  lengthFt,
  cabins,
  propulsion,
  condition,
  engineHours,
  location,
}: {
  lengthFt: number | null;
  cabins: number | null;
  propulsion: string;
  condition: string;
  engineHours: number | null;
  location: string;
}) {
  return [
    lengthFt ? `${Math.round(lengthFt)}ft` : "",
    cabins ? `${cabins} cabins` : "",
    propulsion,
    condition,
    engineHours ? `${engineHours}h` : "",
    location,
  ]
    .filter(Boolean)
    .join(" · ");
}

function buildCoreFacts({
  builder,
  model,
  year,
  lengthFt,
  cabins,
  engineSummary,
  propulsion,
  condition,
  location,
}: {
  builder: string;
  model: string;
  year: number | null;
  lengthFt: number | null;
  cabins: number | null;
  engineSummary: string;
  propulsion: string;
  condition: string;
  location: string;
}) {
  const facts: ListingFact[] = [];
  const add = (label: string, value?: string | number | null) => {
    const normalized = String(value ?? "").trim();
    if (normalized && normalized !== "0") facts.push({ label, value: normalized });
  };

  add("Builder", builder);
  add("Model", model);
  add("Year", year);
  add("Length", lengthFt ? `${Math.round(lengthFt * 10) / 10} ft` : "");
  add("Cabins", cabins);
  add("Engines", engineSummary);
  add("Propulsion", propulsion);
  add("Condition", condition);
  add("Location", location);

  return facts;
}
