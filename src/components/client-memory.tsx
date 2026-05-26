import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Gauge,
  LockKeyhole,
  Mail,
  MessageSquareText,
  PlusCircle,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  Table2,
} from "lucide-react";
import { buyers, sellers } from "@/lib/demo-data";
import {
  type BrokerSegment,
  getBuyersForSegment,
  getConversationsForSegment,
  getFollowUpDraftsForSegment,
  getListingsForSegment,
  getTasksForSegment,
} from "@/lib/broker-segments";
import {
  deriveBuyerNextActions,
  generateBuyerSafeBrief,
  generateMatchesForBuyer,
  getBuyerMemoryProfile,
  getListingById,
  getSellerById,
  getSellerMemoryProfile,
  getVerificationForBuyer,
  getVerificationTone,
} from "@/lib/services";
import type { BuyerProfile, MatchResult, Priority } from "@/lib/types";
import { daysUntil, formatCurrency, formatDate, percentage } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardHeaderIcon,
  EmptyState,
  PageHeader,
  ProgressBar,
  Stat,
  StatusDot,
  TabList,
} from "./ui";
import { ExpandablePreferenceChips } from "./expandable-preference-chips";
import { SessionBuyerQueue } from "./intake-panels";
import { OwnerNotePanel } from "./owner-note-panel";

function dueLabel(date: string) {
  const delta = daysUntil(date);
  if (delta < 0) return `${Math.abs(delta)}d overdue`;
  if (delta === 0) return "Due today";
  if (delta === 1) return "Due tomorrow";
  return `Due in ${delta}d`;
}

function urgencyTone(urgency: BuyerProfile["urgency"]): "error" | "warning" | "info" | "neutral" {
  if (urgency === "Immediate") return "error";
  if (urgency === "This Season") return "warning";
  if (urgency === "This Quarter") return "info";
  return "neutral";
}

function priorityTone(priority: Priority): "error" | "warning" | "info" | "neutral" {
  if (priority === "Critical") return "error";
  if (priority === "High") return "warning";
  if (priority === "Medium") return "info";
  return "neutral";
}

function stageTone(
  stage: BuyerProfile["currentStage"],
): "success" | "info" | "warning" | "neutral" {
  if (stage === "Negotiation") return "success";
  if (stage === "Viewing Planned") return "success";
  if (stage === "Shortlist Sent") return "info";
  if (stage === "Qualified") return "info";
  return "neutral";
}

type BuyerMemoryModel = NonNullable<ReturnType<typeof getBuyerMemoryProfile>>;

function getBuyerMemoryModel(buyer: BuyerProfile, segment?: BrokerSegment): BuyerMemoryModel {
  return getBuyerMemoryProfile(buyer.id, segment) ?? buildBuyerMemoryModel(buyer, segment);
}

function buildBuyerMemoryModel(buyer: BuyerProfile, segment?: BrokerSegment): BuyerMemoryModel {
  const matches = generateMatchesForBuyer(buyer, getListingsForSegment(segment));
  const tasks = getTasksForSegment(segment).filter(
    (task) => task.buyerId === buyer.id && task.status !== "Done",
  );
  const conversations = getConversationsForSegment(segment).filter(
    (conversation) => conversation.buyerId === buyer.id,
  );
  const drafts = getFollowUpDraftsForSegment(segment).filter((draft) => draft.buyerId === buyer.id);
  const rejectedListings = buyer.rejectedAssets.map((rejection) => ({
    rejection,
    listing: getListingById(rejection.listingId, segment),
  }));

  return {
    buyer,
    verification: getVerificationForBuyer(buyer.id, segment),
    matches,
    tasks,
    conversations,
    drafts,
    rejectedListings,
    nextActions: deriveBuyerNextActions(buyer, segment),
    buyerSafeBrief: generateBuyerSafeBrief(buyer, matches),
  };
}

function mergeBuyers(demoBuyers: BuyerProfile[], storedBuyers: BuyerProfile[]) {
  const seen = new Set<string>();

  return [...storedBuyers, ...demoBuyers].filter((buyer) => {
    if (seen.has(buyer.id)) return false;
    seen.add(buyer.id);
    return true;
  });
}

function filterBuyers(buyersToFilter: BuyerProfile[], query?: string) {
  const normalized = query?.trim().toLowerCase();
  if (!normalized) return buyersToFilter;

  return buyersToFilter.filter((buyer) =>
    [
      buyer.name,
      buyer.company,
      buyer.country,
      buyer.currentStage,
      buyer.urgency,
      buyer.preferredBrands.join(" "),
      buyer.preferredLocations.join(" "),
      buyer.lifestylePreferences.join(" "),
      buyer.mustHaves.join(" "),
      buyer.tags.join(" "),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalized),
  );
}

