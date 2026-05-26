import {
  type BrokerSegment,
  brokerSegments,
  normalizeBrokerSegment,
} from "@/lib/broker-segments";

export type ListingFieldKind =
  | "text"
  | "number"
  | "textarea"
  | "select"
  | "checkbox"
  | "multi"
  | "color"
  | "range"
  | "segmented"
  | "location";

export type ListingFieldOption = {
  label: string;
  value: string;
  swatch?: string;
};

export type ListingField = {
  id: string;
  label: string;
  kind: ListingFieldKind;
  placeholder?: string;
  fromPlaceholder?: string;
  toPlaceholder?: string;
  required?: boolean;
  options?: ListingFieldOption[];
  showWhen?: {
    fieldId: string;
    value: string | string[];
  };
};

export type ListingIntakeSection = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  fields: ListingField[];
};

export type ListingRangeValue = { from: string; to: string };
export type ListingDraftValue = string | boolean | string[] | ListingRangeValue;
export type ListingDraftValues = Record<string, ListingDraftValue>;

export type ListingIntakeConfig = {
  segment: BrokerSegment;
  title: string;
  description: string;
  sections: ListingIntakeSection[];
};

const carColors: ListingFieldOption[] = [
  { label: "Beige", value: "Beige", swatch: "#d6b16d" },
  { label: "Blue", value: "Blue", swatch: "#0b66b7" },
  { label: "Brown", value: "Brown", swatch: "#8a3f08" },
  { label: "Bronze", value: "Bronze", swatch: "#c68b4a" },
  { label: "Yellow", value: "Yellow", swatch: "#f4ca18" },
  { label: "Grey", value: "Grey", swatch: "#8f9092" },
  { label: "Green", value: "Green", swatch: "#2f9c24" },
  { label: "Red", value: "Red", swatch: "#e31b2f" },
  { label: "Black", value: "Black", swatch: "#0b0b0c" },
  { label: "Silver", value: "Silver", swatch: "#c7c8ca" },
  { label: "Violet", value: "Violet", swatch: "#9b168d" },
  { label: "White", value: "White", swatch: "#ffffff" },
  { label: "Orange", value: "Orange", swatch: "#f97316" },
  { label: "Gold", value: "Gold", swatch: "#e0bb42" },
];

const interiorColors: ListingFieldOption[] = [
  { label: "Beige", value: "Beige", swatch: "#d6b16d" },
  { label: "Black", value: "Black", swatch: "#0b0b0c" },
  { label: "Grey", value: "Grey", swatch: "#8f9092" },
  { label: "Brown", value: "Brown", swatch: "#8a3f08" },
  { label: "Other", value: "Other", swatch: "linear-gradient(135deg,#111 0 50%,#ddd 50% 100%)" },
  { label: "Blue", value: "Blue", swatch: "#0b66b7" },
  { label: "Red", value: "Red", swatch: "#e31b2f" },
  { label: "Green", value: "Green", swatch: "#2f9c24" },
  { label: "Yellow", value: "Yellow", swatch: "#f4ca18" },
  { label: "Orange", value: "Orange", swatch: "#f97316" },
  { label: "White", value: "White", swatch: "#ffffff" },
];

const realEstateObjectTypes: ListingFieldOption[] = [
  { label: "Apartments for sale", value: "apartments" },
  { label: "Houses for sale", value: "houses" },
  { label: "Commercial premises for sale", value: "commercial" },
];

const fitOutOptions = [
  "Finished",
  "Partially finished",
  "Unfurnished",
  "Unfinished construction",
  "Foundations",
  "Other",
].map((value) => ({ label: value, value }));

const buildingTypeOptions = [
  "Masonry",
  "Block",
  "Monolithic",
  "Wooden",
  "Frame",
  "Log",
  "Panel",
  "Other",
].map((value) => ({ label: value, value }));

const purposeOptions = [
  "Administrative",
  "Retail",
  "Hotel",
  "Services",
  "Storage",
  "Manufacturing and industrial",
  "Food service",
  "Medical",
  "Other",
].map((value) => ({ label: value, value }));

