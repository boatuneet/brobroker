import {
  type BrokerSegment,
  brokerSegments,
} from "@/lib/broker-segments";
import type { BuyerProfile, BuyerSource } from "@/lib/types";

export type BuyerFieldKind = "text" | "number" | "date" | "textarea" | "select" | "range";

export type BuyerFieldOption = {
  label: string;
  value: string;
};

export type BuyerRangeValue = {
  from: string;
  to: string;
};

export type BuyerDraftValue = string | BuyerRangeValue;
export type BuyerDraftValues = Record<string, BuyerDraftValue>;

export type BuyerField = {
  id: string;
  label: string;
  kind: BuyerFieldKind;
  placeholder?: string;
  fromPlaceholder?: string;
  toPlaceholder?: string;
  helper?: string;
  required?: boolean;
  options?: BuyerFieldOption[];
  wide?: boolean;
};

export type BuyerIntakeSection = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  fields: BuyerField[];
};

export type BuyerIntakeConfig = {
  segment: BrokerSegment;
  title: string;
  description: string;
  metricLabel: string;
  metricTitle: string;
  sections: BuyerIntakeSection[];
};

const urgencyOptions: BuyerFieldOption[] = [
  { label: "Immediate", value: "Immediate" },
  { label: "This Quarter", value: "This Quarter" },
  { label: "This Season", value: "This Season" },
  { label: "Exploratory", value: "Exploratory" },
];

const stageOptions: BuyerFieldOption[] = [
  { label: "New Inquiry", value: "New Inquiry" },
  { label: "Qualified", value: "Qualified" },
  { label: "Shortlist Sent", value: "Shortlist Sent" },
  { label: "Viewing Planned", value: "Viewing Planned" },
  { label: "Negotiation", value: "Negotiation" },
  { label: "Closed Won", value: "Closed Won" },
  { label: "Closed Lost", value: "Closed Lost" },
];

/* Lead-source options shown in intake. Stored in `buyers.source` and used
   by the dashboard's "Deal sources" donut. Keep value strings in sync with
   the BuyerSource union in lib/types.ts and the CHECK constraint in the
   Supabase migration (brobroker-analytics-2026-06.sql). */
const sourceOptions: BuyerFieldOption[] = [
  { label: "—", value: "" },
  { label: "Referral", value: "referral" },
  { label: "Website", value: "website" },
  { label: "Voice note", value: "voice_note" },
  { label: "Marketplace", value: "marketplace" },
  { label: "Email", value: "email" },
  { label: "Social", value: "social" },
  { label: "Other", value: "other" },
];

const commonIdentityFields: BuyerField[] = [
  { id: "name", label: "Buyer name", kind: "text", placeholder: "Helena Rossi", required: true },
  { id: "company", label: "Company / entity", kind: "text", placeholder: "Family office, holding company..." },
  { id: "country", label: "Country", kind: "text", placeholder: "Italy", required: true },
  { id: "stage", label: "Stage", kind: "select", options: stageOptions, required: true },
  { id: "urgency", label: "Urgency", kind: "select", options: urgencyOptions, required: true },
  { id: "source", label: "Lead source", kind: "select", options: sourceOptions, helper: "Where this buyer came from. Used in the dashboard's deal-source donut." },
  { id: "nextActionDueAt", label: "Next action due", kind: "date", required: true },
];

const commonRelationshipFields: BuyerField[] = [
  {
    id: "decisionTimeline",
    label: "Decision timeline",
    kind: "text",
    placeholder: "Ready to move before summer if the right fit appears",
    wide: true,
  },
  {
    id: "communicationStyle",
    label: "Communication style",
    kind: "text",
    placeholder: "Principal gets short summary; assistant gets detailed pack",
    wide: true,
  },
  {
    id: "relationshipNotes",
    label: "Relationship notes",
    kind: "textarea",
    placeholder: "Spouse cares about natural light. Asked not to repeat dark interiors.",
    helper: "One note per line is easiest to scan later.",
    wide: true,
  },
  {
    id: "objections",
    label: "Known objections",
    kind: "textarea",
    placeholder: "Worried about transfer time, service history, title structure...",
    helper: "Separate objections with commas or line breaks.",
    wide: true,
  },
];

