import { type BrokerSegment, getListingAssetType } from "./broker-segments";
import {
  generateDraftName,
  generateSpecSummary,
  getInitialDraftValues,
  readNumber,
  readText,
  type ListingDraftValues,
} from "./listing-intake-config";
import type { ListingFact, ListingPhoto, VatStatus, YachtListing } from "./types";

export type EditableListingPayload = {
  id: string;
  segment: BrokerSegment;
  name: string;
  builder: string;
  model: string;
  year: number | null;
  priceEur: number;
  metricValue: number | null;
  metricLabel: string;
  location: string;
  vatStatus: VatStatus;
  specSummary: string;
  coreFacts: ListingFact[];
  fields: ListingDraftValues;
  photos?: ListingPhoto[];
};

export function getEditableValuesFromListing(listing: YachtListing): ListingDraftValues {
  const segment = getListingAssetType(listing);
  const fields = {
    ...getInitialDraftValues(segment),
    ...listingToCommonFields(listing),
  };

  if (segment === "Car") {
    return {
      ...fields,
      make: listing.builder,
      model: listing.model,
      registrationFrom: String(listing.year || ""),
      priceEur: String(listing.priceEur || ""),
      country: listing.location,
      city: listing.location,
      mileageKm: listing.lengthFt ? String(listing.lengthFt) : "",
      powerKw: readCoreFact(listing, "Power").replace(/\s*kW$/i, ""),
      gear: readCoreFact(listing, "Gear") || "All",
      bodyType: readCoreFact(listing, "Body type") || "All",
      fuelType: readCoreFact(listing, "Fuel type") || "All",
    };
  }

  if (segment === "Real Estate") {
    return {
      ...fields,
      objectType: listing.model || "apartments",
      name: listing.name,
      municipality: listing.location,
      address: listing.address ?? listing.location,
      areaSqm: listing.lengthFt ? String(listing.lengthFt) : "",
      rooms: listing.cabins ? String(listing.cabins) : "",
      priceEur: String(listing.priceEur || ""),
      fitOut: listing.exteriorTone ? [listing.exteriorTone] : [],
    };
  }

  return {
    ...fields,
    builder: listing.builder,
    model: listing.model,
    year: String(listing.year || ""),
    lengthFt: listing.lengthFt ? String(listing.lengthFt) : "",
    cabins: listing.cabins ? String(listing.cabins) : "",
    engines: listing.engines,
    engineHours: listing.engineHours ? String(listing.engineHours) : "",
    propulsion: readCoreFact(listing, "Propulsion"),
    condition: readCoreFact(listing, "Condition") || listing.exteriorTone,
    vatStatus: listing.vatStatus,
    priceEur: String(listing.priceEur || ""),
    location: listing.location,
  };
}

export function buildEditableListingPayload(
  id: string,
  segment: BrokerSegment,
  values: ListingDraftValues,
): EditableListingPayload {
  const name = generateDraftName(segment, values);
  const specSummary = generateSpecSummary(segment, values);
  const priceEur = readNumber(values, "priceEur");

  if (segment === "Car") {
    const builder = readText(values, "make") || "Car";
    const model = readText(values, "model") || "Model to confirm";
    const location = readText(values, "city") || readText(values, "country") || "Location to confirm";
    return {
      id,
      segment,
      name,
      builder,
      model,
      year: readNumber(values, "registrationFrom") || null,
      priceEur,
      metricValue: readNumber(values, "mileageKm") || null,
      metricLabel: "km",
      location,
      vatStatus: normalizeVatStatus(readText(values, "vatStatus")),
      specSummary,
      coreFacts: compactFacts([
        ["Make", builder],
        ["Model", model],
        ["Mileage", readText(values, "mileageKm") ? `${readText(values, "mileageKm")} km` : ""],
        ["Power", readText(values, "powerKw") ? `${readText(values, "powerKw")} kW` : ""],
        ["Location", location],
      ]),
      fields: values,
    };
  }

  if (segment === "Real Estate") {
    const model = readText(values, "objectType") || "apartments";
    const location = readText(values, "municipality") || readText(values, "address") || "Private location";
    return {
      id,
      segment,
      name,
      builder: "Private property",
      model,
      year: readNumber(values, "year") || null,
      priceEur,
      metricValue: readNumber(values, "areaSqm") || null,
      metricLabel: "sqm",
      location,
      vatStatus: "Unknown",
      specSummary,
      coreFacts: compactFacts([
        ["Object type", model],
        ["Area", readText(values, "areaSqm") ? `${readText(values, "areaSqm")} sqm` : ""],
        ["Rooms", readText(values, "rooms")],
        ["Location", location],
      ]),
      fields: values,
    };
  }

  const builder = readText(values, "builder") || "Yacht";
  const model = readText(values, "model") || "Model to confirm";
  const location = readText(values, "location") || "Location to confirm";
  return {
    id,
    segment,
    name,
    builder,
    model,
    year: readNumber(values, "year") || null,
    priceEur,
    metricValue: readNumber(values, "lengthFt") || null,
    metricLabel: "ft",
    location,
    vatStatus: normalizeVatStatus(readText(values, "vatStatus")),
    specSummary,
    coreFacts: compactFacts([
      ["Builder", builder],
      ["Model", model],
      ["Year", readText(values, "year")],
      ["Length", readText(values, "lengthFt") ? `${readText(values, "lengthFt")} ft` : ""],
      ["Cabins", readText(values, "cabins")],
      ["Engines", readText(values, "engines")],
      ["Propulsion", readText(values, "propulsion")],
      ["Condition", readText(values, "condition")],
      ["Location", location],
    ]),
    fields: values,
  };
}

function listingToCommonFields(listing: YachtListing): ListingDraftValues {
  return {
    priceEur: String(listing.priceEur || ""),
    vatStatus: listing.vatStatus,
    knownWeaknesses: listing.weaknesses.join("\n"),
    buyerSafeHighlights: listing.highlights.join("\n"),
    idealBuyer: listing.idealBuyer,
    brokerOnlyNotes: listing.brokerOnlyNotes.join("\n"),
    marketSignals: listing.marketSignals.join("\n"),
    missingInfo: listing.missingInfo.join("\n"),
    ownerNotes: listing.ownerNotes.join("\n"),
  };
}

function readCoreFact(listing: YachtListing, label: string) {
  return listing.coreFacts?.find((fact) => fact.label.toLowerCase() === label.toLowerCase())?.value ?? "";
}

function normalizeVatStatus(value: string): VatStatus {
  if (value === "EU VAT Paid" || value === "Not Paid" || value === "Commercial") return value;
  return "Unknown";
}

function compactFacts(facts: Array<[string, string | number | null]>): ListingFact[] {
  return facts
    .map(([label, value]) => ({ label, value: String(value ?? "").trim() }))
    .filter((fact) => fact.value && fact.value !== "0");
}