const houseTypeOptions = [
  "House",
  "Cottage",
  "Townhouse",
  "Part of house",
  "Homestead",
  "Other",
].map((value) => ({ label: value, value }));

const objectType = (value: string | string[]): ListingField["showWhen"] => ({
  fieldId: "objectType",
  value,
});

function getListingBrainSections(segment: BrokerSegment, startStep = 5): ListingIntakeSection[] {
  const assetLabel = getSegmentLabel(segment).toLowerCase();
  const documentPlaceholder =
    segment === "Car"
      ? "Title file\nService records\nApproved image set"
      : segment === "Real Estate"
        ? "Floor plan\nTitle extract\nApproved image set"
        : "Pre-listing survey\nVAT certificate\nService records";
  const missingPlaceholder =
    segment === "Car"
      ? "Seller-approved ownership disclosure\nPaint meter report"
      : segment === "Real Estate"
        ? "Service charge detail\nSeller-approved floor plan"
        : "Owner-approved drone video\nTender service invoice";

  return [
    {
      id: "brainReadiness",
      eyebrow: `Step ${String(startStep).padStart(2, "0")}`,
      title: "Listing brain readiness",
      description: `Documents, gaps, and buyer-safe highlights that will appear in the ${assetLabel} listing brain.`,
      fields: [
        {
          id: "approvedDocuments",
          label: "Approved / buyer-safe documents",
          kind: "textarea",
          placeholder: documentPlaceholder,
        },
        {
          id: "restrictedDocuments",
          label: "Restricted or internal documents",
          kind: "textarea",
          placeholder: "Seller motivation note\nInternal price floor\nPrivate ownership file",
        },
        {
          id: "missingInfo",
          label: "Missing facts or document gaps",
          kind: "textarea",
          placeholder: missingPlaceholder,
        },
        {
          id: "buyerSafeHighlights",
          label: "Buyer-safe highlights",
          kind: "textarea",
          placeholder:
            segment === "Car"
              ? "Single-owner history\nLow mileage\nCollector-grade specification"
              : segment === "Real Estate"
                ? "Private setting\nTurnkey interiors\nApproved viewing pack"
                : "EU VAT paid\nLight interior\nTurn-key Mediterranean setup",
        },
        {
          id: "marketSignals",
          label: "Market signals",
          kind: "textarea",
          placeholder:
            segment === "Car"
              ? "Comparable cars moving quickly below EUR 800k"
              : segment === "Real Estate"
                ? "UHNW buyers active on turnkey privacy-led homes"
                : "Flybridge inventory in Palma tightened after two May contracts",
        },
      ],
    },
    {
      id: "ownerContext",
      eyebrow: `Step ${String(startStep + 1).padStart(2, "0")}`,
      title: "Owner context",
      description: "Seller motivation, cadence, private notes, and reporting expectations for the Owner tab.",
      fields: [
        { id: "sellerName", label: "Owner / seller name", kind: "text", placeholder: "Vallon Marine Holdings" },
        {
          id: "sellerMotivation",
          label: "Seller motivation",
          kind: "textarea",
          placeholder: "Why the owner is selling, timing pressure, and what should stay private.",
        },
        {
          id: "communicationExpectation",
          label: "Communication expectation",
          kind: "textarea",
          placeholder: "Weekly concise update with lead quality, objections, and next actions.",
        },
        {
          id: "pricingSensitivity",
          label: "Pricing posture",
          kind: "textarea",
          placeholder: "Will defend asking price unless speed and certainty are obvious.",
        },
        {
          id: "reportingCadence",
          label: "Reporting cadence",
          kind: "text",
          placeholder: "Weekly Friday owner update",
        },
        {
          id: "nextOwnerUpdateDueAt",
          label: "Next owner update date",
          kind: "text",
          placeholder: "2026-06-01",
        },
        {
          id: "ownerNotes",
          label: "Owner notes",
          kind: "textarea",
          placeholder: "Seller prefers qualified family buyers over casual brochure requests.",
        },
        {
          id: "ownerBrokerOnlyNotes",
          label: "Broker-only owner notes",
          kind: "textarea",
          placeholder: "Do not disclose flexibility, price floor, or private identity.",
        },
      ],
    },
  ];
}