const configs: Record<BrokerSegment, BuyerIntakeConfig> = {
  Yacht: {
    segment: "Yacht",
    title: "Add yacht buyer",
    description: "Capture budget, size, locations, VAT needs, usage style, and relationship memory.",
    metricLabel: "ft",
    metricTitle: "Size range",
    sections: [
      {
        id: "identity",
        eyebrow: "Step 01",
        title: "Buyer identity and urgency",
        description: "The core memory that anchors cards, next actions, and verification readiness.",
        fields: commonIdentityFields,
      },
      {
        id: "criteria",
        eyebrow: "Step 02",
        title: "Yacht search criteria",
        description: "Translate a call or inquiry into searchable yacht preferences.",
        fields: [
          {
            id: "budgetRange",
            label: "Budget range EUR",
            kind: "range",
            fromPlaceholder: "1200000",
            toPlaceholder: "3800000",
            required: true,
          },
          {
            id: "metricRange",
            label: "Size range (ft)",
            kind: "range",
            fromPlaceholder: "52",
            toPlaceholder: "75",
            required: true,
          },
          {
            id: "preferredBrands",
            label: "Preferred builders",
            kind: "text",
            placeholder: "Princess, Sunseeker, Ferretti",
            helper: "Comma-separated.",
          },
          {
            id: "preferredLocations",
            label: "Preferred locations",
            kind: "text",
            placeholder: "Mallorca, Monaco, South of France",
            helper: "Comma-separated.",
          },
          {
            id: "lifestylePreferences",
            label: "Remembered preferences",
            kind: "textarea",
            placeholder: "Light interior, family use, turnkey Mediterranean access",
            wide: true,
          },
          {
            id: "mustHaves",
            label: "Must-haves",
            kind: "textarea",
            placeholder: "EU VAT paid, 3 cabins, stabilizers",
            wide: true,
          },
          {
            id: "dealBreakers",
            label: "Deal breakers",
            kind: "textarea",
            placeholder: "Dark interior, unclear title, high engine hours",
            wide: true,
          },
        ],
      },
      {
        id: "relationship",
        eyebrow: "Step 03",
        title: "Relationship and follow-up memory",
        description: "Keep the human context close to the criteria so future outreach sounds remembered.",
        fields: commonRelationshipFields,
      },
    ],
  },
  Car: {
    segment: "Car",
    title: "Add car buyer",
    description: "Capture collector preferences, provenance needs, budget, and follow-up cadence.",
    metricLabel: "km",
    metricTitle: "Mileage target",
    sections: [
      {
        id: "identity",
        eyebrow: "Step 01",
        title: "Buyer identity and urgency",
        description: "The core memory that anchors cards, next actions, and verification readiness.",
        fields: commonIdentityFields,
      },
      {
        id: "criteria",
        eyebrow: "Step 02",
        title: "Collector car criteria",
        description: "Focus on marque, configuration, mileage, provenance, and principal preferences.",
        fields: [
          {
            id: "budgetRange",
            label: "Budget range EUR",
            kind: "range",
            fromPlaceholder: "180000",
            toPlaceholder: "750000",
            required: true,
          },
          {
            id: "metricRange",
            label: "Mileage range (km)",
            kind: "range",
            fromPlaceholder: "0",
            toPlaceholder: "12000",
            required: true,
          },
          {
            id: "preferredBrands",
            label: "Preferred marques",
            kind: "text",
            placeholder: "Ferrari, Porsche, Range Rover",
            helper: "Comma-separated.",
          },
          {
            id: "preferredLocations",
            label: "Preferred markets",
            kind: "text",
            placeholder: "Germany, Monaco, Switzerland",
            helper: "Comma-separated.",
          },
          {
            id: "lifestylePreferences",
            label: "Remembered preferences",
            kind: "textarea",
            placeholder: "Low mileage, rare spec, principal-safe delivery, discreet color",
            wide: true,
          },
          {
            id: "mustHaves",
            label: "Must-haves",
            kind: "textarea",
            placeholder: "Full service history, no track history, VAT paid",
            wide: true,
          },
          {
            id: "dealBreakers",
            label: "Deal breakers",
            kind: "textarea",
            placeholder: "Repainted panels, missing books, public auction history",
            wide: true,
          },
        ],
      },
      {
        id: "relationship",
        eyebrow: "Step 03",
        title: "Relationship and follow-up memory",
        description: "Record who receives what, and which concerns should not be repeated.",
        fields: commonRelationshipFields,
      },
    ],
  },
  "Real Estate": {
    segment: "Real Estate",
    title: "Add real estate buyer",
    description: "Capture budget, area, privacy constraints, viewing needs, and owner-safe follow-up memory.",
    metricLabel: "sqm",
    metricTitle: "Area range",
    sections: [
      {
        id: "identity",
        eyebrow: "Step 01",
        title: "Buyer identity and urgency",
        description: "The core memory that anchors cards, next actions, and verification readiness.",
        fields: commonIdentityFields,
      },
      {
        id: "criteria",
        eyebrow: "Step 02",
        title: "Property search criteria",
        description: "Capture the private-market requirements that separate qualified buyers from casual interest.",
        fields: [
          {
            id: "budgetRange",
            label: "Budget range EUR",
            kind: "range",
            fromPlaceholder: "3000000",
            toPlaceholder: "18000000",
            required: true,
          },
          {
            id: "metricRange",
            label: "Area range (sqm)",
            kind: "range",
            fromPlaceholder: "180",
            toPlaceholder: "540",
            required: true,
          },
          {
            id: "preferredBrands",
            label: "Preferred property types",
            kind: "text",
            placeholder: "Penthouse, villa, estate",
            helper: "Comma-separated.",
          },
          {
            id: "preferredLocations",
            label: "Preferred districts",
            kind: "text",
            placeholder: "Monaco, Gordes, Dubai",
            helper: "Comma-separated.",
          },
          {
            id: "lifestylePreferences",
            label: "Remembered preferences",
            kind: "textarea",
            placeholder: "Privacy, guest capacity, turnkey interiors, harbor view",
            wide: true,
          },
          {
            id: "mustHaves",
            label: "Must-haves",
            kind: "textarea",
            placeholder: "Private viewing route, parking, title clarity, staff area",
            wide: true,
          },
          {
            id: "dealBreakers",
            label: "Deal breakers",
            kind: "textarea",
            placeholder: "Noisy frontage, unclear service charges, public listing exposure",
            wide: true,
          },
        ],
      },
      {
        id: "relationship",
        eyebrow: "Step 03",
        title: "Relationship and follow-up memory",
        description: "Capture who is involved and which sensitivities matter before arranging viewings.",
        fields: commonRelationshipFields,
      },
    ],
  },
};

