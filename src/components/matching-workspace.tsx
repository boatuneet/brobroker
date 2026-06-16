"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Check,
  CheckCircle2,
  CircleAlert,
  Info,
  Lightbulb,
  MessageSquareText,
  Search,
  Ship,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import {
  type BrokerSegment,
  getBuyersForSegment,
  getListingsForSegment,
} from "@/lib/broker-segments";
import {
  mirrorWorkflowEvent,
  readPersisted,
  saveSessionBuyer,
  writePersisted,
} from "@/lib/browser-persistence";
import { readRerankConfig } from "@/lib/rerank-config";
import {
  generateBuyerShortlist,
  generateClientBriefShortlist,
  generateMatchesForBuyer,
} from "@/lib/services";
import {
  loadAllRequirementSets,
  mergeRequirementSet,
  type RequirementSet,
} from "@/lib/buyer-requirement-sets";
import type { BuyerProfile, YachtListing } from "@/lib/types";
import { cn, formatCurrency, percentage } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardHeaderIcon,
  EmptyState,
  PageHeader,
  ProgressBar,
} from "./ui";
import { SelectMenu } from "./select-menu";

const exampleBriefs: Record<BrokerSegment, string> = {
  Yacht:
    "Princess F55, 2018+, light interior, 3 cabins, EU VAT paid, under EUR 1.4M. Prefer Mallorca or France, ready before summer, no dark dated interior.",
  Car:
    "Ferrari or Porsche, VAT-paid EU car, low mileage, clean service history, under EUR 750k. Prefer Germany or Switzerland, no accident history or missing provenance.",
  "Real Estate":
    "Private villa or penthouse, EUR 5M to EUR 10M, 4+ bedrooms, strong privacy, turnkey interiors. Prefer France, Monaco, or Dubai with approved viewing documents.",
};

const SAVED_BRIEFS_KEY = "brobroker:matching:saved-briefs";

type CaptureMode = "buyer" | "listing";
type AiMatch = { listingId: string; fitScore: number; reason: string };
type AiBuyer = { buyerId: string; fitScore: number; reason: string };

type PersistedBrief = {
  id: string;
  raw: string;
  topListing?: string;
  matchCount: number;
  createdAt: string;
};

function mergeListings(primary: YachtListing[], fallback: YachtListing[]) {
  const seen = new Set<string>();
  return [...primary, ...fallback].filter((listing) => {
    if (seen.has(listing.id)) return false;
    seen.add(listing.id);
    return true;
  });
}

function mergeBuyers(primary: BuyerProfile[], fallback: BuyerProfile[]) {
  const seen = new Set<string>();
  return [...primary, ...fallback].filter((buyer) => {
    if (seen.has(buyer.id)) return false;
    seen.add(buyer.id);
    return true;
  });
}

function categoryTone(category: string): "success" | "info" | "warning" {
  if (category === "Exact Match") return "success";
  if (category === "Close Match") return "info";
  return "warning";
}