function buyerPrimarySegment(buyer: BuyerProfile, segment?: BrokerSegment): BrokerSegment {
  return segment ?? buyer.assetTypes?.[0] ?? "Yacht";
}

function buyerMetricLabel(buyer: BuyerProfile, segment?: BrokerSegment) {
  const primarySegment = buyerPrimarySegment(buyer, segment);
  if (primarySegment === "Car") return "Mileage";
  if (primarySegment === "Real Estate") return "Area";
  return "Size";
}

function formatBuyerMetricRange(buyer: BuyerProfile, segment?: BrokerSegment) {
  const primarySegment = buyerPrimarySegment(buyer, segment);
  const suffix = primarySegment === "Car" ? "km" : primarySegment === "Real Estate" ? "sqm" : "ft";
  return `${buyer.sizeRangeFt[0]}-${buyer.sizeRangeFt[1]} ${suffix}`;
}

function formatBuyerMetricDetail(buyer: BuyerProfile, segment?: BrokerSegment) {
  return [formatBuyerMetricRange(buyer, segment), buyer.preferredLocations.slice(0, 2).join(", ")]
    .filter(Boolean)
    .join(" · ");
}

export function BuyerIndex({
  query,
  segment,
  storedBuyers = [],
}: {
  query?: string;
  segment?: BrokerSegment;
  storedBuyers?: BuyerProfile[];
}) {
  const allBuyers = mergeBuyers(getBuyersForSegment(segment), storedBuyers);
  const visibleBuyers = filterBuyers(allBuyers, query);

  if (allBuyers.length === 0 && !query) {
    return <FirstRunBuyers />;
  }

  const buyerProfiles = visibleBuyers
    .map((buyer) => getBuyerMemoryModel(buyer, segment))
    .filter(Boolean);
  const totalBudget = visibleBuyers.reduce((total, buyer) => total + buyer.budgetMaxEur, 0);
  const dueNow = visibleBuyers.filter((buyer) => daysUntil(buyer.nextActionDueAt) <= 0).length;
  const verifiedCount = buyerProfiles.filter(
    (profile) => profile?.verification?.status === "Verified",
  ).length;

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <PageHeader
        eyebrow="Client memory"
        title="Buyer memory"
        description="Review criteria, urgency, relationships, rejected assets, and next actions."
        metrics={[
          { label: "Active buyers", value: `${visibleBuyers.length}` },
          { label: "Max buying power", value: formatCurrency(totalBudget) },
          { label: "Action needed", value: `${dueNow}` },
          { label: "Verified", value: `${verifiedCount}` },
        ]}
        actions={
          <Link
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#17171c] px-5 text-sm font-medium text-white hover:bg-[#2a2a32]"
            href="/buyers/new"
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            Add buyer
          </Link>
        }
      />

      <form action="/buyers" className="mt-10 flex max-w-2xl items-stretch gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Search buyers</span>
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#75758a]"
            aria-hidden="true"
          />
          <input
            className="h-11 w-full rounded-full border border-[#d9d9dd] bg-white pl-11 pr-4 text-sm text-[#17171c] outline-none placeholder:text-[#9b9ba6] focus:border-[#9b60aa] focus:ring-2 focus:ring-[#9b60aa]/15"
            defaultValue={query}
            name="q"
            placeholder="Family use, VAT, Germany..."
            type="search"
          />
        </label>
        <Button size="sm" type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <SessionBuyerQueue />

      {visibleBuyers.length === 0 ? (
        <Card className="mt-12">
          <EmptyState
            title={`No buyers match “${query}”`}
            description="Adjust the search or open the matching workspace to surface buyers by criteria."
            action={
              <Link
                className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#d9d9dd] bg-white px-4 text-[13px] font-medium text-[#17171c] hover:border-[#17171c]"
                href="/buyers"
              >
                Clear search
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <section className="mt-12 grid gap-5 xl:grid-cols-2">
            {visibleBuyers.map((buyer) => (
              <BuyerCard key={buyer.id} buyer={buyer} segment={segment} />
            ))}
          </section>

          <Card className="mt-12">
            <CardHeader
              eyebrow="Broker table"
              title="Buyer continuity scan"
              action={
                <CardHeaderIcon>
                  <Table2 className="h-4 w-4" aria-hidden="true" />
                </CardHeaderIcon>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="border-b border-[#f2f2f2] text-[11px] uppercase tracking-[0.16em] text-[#75758a]">
                  <tr>
                    <th className="px-6 py-3 font-medium">Buyer</th>
                    <th className="px-6 py-3 font-medium">Budget</th>
                    <th className="px-6 py-3 font-medium">Stage</th>
                    <th className="px-6 py-3 font-medium">Urgency</th>
                    <th className="px-6 py-3 font-medium">Next action</th>
                    <th className="px-6 py-3 font-medium">Communication</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f2f2f2]">
                  {visibleBuyers.map((buyer) => (
                    <tr key={buyer.id} className="align-top">
                      <td className="px-6 py-4">
                        <Link
                          className="text-[14px] font-medium text-[#17171c] hover:text-[#1863dc]"
                          href={`/buyers/${buyer.id}`}
                        >
                          {buyer.name}
                        </Link>
                        <p className="mt-1 text-[13px] text-[#75758a]">
                          {[buyer.company, buyer.country].filter(Boolean).join(" · ")}
                        </p>
                      </td>
                      <td className="px-6 py-4 font-medium text-[#17171c]">
                        {formatCurrency(buyer.budgetMinEur)} – {formatCurrency(buyer.budgetMaxEur)}
                      </td>
                      <td className="px-6 py-4">
                        <Badge tone={stageTone(buyer.currentStage)}>{buyer.currentStage}</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Badge tone={urgencyTone(buyer.urgency)}>{buyer.urgency}</Badge>
                      </td>
                      <td className="px-6 py-4 text-[#3f3f46]">{dueLabel(buyer.nextActionDueAt)}</td>
                      <td className="px-6 py-4 text-[#3f3f46]">{buyer.communicationStyle}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

/* First-run buyers — clean editorial hero + three primary actions + an
   explainer card showing what each buyer profile will remember. */
function FirstRunBuyers() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <PageHeader
        eyebrow="Client memory"
        title="Add your first buyer"
        description="Capture criteria, urgency, style, objections, and next actions for every conversation."
        actions={
          <Link
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#17171c] px-5 text-sm font-medium text-white hover:bg-[#2a2a32]"
            href="/buyers/new"
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            Add buyer
          </Link>
        }
      />

      <section aria-labelledby="buyers-quick-start" className="mt-12">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="bb-mono-label">Quick start</p>
            <h2
              className="bb-display mt-2 text-xl font-medium text-[#17171c]"
              id="buyers-quick-start"
            >
              Three ways to start a buyer
            </h2>
          </div>
          <p className="hidden text-[13px] text-[#75758a] sm:block">
            Each path persists buyer memory.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <BuyersActionCard
            description="Paste a call summary to create memory, tasks, and drafts."
            href="/voice-crm"
            icon={Radio}
            step="01"
            title="Capture a call"
          />
          <BuyersActionCard
            description="Type a brief and attach a generated shortlist."
            href="/matching"
            icon={Gauge}
            step="02"
            title="Run a brief"
          />
          <BuyersActionCard
            description="Clear serious inquiries before sensitive sharing."
            href="/verification"
            icon={ShieldCheck}
            step="03"
            title="Open verification"
          />
        </div>
      </section>

      <Card className="mt-12">
        <CardHeader
          eyebrow="What each buyer remembers"
          title="Memory you'll have on every conversation"
        />
        <ul className="divide-y divide-[#f2f2f2]">
          <BuyersExplainerRow
            icon={CircleAlert}
            title="Criteria, urgency, and stage"
            description="Budget, size, brands, VAT needs, timeline, and stage."
          />
          <BuyersExplainerRow
            icon={LockKeyhole}
            title="Verification and access readiness"
            description="Risk score, action, and broker-held sensitive assets."
          />
          <BuyersExplainerRow
            icon={MessageSquareText}
            title="Communication and relationship notes"
            description="Channel, cadence, objections, and rejected assets."
          />
          <BuyersExplainerRow
            icon={Mail}
            title="Drafts waiting for broker approval"
            description="Replies and recaps stay editable before send."
          />
        </ul>
      </Card>
    </div>
  );
}

function BuyersActionCard({
  description,
  href,
  icon: Icon,
  step,
  title,
}: {
  description: string;
  href: string;
  icon: LucideIcon;
  step: string;
  title: string;
}) {
  return (
    <Link
      className="group flex h-full flex-col justify-between gap-5 rounded-2xl border border-[#e5e7eb] bg-white p-6 transition-colors hover:border-[#17171c]"
      href={href}
    >
      <div>
        <div className="flex items-center justify-between">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#003c33] text-white">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="bb-mono-label">{step}</span>
        </div>
        <h3 className="bb-display mt-5 text-lg font-medium text-[#17171c]">{title}</h3>
        <p className="mt-2 text-[13px] leading-6 text-[#616161]">{description}</p>
      </div>
      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#17171c]">
        Get started
        <ArrowRight
          className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}

function BuyersExplainerRow({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <li className="grid gap-4 px-6 py-5 sm:grid-cols-[36px_1fr]">
      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e5e7eb] bg-white text-[#003c33]">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-[14px] font-medium text-[#17171c]">{title}</p>
        <p className="mt-1 text-[13px] leading-6 text-[#616161]">{description}</p>
      </div>
    </li>
  );
}

function BuyerCard({ buyer, segment }: { buyer: BuyerProfile; segment?: BrokerSegment }) {
  const profile = getBuyerMemoryModel(buyer, segment);
  const verification = profile?.verification;
  const tone = getVerificationTone(verification?.status ?? "Needs Review");
  const topMatch = profile?.matches[0];
  const topListing = topMatch ? getListingById(topMatch.listingId, segment) : undefined;
  const preferenceChips = Array.from(new Set([
    ...buyer.lifestylePreferences.slice(0, 3),
    ...buyer.mustHaves.slice(0, 2),
  ]));

  return (
    <Card className="group flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#fbfaf7_100%)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#cfcfd6] hover:shadow-[0_18px_45px_rgba(23,23,28,0.08)]">
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#003c33] text-[15px] font-medium text-white shadow-[0_10px_24px_rgba(0,60,51,0.18)]"
            >
              {buyer.name
                .split(" ")
                .map((part) => part[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={stageTone(buyer.currentStage)}>{buyer.currentStage}</Badge>
                <Badge className={tone.className}>
                  <StatusDot className={tone.dotClassName} />
                  {verification?.status ?? "Needs Review"}
                </Badge>
              </div>
              <h2 className="bb-display mt-3 truncate text-xl font-medium tracking-[-0.01em] text-[#17171c]">
                {buyer.name}
              </h2>
              <p className="mt-1 truncate text-[13px] text-[#75758a]">
                {[buyer.company, buyer.country].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          <Badge className="shrink-0" tone={urgencyTone(buyer.urgency)}>
            {buyer.urgency}
          </Badge>
        </div>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#ececf0] bg-white/80 p-4">
            <dt className="bb-mono-label">Budget & {buyerMetricLabel(buyer, segment).toLowerCase()}</dt>
            <dd className="mt-2 text-[17px] font-medium tracking-[-0.01em] text-[#17171c]">
              {formatCurrency(buyer.budgetMinEur)} – {formatCurrency(buyer.budgetMaxEur)}
            </dd>
            <dd className="mt-1 text-[13px] leading-5 text-[#616161]">
              {formatBuyerMetricDetail(buyer, segment)}
            </dd>
          </div>
          <div className="rounded-2xl border border-[#ececf0] bg-white/80 p-4">
            <dt className="bb-mono-label">Next action</dt>
            <dd className="mt-2 text-[17px] font-medium tracking-[-0.01em] text-[#17171c]">
              {dueLabel(buyer.nextActionDueAt)}
            </dd>
            <dd className="mt-1 line-clamp-2 text-[13px] leading-5 text-[#616161]">
              {profile?.nextActions[0]?.label ?? "No open action"}
            </dd>
          </div>
        </dl>

        <div className="mt-6 min-w-0">
          <p className="bb-mono-label">Remembered preferences</p>
          <ExpandablePreferenceChips items={preferenceChips} />
          <p className="mt-4 line-clamp-2 text-[13px] leading-6 text-[#616161]">
            {buyer.relationshipNotes[0] ?? "No relationship note recorded yet."}
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-[#e8e8ec] bg-[#f7f7f9] p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="bb-mono-label">Top fit</p>
              <p className="mt-2 truncate text-[13px] font-medium text-[#616161]">
                {topListing ? topListing.name : "No match yet"}
              </p>
            </div>
            <p className="shrink-0 font-mono text-2xl font-semibold tracking-[-0.04em] text-[#17171c]">
              {topMatch ? percentage(topMatch.fitScore) : "—"}
            </p>
          </div>
          <ProgressBar className="mt-4 h-2" value={topMatch?.fitScore ?? 0} />
        </div>

        <div className="mt-auto pt-6">
          <Link
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#17171c] px-5 text-sm font-medium text-white transition-colors hover:bg-[#2a2a32] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c6ee6]"
            href={`/buyers/${buyer.id}`}
          >
            Open buyer memory
            <ArrowRight
              className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </div>
      </div>
    </Card>
  );
}

export function BuyerMemoryProfile({
  buyerId,
  buyerOverride,
  segment,
}: {
  buyerId: string;
  buyerOverride?: BuyerProfile;
  segment?: BrokerSegment;
}) {
  const profile = buyerOverride
    ? getBuyerMemoryModel(buyerOverride, segment)
    : getBuyerMemoryProfile(buyerId, segment);

  if (!profile) {
    return null;
  }

  const {
    buyer,
    verification,
    matches,
    conversations,
    drafts,
    rejectedListings,
    nextActions,
    buyerSafeBrief,
  } = profile;
  const verificationTone = getVerificationTone(verification?.status ?? "Needs Review");

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <Link
        className="inline-flex items-center gap-2 text-sm font-medium text-[#3f3f46] hover:text-[#17171c]"
        href="/buyers"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to buyers
      </Link>

      <div className="mt-6">
        <PageHeader
          eyebrow={[buyer.company, buyer.country].filter(Boolean).join(" · ") || "Buyer memory"}
          title={buyer.name}
          description={`${buyer.decisionTimeline}. ${buyer.communicationStyle}.`}
          metrics={[
            {
              label: "Budget",
              value: `${formatCurrency(buyer.budgetMinEur)} – ${formatCurrency(buyer.budgetMaxEur)}`,
            },
            { label: "Next action", value: dueLabel(buyer.nextActionDueAt) },
            { label: "Top fit", value: matches[0] ? percentage(matches[0].fitScore) : "—" },
          ]}
          actions={
            <>
              <Badge tone={stageTone(buyer.currentStage)}>{buyer.currentStage}</Badge>
              <Badge tone={urgencyTone(buyer.urgency)}>{buyer.urgency}</Badge>
              <Badge className={verificationTone.className}>
                <StatusDot className={verificationTone.dotClassName} />
                {verification?.status ?? "Needs Review"}
              </Badge>
            </>
          }
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-1.5">
        {buyer.tags.map((tag, index) => (
          <Badge key={`${tag}-${index}`} tone="neutral">
            {tag}
          </Badge>
        ))}
      </div>

      <Card className="mt-12">
        <CardHeader
          eyebrow="Buyer profile"
          title="Criteria and relationship memory"
          action={<TabList active="Memory" items={["Memory", "Matches", "Drafts"]} />}
        />
        <div className="grid gap-x-12 gap-y-5 px-6 py-5 lg:grid-cols-2">
          <InfoColumn
            title="Budget and criteria"
            rows={[
              [
                "Budget",
                `${formatCurrency(buyer.budgetMinEur)} – ${formatCurrency(buyer.budgetMaxEur)}`,
              ],
              [buyerMetricLabel(buyer, segment), formatBuyerMetricRange(buyer, segment)],
              ["Preferred brands", buyer.preferredBrands.join(", ")],
              ["Preferred locations", buyer.preferredLocations.join(", ")],
            ]}
          />
          <InfoColumn
            title="Relationship context"
            rows={[
              ["Decision timeline", buyer.decisionTimeline],
              ["Communication style", buyer.communicationStyle],
              ["Last contacted", formatDate(buyer.lastContactedAt)],
              ["Next action", dueLabel(buyer.nextActionDueAt)],
            ]}
          />
        </div>

        <div className="grid gap-x-10 gap-y-6 border-t border-[#f2f2f2] px-6 py-5 lg:grid-cols-3">
          <InsightList icon={Sparkles} title="Preferences" items={buyer.lifestylePreferences} />
          <InsightList icon={CheckCircle2} title="Must-haves" items={buyer.mustHaves} />
          <InsightList icon={CircleAlert} title="Deal breakers" items={buyer.dealBreakers} />
        </div>

        <div className="grid gap-x-10 gap-y-6 border-t border-[#f2f2f2] px-6 py-5 lg:grid-cols-2">
          <InsightList
            icon={MessageSquareText}
            title="Relationship notes"
            items={buyer.relationshipNotes}
          />
          <InsightList
            icon={CircleAlert}
            title="Known objections"
            items={buyer.objections.length ? buyer.objections : ["No open objections recorded"]}
          />
        </div>
      </Card>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div className="grid content-start gap-8">
          <Card>
            <CardHeader
              eyebrow="Rejected assets"
              title="Do not repeat the same mismatch"
            />
            <ul className="grid gap-0 divide-y divide-[#f2f2f2]">
              {rejectedListings.length ? (
                rejectedListings.map(({ rejection, listing }) => (
                  <li
                    key={rejection.listingId}
                    className="grid gap-3 px-6 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                  >
                    <div className="min-w-0">
                      <h2 className="text-[14px] font-medium text-[#17171c]">
                        {listing?.name ?? "Unknown asset"}
                      </h2>
                      <p className="mt-1 text-[13px] leading-6 text-[#616161]">
                        {rejection.reason}
                      </p>
                    </div>
                    <Badge tone="warning">Rejected {formatDate(rejection.rejectedAt)}</Badge>
                  </li>
                ))
              ) : (
                <li className="px-6 py-5 text-sm leading-6 text-[#616161]">
                  No rejected assets have been recorded for this buyer yet.
                </li>
              )}
            </ul>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Matching memory"
              title="Current recommendations and missing criteria"
            />
            <ul className="grid gap-0 divide-y divide-[#f2f2f2]">
              {matches.map((match) => (
                <MatchPanel key={match.id} match={match} segment={segment} />
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Conversation continuity"
              title="Recent conversations and drafts"
            />
            <ul className="grid gap-0 divide-y divide-[#f2f2f2]">
              {conversations.map((conversation) => (
                <li key={conversation.id} className="px-6 py-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{conversation.channel}</Badge>
                    <span className="text-[12px] uppercase tracking-[0.14em] text-[#75758a]">
                      {formatDate(conversation.occurredAt)}
                    </span>
                    {conversation.needsSummary ? <Badge tone="warning">Needs summary</Badge> : null}
                  </div>
                  <p className="mt-2 text-[13px] leading-6 text-[#3f3f46]">
                    {conversation.summary}
                  </p>
                </li>
              ))}
              {drafts.map((draft) => (
                <li key={draft.id} className="px-6 py-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="success">{draft.status}</Badge>
                    <Badge tone="neutral">{draft.channel}</Badge>
                  </div>
                  <h2 className="mt-2 text-[14px] font-medium text-[#17171c]">{draft.subject}</h2>
                  <p className="mt-2 text-[13px] leading-6 text-[#3f3f46]">{draft.body}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="grid content-start gap-8">
          <ActionStack actions={nextActions} title="Memory-derived next actions" />

          <Card id="buyer-safe-brief">
            <CardHeader
              eyebrow="Buyer-safe content"
              title={buyerSafeBrief.headline}
              action={
                <CardHeaderIcon>
                  <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                </CardHeaderIcon>
              }
            />
            <ul className="grid gap-0 divide-y divide-[#f2f2f2]">
              {buyerSafeBrief.body.map((line, index) => (
                <li key={`${line}-${index}`} className="px-6 py-3.5 text-[13px] leading-6 text-[#3f3f46]">
                  {line}
                </li>
              ))}
            </ul>
            <div className="border-t border-[#f2f2f2] bg-emerald-50/60 px-6 py-4">
              <p className="bb-mono-label text-emerald-800">Approved facts used</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {buyerSafeBrief.approvedFacts.map((fact, index) => (
                  <Badge key={`${fact}-${index}`} tone="success">
                    {fact}
                  </Badge>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Broker guardrails"
              title="Filtered before buyer delivery"
            />
            <ul className="grid gap-0 divide-y divide-[#f2f2f2]">
              {buyerSafeBrief.removedInternalFields.map((field, index) => (
                <li key={`${field}-${index}`} className="flex items-start gap-3 px-6 py-3.5">
                  <LockKeyhole
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#003c33]"
                    aria-hidden="true"
                  />
                  <p className="text-[13px] leading-6 text-[#3f3f46]">{field}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Verification context"
              title={verification?.requestedAccess ?? "Access request"}
            />
            <div className="px-6 py-5">
              <div className="flex items-center justify-between gap-3">
                <Badge className={verificationTone.className}>
                  <StatusDot className={verificationTone.dotClassName} />
                  {verification?.status ?? "Needs Review"}
                </Badge>
                <span className="font-mono text-[14px] font-medium text-[#17171c]">
                  {verification?.score ?? 0}
                </span>
              </div>
              <ProgressBar className="mt-3" value={verification?.score ?? 0} />
              <p className="mt-3 text-[13px] leading-6 text-[#616161]">
                {verification?.recommendedAction ?? "No verification recommendation recorded."}
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MatchPanel({
  match,
  segment,
}: {
  match: MatchResult;
  segment?: BrokerSegment;
}) {
  const listing = getListingById(match.listingId, segment);
  const owner = listing ? getSellerById(listing.ownerId, segment) : undefined;

  return (
    <li className="px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge tone="info">{match.category}</Badge>
          <h2 className="mt-2 text-[14px] font-medium text-[#17171c]">
            {listing ? `${listing.name} · ${listing.builder} ${listing.model}` : "Unknown asset"}
          </h2>
          {owner ? (
            <Link
              className="mt-1 inline-flex text-[13px] font-medium text-[#1863dc] hover:underline"
              href={`/sellers/${owner.id}`}
            >
              {owner.name}
            </Link>
          ) : null}
        </div>
        <span className="font-mono text-[13px] font-medium text-[#17171c]">
          {percentage(match.fitScore)}
        </span>
      </div>
      <ProgressBar className="mt-3" value={match.fitScore} />
      <p className="mt-3 text-[13px] leading-6 text-[#3f3f46]">{match.rationale}</p>
      <div className="mt-3 grid gap-x-10 gap-y-3 sm:grid-cols-2">
        <ListBlock
          label="Criteria met"
          items={match.criteriaMet.length ? match.criteriaMet : ["Needs broker review"]}
        />
        <ListBlock
          label="Missing criteria"
          items={
            match.missingCriteria.length
              ? match.missingCriteria
              : ["No missing criteria flagged"]
          }
        />
      </div>
    </li>
  );
}

export function SellerMemoryProfile({ sellerId, segment }: { sellerId: string; segment?: BrokerSegment }) {
  const profile = getSellerMemoryProfile(sellerId, segment);

  if (!profile) {
    return null;
  }

  const { seller, assets, tasks, conversations, reports, nextActions } = profile;
  const totalValue = assets.reduce((total, listing) => total + listing.priceEur, 0);

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <Link
        className="inline-flex items-center gap-2 text-sm font-medium text-[#3f3f46] hover:text-[#17171c]"
        href="/listings"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to listings
      </Link>

      <div className="mt-6">
        <PageHeader
          eyebrow="Seller memory"
          title={seller.name}
          description="Owner motivation, pricing posture, feedback expectations, and next update timing."
          metrics={[
            { label: "Portfolio", value: `${assets.length} assets` },
            { label: "Asking value", value: formatCurrency(totalValue) },
            { label: "Owner update", value: dueLabel(seller.nextOwnerUpdateDueAt) },
          ]}
          actions={<Badge tone="neutral">{seller.reportingCadence}</Badge>}
        />
      </div>

      <div className="mt-12 grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div className="grid content-start gap-8">
          <Card>
            <CardHeader eyebrow="Owner profile" title="Expectations and pricing context" />
            <div className="grid gap-x-10 gap-y-5 px-6 py-5 sm:grid-cols-2">
              <InfoColumn
                title="Commercial context"
                rows={[
                  ["Motivation", seller.motivation],
                  ["Pricing sensitivity", seller.pricingSensitivity],
                  ["Reporting cadence", seller.reportingCadence],
                  ["Next update", dueLabel(seller.nextOwnerUpdateDueAt)],
                ]}
              />
              <InfoColumn
                title="Communication expectation"
                rows={[
                  ["Expectation", seller.communicationExpectation],
                  ["Open tasks", `${tasks.length}`],
                  ["Recent conversations", `${conversations.length}`],
                  ["Report drafts", `${reports.length}`],
                ]}
              />
            </div>
            <div className="border-t border-[#f2f2f2] px-6 py-5">
              <InsightList
                icon={MessageSquareText}
                title="Feedback history"
                items={seller.feedbackHistory}
              />
            </div>
          </Card>

          <Card>
            <CardHeader eyebrow="Portfolio" title="Listed assets and blockers" />
            <ul className="grid gap-0 divide-y divide-[#f2f2f2]">
              {assets.map((asset) => (
                <li
                  key={asset.id}
                  className="grid gap-3 px-6 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                >
                  <div className="min-w-0">
                    <Link
                      className="text-[14px] font-medium text-[#17171c] hover:text-[#1863dc]"
                      href={`/listings/${asset.id}`}
                    >
                      {asset.name}
                    </Link>
                    <p className="mt-1 text-[13px] leading-6 text-[#616161]">
                      {asset.builder} {asset.model} · {asset.location} · Missing:{" "}
                      {asset.missingInfo.length ? asset.missingInfo.join(", ") : "none"}.
                    </p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="font-mono text-[14px] font-medium text-[#17171c]">
                      {formatCurrency(asset.priceEur)}
                    </p>
                    <p className="mt-1 text-[12px] uppercase tracking-[0.14em] text-[#75758a]">
                      {asset.status}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader eyebrow="Owner reporting" title="Prepared update material" />
            <div className="grid gap-0 divide-y divide-[#f2f2f2]">
              {reports.length ? (
                reports.map((report) => (
                  <article key={report.title} className="px-6 py-5">
                    <h2 className="text-[14px] font-medium text-[#17171c]">{report.title}</h2>
                    <p className="mt-2 text-[13px] leading-6 text-[#3f3f46]">{report.summary}</p>
                    <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                      {report.sections.map((section) => (
                        <div key={section.label}>
                          <dt className="bb-mono-label">{section.label}</dt>
                          <dd className="mt-1.5 text-[13px] leading-6 text-[#3f3f46]">
                            {section.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </article>
                ))
              ) : (
                <p className="px-6 py-5 text-sm leading-6 text-[#616161]">
                  No owner report draft is prepared for this seller yet.
                </p>
              )}
            </div>
          </Card>
        </div>

        <div className="grid content-start gap-8">
          <ActionStack actions={nextActions} title="Owner next actions" />

          <OwnerNotePanel sellerId={seller.id} />

          <Card>
            <CardHeader
              eyebrow="Owner cadence"
              title="Next update preparation"
              action={
                <CardHeaderIcon>
                  <Mail className="h-4 w-4" aria-hidden="true" />
                </CardHeaderIcon>
              }
            />
            <div className="grid gap-4 px-6 py-5">
              <p className="text-[13px] leading-6 text-[#3f3f46]">
                {seller.communicationExpectation}
              </p>
              <Stat
                label="Cadence"
                value={seller.reportingCadence}
                detail={`Next update ${dueLabel(seller.nextOwnerUpdateDueAt)}`}
              />
              <Stat
                label="Sensitivity"
                value="Pricing posture"
                detail={seller.pricingSensitivity}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Recent touchpoints"
              title="Conversations and open tasks"
            />
            <ul className="grid gap-0 divide-y divide-[#f2f2f2]">
              {conversations.map((conversation) => (
                <li key={conversation.id} className="px-6 py-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{conversation.channel}</Badge>
                    <span className="text-[12px] uppercase tracking-[0.14em] text-[#75758a]">
                      {formatDate(conversation.occurredAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] leading-6 text-[#3f3f46]">
                    {conversation.summary}
                  </p>
                </li>
              ))}
              {tasks.map((task) => (
                <li key={task.id} className="px-6 py-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={priorityTone(task.priority)}>{task.priority}</Badge>
                    <span className="text-[12px] uppercase tracking-[0.14em] text-[#75758a]">
                      {dueLabel(task.dueAt)}
                    </span>
                  </div>
                  <h2 className="mt-2 text-[14px] font-medium text-[#17171c]">{task.title}</h2>
                  <p className="mt-1 text-[13px] leading-6 text-[#616161]">{task.reason}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ActionStack({
  actions,
  title,
}: {
  actions: Array<{
    label: string;
    reason: string;
    priority: Priority;
    dueAt: string;
    kind: string;
  }>;
  title: string;
}) {
  return (
    <Card>
      <CardHeader
        eyebrow="Next-best action"
        title={title}
        action={
          <CardHeaderIcon>
            <Gauge className="h-4 w-4" aria-hidden="true" />
          </CardHeaderIcon>
        }
      />
      <ul className="grid gap-0 divide-y divide-[#f2f2f2]">
        {actions.length ? (
          actions.map((action) => (
            <li key={`${action.label}-${action.dueAt}`} className="px-6 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={priorityTone(action.priority)}>{action.priority}</Badge>
                <Badge tone="neutral">{action.kind}</Badge>
                <span className="text-[12px] uppercase tracking-[0.14em] text-[#75758a]">
                  {dueLabel(action.dueAt)}
                </span>
              </div>
              <h2 className="mt-2 text-[14px] font-medium text-[#17171c]">{action.label}</h2>
              <p className="mt-2 text-[13px] leading-6 text-[#616161]">{action.reason}</p>
            </li>
          ))
        ) : (
          <li className="px-6 py-5 text-sm leading-6 text-[#616161]">
            No memory-derived action is currently required.
          </li>
        )}
      </ul>
    </Card>
  );
}

function InfoColumn({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, string]>;
}) {
  return (
    <div className="min-w-0">
      <p className="bb-mono-label">{title}</p>
      <dl className="mt-3 grid gap-2.5">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[150px_1fr] gap-3 text-sm">
            <dt className="text-[#75758a]">{label}</dt>
            <dd className="text-[#3f3f46]">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function InsightList({
  icon: Icon,
  title,
  items,
}: {
  icon: LucideIcon;
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
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="text-[13px] leading-6 text-[#3f3f46]">
            · {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ListBlock({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="min-w-0">
      <p className="bb-mono-label">{label}</p>
      <ul className="mt-2 grid gap-1">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="text-[13px] leading-6 text-[#3f3f46]">
            · {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function getBuyerIds() {
  return buyers.map((buyer) => buyer.id);
}

export function getSellerIds() {
  return sellers.map((seller) => seller.id);
}