export function getBuyerIntakeConfig(segment: BrokerSegment) {
  return configs[segment];
}

export function getInitialBuyerDraftValues(segment: BrokerSegment): BuyerDraftValues {
  const values: BuyerDraftValues = {};

  for (const section of configs[segment].sections) {
    for (const field of section.fields) {
      values[field.id] =
        field.kind === "range"
          ? { from: "", to: "" }
          : field.options?.[0]?.value ?? "";
    }
  }

  const today = new Date();
  const due = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
  const dueDate = due.toISOString().slice(0, 10);

  if (segment === "Car") {
    return {
      ...values,
      name: "New car buyer",
      country: "Europe",
      budgetRange: { from: "180000", to: "750000" },
      metricRange: { from: "0", to: "12000" },
      preferredBrands: "Porsche, Ferrari",
      preferredLocations: "Germany, Monaco",
      urgency: "This Quarter",
      stage: "New Inquiry",
      nextActionDueAt: dueDate,
    };
  }

  if (segment === "Real Estate") {
    return {
      ...values,
      name: "New property buyer",
      country: "International",
      budgetRange: { from: "3000000", to: "12000000" },
      metricRange: { from: "180", to: "540" },
      preferredBrands: "Villa, penthouse",
      preferredLocations: "Monaco, Gordes",
      urgency: "This Season",
      stage: "New Inquiry",
      nextActionDueAt: dueDate,
    };
  }

  return {
    ...values,
    name: "New yacht buyer",
    country: "Europe",
    budgetRange: { from: "1200000", to: "3800000" },
    metricRange: { from: "52", to: "75" },
    preferredBrands: "Princess, Sunseeker",
    preferredLocations: "Mallorca, Monaco",
    urgency: "This Season",
    stage: "New Inquiry",
    nextActionDueAt: dueDate,
  };
}

