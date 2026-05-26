import { describe, expect, test } from "vitest";
import {
  buyers,
  dealRooms,
  verificationCases,
  yachtListings,
} from "./demo-data";
import {
  answerScopedDealRoomQuestion,
  generateBuyerSafeBrief,
  generateClientBriefShortlist,
  generateMatchesForBuyer,
  generateVoiceToCrmDrafts,
  parseClientBrief,
  scoreVerification,
} from "./services";
import type { BuyerProfile, VerificationCase, YachtListing } from "./types";

const sampleListing = (): YachtListing => ({
  id: "listing-test-alba",
  name: "Alba",
  builder: "Princess",
  model: "F55",
  year: 2020,
  priceEur: 1_375_000,
  lengthFt: 55,
  cabins: 3,
  engines: "Twin Volvo D13",
  engineHours: 620,
  location: "Palma, Mallorca",
  vatStatus: "EU VAT Paid",
  availability: "Immediate",
  status: "Active",
  ownerId: "seller-test",
  exteriorTone: "White hull",
  interiorStyle: "Modern light oak",
  refitHistory: ["2024 upholstery refresh"],
  highlights: ["EU VAT paid", "Light modern interior", "Low engine hours"],
  weaknesses: ["No stabilizers"],
  idealBuyer: "Family buyer wanting a turnkey 55ft flybridge before summer.",
  documents: [
    { id: "doc-survey", title: "Survey", category: "Survey", status: "Approved", updatedAt: "2026-05-18" },
    { id: "doc-vat", title: "VAT certificate", category: "VAT", status: "Approved", updatedAt: "2026-05-15" },
  ],
  comps: [],
  faqs: [],
  objections: [],
  missingInfo: [],
  ownerNotes: [],
  brokerOnlyNotes: [],
  marketSignals: [],
});

const sampleBuyer = (): BuyerProfile => ({
  id: "buyer-test-daniel",
  name: "Daniel Ross",
  company: "Ross Family Office",
  country: "United Kingdom",
  budgetMinEur: 1_100_000,
  budgetMaxEur: 1_500_000,
  sizeRangeFt: [50, 60],
  preferredBrands: ["Princess", "Ferretti"],
  preferredLocations: ["Mallorca", "France"],
  lifestylePreferences: ["Light interior", "Family use"],
  mustHaves: ["EU VAT paid", "3 cabins"],
  dealBreakers: ["Heavy refit"],
  objections: [],
  rejectedAssets: [],
  urgency: "This Season",
  decisionTimeline: "Wants to close before summer.",
  communicationStyle: "Prefers WhatsApp updates.",
  relationshipNotes: [],
  currentStage: "Qualified",
  lastContactedAt: "2026-05-20",
  nextActionDueAt: "2026-05-25",
  verificationCaseId: "verif-test",
  tags: ["family"],
});

const verifiedCase = (): VerificationCase => ({
  id: "verif-test-verified",
  buyerId: "buyer-test-daniel",
  listingId: "listing-test-alba",
  requestedAccess: "Approved photo set",
  status: "Verified",
  score: 90,
  recommendedAction: "Proceed with broker-approved access.",
  signals: [
    { label: "Identity", state: "Pass", detail: "Identity confirmed." },
    { label: "Company", state: "Pass", detail: "Buying entity recorded." },
    { label: "Contact consistency", state: "Pass", detail: "Contact stable." },
    { label: "Proof-of-funds readiness", state: "Pass", detail: "Readiness recorded." },
    { label: "AML-style signals", state: "Pass", detail: "Clean." },
  ],
  updatedAt: "2026-05-22",
});

const highRiskCase = (): VerificationCase => ({
  id: "verif-test-high-risk",
  buyerId: "buyer-test-daniel",
  listingId: "listing-test-alba",
  requestedAccess: "Restricted documents",
  status: "High Risk",
  score: 20,
  recommendedAction: "Hold access and escalate with an audit trail.",
  signals: [
    { label: "Identity", state: "Review", detail: "ID needs refresh." },
    { label: "AML-style signals", state: "Fail", detail: "Adverse-media flag." },
  ],
  updatedAt: "2026-05-22",
});