const carConfig: ListingIntakeConfig = {
  segment: "Car",
  title: "Add car listing",
  description:
    "Capture broker-grade vehicle details without turning the Listings screen into a giant form.",
  sections: [
    {
      id: "basic",
      eyebrow: "Step 01",
      title: "Basic specifications and location",
      description: "The fields brokers need first to identify, price, and place the vehicle.",
      fields: [
        { id: "make", label: "Make", kind: "text", placeholder: "Porsche", required: true },
        { id: "model", label: "Model", kind: "text", placeholder: "Cayenne", required: true },
        {
          id: "additionalProperties",
          label: "Additional properties",
          kind: "text",
          placeholder: "satnav, 4Matic, warranty, etc.",
        },
        {
          id: "bodyType",
          label: "Body type",
          kind: "select",
          options: ["All", "Coupe", "SUV", "Cabriolet", "Sedan", "Wagon"].map((value) => ({
            label: value,
            value,
          })),
        },
        {
          id: "fuelType",
          label: "Fuel type",
          kind: "select",
          options: ["All", "Petrol", "Diesel", "Hybrid", "Electric"].map((value) => ({
            label: value,
            value,
          })),
        },
        { id: "registrationFrom", label: "First registration from", kind: "number", placeholder: "2023" },
        { id: "priceEur", label: "Asking price EUR", kind: "number", placeholder: "139000" },
        { id: "country", label: "Country / market", kind: "text", placeholder: "Europe" },
        { id: "city", label: "City / zip code", kind: "location", placeholder: "Munich" },
        { id: "mileageKm", label: "Mileage (km)", kind: "number", placeholder: "6200" },
        { id: "powerKw", label: "Power (kW)", kind: "number", placeholder: "375" },
        {
          id: "gear",
          label: "Gear",
          kind: "select",
          options: ["All", "Automatic", "Manual", "PDK", "Single-speed"].map((value) => ({
            label: value,
            value,
          })),
        },
        {
          id: "doors",
          label: "Nr. of doors",
          kind: "select",
          options: ["All", "2/3", "4/5", "6/7"].map((value) => ({ label: value, value })),
        },
        {
          id: "seats",
          label: "Nr. of seats",
          kind: "select",
          options: ["From", "2", "4", "5", "7"].map((value) => ({ label: value, value })),
        },
        {
          id: "sellerType",
          label: "Seller",
          kind: "select",
          options: ["All", "Dealer", "Private", "Broker mandate"].map((value) => ({
            label: value,
            value,
          })),
        },
        {
          id: "vehicleType",
          label: "Vehicle type",
          kind: "multi",
          options: ["New", "Used", "Employee's car", "Antique / Classic", "Demonstration", "Pre-registered"].map(
            (value) => ({ label: value, value }),
          ),
        },
      ],
    },
    {
      id: "exterior",
      eyebrow: "Step 02",
      title: "Exterior",
      description: "Color and paintwork metadata from the kind of search filters brokers already use.",
      fields: [
        { id: "bodyColor", label: "Body color", kind: "color", options: carColors },
        { id: "metallic", label: "Metallic paintwork", kind: "checkbox" },
      ],
    },
    {
      id: "interior",
      eyebrow: "Step 03",
      title: "Interior color",
      description: "Interior color and material details that help buyers compare similar cars.",
      fields: [
        { id: "interiorColor", label: "Interior color", kind: "color", options: interiorColors },
        {
          id: "interiorMaterial",
          label: "Interior material",
          kind: "select",
          options: ["Leather", "Alcantara", "Fabric", "Carbon trim", "Wood trim", "Custom"].map((value) => ({
            label: value,
            value,
          })),
        },
        { id: "trimNotes", label: "Trim notes", kind: "textarea", placeholder: "Contrast stitching, carbon buckets, etc." },
      ],
    },
    {
      id: "brokerDetails",
      eyebrow: "Step 04",
      title: "Broker-grade details",
      description: "Disclosure, provenance, and private notes before the listing becomes buyer-safe.",
      fields: [
        { id: "vinVisibility", label: "VIN / visibility", kind: "text", placeholder: "Partial VIN only" },
        { id: "serviceHistory", label: "Service history", kind: "text", placeholder: "Full Porsche service file" },
        { id: "accidentHistory", label: "Accident history", kind: "text", placeholder: "Clean history / disclose repairs" },
        { id: "ownershipCount", label: "Ownership count", kind: "number", placeholder: "2" },
        { id: "vatStatus", label: "VAT status", kind: "select", options: ["EU VAT Paid", "Not Paid", "Unknown", "Commercial"].map((value) => ({ label: value, value })) },
        { id: "warrantyStatus", label: "Warranty status", kind: "text", placeholder: "Manufacturer warranty until..." },
        { id: "knownWeaknesses", label: "Known weaknesses", kind: "textarea", placeholder: "Stone chips, tire age, deferred service..." },
        { id: "idealBuyer", label: "Ideal buyer", kind: "textarea", placeholder: "Collector, family office, fast buyer..." },
        { id: "brokerOnlyNotes", label: "Broker-only notes", kind: "textarea", placeholder: "Private seller context and negotiation constraints." },
      ],
    },
    ...getListingBrainSections("Car"),
  ],
};