// Map a saved buyer back into the draft-values shape used by the intake form
// so the same component can power both "new" and "edit" flows.
export function getBuyerDraftValuesFromProfile(
  segment: BrokerSegment,
  buyer: BuyerProfile,
): BuyerDraftValues {
  const base = getInitialBuyerDraftValues(segment);
  return {
    ...base,
    name: buyer.name,
    company: buyer.company ?? "",
    country: buyer.country,
    stage: buyer.currentStage,
    urgency: buyer.urgency,
    nextActionDueAt: buyer.nextActionDueAt,
    budgetRange: {
      from: buyer.budgetMinEur ? String(buyer.budgetMinEur) : "",
      to: buyer.budgetMaxEur ? String(buyer.budgetMaxEur) : "",
    },
    metricRange: {
      from: buyer.sizeRangeFt?.[0] ? String(buyer.sizeRangeFt[0]) : "",
      to: buyer.sizeRangeFt?.[1] ? String(buyer.sizeRangeFt[1]) : "",
    },
    preferredBrands: buyer.preferredBrands.join(", "),
    preferredLocations: buyer.preferredLocations.join(", "),
    lifestylePreferences: buyer.lifestylePreferences.join("\n"),
    mustHaves: buyer.mustHaves.join("\n"),
    dealBreakers: buyer.dealBreakers.join("\n"),
    objections: buyer.objections.join("\n"),
    // Strip the default placeholders so editing an un-filled buyer starts
    // with empty fields instead of treating placeholders as real data.
    decisionTimeline:
      buyer.decisionTimeline === "Timeline to confirm with buyer."
        ? ""
        : buyer.decisionTimeline,
    communicationStyle:
      buyer.communicationStyle === "Broker to confirm preferred cadence."
        ? ""
        : buyer.communicationStyle,
    relationshipNotes: buyer.relationshipNotes.join("\n"),
    source: buyer.source ?? "",
  };
}

export function getSegmentLabel(segment: BrokerSegment) {
  return brokerSegments.find((item) => item.id === segment)?.label ?? segment;
}

export function readText(values: BuyerDraftValues, key: string): string {
  const value = values[key];
  return typeof value === "string" ? value.trim() : "";
}

export function readRange(values: BuyerDraftValues, key: string): BuyerRangeValue {
  const value = values[key];
  return typeof value === "object" &&
    value !== null &&
    "from" in value &&
    "to" in value
    ? value
    : { from: "", to: "" };
}

export function readRangeNumbers(values: BuyerDraftValues, key: string): [number, number] {
  const range = readRange(values, key);
  const from = parseNumber(range.from);
  const to = parseNumber(range.to);
  if (!from && !to) return [0, 0];
  if (!to) return [from, from];
  if (!from) return [to, to];
  return from <= to ? [from, to] : [to, from];
}

export function readList(values: BuyerDraftValues, key: string): string[] {
  return splitList(readText(values, key));
}

export function splitList(value: string) {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseNumber(value: string | number | undefined | null): number {
  if (value === undefined || value === null || value === "") return 0;
  const number = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

export function normalizeBuyerStage(value: string): BuyerProfile["currentStage"] {
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

export function normalizeBuyerUrgency(value: string): BuyerProfile["urgency"] {
  if (value === "Immediate" || value === "This Quarter" || value === "Exploratory") {
    return value;
  }
  return "This Season";
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

export function normalizeBuyerSource(value: string): BuyerSource | undefined {
  if (!value) return undefined;
  return (VALID_SOURCES as ReadonlyArray<string>).includes(value)
    ? (value as BuyerSource)
    : undefined;
}

export function generateBuyerSummary(segment: BrokerSegment, values: BuyerDraftValues) {
  const [budgetMin, budgetMax] = readRangeNumbers(values, "budgetRange");
  const [metricMin, metricMax] = readRangeNumbers(values, "metricRange");
  const config = getBuyerIntakeConfig(segment);
  const locations = readList(values, "preferredLocations").slice(0, 2).join(", ");
  const budget = budgetMax
    ? `EUR ${budgetMin.toLocaleString("en-GB")} - ${budgetMax.toLocaleString("en-GB")}`
    : "budget to confirm";
  const metric = metricMax
    ? `${metricMin}-${metricMax} ${config.metricLabel}`
    : `${config.metricTitle.toLowerCase()} to confirm`;

  return [budget, metric, locations].filter(Boolean).join(" · ");
}

