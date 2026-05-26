"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  CircleAlert,
  Lightbulb,
  MessageSquareText,
  Sparkles,
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
import {
  discoverHiddenOpportunities,
  generateClientBriefShortlist,
  generateMatchesForBuyer,
} from "@/lib/services";
import type { BuyerProfile, YachtListing } from "@/lib/types";
import { formatCurrency, percentage } from "@/lib/utils";
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
  segment = "Yacht",
  storedBuyers = [],
  storedListings = [],
}: {
  segment?: BrokerSegment;
  storedBuyers?: BuyerProfile[];
  storedListings?: YachtListing[];
}) {
  const listings = mergeListings(storedListings, getListingsForSegment(segment));
  const buyers = mergeBuyers(storedBuyers, getBuyersForSegment(segment));
  const exampleBrief = exampleBriefs[segment];
  const [brief, setBrief] = useState("");
  const [parsedBrief, setParsedBrief] = useState("");
  const [opportunityListingId, setOpportunityListingId] = useState(listings[0]?.id ?? "");
  const [savedBriefs, setSavedBriefs] = useState<PersistedBrief[]>(() =>
    readPersisted<PersistedBrief[]>("brobroker:matching:saved-briefs", []),
  );

  const shortlist = useMemo(
    () => generateClientBriefShortlist(parsedBrief, segment, listings),
    [listings, parsedBrief, segment],
  );
  const opportunities = useMemo(
    () =>
      opportunityListingId
        ? discoverHiddenOpportunities(opportunityListingId, segment, listings, buyers)
        : [],
    [buyers, listings, opportunityListingId, segment],
  );
  const selectedListing = listings.find((listing) => listing.id === opportunityListingId);

  const hasBrief = parsedBrief.trim().length > 0;
  const exactCount = shortlist.matches.filter((match) => match.category === "Exact Match").length;

  function parseBrief() {
    const trimmed = brief.trim();
    if (!trimmed) return;
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
    setSavedBriefs((current) => {
      const savedBrief = {
        id: `brief-${Date.now()}`,
        raw: brief,
        topListing: nextShortlist.matches[0]?.listing.name,
        matchCount: nextShortlist.matches.length,
        createdAt: new Date().toISOString(),
      };
      const next = [
        savedBrief,
        ...current,
      ].slice(0, 8);
      writePersisted("brobroker:matching:saved-briefs", next);
      mirrorWorkflowEvent("matching_brief_generated", savedBrief.id, {
        brief,
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

  function resetWorkspace() {
    setBrief("");
    setParsedBrief("");
  }

  return (
    <div className="w-full px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <PageHeader
        eyebrow="Matching & shortlists"
        title="Match from a brief"
        description="Parse a buyer brief, rank inventory, and surface hidden opportunities."
        metrics={[
          {
            label: "Ranked matches",
            value: hasBrief ? `${shortlist.matches.length}` : "—",
          },
          { label: "Exact matches", value: hasBrief ? `${exactCount}` : "—" },
          {
            label: "Hidden opportunities",
            value: listings.length > 0 ? `${opportunities.length}` : "—",
          },
          {
            label: "Saved buyer checks",
            value: `${buyers.length}`,
          },
        ]}
        actions={
          hasBrief ? (
            <Button onClick={resetWorkspace} type="button" variant="secondary">
              Start over
            </Button>
          ) : null
        }
      />

      <div className="mt-12 grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(380px,0.65fr)]">
        {/* Left column — brief, criteria, ranked matches, comparison */}
        <div className="grid content-start gap-8">
          <Card>
            <CardHeader
              eyebrow="Client brief matcher"
              title="Enter buyer requirements"
              description="Add budget, size, location, year, brand, or style to sharpen the shortlist."
              action={
                <CardHeaderIcon>
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                </CardHeaderIcon>
              }
            />
            <div className="grid gap-4 px-6 py-5">
              <textarea
                aria-label="Client brief"
                className="min-h-40 w-full rounded-xl border border-[#d9d9dd] bg-white p-4 text-[15px] leading-7 text-[#17171c] outline-none placeholder:text-[#9b9ba6] focus:border-[#9b60aa] focus:ring-2 focus:ring-[#9b60aa]/15"
                onChange={(event) => setBrief(event.target.value)}
                placeholder="Describe the buyer in your own words — asset type, model, year, size, budget, geography, urgency."
                value={brief}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button disabled={!brief.trim()} onClick={parseBrief} type="button">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Generate shortlist
                </Button>
                <Button onClick={() => setBrief(exampleBrief)} type="button" variant="link">
                  Load example
                </Button>
                {brief && brief !== parsedBrief ? (
                  <span className="text-[12px] uppercase tracking-[0.14em] text-[#75758a]">
                    Unparsed changes
                  </span>
                ) : null}
              </div>
            </div>
          </Card>

          {buyers.length ? (
            <Card>
              <CardHeader
                eyebrow="Saved buyer matches"
                title="Current buyer profiles against inventory"
                description="Automatically refreshed from saved buyer profiles and current listings."
              />
              <div className="grid gap-0 divide-y divide-[#f2f2f2]">
                {buyers.map((buyer) => {
                  const matches = generateMatchesForBuyer(buyer, listings);
                  const topMatch = matches[0];
                  const topListing = listings.find((listing) => listing.id === topMatch?.listingId);

                  return (
                    <article key={buyer.id} className="grid gap-4 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-center">
                      <div className="min-w-0">
                        <Link
                          className="text-[15px] font-semibold text-[#17171c] hover:text-[#1863dc]"
                          href={`/buyers/${buyer.id}`}
                        >
                          {buyer.name}
                        </Link>
                        <p className="mt-1 text-[13px] leading-6 text-[#616161]">
                          {topListing
                            ? `Top fit: ${topListing.name}`
                            : "No listing fit found yet."}
                        </p>
                      </div>
                      <div className="rounded-xl bg-[#f7f7f9] p-4 lg:text-right">
                        <p className="bb-mono-label">Top fit</p>
                        <p className="mt-1 font-mono text-xl font-semibold text-[#17171c]">
                          {topMatch ? percentage(topMatch.fitScore) : "—"}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              eyebrow="Structured criteria"
              title="What the matcher extracted"
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
                  <CriteriaRow
                    label="Interior"
                    value={shortlist.criteria.interiorStyle ?? "Flexible"}
                  />
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

                <div className="grid gap-6 border-t border-[#f2f2f2] px-6 py-5 sm:grid-cols-2">
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
                title="No brief parsed yet"
                description="Type or paste a brief, then run Generate shortlist to extract criteria."
                action={
                  <Button
                    onClick={() => setBrief(exampleBrief)}
                    type="button"
                    size="sm"
                    variant="secondary"
                  >
                    Load an example
                  </Button>
                }
              />
            )}
          </Card>

          {hasBrief ? (
            <Card>
              <CardHeader
                eyebrow="Ranked matches"
                title="Ranked recommendations"
                action={
                  <CardHeaderIcon>
                    <Lightbulb className="h-4 w-4" aria-hidden="true" />
                  </CardHeaderIcon>
                }
              />
              <div className="grid gap-0 divide-y divide-[#f2f2f2]">
                {shortlist.matches.length ? (
                  shortlist.matches.map((match) => (
                    <article key={match.id} className="px-6 py-6">
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-start">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={categoryTone(match.category)}>{match.category}</Badge>
                            <span className="bb-mono-label">
                              {percentage(match.fitScore)} fit
                            </span>
                          </div>
                          <Link
                            className="bb-display mt-3 inline-block text-lg font-medium text-[#17171c] hover:text-[#1863dc]"
                            href={`/listings/${match.listing.id}`}
                          >
                            {match.listing.name}
                            <span className="text-[#75758a]">
                              {" "}
                              · {match.listing.builder} {match.listing.model}
                            </span>
                          </Link>
                          <p className="mt-2 text-sm leading-6 text-[#3f3f46]">{match.rationale}</p>
                        </div>
                        <div className="rounded-xl bg-[#f7f7f9] p-4 lg:text-right">
                          <p className="bb-mono-label">Fit</p>
                          <p className="bb-display mt-2 text-2xl font-medium text-[#17171c]">
                            {percentage(match.fitScore)}
                          </p>
                          <ProgressBar className="mt-3" value={match.fitScore} />
                        </div>
                      </div>
                      <div className="mt-5 grid gap-4 lg:grid-cols-3">
                        <ListBlock
                          icon={CheckCircle2}
                          title="Criteria met"
                          items={match.criteriaMet}
                        />
                        <ListBlock
                          icon={CircleAlert}
                          title="Missing / uncertain"
                          items={
                            match.missingCriteria.length
                              ? match.missingCriteria
                              : ["No blockers flagged"]
                          }
                        />
                        <ListBlock
                          icon={Lightbulb}
                          title="Broker talking points"
                          items={match.talkingPoints}
                        />
                      </div>
                    </article>
                  ))
                ) : (
                  <EmptyState
                    title={
                      listings.length === 0
                        ? "No inventory to score against"
                        : "Brief parsed but no listings matched"
                    }
                    description={
                      listings.length === 0
                        ? "The brief is structured and ready — add inventory and the matcher will rank it against these criteria."
                        : "Try widening budget, size, or location. The matcher needs at least one listing inside the requested band."
                    }
                    action={
                      listings.length === 0 ? (
                        <Link
                          className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#d9d9dd] bg-white px-4 text-[13px] font-medium text-[#17171c] hover:border-[#17171c]"
                          href="/listings"
                        >
                          Open listings
                        </Link>
                      ) : null
                    }
                  />
                )}
              </div>
            </Card>
          ) : null}

          {hasBrief && shortlist.matches.length > 0 ? (
            <Card>
              <CardHeader
                eyebrow="Competitive set"
                title="Comparison table and outreach copy"
                action={
                  <CardHeaderIcon>
                    <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                  </CardHeaderIcon>
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left text-sm">
                  <thead className="border-b border-[#f2f2f2] text-[11px] uppercase tracking-[0.16em] text-[#75758a]">
                    <tr>
                      <th className="px-6 py-3 font-medium">Asset</th>
                      <th className="px-6 py-3 font-medium">Category</th>
                      <th className="px-6 py-3 font-medium">Fit</th>
                      <th className="px-6 py-3 font-medium">Price</th>
                      <th className="px-6 py-3 font-medium">Size / Year</th>
                      <th className="px-6 py-3 font-medium">VAT</th>
                      <th className="px-6 py-3 font-medium">Top trade-off</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f2f2f2]">
                    {shortlist.comparisonRows.map((row) => (
                      <tr key={row.listing.id} className="align-top">
                        <td className="px-6 py-4 font-medium text-[#17171c]">{row.listing.name}</td>
                        <td className="px-6 py-4">
                          <Badge tone={categoryTone(row.category)}>{row.category}</Badge>
                        </td>
                        <td className="px-6 py-4 font-mono font-medium text-[#17171c]">
                          {percentage(row.fitScore)}
                        </td>
                        <td className="px-6 py-4 text-[#3f3f46]">{formatCurrency(row.priceEur)}</td>
                        <td className="px-6 py-4 text-[#3f3f46]">
                          {row.sizeFt}ft / {row.year}
                        </td>
                        <td className="px-6 py-4 text-[#3f3f46]">{row.vatStatus}</td>
                        <td className="px-6 py-4 text-[#616161]">{row.topTradeOff}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-[#f2f2f2] px-6 py-5">
                <div className="rounded-2xl bg-[#003c33] p-5 text-white">
                  <div className="flex items-center gap-2">
                    <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                    <p className="bb-mono-label !text-white/70">Suggested outreach</p>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-white/90">
                    {shortlist.outreachMessage}
                  </p>
                </div>
              </div>
            </Card>
          ) : null}
        </div>

        {/* Right column — missing criteria, trade-offs, hidden opportunities */}
        <div className="grid content-start gap-8">
          {hasBrief && shortlist.matches.length > 0 ? (
            <>
              <Card>
                <CardHeader
                  eyebrow="Missing criteria"
                  title="What to verify before sending"
                  action={
                    <CardHeaderIcon className="bg-amber-50 text-[#b45309]">
                      <CircleAlert className="h-4 w-4" aria-hidden="true" />
                    </CardHeaderIcon>
                  }
                />
                {shortlist.missingCriteria.length ? (
                  <ul className="grid gap-0 divide-y divide-[#f2f2f2]">
                    {shortlist.missingCriteria.map((item) => (
                      <li key={item} className="flex items-start gap-3 px-6 py-4">
                        <CircleAlert
                          className="mt-0.5 h-4 w-4 shrink-0 text-[#b45309]"
                          aria-hidden="true"
                        />
                        <p className="text-sm leading-6 text-[#3f3f46]">{item}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    title="No criteria blockers"
                    description="The current shortlist has nothing flagged by the deterministic matcher."
                  />
                )}
              </Card>

              <Card>
                <CardHeader
                  eyebrow="Trade-offs"
                  title="Broker framing notes"
                  action={
                    <CardHeaderIcon>
                      <Lightbulb className="h-4 w-4" aria-hidden="true" />
                    </CardHeaderIcon>
                  }
                />
                {shortlist.tradeOffs.length ? (
                  <ul className="grid gap-0 divide-y divide-[#f2f2f2]">
                    {shortlist.tradeOffs.map((tradeOff) => (
                      <li key={tradeOff} className="px-6 py-4 text-sm leading-6 text-[#3f3f46]">
                        {tradeOff}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    title="No trade-offs to frame"
                    description="The current shortlist has no headline trade-offs flagged for broker framing."
                  />
                )}
              </Card>
            </>
          ) : null}

          <Card>
            <CardHeader
              eyebrow="Hidden opportunities"
              title="Who should hear about it"
              action={
                <CardHeaderIcon>
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                </CardHeaderIcon>
              }
            />
            {listings.length === 0 ? (
              <EmptyState
                title="No inventory to discover against"
                description="Add a listing to check it against buyer memory, timing, budget, and objections."
                action={
                  <Link
                    className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#d9d9dd] bg-white px-4 text-[13px] font-medium text-[#17171c] hover:border-[#17171c]"
                    href="/listings"
                  >
                    Open listings
                  </Link>
                }
              />
            ) : (
              <div className="grid gap-4 px-6 py-5">
                <SelectMenu
                  label="New or updated listing"
                  onChange={setOpportunityListingId}
                  options={listings.map((listing) => ({
                    label: `${listing.name} · ${listing.builder} ${listing.model}`,
                    value: listing.id,
                    meta: `${listing.assetType ?? "Yacht"} · ${listing.location}`,
                  }))}
                  value={opportunityListingId}
                />

                {selectedListing ? (
                  <p className="text-[13px] leading-6 text-[#75758a]">
                    <span className="font-medium text-[#17171c]">{selectedListing.name}</span> is
                    checked against buyer memory, timing, budget range, VAT needs, and known
                    objections.
                  </p>
                ) : null}

                {opportunities.length ? (
                  <ul className="grid gap-0 divide-y divide-[#f2f2f2]">
                    {opportunities.map((opportunity) => (
                      <li key={opportunity.buyer.id} className="py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link
                              className="text-[15px] font-medium text-[#17171c] hover:text-[#1863dc]"
                              href={`/buyers/${opportunity.buyer.id}`}
                            >
                              {opportunity.buyer.name}
                            </Link>
                            <p className="mt-1 text-[13px] leading-6 text-[#616161]">
                              {opportunity.recommendedAction}
                            </p>
                          </div>
                          <Badge tone={categoryTone(opportunity.match.category)}>
                            {percentage(opportunity.score)}
                          </Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {opportunity.memorySignals.map((signal) => (
                            <Badge key={signal} tone="neutral">
                              {signal}
                            </Badge>
                          ))}
                        </div>
                        <p className="mt-2 text-[13px] text-[#75758a]">
                          Watch: {opportunity.blocker ?? "No blocker currently flagged"}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] leading-6 text-[#75758a]">
                    No buyer memory profile currently crosses the opportunity threshold for this
                    listing.
                  </p>
                )}
              </div>
            )}
          </Card>

          {savedBriefs.length ? (
            <Card>
              <CardHeader
                eyebrow="Persistent brief memory"
                title="Saved shortlist runs"
                action={
                  <CardHeaderIcon>
                    <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                  </CardHeaderIcon>
                }
              />
              <ul className="divide-y divide-[#f2f2f2]">
                {savedBriefs.slice(0, 4).map((item) => (
                  <li key={item.id} className="px-6 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-[14px] font-medium text-[#17171c]">
                        {item.topListing ?? "No top fit yet"}
                      </p>
                      <Badge tone="success">Saved</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-6 text-[#616161]">
                      {item.raw}
                    </p>
                    <p className="mt-2 text-[12px] uppercase tracking-[0.14em] text-[#75758a]">
                      {item.matchCount} ranked matches
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CriteriaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="bb-mono-label">{label}</dt>
      <dd className="mt-1.5 text-[14px] text-[#17171c]">{value}</dd>
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
          <p className="text-sm leading-6 text-[#75758a]">{empty}</p>
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
        <Icon className="h-3.5 w-3.5 text-[#003c33]" aria-hidden="true" />
        <p className="bb-mono-label">{title}</p>
      </div>
      <ul className="mt-2 grid gap-1">
        {items.map((item) => (
          <li key={item} className="text-[13px] leading-6 text-[#3f3f46]">
            · {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
