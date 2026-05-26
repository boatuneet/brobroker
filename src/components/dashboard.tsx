import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Bot,
  Calendar,
  CarFront,
  CheckCircle,
  Clock,
  Compass,
  FileText,
  Gauge,
  Radio,
  Search,
  ShieldCheck,
  Ship,
  Sparkles,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getBrokerSegmentMeta, type BrokerSegment } from "@/lib/broker-segments";
import {
  getBuyerById,
  getDashboardModel,
  getListingById,
  getListingSpecSummary,
  getTaskTone,
  getVerificationTone,
} from "@/lib/services";
import { daysUntil, formatCurrency, percentage } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardHeaderIcon,
  EmptyState,
  PageHeader,
  ProgressBar,
  StatusDot,
} from "./ui";
import { TaskActionButton } from "./task-action-button";

const segmentIcons = {
  Yacht: Ship,
  Car: CarFront,
  "Real Estate": Building2,
} satisfies Record<BrokerSegment, LucideIcon>;

function dueLabel(date: string) {
  const delta = daysUntil(date);
  if (delta < 0) return `${Math.abs(delta)}d overdue`;
  if (delta === 0) return "Due today";
  if (delta === 1) return "Due tomorrow";
  return `Due in ${delta}d`;
}

export function Dashboard({ segment }: { segment?: BrokerSegment }) {
  const model = getDashboardModel(segment);
  const segmentMeta = getBrokerSegmentMeta(segment);
  const SegmentIcon = segmentIcons[segmentMeta.id];
  const approvedDrafts = model.followUpDrafts.filter((draft) => draft.status === "Approved").length;
  const conversationsNeedingSummary = model.conversations.filter((item) => item.needsSummary).length;

  if (!model.hasAnyData) {
    return <FirstRunDashboard />;
  }

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <section
        aria-labelledby="segment-dashboard-heading"
        className="group relative overflow-hidden rounded-[28px] border border-white/70 bg-[#edeae3] shadow-[0_24px_70px_rgba(23,23,28,0.08)]"
      >
        <div className="relative aspect-video min-h-[760px] sm:min-h-[720px] lg:min-h-0">
          <Image
            alt=""
            className="object-cover object-center transition-transform duration-[2000ms] ease-out group-hover:scale-105"
            fill
            priority
            sizes="(min-width: 1280px) 1170px, calc(100vw - 48px)"
            src={segmentMeta.imageSrc}
          />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.1)_0%,rgba(0,0,0,0.18)_46%,rgba(0,0,0,0.34)_100%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.42),transparent_38%)]" />
        </div>

        <div className="absolute inset-0 grid content-between gap-6 p-5 sm:p-7 lg:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/40 bg-white/60 px-3.5 text-[13px] font-medium text-[#003c33] shadow-[0_12px_34px_rgba(23,23,28,0.14)] backdrop-blur-xl transition-transform hover:scale-105">
              <SegmentIcon className="h-[18px] w-[18px]" aria-hidden="true" />
              {segmentMeta.label} workspace
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/40 bg-white/60 px-4 text-sm font-medium text-[#17171c] shadow-[0_12px_34px_rgba(23,23,28,0.12)] backdrop-blur-xl transition-all hover:scale-105 hover:bg-white/80"
                href="/voice-crm"
              >
                <Bot className="h-4 w-4" aria-hidden="true" />
                Voice note
              </Link>
              <Link
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-transparent bg-[#17171c] px-5 text-sm font-medium text-white shadow-[0_12px_34px_rgba(23,23,28,0.18)] transition-all hover:scale-105 hover:bg-[#2a2a32]"
                href="/deal-rooms"
              >
                <FileText className="h-4 w-4" aria-hidden="true" />
                Create deal room
              </Link>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_560px] lg:items-end">
            <div className="flex max-w-[460px] flex-col items-start">
              <div className="group/card rounded-[24px] border border-white/30 bg-white/40 p-4 text-[#17171c] shadow-[0_18px_55px_rgba(23,23,28,0.14)] backdrop-blur-xl transition-all duration-300 hover:border-white/50 hover:bg-white/50 sm:p-5">
                <p className="bb-mono-label !text-[#003c33] transition-colors group-hover/card:text-[#002822]">{segmentMeta.label} command view</p>
                <h2
                  className="bb-display mt-2 text-[1.65rem] font-medium leading-[1.08] sm:text-[2rem]"
                  id="segment-dashboard-heading"
                >
                  Deal command center
                </h2>
                <p className="mt-2 max-w-md text-[13px] leading-6 text-[#3f3f46]">
                  Track urgent tasks, buyer momentum, verification, and owner updates. {segmentMeta.description}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {model.metrics.map((metric, index) => {
                const MetricIcon = [Users, Compass, Clock, ShieldCheck][index] ?? Gauge;

                return (
                  <div
                    className="group/metric min-h-[118px] rounded-[24px] border border-white/30 bg-white/40 p-4 text-[#17171c] shadow-[0_18px_55px_rgba(23,23,28,0.16)] backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] hover:border-white/50 hover:bg-white/50 hover:shadow-[0_24px_65px_rgba(23,23,28,0.2)] sm:p-5"
                    key={metric.label}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-[#3f3f46] transition-colors group-hover/metric:text-[#17171c]">{metric.label}</p>
                      <MetricIcon className="h-[18px] w-[18px] text-[#9f4f2e] transition-transform duration-300 group-hover/metric:scale-110" aria-hidden="true" />
                    </div>
                    <p className="bb-display mt-4 text-3xl font-medium text-[#17171c]">{metric.value}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-[#3f3f46]">
                      <span className="rounded-full border border-white/40 bg-white/50 px-2 py-0.5 font-medium text-[#1f7a46] backdrop-blur transition-colors group-hover/metric:bg-white/70">
                        {metric.trend}
                      </span>
                      <span>{metric.detail}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <form action="/search" className="mt-10 flex max-w-2xl items-stretch gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Search buyers, listings, or tasks</span>
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#75758a]"
            aria-hidden="true"
          />
          <input
            className="h-11 w-full rounded-full border border-[#d9d9dd] bg-white pl-11 pr-4 text-sm text-[#17171c] outline-none placeholder:text-[#9b9ba6] focus:border-[#9b60aa] focus:ring-2 focus:ring-[#9b60aa]/15"
            name="q"
            placeholder="Search buyer memory, listing facts, owner notes..."
            type="search"
          />
        </label>
        <Button size="sm" type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 auto-rows-max">
        {/* Next-best action */}
        <Card className="col-span-1 md:col-span-2 xl:col-span-2 flex max-h-[560px] flex-col overflow-hidden">
          <CardHeader
            eyebrow="Next-best action"
            title="Today needs broker judgment"
            action={
              model.overdueTasks.length ? (
                <Badge tone="error">{model.overdueTasks.length} urgent</Badge>
              ) : (
                <Badge tone="neutral">All clear</Badge>
              )
            }
          />
          {model.overdueTasks.length === 0 ? (
            <EmptyState
              title="No urgent broker tasks"
              description="Overdue follow-ups, verification holds, and owner updates will surface here."
              action={
                <Link
                  className="inline-flex min-h-9 items-center gap-2 rounded-full bg-[#17171c] px-4 text-[13px] font-medium text-white hover:bg-[#2a2a32]"
                  href="/voice-crm"
                >
                  Add a voice note
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              }
            />
          ) : (
            <div className="min-h-0 overflow-y-auto">
            <ul className="divide-y divide-[#f2f2f2]">
              {model.overdueTasks.map((task) => {
                const buyer = task.buyerId ? getBuyerById(task.buyerId, segment) : undefined;
                const listing = task.listingId ? getListingById(task.listingId, segment) : undefined;
                return (
                  <li
                    key={task.id}
                    className="grid gap-3 px-6 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={getTaskTone(task)}>{task.priority}</Badge>
                        <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-[#75758a]">
                          {dueLabel(task.dueAt)}
                        </span>
                      </div>
                      <h3 className="mt-2 text-[15px] font-medium text-[#17171c]">{task.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-[#616161]">{task.reason}</p>
                      {(buyer || listing) && (
                        <p className="mt-2 text-[13px] text-[#75758a]">
                          {[buyer?.name, listing?.name].filter(Boolean).join(" / ")}
                        </p>
                      )}
                    </div>
                    <TaskActionButton taskId={task.id} label={task.actionLabel} />
                  </li>
                );
              })}
            </ul>
            </div>
          )}
        </Card>

        {/* Trust gate */}
        <Card className="col-span-1 flex max-h-[560px] flex-col overflow-hidden">
          <CardHeader
            eyebrow="Trust gate"
            title="Verification queue"
            action={
              <CardHeaderIcon>
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              </CardHeaderIcon>
            }
          />
          {model.verificationCases.length === 0 ? (
            <EmptyState
              title="Verification inbox is empty"
              description="Buyer access requests will land here with risk scores and recommended actions."
            />
          ) : (
            <>
              <div className="min-h-0 overflow-y-auto">
              <ul className="divide-y divide-[#f2f2f2]">
                {model.verificationCases.slice(0, 4).map((caseFile) => {
                  const buyer = getBuyerById(caseFile.buyerId, segment);
                  const listing = getListingById(caseFile.listingId, segment);
                  const tone = getVerificationTone(caseFile.status);
                  return (
                    <li key={caseFile.id} className="px-5 py-5 sm:px-6">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                        <div className="min-w-0">
                          <p className="text-[15px] font-medium text-[#17171c]">{buyer?.name}</p>
                          <p className="mt-1 max-w-[230px] text-[13px] leading-5 text-[#75758a]">
                            {listing?.name} · {caseFile.requestedAccess}
                          </p>
                        </div>
                        <Badge className={tone.className}>
                          <StatusDot className={tone.dotClassName} />
                          {caseFile.status}
                        </Badge>
                      </div>
                      <div className="mt-4 rounded-xl bg-[#f7f7f9] p-3.5">
                        <div className="flex items-center justify-between gap-3 text-[13px]">
                          <span className="text-[#75758a]">Risk score</span>
                          <span className="font-mono font-semibold text-[#17171c]">
                            {caseFile.score}
                          </span>
                        </div>
                        <ProgressBar className="mt-2" value={caseFile.score} />
                      </div>
                      <p className="mt-3 text-[13px] leading-6 text-[#616161]">
                        {caseFile.recommendedAction}
                      </p>
                    </li>
                  );
                })}
              </ul>
              </div>
              <div className="border-t border-[#f2f2f2] px-6 py-4">
                <Link className="text-sm font-medium text-[#1863dc] hover:underline" href="/verification">
                  Open inbox →
                </Link>
              </div>
            </>
          )}
        </Card>

        {/* Broker memory */}
        <Card className="col-span-1 md:col-span-2 xl:col-span-2 flex max-h-[640px] flex-col overflow-hidden">
          <CardHeader
            eyebrow="Broker memory"
            title="Hot buyers and stale momentum"
            action={
              <CardHeaderIcon>
                <Users className="h-4 w-4" aria-hidden="true" />
              </CardHeaderIcon>
            }
          />
          {model.hotBuyers.length === 0 ? (
            <EmptyState
              title="No buyer memory yet"
              description="Buyers added by voice or matching appear here by urgency."
            />
          ) : (
            <div className="min-h-0 overflow-y-auto">
            <ul className="divide-y divide-[#f2f2f2]">
              {model.hotBuyers.map(({ buyer, verification, topMatch }) => {
                const listing = topMatch ? getListingById(topMatch.listingId, segment) : undefined;
                const tone = getVerificationTone(verification?.status ?? "Needs Review");
                return (
                  <li key={buyer.id} className="grid gap-5 px-6 py-5 lg:grid-cols-[1fr_280px]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          className="text-[15px] font-medium text-[#17171c] hover:text-[#1863dc]"
                          href={`/buyers/${buyer.id}`}
                        >
                          {buyer.name}
                        </Link>
                        <Badge className={tone.className}>
                          <StatusDot className={tone.dotClassName} />
                          {verification?.status ?? "Needs Review"}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[#616161]">
                        {buyer.sizeRangeFt[0]}–{buyer.sizeRangeFt[1]}ft, {buyer.urgency.toLowerCase()},{" "}
                        {buyer.communicationStyle.toLowerCase()}.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {buyer.tags.slice(0, 4).map((tag) => (
                          <Badge key={tag} tone="neutral">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl bg-[#f7f7f9] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[13px] font-medium text-[#17171c]">
                          {listing?.name ?? "No active match"}
                        </p>
                        <span className="font-mono text-[13px] font-semibold text-[#17171c]">
                          {topMatch ? percentage(topMatch.fitScore) : "—"}
                        </span>
                      </div>
                      <ProgressBar className="mt-3" value={topMatch?.fitScore ?? 0} />
                      {topMatch?.rationale ? (
                        <p className="mt-3 text-[13px] leading-6 text-[#616161]">{topMatch.rationale}</p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
            </div>
          )}
          <DashboardCardFooterLink href="/buyers" label="All buyers" />
        </Card>

        {/* Matching */}
        <Card className="col-span-1 flex max-h-[640px] flex-col overflow-hidden">
          <CardHeader
            eyebrow="Matching"
            title="New hidden opportunities"
            action={
              <CardHeaderIcon>
                <Gauge className="h-4 w-4" aria-hidden="true" />
              </CardHeaderIcon>
            }
          />
          {model.matchResults.length === 0 ? (
            <EmptyState
              title="No matches generated yet"
              description="Add buyers and listings, then run the matcher."
              action={
                <Link
                  className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#d9d9dd] bg-white px-4 text-[13px] font-medium text-[#17171c] hover:border-[#17171c]"
                  href="/matching"
                >
                  Open the matcher
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              }
            />
          ) : (
            <div className="min-h-0 overflow-y-auto p-5">
              <div className="grid gap-3">
                {model.matchResults.slice(0, 5).map((match) => {
                  const buyer = getBuyerById(match.buyerId, segment);
                  const listing = getListingById(match.listingId, segment);

                  return (
                    <Link
                      className="group block rounded-2xl border border-[#ececf0] bg-[#f7f7f9] p-4 transition-colors hover:border-[#17171c]"
                      href="/matching"
                      key={match.id}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[15px] font-medium text-[#17171c]">{buyer?.name}</p>
                            <Badge tone="info">{match.category}</Badge>
                          </div>
                          <p className="mt-1 text-[13px] text-[#75758a]">
                            {listing?.builder} {listing?.model}
                          </p>
                        </div>
                        <span className="font-mono text-[15px] font-semibold text-[#17171c]">
                          {percentage(match.fitScore)}
                        </span>
                      </div>
                      <ProgressBar className="mt-3" value={match.fitScore} />
                      <p className="mt-3 text-[13px] leading-6 text-[#616161]">
                        {match.talkingPoints[0]}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
          <DashboardCardFooterLink href="/matching" label="Open matcher" />
        </Card>

        {/* Asset intelligence */}
        <Card className="col-span-1 flex max-h-[520px] flex-col overflow-hidden">
          <CardHeader
            eyebrow="Asset intelligence"
            title="Listings needing attention"
            action={
              <CardHeaderIcon>
                <Compass className="h-4 w-4" aria-hidden="true" />
              </CardHeaderIcon>
            }
          />
          {model.listings.length === 0 ? (
            <EmptyState
              title="No listings on file"
              description="Add a listing to surface missing docs, comps, and outreach angles."
              action={
                <Link
                  className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#d9d9dd] bg-white px-4 text-[13px] font-medium text-[#17171c] hover:border-[#17171c]"
                  href="/listings"
                >
                  Open listings
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              }
            />
          ) : (
            <div className="min-h-0 overflow-y-auto">
              <ul className="divide-y divide-[#f2f2f2]">
                {model.listings.slice(0, 5).map((listing) => (
                  <li key={listing.id} className="px-6 py-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <Link
                        className="text-[15px] font-medium text-[#17171c] hover:text-[#1863dc]"
                        href={`/listings/${listing.id}`}
                      >
                        {listing.name}
                      </Link>
                      <p className="font-mono text-[13px] font-medium text-[#17171c]">
                        {formatCurrency(listing.priceEur)}
                      </p>
                    </div>
                    <p className="mt-1 text-[13px] leading-6 text-[#616161]">
                      {listing.builder} {listing.model} · {getListingSpecSummary(listing)}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">{listing.status}</Badge>
                      <Badge tone="neutral">{listing.vatStatus}</Badge>
                      {listing.missingInfo.length ? (
                        <span className="text-[12px] text-[#b45309]">
                          Missing: {listing.missingInfo.join(", ")}
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <DashboardCardFooterLink href="/listings" label="All listings" />
        </Card>

        {/* Deal rooms */}
        <Card className="col-span-1 flex max-h-[520px] flex-col overflow-hidden">
          <CardHeader
            eyebrow="Deal rooms"
            title="Buyer-safe rooms"
            action={
              <CardHeaderIcon>
                <FileText className="h-4 w-4" aria-hidden="true" />
              </CardHeaderIcon>
            }
          />
          {model.dealRooms.length === 0 ? (
            <EmptyState
              title="No deal rooms yet"
              description="Create a private room after buyer verification."
              action={
                <Link
                  className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#d9d9dd] bg-white px-4 text-[13px] font-medium text-[#17171c] hover:border-[#17171c]"
                  href="/deal-rooms"
                >
                  Create a deal room
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              }
            />
          ) : (
            <div className="min-h-0 overflow-y-auto">
            <ul className="divide-y divide-[#f2f2f2]">
              {model.dealRooms.map((room) => {
                const buyer = getBuyerById(room.buyerId, segment);
                const tone = getVerificationTone(room.verificationStatus);
                return (
                  <li key={room.id} className="px-6 py-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[15px] font-medium text-[#17171c]">{room.title}</p>
                        <p className="mt-1 text-[13px] text-[#75758a]">
                          {buyer?.name} · {room.status}
                        </p>
                      </div>
                      <Badge className={tone.className}>{room.verificationStatus}</Badge>
                    </div>
                    <p className="mt-3 text-[13px] leading-6 text-[#616161]">
                      {room.listingIds.length} listings · {room.approvedDocumentIds.length} approved docs ·{" "}
                      {room.brokerApprovalStatus.toLowerCase()} approval
                    </p>
                  </li>
                );
              })}
            </ul>
            </div>
          )}
          <DashboardCardFooterLink href="/deal-rooms" label="All rooms" />
        </Card>

        {/* Owner reporting */}
        <Card className="col-span-1 md:col-span-2 xl:col-span-1 flex max-h-[520px] flex-col overflow-hidden">
          <CardHeader
            eyebrow="Owner reporting"
            title={model.sellerReport?.title ?? "Owner reports"}
            action={
              <CardHeaderIcon>
                <Calendar className="h-4 w-4" aria-hidden="true" />
              </CardHeaderIcon>
            }
          />
          {model.sellerReport ? (
            <div className="min-h-0 overflow-y-auto px-6 py-5">
              <p className="text-sm leading-6 text-[#3f3f46]">{model.sellerReport.summary}</p>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                {model.sellerReport.sections.map((section) => (
                  <div key={section.label}>
                    <dt className="bb-mono-label">{section.label}</dt>
                    <dd className="mt-1.5 text-[13px] leading-6 text-[#3f3f46]">{section.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <EmptyState
              title="No owner reports queued"
              description="Add seller context and cadence to draft owner updates."
            />
          )}
          <DashboardCardFooterLink href="/reports" label="Open reports" />
        </Card>

        {/* Workflow health */}
        <Card className="col-span-1 md:col-span-2 xl:col-span-3 flex flex-col overflow-hidden">
          <CardHeader
            eyebrow="Workflow health"
            title="Signals the broker should not miss"
            action={
              <CardHeaderIcon>
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              </CardHeaderIcon>
            }
          />
          <div className="min-h-0 overflow-y-auto">
            <ul className="grid divide-y divide-[#f2f2f2] md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-4">
              <SignalRow
                icon={AlertTriangle}
                label="Missing documents"
                value={`${model.missingDocuments.length} blockers`}
                detail={
                  model.missingDocuments.length
                    ? model.missingDocuments
                        .map((item) => `${item.listing.name}: ${item.missing}`)
                        .join(" · ")
                    : "No outstanding document gaps."
                }
              />
              <SignalRow
                icon={Clock}
                label="Calls needing summaries"
                value={`${conversationsNeedingSummary} conversations`}
                detail={
                  conversationsNeedingSummary
                    ? model.conversations
                        .filter((item) => item.needsSummary)
                        .map((item) => item.summary)
                        .join(" · ")
                    : "All captured calls have a summary on file."
                }
              />
              <SignalRow
                icon={Calendar}
                label="Owner updates due"
                value={`${model.ownerUpdates.length} due soon`}
                detail={
                  model.ownerUpdates.length
                    ? model.ownerUpdates
                        .map((item) => `${item.seller.name}: ${dueLabel(item.seller.nextOwnerUpdateDueAt)}`)
                        .join(" · ")
                    : "No owner reports are due this week."
                }
              />
              <SignalRow
                icon={CheckCircle}
                label="Approved drafts"
                value={`${approvedDrafts} approved`}
                detail={
                  model.followUpDrafts.length
                    ? `${model.followUpDrafts.length} drafts in the human approval loop.`
                    : "No follow-up drafts yet. Voice notes and call summaries create them automatically."
                }
              />
            </ul>
          </div>
        </Card>
      </div>

    </div>
  );
}

function DashboardCardFooterLink({ href, label }: { href: string; label: string }) {
  return (
    <div className="mt-auto border-t border-[#f2f2f2] px-6 py-4">
      <Link className="text-sm font-medium text-[#1863dc] hover:underline" href={href}>
        {label} →
      </Link>
    </div>
  );
}

/* First-run dashboard — single editorial hero + 3 primary actions + a quiet
   explainer card. Replaces the eight-card empty layout that read as chaotic
   on a clean install. */
function FirstRunDashboard() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <PageHeader
        eyebrow="Welcome to BroBroker"
        title="Start with your first signal"
        description="Add a call, buyer, or listing to build memory, matches, and follow-ups."
        actions={
          <Link
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#17171c] px-5 text-sm font-medium text-white hover:bg-[#2a2a32]"
            href="/voice-crm"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Start with a voice note
          </Link>
        }
      />

      <section aria-labelledby="quick-start-heading" className="mt-12">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="bb-mono-label">Quick start</p>
            <h2
              className="bb-display mt-2 text-xl font-medium text-[#17171c]"
              id="quick-start-heading"
            >
              Three ways to seed the brain
            </h2>
          </div>
          <p className="hidden text-[13px] text-[#75758a] sm:block">
            Each action takes under a minute.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <ActionCard
            description="Paste a call to extract criteria, tasks, and drafts."
            href="/voice-crm"
            icon={Radio}
            step="01"
            title="Capture a call"
          />
          <ActionCard
            description="Add inventory with comps, gaps, and pitch lines."
            href="/listings"
            icon={Compass}
            step="02"
            title="Add a listing"
          />
          <ActionCard
            description="Type a brief in your own words to generate an exact / close / substitute shortlist."
            href="/matching"
            icon={Gauge}
            step="03"
            title="Run a brief"
          />
        </div>
      </section>

      <Card className="mt-12">
        <CardHeader
          eyebrow="How the brain works"
          title="Core workflow"
        />
        <ul className="divide-y divide-[#f2f2f2]">
          <ExplainerRow
            icon={Radio}
            title="Memory grows from voice"
            description="Call notes become buyer memory, urgency, and draft follow-ups."
          />
          <ExplainerRow
            icon={Gauge}
            title="Matching surfaces fits, not noise"
            description="Inventory is ranked against criteria with trade-offs."
          />
          <ExplainerRow
            icon={ShieldCheck}
            title="Verification gates sensitive access"
            description="Risk signals gate documents, viewings, and introductions."
          />
          <ExplainerRow
            icon={FileText}
            title="Reports and rooms stay broker-approved"
            description="Reports and rooms stay editable until broker sign-off."
          />
        </ul>
      </Card>
    </div>
  );
}

function ActionCard({
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

function ExplainerRow({
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

function SignalRow({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof AlertTriangle;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <li className="grid gap-4 px-6 py-5 sm:grid-cols-[36px_1fr]">
      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e5e7eb] bg-white text-[#17171c]">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[14px] font-medium text-[#17171c]">{label}</p>
          <span className="bb-mono-label">{value}</span>
        </div>
        <p className="mt-2 text-[13px] leading-6 text-[#616161]">{detail}</p>
      </div>
    </li>
  );
}