const yachtConfig: ListingIntakeConfig = {
  segment: "Yacht",
  title: "Add yacht listing",
  description: "Capture marine inventory with ownership, VAT, survey, and document readiness context.",
  sections: [
    {
      id: "basic",
      eyebrow: "Step 01",
      title: "Basic specifications",
      description: "Core yacht specs needed for buyer matching and listing intelligence.",
      fields: [
        { id: "builder", label: "Builder / shipyard", kind: "text", placeholder: "Princess", required: true },
        { id: "model", label: "Model", kind: "text", placeholder: "Y72", required: true },
        { id: "year", label: "Year", kind: "number", placeholder: "2021" },
        { id: "lengthFt", label: "Length overall (ft)", kind: "number", placeholder: "72" },
        { id: "cabins", label: "Cabins", kind: "number", placeholder: "4" },
        { id: "engines", label: "Engines", kind: "text", placeholder: "Twin MAN V12" },
        { id: "engineHours", label: "Engine hours", kind: "number", placeholder: "690" },
        { id: "vatStatus", label: "VAT status", kind: "select", options: ["EU VAT Paid", "Not Paid", "Unknown", "Commercial"].map((value) => ({ label: value, value })) },
        { id: "priceEur", label: "Asking price EUR", kind: "number", placeholder: "3450000" },
        { id: "location", label: "Location / marina", kind: "location", placeholder: "Palma" },
      ],
    },
    {
      id: "operations",
      eyebrow: "Step 02",
      title: "Condition and operations",
      description: "Operational details that shape broker confidence and buyer-safe sharing.",
      fields: [
        { id: "surveyStatus", label: "Survey status", kind: "text", placeholder: "Survey available / needs update" },
        { id: "refitHistory", label: "Refit history", kind: "textarea", placeholder: "Recent works, invoices, yard periods..." },
        { id: "knownWeaknesses", label: "Known weaknesses", kind: "textarea" },
        { id: "brokerOnlyNotes", label: "Broker-only notes", kind: "textarea" },
      ],
    },
    ...getListingBrainSections("Yacht", 3),
  ],
};