export function MatchingWorkspace({
  includeDemo = true,
  segment = "Yacht",
  storedBuyers = [],
  storedListings = [],
}: {
  includeDemo?: boolean;
  segment?: BrokerSegment;
  storedBuyers?: BuyerProfile[];
  storedListings?: YachtListing[];
}) {
  const listings = mergeListings(storedListings, includeDemo ? getListingsForSegment(segment) : []);
  const buyers = mergeBuyers(storedBuyers, includeDemo ? getBuyersForSegment(segment) : []);
  const exampleBrief = exampleBriefs[segment];

  const [mode, setMode] = useState<CaptureMode>("buyer");
  const [brief, setBrief] = useState("");
  const [parsedBrief, setParsedBrief] = useState("");
  const [sourceBuyerId, setSourceBuyerId] = useState("");
  const [briefSetId, setBriefSetId] = useState("primary");
  // When a shortlist is generated from a saved buyer (structured ask), this
  // records which buyer + requirement set so the new weighted engine runs.
  const [parsedBuyer, setParsedBuyer] = useState<{ buyerId: string; setId: string } | null>(null);
  const [opportunityListingId, setOpportunityListingId] = useState(listings[0]?.id ?? "");
  const [listingDrawerOpen, setListingDrawerOpen] = useState(false);
  const [listingSearch, setListingSearch] = useState("");
  const [savedBriefs, setSavedBriefs] = useState<PersistedBrief[]>([]);

  // AI re-rank (parity with the Buyers screen) — runs the shortlist candidates
  // through the matching agent + the broker's rerank config.
  const [aiMatches, setAiMatches] = useState<AiMatch[] | null>(null);
  const [aiMode, setAiMode] = useState<"ai" | "deterministic" | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // AI re-rank for the listing → buyers direction (semantic parity with the
  // buyer → matches re-rank above).
  const [aiBuyers, setAiBuyers] = useState<AiBuyer[] | null>(null);
  const [aiBuyersMode, setAiBuyersMode] = useState<"ai" | "deterministic" | null>(null);
  const [aiBuyersLoading, setAiBuyersLoading] = useState(false);
  const [aiBuyersError, setAiBuyersError] = useState<string | null>(null);

  // Hydrate saved briefs after mount (localStorage is client-only — seeding in
  // render would desync the SSR/client first paint). Same pattern as Voice CRM.
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [seeded, setSeeded] = useState(false);
  if (hydrated && !seeded) {
    setSeeded(true);
    const stored = readPersisted<PersistedBrief[]>(SAVED_BRIEFS_KEY, []);
    if (stored.length) setSavedBriefs(stored);
  }

  // All buyers' requirement sets (Supabase or device): powers both the
  // saved-buyer shortlist and the listing → buyers cross-set matching.
  const [setsByBuyer, setSetsByBuyer] = useState<Record<string, RequirementSet[]>>({});
  useEffect(() => {
    let cancelled = false;
    void loadAllRequirementSets().then((map) => {
      if (!cancelled) setSetsByBuyer(map);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // One engine for both paths: a saved buyer scores its structured ask (+ the
  // chosen requirement set) directly; free text is parsed into an ask. Both run
  // generateMatchesForBuyer, so the Matching screen matches the Buyers tab.
  const shortlist = useMemo(() => {
    if (parsedBuyer) {
      const buyer = buyers.find((candidate) => candidate.id === parsedBuyer.buyerId);
      if (buyer) {
        const set = (setsByBuyer[parsedBuyer.buyerId] ?? []).find((entry) => entry.id === parsedBuyer.setId);
        return generateBuyerShortlist(set ? mergeRequirementSet(buyer, set) : buyer, segment, listings);
      }
    }
    return generateClientBriefShortlist(parsedBrief, segment, listings);
  }, [parsedBuyer, parsedBrief, buyers, setsByBuyer, listings, segment]);

  const selectedListing = listings.find((listing) => listing.id === opportunityListingId);

  // For the selected listing, score each buyer against their Primary ask plus
  // every requirement set, keep the best, and remember which ask won so the UI
  // can badge "via <set>".
  const opportunities = useMemo(() => {
    if (!selectedListing) return [];
    return buyers
      .map((buyer) => {
        const asks: { label: string | null; ask: BuyerProfile }[] = [
          { label: null, ask: buyer },
          ...(setsByBuyer[buyer.id] ?? []).map((set) => ({
            label: set.label,
            ask: mergeRequirementSet(buyer, set),
          })),
        ];
        let best: { label: string | null; match: ReturnType<typeof generateMatchesForBuyer>[number] } | null = null;
        for (const candidate of asks) {
          const match = generateMatchesForBuyer(candidate.ask, [selectedListing])[0];
          if (match && (!best || match.fitScore > best.match.fitScore)) {
            best = { label: candidate.label, match };
          }
        }
        return best ? { buyer, matchedLabel: best.label, match: best.match } : null;
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry) && entry!.match.fitScore >= 58)
      .sort((a, b) => b.match.fitScore - a.match.fitScore)
      .slice(0, 6);
  }, [buyers, selectedListing, setsByBuyer]);

  const filteredListings = useMemo(() => {
    const query = listingSearch.trim().toLowerCase();
    if (!query) return listings;
    return listings.filter((listing) =>
      [listing.name, listing.builder, listing.model, listing.location]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(query)),
    );
  }, [listings, listingSearch]);

  const hasBrief = parsedBuyer != null || parsedBrief.trim().length > 0;
  const exactCount = shortlist.matches.filter((match) => match.category === "Exact Match").length;

  function loadBuyerIntoBrief(value: string) {
    setSourceBuyerId(value);
    setBriefSetId("primary");
  }

  function recordShortlist(
    nextShortlist: ReturnType<typeof generateClientBriefShortlist>,
    raw: string,
  ) {
    setSavedBriefs((current) => {
      const savedBrief = {
        id: `brief-${Date.now()}`,
        raw,
        topListing: nextShortlist.matches[0]?.listing.name,
        matchCount: nextShortlist.matches.length,
        createdAt: new Date().toISOString(),
      };
      const next = [savedBrief, ...current].slice(0, 8);
      writePersisted(SAVED_BRIEFS_KEY, next);
      mirrorWorkflowEvent("matching_brief_generated", savedBrief.id, {
        brief: raw,
        criteria: nextShortlist.criteria,
        matches: nextShortlist.matches.map((match) => ({
          listingId: match.listing.id,
          fitScore: match.fitScore,
          category: match.category,
        })),
      });
      return next;
    });
  }

  function parseBrief() {
    setAiMatches(null);
    setAiError(null);

    // Saved buyer → match the structured ask (+ chosen set) with the new engine.
    if (sourceBuyerId) {
      const buyer = buyers.find((candidate) => candidate.id === sourceBuyerId);
      if (!buyer) return;
      const set = (setsByBuyer[sourceBuyerId] ?? []).find((entry) => entry.id === briefSetId);
      setParsedBuyer({ buyerId: sourceBuyerId, setId: briefSetId });
      setParsedBrief("");
      const nextShortlist = generateBuyerShortlist(
        set ? mergeRequirementSet(buyer, set) : buyer,
        segment,
        listings,
      );
      recordShortlist(nextShortlist, set ? `${buyer.name} · ${set.label}` : buyer.name);
      return;
    }

    // Free text → parse into an ask and run the same engine.
    const trimmed = brief.trim();
    if (!trimmed) return;
    setParsedBuyer(null);
    setParsedBrief(brief);
    const nextShortlist = generateClientBriefShortlist(brief, segment, listings);
    saveSessionBuyer({
      id: `brief-buyer-${Date.now()}`,
      name: "Buyer brief draft",
      source: "Matching",
      summary: nextShortlist.outreachMessage,
      budgetLabel: nextShortlist.criteria.budgetMaxEur
        ? `Budget cap EUR ${nextShortlist.criteria.budgetMaxEur.toLocaleString("en-GB")}`
        : "Budget not specified",
      urgency: nextShortlist.criteria.urgency,
      createdAt: new Date().toISOString(),
    });
    recordShortlist(nextShortlist, brief);
  }

  async function runAiMatch() {
    if (aiLoading) return;
    if (!parsedBuyer && !parsedBrief.trim()) return;
    setAiLoading(true);
    setAiError(null);
    try {
      // Saved buyer → the structured buyer-match agent (+ requirement set);
      // free text → the brief-match agent. Both use the broker's rerank config.
      const res = parsedBuyer
        ? await fetch("/api/buyer-match", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              buyerId: parsedBuyer.buyerId,
              config: readRerankConfig(),
              requirementSet:
                (setsByBuyer[parsedBuyer.buyerId] ?? []).find((entry) => entry.id === parsedBuyer.setId) ?? null,
            }),
          })
        : await fetch("/api/brief-match", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ brief: parsedBrief, config: readRerankConfig() }),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not run the AI match.");
      setAiMatches(Array.isArray(data.ranked) ? data.ranked : []);
      setAiMode(data.mode === "ai" ? "ai" : "deterministic");
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Could not run the AI match.");
    } finally {
      setAiLoading(false);
    }
  }

  async function runListingAiMatch() {
    if (aiBuyersLoading || !opportunityListingId) return;
    setAiBuyersLoading(true);
    setAiBuyersError(null);
    try {
      const res = await fetch("/api/listing-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: opportunityListingId, config: readRerankConfig() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not run the AI match.");
      setAiBuyers(Array.isArray(data.ranked) ? data.ranked : []);
      setAiBuyersMode(data.mode === "ai" ? "ai" : "deterministic");
    } catch (error) {
      setAiBuyersError(error instanceof Error ? error.message : "Could not run the AI match.");
    } finally {
      setAiBuyersLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1536px] px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
      <PageHeader
        metrics={[
          { label: "Ranked matches", value: hasBrief ? `${shortlist.matches.length}` : "—" },
          { label: "Exact matches", value: hasBrief ? `${exactCount}` : "—" },
          {
            label: "Hidden opportunities",
            value: listings.length > 0 ? `${opportunities.length}` : "—",
          },
          { label: "Saved buyers", value: `${buyers.length}` },
        ]}
      />

      {/* Mode switch in its own full-width card — tabs + a blue info callout,
          mirroring the Voice CRM capture card. */}
      <div className="mt-8 rounded-[12px] border border-[#E7E7E7] bg-white p-4 sm:p-5">
        <div
          aria-label="Matching mode"
          className="inline-flex w-fit shrink-0 items-center gap-1 rounded-[8px] border border-[#D9DAD4] bg-white p-1 text-[13px] font-medium"
          role="tablist"
        >
          <button
            aria-selected={mode === "buyer"}
            className={cn(
              "inline-flex min-h-9 shrink-0 items-center gap-2 rounded-[8px] px-3 transition-colors",
              mode === "buyer" ? "bg-[#171719] text-white" : "text-[#5F625E] hover:bg-[#F1F2EE]",
            )}
            onClick={() => setMode("buyer")}
            role="tab"
            type="button"
          >
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            Find boats for a buyer
          </button>
          <button
            aria-selected={mode === "listing"}
            className={cn(
              "inline-flex min-h-9 shrink-0 items-center gap-2 rounded-[8px] px-3 transition-colors",
              mode === "listing" ? "bg-[#171719] text-white" : "text-[#5F625E] hover:bg-[#F1F2EE]",
            )}
            onClick={() => setMode("listing")}
            role="tab"
            type="button"
          >
            <Ship className="h-3.5 w-3.5" aria-hidden="true" />
            Find buyers for a listing
          </button>
        </div>
        <div className="mt-3 flex items-start gap-2.5 rounded-[10px] border border-[#CBDDEB] bg-[#E0ECF2] px-4 py-2.5 text-[13px] leading-6 text-[#3D6F8F]">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0">
            {mode === "buyer"
              ? "Turn a buyer brief into a ranked, explainable shortlist."
              : "Pick a listing and see which saved buyers it fits — with the reasons why."}
          </span>
        </div>
      </div>

      {mode === "buyer" ? (
        <>
        <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
          {/* Left — the 1 → 2 → 3 flow */}
          <div className="grid content-start gap-8">
            <Card>
              <CardHeader
                eyebrow="Step 1"
                title="Describe the buyer"
                description="Start from a saved buyer, or type the requirements yourself — budget, size, location, year, brand, or style."
                action={
                  <CardHeaderIcon>
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                  </CardHeaderIcon>
                }
              />
              <div className="grid gap-4 px-6 py-5">
                {buyers.length ? (
                  <SelectMenu
                    label="Start from a saved buyer (optional)"
                    onChange={loadBuyerIntoBrief}
                    options={[
                      { value: "", label: "Free text — no saved buyer", meta: "Type the brief yourself" },
                      ...buyers.map((buyer) => ({
                        value: buyer.id,
                        label: buyer.name,
                        meta: [buyer.company, buyer.country].filter(Boolean).join(" · "),
                      })),
                    ]}
                    value={sourceBuyerId}
                  />
                ) : null}

                {sourceBuyerId ? (
                  /* Saved buyer → match its structured ask. Pick which set. */
                  <div className="grid gap-2">
                    <span className="block text-[11px] font-medium uppercase tracking-[0.12em] text-[#8E918B]">
                      Requirement set
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {[{ id: "primary", label: "Primary" }, ...(setsByBuyer[sourceBuyerId] ?? [])].map((set) => (
                        <button
                          className={cn(
                            "inline-flex min-h-8 items-center rounded-[8px] border px-3 text-[12.5px] font-medium transition-colors",
                            briefSetId === set.id
                              ? "border-[#003C33] bg-[#003C33] text-white"
                              : "border-[#E7E7E7] bg-white text-[#5F625E] hover:border-[#003C33]/40 hover:bg-[#F1F2EE]",
                          )}
                          key={set.id}
                          onClick={() => setBriefSetId(set.id)}
                          type="button"
                        >
                          {set.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[12.5px] leading-5 text-[#8E918B]">
                      Matches this buyer&apos;s saved requirements with the weighted engine. Manage sets on
                      the buyer&apos;s page.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-1.5">
                    <span className="block text-[11px] font-medium uppercase tracking-[0.12em] text-[#8E918B]">
                      Buyer brief
                    </span>
                    <textarea
                      aria-label="Client brief"
                      className="min-h-40 w-full rounded-[12px] border border-[#D9DAD4] bg-white p-4 text-[15px] leading-7 text-[#171719] outline-none placeholder:text-[#A9ABA5] focus:border-[#003C33] focus:ring-2 focus:ring-[#003C33]/15"
                      onChange={(event) => setBrief(event.target.value)}
                      placeholder="Describe the buyer in your own words — asset type, model, year, size, budget, geography, urgency."
                      value={brief}
                    />
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <Button disabled={!sourceBuyerId && !brief.trim()} onClick={parseBrief} type="button">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    Generate shortlist
                  </Button>
                  {!sourceBuyerId ? (
                    <Button onClick={() => setBrief(exampleBrief)} type="button" variant="link">
                      Load example
                    </Button>
                  ) : null}
                  {!sourceBuyerId && brief && brief !== parsedBrief ? (
                    <span className="text-[12px] uppercase tracking-[0.14em] text-[#8E918B]">
                      Unparsed changes
                    </span>
                  ) : null}
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader
                eyebrow="Step 2"
                title="Review extracted criteria"
                description="Confirm the matcher read the brief correctly before trusting the shortlist."
                action={
                  <CardHeaderIcon>
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  </CardHeaderIcon>
                }
              />
              {hasBrief ? (
                <>
                  <dl className="grid gap-x-10 gap-y-5 px-6 py-5 sm:grid-cols-2">
                    <CriteriaRow label="Model" value={shortlist.criteria.model ?? "Flexible"} />
                    <CriteriaRow
                      label="Budget cap"
                      value={
                        shortlist.criteria.budgetMaxEur
                          ? formatCurrency(shortlist.criteria.budgetMaxEur)
                          : "Not specified"
                      }
                    />
                    <CriteriaRow
                      label="Year"
                      value={shortlist.criteria.minYear ? `${shortlist.criteria.minYear}+` : "Flexible"}
                    />
                    <CriteriaRow
                      label="Cabins"
                      value={shortlist.criteria.cabins ? `${shortlist.criteria.cabins}+` : "Flexible"}
                    />
                    <CriteriaRow label="Interior" value={shortlist.criteria.interiorStyle ?? "Flexible"} />
                    <CriteriaRow label="VAT" value={shortlist.criteria.vatStatus ?? "Flexible"} />
                    <CriteriaRow
                      label="Size"
                      value={
                        shortlist.criteria.sizeRangeFt
                          ? `${shortlist.criteria.sizeRangeFt[0]} – ${shortlist.criteria.sizeRangeFt[1]} ft`
                          : "Flexible"
                      }
                    />
                    <CriteriaRow
                      label="Location"
                      value={shortlist.criteria.preferredLocations?.join(", ") || "Flexible"}
                    />
                  </dl>

                  <div className="grid gap-6 border-t border-[#E7E7E7] px-6 py-5 sm:grid-cols-2">
                    <TagRow
                      title="Must-haves"
                      items={shortlist.criteria.mustHaves ?? []}
                      empty="No explicit must-haves parsed."
                    />
                    <TagRow
                      title="Deal breakers"
                      items={shortlist.criteria.dealBreakers ?? []}
                      empty="No explicit deal breakers parsed."
                    />
                  </div>
                </>
              ) : (
                <EmptyState
                  title="Criteria appear after Step 1"
                  description="Type or load a brief, then run Generate shortlist to extract structured criteria."
                  action={
                    <Button onClick={() => setBrief(exampleBrief)} type="button" size="sm" variant="secondary">
                      Load an example
                    </Button>
                  }
                />
              )}
            </Card>

            <Card>
              <CardHeader
                eyebrow="Step 3"
                title="Ranked matches"
                description="Best-fit inventory with the reasons, gaps, and talking points for each."
                action={
                  <CardHeaderIcon>
                    <Lightbulb className="h-4 w-4" aria-hidden="true" />
                  </CardHeaderIcon>
                }
              />
              {!hasBrief ? (
                <EmptyState
                  title="Your shortlist will appear here"
                  description="Complete Step 1 to rank inventory against the brief."
                />
              ) : shortlist.matches.length ? (
                <div className="px-6 py-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="bb-mono-label">
                      {shortlist.matches.length} ranked match{shortlist.matches.length === 1 ? "" : "es"}
                    </p>
                    <button
                      className="inline-flex min-h-8 items-center gap-1.5 rounded-[8px] border border-[#E7E7E7] bg-white px-3 text-[12.5px] font-medium text-[#5F625E] transition-colors hover:border-[#003C33] hover:text-[#003C33] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={aiLoading}
                      onClick={() => void runAiMatch()}
                      type="button"
                    >
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      {aiLoading ? "Ranking…" : aiMatches ? "Re-run AI ranking" : "Re-rank with AI"}
                    </button>
                  </div>

                  {aiError ? (
                    <p className="mt-3 rounded-[8px] bg-[#F0DDD0]/60 px-3 py-2 text-[12.5px] text-[#A86642]">
                      {aiError}
                    </p>
                  ) : null}

                  {aiMatches ? (
                    <div className="mt-3 overflow-hidden rounded-[12px] border border-[#E7EFEA] bg-[#f4fbf5]">
                      <div className="flex items-center justify-between gap-3 border-b border-[#E7EFEA] px-4 py-2.5">
                        <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#3F5249]">
                          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                          {aiMode === "ai" ? "AI semantic ranking" : "Rule-based ranking (no OpenAI key)"}
                        </p>
                        <button
                          className="text-[12px] font-medium text-[#5F7A6F] transition-colors hover:text-[#003C33]"
                          onClick={() => setAiMatches(null)}
                          type="button"
                        >
                          Hide
                        </button>
                      </div>
                      {aiMatches.length ? (
                        <ul className="divide-y divide-[#E7EFEA]">
                          {aiMatches.map((item) => {
                            const listing = listings.find((entry) => entry.id === item.listingId);
                            return (
                              <li className="px-4 py-3" key={item.listingId}>
                                <div className="flex items-center justify-between gap-3">
                                  <Link
                                    className="truncate text-[14px] font-medium text-[#171719] hover:text-[#003C33] hover:underline"
                                    href={`/listings/${item.listingId}`}
                                  >
                                    {listing?.name ?? item.listingId}
                                  </Link>
                                  <span className="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-[#003C33]">
                                    {item.fitScore}%
                                  </span>
                                </div>
                                {item.reason ? (
                                  <p className="mt-1 text-[12.5px] leading-[1.55] text-[#5F625E]">{item.reason}</p>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="px-4 py-3 text-[12.5px] text-[#5F625E]">No candidates to rank.</p>
                      )}
                    </div>
                  ) : null}

                  <div className="mt-3 max-h-[900px] divide-y divide-[#E7E7E7] overflow-y-auto rounded-[12px] border border-[#E7E7E7]">
                    {shortlist.matches.map((match) => (
                      <article key={match.id} className="px-5 py-5">
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_160px] lg:items-start">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge tone={categoryTone(match.category)}>{match.category}</Badge>
                              <span className="bb-mono-label">{percentage(match.fitScore)} fit</span>
                            </div>
                            <Link
                              className="bb-display mt-3 inline-block text-lg font-medium text-[#171719] hover:text-[#1863dc]"
                              href={`/listings/${match.listing.id}`}
                            >
                              {match.listing.name}
                              <span className="text-[#8E918B]">
                                {" "}· {match.listing.builder} {match.listing.model}
                              </span>
                            </Link>
                            <p className="mt-2 text-sm leading-6 text-[#5F625E]">{match.rationale}</p>
                          </div>
                          <div className="rounded-[12px] bg-[#FBFBFB] p-4 lg:text-right">
                            <p className="bb-mono-label">Fit</p>
                            <p className="bb-display mt-2 text-2xl font-medium text-[#171719]">
                              {percentage(match.fitScore)}
                            </p>
                            <ProgressBar className="mt-3" value={match.fitScore} />
                          </div>
                        </div>
                        <div className="mt-5 grid gap-4 lg:grid-cols-3">
                          <ListBlock icon={CheckCircle2} title="Criteria met" items={match.criteriaMet} />
                          <ListBlock
                            icon={CircleAlert}
                            title="Missing / uncertain"
                            items={match.missingCriteria.length ? match.missingCriteria : ["No blockers flagged"]}
                          />
                          <ListBlock icon={Lightbulb} title="Broker talking points" items={match.talkingPoints} />
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState
                  title={
                    listings.length === 0 ? "No inventory to score against" : "Brief parsed but no listings matched"
                  }
                  description={
                    listings.length === 0
                      ? "The brief is structured and ready — add inventory and the matcher will rank it against these criteria."
                      : "Try widening budget, size, or location. The matcher needs at least one listing inside the requested band."
                  }
                  action={
                    listings.length === 0 ? (
                      <Link
                        className="inline-flex min-h-9 items-center gap-2 rounded-[8px] border border-[#D9DAD4] bg-white px-4 text-[13px] font-medium text-[#171719] hover:border-[#003C33]"
                        href="/listings"
                      >
                        Open listings
                      </Link>
                    ) : null
                  }
                />
              )}
            </Card>

          </div>

          {/* Right rail — saved buyers to load + post-shortlist guidance */}
          <div className="grid content-start gap-8">
            {buyers.length ? (
              <Card>
                <CardHeader
                  title="Your saved buyers"
                  description="Click a buyer to load their requirements into the brief."
                  action={
                    <CardHeaderIcon>
                      <Users className="h-4 w-4" aria-hidden="true" />
                    </CardHeaderIcon>
                  }
                />
                <div className="grid gap-0 divide-y divide-[#E7E7E7]">
                  {buyers.map((buyer) => {
                    const matches = generateMatchesForBuyer(buyer, listings);
                    const topMatch = matches[0];
                    const topListing = listings.find((listing) => listing.id === topMatch?.listingId);
                    return (
                      <button
                        className={cn(
                          "flex items-center justify-between gap-4 px-6 py-4 text-left transition-colors hover:bg-[#FBFBFB]",
                          sourceBuyerId === buyer.id && "bg-[#F1F2EE] hover:bg-[#F1F2EE]",
                        )}
                        key={buyer.id}
                        onClick={() => loadBuyerIntoBrief(buyer.id)}
                        type="button"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold text-[#171719]">{buyer.name}</p>
                          <p className="mt-0.5 truncate text-[12.5px] leading-5 text-[#8E918B]">
                            {topListing ? `Top fit: ${topListing.name}` : "No listing fit found yet."}
                          </p>
                        </div>
                        <span className="shrink-0 font-mono text-[15px] font-semibold tabular-nums text-[#171719]">
                          {topMatch ? percentage(topMatch.fitScore) : "—"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Card>
            ) : null}

            {hasBrief && shortlist.matches.length > 0 ? (
              <>
                <Card>
                  <CardHeader
                    title="Verify before sending"
                    action={
                      <CardHeaderIcon className="bg-[#F0DDD0] text-[#b45309]">
                        <CircleAlert className="h-4 w-4" aria-hidden="true" />
                      </CardHeaderIcon>
                    }
                  />
                  {shortlist.missingCriteria.length ? (
                    <ul className="grid gap-0 divide-y divide-[#E7E7E7]">
                      {shortlist.missingCriteria.map((item) => (
                        <li key={item} className="flex items-start gap-3 px-6 py-4">
                          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#b45309]" aria-hidden="true" />
                          <p className="text-sm leading-6 text-[#5F625E]">{item}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState
                      title="No criteria blockers"
                      description="The current shortlist has nothing flagged by the matcher."
                    />
                  )}
                </Card>

                <Card>
                  <CardHeader
                    title="Talking points"
                    action={
                      <CardHeaderIcon>
                        <Lightbulb className="h-4 w-4" aria-hidden="true" />
                      </CardHeaderIcon>
                    }
                  />
                  {shortlist.tradeOffs.length ? (
                    <ul className="grid gap-0 divide-y divide-[#E7E7E7]">
                      {shortlist.tradeOffs.map((tradeOff) => (
                        <li key={tradeOff} className="px-6 py-4 text-sm leading-6 text-[#5F625E]">
                          {tradeOff}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState
                      title="No trade-offs to frame"
                      description="The current shortlist has no headline trade-offs flagged."
                    />
                  )}
                </Card>
              </>
            ) : null}

            {savedBriefs.length ? (
              <Card>
                <CardHeader
                  title="Recent shortlists"
                  action={
                    <CardHeaderIcon>
                      <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                    </CardHeaderIcon>
                  }
                />
                <ul className="divide-y divide-[#E7E7E7]">
                  {savedBriefs.slice(0, 4).map((item) => (
                    <li key={item.id} className="px-6 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[14px] font-medium text-[#171719]">
                          {item.topListing ?? "No top fit yet"}
                        </p>
                        <Badge tone="success">Saved</Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[13px] leading-6 text-[#5F625E]">{item.raw}</p>
                      <p className="mt-2 text-[12px] uppercase tracking-[0.14em] text-[#8E918B]">
                        {item.matchCount} ranked matches
                      </p>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </div>
        </div>

        {/* Comparison & outreach — full width below the flow, listings-style table. */}
        {hasBrief && shortlist.matches.length > 0 ? (
          <div className="mt-8">
            <Card>
              <CardHeader
                title="Comparison & outreach"
                description="Side-by-side trade-offs and a ready-to-edit message for the buyer."
                action={
                  <CardHeaderIcon>
                    <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                  </CardHeaderIcon>
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E7E7E7] bg-[#FBFBFB] text-[11px] uppercase tracking-[0.14em] text-[#8E918B]">
                      <th className="px-5 py-3 font-medium">Asset</th>
                      <th className="px-5 py-3 font-medium">Category</th>
                      <th className="px-5 py-3 font-medium">Fit</th>
                      <th className="px-5 py-3 font-medium">Price</th>
                      <th className="px-5 py-3 font-medium">Size / Year</th>
                      <th className="px-5 py-3 font-medium">VAT</th>
                      <th className="px-5 py-3 font-medium">Top trade-off</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E7E7]">
                    {shortlist.comparisonRows.map((row) => (
                      <tr key={row.listing.id} className="align-top transition-colors hover:bg-[#FBFBFB]">
                        <td className="px-5 py-4 font-medium text-[#171719]">{row.listing.name}</td>
                        <td className="px-5 py-4">
                          <Badge tone={categoryTone(row.category)}>{row.category}</Badge>
                        </td>
                        <td className="px-5 py-4 font-mono font-medium text-[#171719]">
                          {percentage(row.fitScore)}
                        </td>
                        <td className="px-5 py-4 text-[#5F625E]">{formatCurrency(row.priceEur)}</td>
                        <td className="px-5 py-4 text-[#5F625E]">
                          {row.sizeFt > 0 ? `${Math.round(row.sizeFt)}ft` : "—"} / {row.year}
                        </td>
                        <td className="px-5 py-4 text-[#5F625E]">{row.vatStatus}</td>
                        <td className="px-5 py-4 text-[#5F625E]">{row.topTradeOff}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-[#E7E7E7] px-6 py-5">
                <div className="rounded-[12px] bg-[#003C33] p-5 text-white">
                  <div className="flex items-center gap-2">
                    <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                    <p className="bb-mono-label !text-white/70">Suggested outreach</p>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-white/90">{shortlist.outreachMessage}</p>
                </div>
              </div>
            </Card>
          </div>
        ) : null}
        </>
      ) : (
        /* Listing → buyers mode */
        <div
          className={cn(
            "mt-8 grid gap-8",
            listings.length ? "lg:grid-cols-2 lg:items-start" : "lg:max-w-2xl",
          )}
        >
          <Card>
            <CardHeader
              eyebrow="Step 1"
              title="Pick a listing"
              description="Choose a new or updated listing to check against your saved buyers."
              action={
                <CardHeaderIcon>
                  <Ship className="h-4 w-4" aria-hidden="true" />
                </CardHeaderIcon>
              }
            />
            {listings.length === 0 ? (
              <EmptyState
                title="No inventory to discover against"
                description="Add a listing to check it against buyer memory, timing, budget, and objections."
                action={
                  <Link
                    className="inline-flex min-h-9 items-center gap-2 rounded-[8px] border border-[#D9DAD4] bg-white px-4 text-[13px] font-medium text-[#171719] hover:border-[#003C33]"
                    href="/listings"
                  >
                    Open listings
                  </Link>
                }
              />
            ) : (
              <div className="grid gap-4 px-6 py-5">
                <div className="grid gap-1.5">
                  <span className="block text-[11px] font-medium uppercase tracking-[0.12em] text-[#8E918B]">
                    Listing
                  </span>
                  <button
                    className="inline-flex min-h-11 w-full items-center justify-between gap-3 rounded-[10px] border border-[#D9DAD4] bg-white px-3.5 py-2.5 text-left text-[14px] font-medium text-[#171719] transition-colors hover:border-[#A9ABA5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c6ee6]"
                    onClick={() => setListingDrawerOpen(true)}
                    type="button"
                  >
                    <span className="min-w-0 truncate">
                      {selectedListing
                        ? `${selectedListing.name} · ${selectedListing.builder} ${selectedListing.model}`
                        : "Select a listing"}
                    </span>
                    <Search className="h-4 w-4 shrink-0 text-[#8E918B]" aria-hidden="true" />
                  </button>
                </div>
                {selectedListing ? (
                  <p className="text-[13px] leading-6 text-[#8E918B]">
                    <span className="font-medium text-[#171719]">{selectedListing.name}</span> is checked
                    against buyer memory, timing, budget range, VAT needs, and known objections.
                  </p>
                ) : null}
              </div>
            )}
          </Card>

          {listings.length > 0 ? (
            <Card>
              <CardHeader
                eyebrow="Step 2"
                title="Matched buyers"
                description="Saved buyers whose memory crosses the opportunity threshold for this listing."
                action={
                  <CardHeaderIcon>
                    <Users className="h-4 w-4" aria-hidden="true" />
                  </CardHeaderIcon>
                }
              />
              <div className="px-6 py-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="bb-mono-label">
                    {opportunities.length} matched buyer{opportunities.length === 1 ? "" : "s"}
                  </p>
                  {buyers.length ? (
                    <button
                      className="inline-flex min-h-8 items-center gap-1.5 rounded-[8px] border border-[#E7E7E7] bg-white px-3 text-[12.5px] font-medium text-[#5F625E] transition-colors hover:border-[#003C33] hover:text-[#003C33] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={aiBuyersLoading}
                      onClick={() => void runListingAiMatch()}
                      type="button"
                    >
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      {aiBuyersLoading ? "Ranking…" : aiBuyers ? "Re-run AI ranking" : "Re-rank with AI"}
                    </button>
                  ) : null}
                </div>

                {aiBuyersError ? (
                  <p className="mt-3 rounded-[8px] bg-[#F0DDD0]/60 px-3 py-2 text-[12.5px] text-[#A86642]">
                    {aiBuyersError}
                  </p>
                ) : null}

                {aiBuyers ? (
                  <div className="mt-3 overflow-hidden rounded-[12px] border border-[#E7EFEA] bg-[#f4fbf5]">
                    <div className="flex items-center justify-between gap-3 border-b border-[#E7EFEA] px-4 py-2.5">
                      <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#3F5249]">
                        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                        {aiBuyersMode === "ai" ? "AI semantic ranking" : "Rule-based ranking (no OpenAI key)"}
                      </p>
                      <button
                        className="text-[12px] font-medium text-[#5F7A6F] transition-colors hover:text-[#003C33]"
                        onClick={() => setAiBuyers(null)}
                        type="button"
                      >
                        Hide
                      </button>
                    </div>
                    {aiBuyers.length ? (
                      <ul className="divide-y divide-[#E7EFEA]">
                        {aiBuyers.map((item) => {
                          const buyer = buyers.find((entry) => entry.id === item.buyerId);
                          return (
                            <li className="px-4 py-3" key={item.buyerId}>
                              <div className="flex items-center justify-between gap-3">
                                <Link
                                  className="truncate text-[14px] font-medium text-[#171719] hover:text-[#003C33] hover:underline"
                                  href={`/buyers/${item.buyerId}`}
                                >
                                  {buyer?.name ?? item.buyerId}
                                </Link>
                                <span className="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-[#003C33]">
                                  {item.fitScore}%
                                </span>
                              </div>
                              {item.reason ? (
                                <p className="mt-1 text-[12.5px] leading-[1.55] text-[#5F625E]">{item.reason}</p>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="px-4 py-3 text-[12.5px] text-[#5F625E]">No buyers ranked.</p>
                    )}
                  </div>
                ) : null}

                {opportunities.length ? (
                  <ul className="mt-3 grid gap-0 divide-y divide-[#E7E7E7] overflow-hidden rounded-[12px] border border-[#E7E7E7]">
                    {opportunities.map((opportunity) => (
                      <li key={opportunity.buyer.id} className="px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                className="text-[15px] font-medium text-[#171719] hover:text-[#1863dc]"
                                href={`/buyers/${opportunity.buyer.id}`}
                              >
                                {opportunity.buyer.name}
                              </Link>
                              <span className="inline-flex items-center rounded-[8px] bg-[#F1F2EE] px-2 py-0.5 text-[11px] font-medium text-[#5F625E]">
                                via {opportunity.matchedLabel ?? "Primary ask"}
                              </span>
                            </div>
                            <p className="mt-1 text-[13px] leading-6 text-[#5F625E]">
                              {opportunity.match.rationale}
                            </p>
                          </div>
                          <Badge tone={categoryTone(opportunity.match.category)}>
                            {percentage(opportunity.match.fitScore)}
                          </Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {opportunity.match.criteriaMet.slice(0, 4).map((signal) => (
                            <Badge key={signal} tone="neutral">
                              {signal}
                            </Badge>
                          ))}
                        </div>
                        {opportunity.match.missingCriteria.length ? (
                          <p className="mt-2 text-[13px] text-[#8E918B]">
                            Watch: {opportunity.match.missingCriteria[0]}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 rounded-[12px] border border-dashed border-[#E7E7E7] bg-white px-4 py-4 text-[13px] leading-6 text-[#8E918B]">
                    No saved buyer crosses the rule-based threshold for this listing yet. Try “Re-rank with
                    AI” for a semantic pass over your saved buyers.
                  </p>
                )}
              </div>
            </Card>
          ) : null}
        </div>
      )}

      {/* Searchable listing picker — a right-side drawer so a long inventory is
          actually findable (the inline dropdown was hard to scan). */}
      {listingDrawerOpen ? (
        <div
          aria-modal="true"
          className="bb-overlay-enter fixed inset-0 z-[80] flex justify-end bg-[#171719]/30 backdrop-blur-sm"
          onClick={() => setListingDrawerOpen(false)}
          role="dialog"
        >
          <div
            className="bb-drawer-enter flex h-full w-full max-w-md flex-col bg-white shadow-[0_24px_64px_rgba(23,31,25,0.18)]"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-center justify-between gap-3 border-b border-[#E7E7E7] px-5 py-4">
              <div>
                <h2 className="text-[15px] font-semibold text-[#171719]">Choose a listing</h2>
                <p className="mt-0.5 text-[12px] text-[#8E918B]">{listings.length} in inventory</p>
              </div>
              <button
                aria-label="Close"
                className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#8E918B] transition-colors hover:bg-[#F1F2EE] hover:text-[#171719]"
                onClick={() => setListingDrawerOpen(false)}
                type="button"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>
            <div className="border-b border-[#E7E7E7] px-5 py-3">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8E918B]"
                  aria-hidden="true"
                />
                <input
                  aria-label="Search listings"
                  autoFocus
                  className="min-h-10 w-full rounded-[10px] border border-[#D9DAD4] bg-white pl-9 pr-3 text-[14px] text-[#171719] outline-none placeholder:text-[#A9ABA5] focus:border-[#003C33] focus:ring-2 focus:ring-[#003C33]/15"
                  onChange={(event) => setListingSearch(event.target.value)}
                  placeholder="Search by name, builder, model, or location"
                  value={listingSearch}
                />
              </div>
            </div>
            <div className="flex-1 overflow-auto p-2">
              {filteredListings.length ? (
                <ul className="grid gap-0.5">
                  {filteredListings.map((listing) => {
                    const active = listing.id === opportunityListingId;
                    return (
                      <li key={listing.id}>
                        <button
                          className={cn(
                            "flex w-full items-start justify-between gap-3 rounded-[10px] px-3 py-3 text-left transition-colors hover:bg-[#F1F2EE]",
                            active && "bg-[#F1F2EE]",
                          )}
                          onClick={() => {
                            setOpportunityListingId(listing.id);
                            setAiBuyers(null);
                            setAiBuyersError(null);
                            setListingDrawerOpen(false);
                            setListingSearch("");
                          }}
                          type="button"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-medium text-[#171719]">{listing.name}</p>
                            <p className="mt-0.5 truncate text-[12.5px] text-[#8E918B]">
                              {[
                                `${listing.builder} ${listing.model}`.trim(),
                                listing.lengthFt > 0 ? `${listing.lengthFt}ft` : null,
                                listing.location,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                          {active ? (
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#003C33]" aria-hidden="true" />
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-3 py-8 text-center text-[13px] text-[#8E918B]">
                  No listings match “{listingSearch}”.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CriteriaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="bb-mono-label">{label}</dt>
      <dd className="mt-1.5 text-[14px] text-[#171719]">{value}</dd>
    </div>
  );
}

function TagRow({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="min-w-0">
      <p className="bb-mono-label">{title}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {items.length ? (
          items.map((item) => (
            <Badge key={item} tone="neutral">
              {item}
            </Badge>
          ))
        ) : (
          <p className="text-sm leading-6 text-[#8E918B]">{empty}</p>
        )}
      </div>
    </div>
  );
}

function ListBlock({
  icon: Icon,
  title,
  items,
}: {
  icon: typeof CheckCircle2;
  title: string;
  items: string[];
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-[#003C33]" aria-hidden="true" />
        <p className="bb-mono-label">{title}</p>
      </div>
      <ul className="mt-2 grid gap-1">
        {items.map((item) => (
          <li key={item} className="text-[13px] leading-6 text-[#5F625E]">
            · {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