describe("client brief parsing and matching", () => {
  test("extracts structured yacht criteria from a natural brief", () => {
    const parsed = parseClientBrief(
      "Princess F55, 2018+, light interior, 3 cabins, EU VAT paid, under EUR1.4M",
    );

    expect(parsed).toMatchObject({
      model: "Princess F55",
      minYear: 2018,
      cabins: 3,
      interiorStyle: "Light interior",
      vatStatus: "EU VAT Paid",
      budgetMaxEur: 1_400_000,
    });
    expect(parsed.mustHaves).toContain("EU VAT paid");
  });

  test("returns a populated shortlist against seeded inventory", () => {
    const shortlist = generateClientBriefShortlist(
      "Princess F55, 2018+, light interior, 3 cabins, EU VAT paid, under EUR1.4M",
    );

    expect(yachtListings.length).toBeGreaterThanOrEqual(10);
    expect(shortlist.matches.length).toBeGreaterThan(0);
    expect(shortlist.outreachMessage).toContain(shortlist.matches[0].listing.name);
  });
});

describe("verification scoring", () => {
  test("classifies strong and risky inquiry cases deterministically", () => {
    expect(scoreVerification(verifiedCase()).status).toBe("Verified");
    expect(scoreVerification(highRiskCase()).status).toBe("High Risk");
  });
});

describe("buyer matching", () => {
  test("ranks an inventory listing against a buyer", () => {
    const matches = generateMatchesForBuyer(sampleBuyer(), [sampleListing()]);

    expect(matches).toHaveLength(1);
    expect(matches[0].fitScore).toBeGreaterThanOrEqual(80);
    expect(matches[0].criteriaMet).toContain("Inside budget");
  });
});

describe("buyer-safe content and drafting", () => {
  test("filters broker-only context from buyer-safe brief output", () => {
    const buyer = sampleBuyer();
    const brief = generateBuyerSafeBrief(buyer, generateMatchesForBuyer(buyer, [sampleListing()]));
    const buyerVisibleContent = JSON.stringify({ body: brief.body, approvedFacts: brief.approvedFacts });

    expect(buyerVisibleContent).not.toContain("risk score");
    expect(buyerVisibleContent).not.toContain("seller motivation");
    expect(brief.removedInternalFields).toContain("broker-only seller notes");
  });

  test("generates deterministic follow-up drafts for voice-to-CRM output", () => {
    const buyer = sampleBuyer();
    const drafts = generateVoiceToCrmDrafts(buyer, {
      buyerName: buyer.name,
      preferences: ["55 to 60 foot", "Modern light interior", "EU VAT paid"],
      tasks: ["Send ranked shortlist"],
      urgency: "High",
      linkedListingIds: ["listing-test-alba"],
      pipelineUpdate: "Qualified buyer.",
    });

    expect(drafts.map((draft) => draft.kind)).toEqual([
      "Inquiry Reply",
      "Post-Call Follow-Up",
      "Viewing Recap",
      "Negotiation Update",
    ]);
    expect(drafts.every((draft) => draft.status === "Draft")).toBe(true);
  });
});

describe("validation demo data", () => {
  test("ships with realistic seeded broker data", () => {
    expect(buyers).toHaveLength(6);
    expect(yachtListings).toHaveLength(10);
    expect(verificationCases.length).toBeGreaterThanOrEqual(4);
    expect(dealRooms.length).toBeGreaterThanOrEqual(3);
  });

  test("deal-room scoped Q&A degrades gracefully without rooms", () => {
    const fallback = answerScopedDealRoomQuestion("room-unknown", "How many cabins?");

    expect(fallback.restricted).toBe(true);
    expect(fallback.followUpTask).toContain("Confirm missing deal-room context");
  });
});