const realEstateConfig: ListingIntakeConfig = {
  segment: "Real Estate",
  title: "Add real estate listing",
  description: "Capture private property data with ownership, document, and viewing discretion context.",
  sections: [
    {
      id: "basic",
      eyebrow: "Step 01",
      title: "Object type and location",
      description: "Choose the real estate category once, then fill only the fields that apply.",
      fields: [
        { id: "objectType", label: "Object type", kind: "select", options: realEstateObjectTypes, required: true },
        { id: "municipality", label: "Municipality", kind: "text", placeholder: "Vilnius city" },
        { id: "address", label: "Address / private location label", kind: "location", placeholder: "Street, district, or private label" },
        { id: "name", label: "Listing name", kind: "text", placeholder: "Old Town apartment", required: true },
      ],
    },
    {
      id: "sizeAndPrice",
      eyebrow: "Step 02",
      title: "Size and price",
      description: "Exact listing facts for the seller mandate, not buyer search ranges.",
      fields: [
        { id: "areaSqm", label: "Area, m²", kind: "number", placeholder: "86" },
        { id: "priceEur", label: "Asking price, €", kind: "number", placeholder: "320000" },
        { id: "pricePerSqm", label: "Price per m²", kind: "number", placeholder: "3720" },
        { id: "plotAreaAres", label: "Plot area, ares", kind: "number", placeholder: "12", showWhen: objectType("houses") },
      ],
    },
    {
      id: "buildingDetails",
      eyebrow: "Step 03",
      title: "Building details",
      description: "Condition, room count, building structure, heating, and type-specific details.",
      fields: [
        { id: "floor", label: "Floor", kind: "number", placeholder: "3", showWhen: objectType(["apartments", "commercial"]) },
        {
          id: "rooms",
          label: "Rooms",
          kind: "segmented",
          options: ["1", "2", "3", "4", "5", "More"].map((value) => ({ label: value, value })),
          showWhen: objectType("apartments"),
        },
        {
          id: "floorCount",
          label: "Number of floors",
          kind: "segmented",
          options: ["1", "2", "More than 2"].map((value) => ({ label: value, value })),
          showWhen: objectType("houses"),
        },
        { id: "year", label: "Build / renovation year", kind: "number", placeholder: "2018", showWhen: objectType(["apartments", "houses"]) },
        { id: "houseType", label: "House type", kind: "select", options: houseTypeOptions, showWhen: objectType("houses") },
        { id: "fitOut", label: "Fit-out / condition", kind: "multi", options: fitOutOptions },
        { id: "heating", label: "Heating", kind: "text", placeholder: "Heating", showWhen: objectType(["apartments", "houses"]) },
        { id: "buildingType", label: "Building type", kind: "multi", options: buildingTypeOptions, showWhen: objectType(["apartments", "houses"]) },
        { id: "purpose", label: "Purpose", kind: "multi", options: purposeOptions, showWhen: objectType("commercial") },
      ],
    },
    {
      id: "brokerNotes",
      eyebrow: "Step 04",
      title: "Broker notes",
      description: "Private ownership, viewing, and qualification context for the listing brain.",
      fields: [
        { id: "ownershipStructure", label: "Ownership structure", kind: "text", placeholder: "Private owner, company, SPV..." },
        { id: "agencyMandate", label: "Agency mandate status", kind: "text", placeholder: "Exclusive, open, verbal..." },
        { id: "viewingPrivacy", label: "Viewing privacy requirements", kind: "textarea" },
        { id: "brokerOnlyNotes", label: "Broker-only notes", kind: "textarea" },
      ],
    },
    ...getListingBrainSections("Real Estate"),
  ],
};

export const listingIntakeConfigs = {
  Yacht: yachtConfig,
  Car: carConfig,
  "Real Estate": realEstateConfig,
} satisfies Record<BrokerSegment, ListingIntakeConfig>;

export function getListingIntakeConfig(segment?: string | null): ListingIntakeConfig {
  return listingIntakeConfigs[normalizeBrokerSegment(segment)];
}

