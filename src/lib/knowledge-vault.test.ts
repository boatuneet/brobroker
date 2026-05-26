import { describe, expect, test } from "vitest";
import { buildKnowledgeVault } from "./knowledge-vault";
import type { BuyerProfile, YachtListing } from "./types";

const storedYachtListing = {
  id: "stored-yacht-outside-segment",
  assetType: "Yacht",
  name: "Stored Yacht Outside Segment",
  builder: "Princess",
  model: "Y72",
  year: 2021,
  priceEur: 3_100_000,
  lengthFt: 72,
  cabins: 4,
  engines: "Twin MAN V12",
  engineHours: 580,
  location: "Palma",
  vatStatus: "EU VAT Paid",
  availability: "Immediate",
  status: "Active",
  ownerId: "stored-seller-yacht",
  exteriorTone: "White hull",
  interiorStyle: "Light oak",
  refitHistory: [],
  highlights: ["VAT paid"],
  weaknesses: [],
  idealBuyer: "Family buyer.",
  documents: [],
  comps: [],
  faqs: [],
  objections: [],
  missingInfo: [],
  ownerNotes: [],
  brokerOnlyNotes: [],
  marketSignals: [],
} satisfies YachtListing;

const storedCarBuyer = {
  id: "stored-car-buyer",
  assetTypes: ["Car"],
  name: "Stored Car Buyer",
  company: "Collector Office",
  country: "Germany",
  budgetMinEur: 200_000,
  budgetMaxEur: 500_000,
  sizeRangeFt: [0, 20_000],
  preferredBrands: ["Porsche"],
  preferredLocations: ["Germany"],
  lifestylePreferences: ["Low mileage"],
  mustHaves: ["Documented service"],
  dealBreakers: [],
  objections: [],
  rejectedAssets: [],
  urgency: "This Quarter",
  decisionTimeline: "This quarter",
  communicationStyle: "Email",
  relationshipNotes: [],
  currentStage: "Qualified",
  lastContactedAt: "2026-05-20",
  nextActionDueAt: "2026-05-26",
  verificationCaseId: "",
  tags: ["collector"],
} satisfies BuyerProfile;

describe("workspace knowledge vault", () => {
  test("compiles segment-specific pages with source lineage and open gaps", () => {
    const model = buildKnowledgeVault("Real Estate", {
      storedListings: [storedYachtListing],
      storedBuyers: [storedCarBuyer],
    });

    expect(model.pages.length).toBeGreaterThan(5);
    expect(model.pages.some((page) => page.title === "Port Hercules Penthouse")).toBe(true);
    expect(model.pages.some((page) => page.title === "Aurora 72")).toBe(false);
    expect(model.pages.some((page) => page.title === storedYachtListing.name)).toBe(false);
    expect(model.pages.some((page) => page.title === storedCarBuyer.name)).toBe(false);
    expect(model.healthChecks.find((check) => check.id === "source-coverage")?.count).toBeGreaterThan(0);
    expect(model.pages.find((page) => page.id === "open-gaps")?.openGaps.length).toBeGreaterThan(0);
  });

  test("ships an overview, source log, and category counts", () => {
    const model = buildKnowledgeVault("Yacht");

    expect(model.selectedPage.id).toBe("overview");
    expect(model.pages.find((page) => page.id === "source-log")?.sources.length).toBeGreaterThan(0);
    expect(model.categories.map((category) => category.label)).toContain("Listing");
    expect(model.metrics.map((metric) => metric.label)).toEqual([
      "Pages",
      "Sources",
      "Open gaps",
      "Lower confidence",
    ]);
  });
});