export function getInitialDraftValues(segment: BrokerSegment): ListingDraftValues {
  const config = listingIntakeConfigs[segment];
  const values: ListingDraftValues = {};

  for (const section of config.sections) {
    for (const field of section.fields) {
      values[field.id] =
        field.kind === "multi"
          ? []
          : field.kind === "range"
            ? { from: "", to: "" }
            : field.kind === "checkbox"
              ? false
              : field.options?.[0]?.value ?? "";
    }
  }

  if (segment === "Car") {
    return {
      ...values,
      make: "Porsche",
      model: "Cayenne",
      registrationFrom: "2023",
      country: "Europe",
      sellerType: "All",
      doors: "All",
      bodyType: "All",
      fuelType: "All",
      gear: "All",
    };
  }

  if (segment === "Real Estate") {
    return {
      ...values,
      objectType: "apartments",
    };
  }

  return values;
}

export function getSegmentLabel(segment: BrokerSegment) {
  return brokerSegments.find((item) => item.id === segment)?.label ?? segment;
}

export function readText(values: ListingDraftValues, key: string): string {
  const value = values[key];
  return typeof value === "string" ? value.trim() : "";
}

export function readRange(values: ListingDraftValues, key: string): ListingRangeValue {
  const value = values[key];
  return typeof value === "object" &&
    !Array.isArray(value) &&
    value !== null &&
    "from" in value &&
    "to" in value
    ? value
    : { from: "", to: "" };
}

function readMulti(values: ListingDraftValues, key: string): string[] {
  const value = values[key];
  return Array.isArray(value) ? value : [];
}

export function readNumber(values: ListingDraftValues, key: string): number {
  const parsed = Number(readText(values, key).replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function generateDraftName(segment: BrokerSegment, values: ListingDraftValues): string {
  if (segment === "Car") {
    return [readText(values, "make"), readText(values, "model")].filter(Boolean).join(" ") || "Untitled car";
  }

  if (segment === "Real Estate") {
    const objectType = readText(values, "objectType") || "apartments";
    const label = realEstateObjectTypes.find((item) => item.value === objectType)?.label ?? "Real estate";
    return [readText(values, "name") || label, readText(values, "municipality")]
      .filter(Boolean)
      .join(" · ");
  }

  return [readText(values, "builder"), readText(values, "model")].filter(Boolean).join(" ") || "Untitled yacht";
}

export function generateSpecSummary(segment: BrokerSegment, values: ListingDraftValues): string {
  if (segment === "Car") {
    return [
      readText(values, "mileageKm") ? `${readText(values, "mileageKm")} km` : "",
      readText(values, "vatStatus"),
      readText(values, "city") || readText(values, "country"),
      readText(values, "registrationFrom"),
    ]
      .filter(Boolean)
      .join(" · ");
  }

  if (segment === "Real Estate") {
    const objectType = readText(values, "objectType");
    const area = readText(values, "areaSqm") ? `${readText(values, "areaSqm")} m²` : "";
    const plot = readText(values, "plotAreaAres") ? `${readText(values, "plotAreaAres")} ares` : "";

    if (objectType === "houses") {
      return [
        area,
        plot,
        readText(values, "floorCount") ? `${readText(values, "floorCount")} floors` : "",
        readText(values, "municipality"),
      ]
        .filter(Boolean)
        .join(" · ");
    }

    if (objectType === "commercial") {
      return [
        area,
        readMulti(values, "purpose")[0],
        readText(values, "floor") ? `floor ${readText(values, "floor")}` : "",
        readText(values, "municipality"),
      ]
        .filter(Boolean)
        .join(" · ");
    }

    return [
      area,
      readText(values, "rooms") ? `${readText(values, "rooms")} rooms` : "",
      readText(values, "floor") ? `floor ${readText(values, "floor")}` : "",
      readText(values, "municipality"),
    ]
      .filter(Boolean)
      .join(" · ");
  }

  return [
    readText(values, "lengthFt") ? `${readText(values, "lengthFt")}ft` : "",
    readText(values, "cabins") ? `${readText(values, "cabins")} cabins` : "",
    readText(values, "engineHours") ? `${readText(values, "engineHours")}h` : "",
    readText(values, "location"),
  ]
    .filter(Boolean)
    .join(" · ");
}
