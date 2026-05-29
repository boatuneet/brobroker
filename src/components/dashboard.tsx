import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
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
  ShieldCheck,
  Ship,
  Sparkles,
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
import { cn, daysUntil, formatCurrency } from "@/lib/utils";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  StatusDot,
} from "./ui";
import { TaskActionButton } from "./task-action-button";
import {
  FitRing,
  HalfGauge,
  Sparkbars,
  Tile,
} from "./dashboard/visuals";
import { DashboardPulsePreview } from "./pulse/dashboard-pulse-preview";

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
  const approvedDrafts = model.followUpDrafts.filter(
    (draft) => draft.status === "Approved",
  ).length;
  const conversationsNeedingSummary = model.conversations.filter(
    (item) => item.needsSummary,
  ).length;

  if (!model.hasAnyData) {
    return <FirstRunDashboard />;
  }

  // Derived numbers powering the visualisations.
  const pipelineCount = model.buyers.length;
  const listingCount = model.listings.length;
  const verificationCount = model.verificationCases.length;
  const openTaskCount = model.metrics[2]?.value
    ? Number(model.metrics[2].value)
    : 0;
  const overdueCount = model.overdueTasks.length;
  const overduePct =
    openTaskCount > 0
      ? Math.min(100, Math.round((overdueCount / openTaskCount) * 100))
      : 0;

  // Top urgency drives the anchor tile.
  const topTask = model.overdueTasks[0];
  const topTaskBuyer = topTask?.buyerId
    ? getBuyerById(topTask.buyerId, segment)
    : undefined;
  const topTaskListing = topTask?.listingId
    ? getListingById(topTask.listingId, segment)
    : undefined;
  /* Where the primary "action" button on the focal task should navigate to,
     based on the task kind + linked IDs. Keeps the button label honest:
     "Open matcher" → /matching, "Approve update" → owner page, etc. */
  const topTaskHref = topTask
    ? taskActionHref(
        topTask.kind,
        topTask.buyerId,
        topTask.listingId,
        topTask.sellerId,
      )
    : undefined;
  /* Defer link points back into Voice CRM with the buyer pre-selected when
     the task is buyer-linked. */
  const deferHref = topTask?.buyerId
    ? `/voice-crm?buyer=${encodeURIComponent(topTask.buyerId)}`
    : "/voice-crm";

  // Verification sparkbars — count by status across the segment.
  const verifBuckets: Array<{ label: string; value: number }> = [
    {
      label: "OK",
      value: model.verificationCases.filter((v) => v.status === "Verified")
        .length,
    },
    {
      label: "Rev",
      value: model.verificationCases.filter((v) => v.status === "Needs Review")
        .length,
    },
    {
      label: "Risk",
      value: model.verificationCases.filter((v) => v.status === "High Risk")
        .length,
    },
  ];
  const highestRiskIdx = verifBuckets[2].value > 0 ? 2 : 1;
  const topRiskCase = [...model.verificationCases].sort(
    (a, b) => b.score - a.score,
  )[0];
  const topRiskBuyer = topRiskCase
    ? getBuyerById(topRiskCase.buyerId, segment)
    : undefined;

  // Average fit score across hot buyers — drives a big-number tile.
  const avgFit = model.hotBuyers.length
    ? Math.round(
        (model.hotBuyers.reduce(
          (sum, hb) => sum + (hb.topMatch?.fitScore ?? 0),
          0,
        ) /
          model.hotBuyers.length) *
          1,
      )
    : 0;

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
      {/* Compact header strip — replaces the giant hero. */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-[#D9DAD4] bg-white px-3 text-[11px] font-medium uppercase tracking-[0.16em] text-[#5F625E]">
            <SegmentIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {segmentMeta.label} cockpit
          </span>
          <h1 className="bb-display mt-3 text-[2rem] font-medium leading-[1.04] text-[#171719] sm:text-[2.35rem]">
            Today, before everything else.
          </h1>
        </div>
        <div className="flex flex-col items-end gap-2.5">
          {/* Date sits above the action buttons, tinted brand-green so it
              reads as the "today" marker rather than another label. */}
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#003C33]">
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </span>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#D9DAD4] bg-white px-5 text-[14px] font-semibold text-[#171719] transition-colors hover:bg-[#F1F2EE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]"
              href="/voice-crm"
            >
              <Bot className="h-[18px] w-[18px]" aria-hidden="true" />
              Voice note
            </Link>
            <Link
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#003C33] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[#0B4A3F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]"
              href="/deal-rooms"
            >
              <FileText className="h-[18px] w-[18px]" aria-hidden="true" />
              New deal room
            </Link>
          </div>
        </div>
      </header>

      {/* Fold grid: anchor (left, 2-col) + ring/big-number rail (right, 1-col). */}
      <section
        aria-label="Today’s priorities"
        className="mt-7 grid grid-cols-1 gap-5 lg:grid-cols-3"
      >
        {/* === ANCHOR TILE — dark, ink-green, single biggest urgency.
            Left rail anchors the focal task with buyer identity + actions.
            Right rail summarises the rest of today as a clean list. === */}
        <article className="relative col-span-1 overflow-hidden rounded-[28px] bg-[#003C33] text-[#F2EADC] shadow-[0_30px_80px_-30px_rgba(0,60,51,0.5)] lg:col-span-2">
          {/* Segment image revealed through a circular mask anchored to the
              right edge. The image fills the whole card; the mask makes it
              visible only inside the circle (which reaches into the middle
              of the card), so the dark green base shows through on the left
              where the copy lives. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 hidden overflow-hidden sm:block"
            style={{
              WebkitMaskImage:
                "radial-gradient(circle at 100% 50%, #000 0%, #000 32%, rgba(0,0,0,0.4) 55%, transparent 75%)",
              maskImage:
                "radial-gradient(circle at 100% 50%, #000 0%, #000 32%, rgba(0,0,0,0.4) 55%, transparent 75%)",
            }}
          >
            <Image
              alt=""
              className="object-cover object-right opacity-[0.55] mix-blend-luminosity"
              fill
              priority
              sizes="1280px"
              src={segmentMeta.imageSrc}
            />
          </div>

          <div className="relative grid gap-7 p-6 sm:p-8 lg:grid-cols-[1.2fr_1fr] lg:gap-10">
            {/* ---------- LEFT: focal task ---------- */}
            <div className="flex min-w-0 flex-col">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#A86642]/12 px-2.5 py-1 ring-1 ring-[#A86642]/30">
                <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-[#A86642]" />
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#F0DDD0]">
                  Critical · {overdueCount} overdue
                </p>
              </div>

              {topTask ? (
                <>
                  <h2 className="bb-display mt-5 text-[1.75rem] font-medium leading-[1.06] text-white sm:text-[2.05rem]">
                    {topTask.title}
                  </h2>
                  <p className="mt-3 max-w-md text-[13.5px] leading-7 text-[#F2EADC]/80">
                    {topTask.reason}
                  </p>

                  {/* mt-auto pushes the action row to the bottom of the
                      flex column so it lines up consistently regardless of
                      title/description length. */}
                  <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-3 pt-6">
                    <TaskActionButton
                      href={topTaskHref}
                      label={topTask.actionLabel}
                      taskId={topTask.id}
                    />
                    <Link
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-[#F2EADC]/80 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2EADC]"
                      href={deferHref}
                    >
                      Defer via voice note
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="bb-display mt-5 text-[1.75rem] font-medium leading-[1.06] text-white sm:text-[2.05rem]">
                    Inbox zero on urgency.
                  </h2>
                  <p className="mt-3 max-w-md text-[13.5px] leading-7 text-[#F2EADC]/80">
                    No overdue items. Use the saved time to message a stale hot
                    buyer or refresh a listing.
                  </p>
                </>
              )}
            </div>

            {/* ---------- RIGHT: client identity + the rest of today ---------- */}
            <div className="flex min-w-0 flex-col gap-4">
              {/* Client identity bar — avatar + name + asset + due pill. Lives
                  on the right now so the left column reads as a clean focal
                  block: status → title → description → actions. */}
              {topTask && (topTaskBuyer || topTaskListing) ? (
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 backdrop-blur-sm">
                  <span
                    aria-hidden="true"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F2EADC] text-[12px] font-semibold uppercase tracking-[0.06em] text-[#003C33]"
                  >
                    {topTaskBuyer ? initialsFor(topTaskBuyer.name) : "—"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-white">
                      {topTaskBuyer?.name ?? "Unassigned"}
                    </p>
                    {topTaskListing ? (
                      <p className="truncate text-[11.5px] text-[#F2EADC]/70">
                        {topTaskListing.name}
                      </p>
                    ) : null}
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#A86642]/15 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#F0DDD0]">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {dueLabel(topTask.dueAt)}
                  </span>
                </div>
              ) : null}

              {/* What else today — compact list of up to 3 next overdue tasks.
                  No longer forced to fill the column; sits below the identity
                  bar at its natural height. */}
              {model.overdueTasks.length > 1 ? (
                <div className="flex min-w-0 flex-col rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-sm">
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#F2EADC]/70">
                      What else today
                    </p>
                    <span className="text-[10.5px] font-semibold text-[#F0DDD0]">
                      {model.overdueTasks.length - 1} more
                    </span>
                  </div>
                  <ul className="divide-y divide-white/8">
                    {model.overdueTasks.slice(1, 4).map((task) => (
                      <li key={task.id}>
                        <div className="flex items-center gap-3 px-4 py-2.5">
                          <span
                            aria-hidden="true"
                            className="inline-block h-7 w-[3px] shrink-0 rounded-full bg-[#A86642]"
                          />
                          <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[#F2EADC]/90">
                            {task.title}
                          </span>
                          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#F0DDD0]">
                            {dueLabel(task.dueAt)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </article>

        {/* === RIGHT RAIL — Ring + Big-number === */}
        <div className="col-span-1 grid gap-5">
          {/* Task momentum — segmented half-gauge. Coral when there's overdue
              pressure, green when the broker is on top of the queue. Laid out
              side-by-side (gauge left, big number + link right) so the card
              keeps the same height as the cockpit panel next to it. */}
          <Tile className="!p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="bb-mono-label">Open tasks</p>
              <span
                className={cn(
                  "inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold",
                  overdueCount > 0
                    ? "bg-[#F0DDD0] text-[#A86642]"
                    : "bg-[#E1F1EA] text-[#0F8F62]",
                )}
              >
                {overdueCount > 0 ? `${overdueCount} overdue` : "On schedule"}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <p className="bb-display text-[1.75rem] font-medium leading-none tabular-nums text-[#171719]">
                  {openTaskCount}
                </p>
                <p className="mt-1 text-[11px] leading-4 text-[#8E918B]">
                  Open tasks total
                </p>
                <Link
                  className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-[#171719] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c6ee6]"
                  href="/matching"
                >
                  Open matching <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              </div>
              <HalfGauge
                label={`${overduePct}%`}
                size={128}
                sublabel="Overdue"
                tone={overdueCount > 0 ? "coral" : "green"}
                value={overduePct}
              />
            </div>
          </Tile>

          {/* Big-number tile — average fit */}
          <Tile tone="cream" className="!p-6">
            <p className="bb-mono-label !text-[#5F625E]">Avg buyer fit</p>
            <div className="mt-2 flex items-end gap-3">
              <p className="bb-display text-[3rem] font-medium leading-[0.95] text-[#171719]">
                {avgFit}
                <span className="text-[1.5rem] text-[#5F625E]">%</span>
              </p>
              <span className="mb-1.5 rounded-full bg-[#003C33] px-2.5 py-0.5 text-[11px] font-medium text-[#F2EADC]">
                {model.hotBuyers.length} hot
              </span>
            </div>
            <p className="mt-3 text-[12.5px] leading-5 text-[#5F625E]/80">
              Across top-of-funnel buyers vs their best inventory match.
            </p>
          </Tile>
        </div>
      </section>

      {/* === Pulse preview + Trust gate === */}
      <section
        aria-label="Pulse preview"
        className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3"
      >
        <DashboardPulsePreview
          buyers={model.buyers}
          className="md:col-span-2"
          conversations={model.conversations}
          drafts={model.followUpDrafts}
          tasks={model.tasks}
        />

        <Tile>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="bb-mono-label">Trust gate</p>
              <p className="bb-display mt-1.5 text-lg font-medium text-[#171719]">
                Verification mix
              </p>
            </div>
            <ShieldCheck
              className="h-4 w-4 text-[#003C33]"
              aria-hidden="true"
            />
          </div>
          <div className="mt-6">
            <Sparkbars data={verifBuckets} highlightIndex={highestRiskIdx} />
          </div>
          {topRiskCase ? (
            <div className="mt-5 rounded-xl border border-[#E7E7E2] bg-[#F1F2EE] p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12.5px] font-medium text-[#171719]">
                  {topRiskBuyer?.name ?? "Unknown buyer"}
                </p>
                <span className="font-mono text-[12px] font-semibold text-[#A86642]">
                  {topRiskCase.score}
                </span>
              </div>
              <p className="mt-1 text-[11.5px] leading-5 text-[#5F625E]">
                {topRiskCase.recommendedAction}
              </p>
              <Link
                className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-[#171719] hover:underline"
                href="/verification"
              >
                Open case <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <p className="mt-5 text-[12.5px] text-[#8E918B]">
              Verification inbox is clear.
            </p>
          )}
        </Tile>
      </section>

      {/* === Slim pipeline composition strip — full width below ===
          Each column is itself a click target into the relevant workspace,
          which lets us drop the standalone "Open buyers" link. */}
      <section aria-label="Pipeline composition" className="mt-5">
        <Tile className="!p-0">
          <div className="flex items-center justify-between gap-3 border-b border-[#E7E7E2] px-5 py-3">
            <p className="bb-mono-label">Pipeline composition</p>
            <p className="text-[11.5px] leading-5 text-[#8E918B]">
              Where the broker’s capacity sits
            </p>
          </div>
          <div className="grid grid-cols-3 divide-x divide-[#E7E7E2]">
            <PipelineCompositionStat
              detail={`${
                model.buyers.filter((b) => b.currentStage !== "New Inquiry").length
              } past intake`}
              href="/buyers"
              label="Buyers"
              tone="green"
              value={pipelineCount}
            />
            <PipelineCompositionStat
              detail={`${
                model.listings.filter((l) => l.status === "Active").length
              } marketable`}
              href="/listings"
              label="Listings"
              tone="ink"
              value={listingCount}
            />
            <PipelineCompositionStat
              detail={`${
                model.verificationCases.filter((v) => v.status === "High Risk").length
              } high risk`}
              href="/verification"
              label="Verifications"
              tone="coral"
              value={verificationCount}
            />
          </div>
        </Tile>
      </section>

      {/* === HOT BUYERS row — horizontal scrolling portrait cards === */}
      <section aria-label="Hot buyers" className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="bb-mono-label">Broker memory</p>
            <h2 className="bb-display mt-1.5 text-[1.4rem] font-medium text-[#171719]">
              Hot buyers
            </h2>
          </div>
          <Link
            className="text-[12.5px] font-medium text-[#171719] hover:underline"
            href="/buyers"
          >
            All buyers →
          </Link>
        </div>

        {model.hotBuyers.length === 0 ? (
          <Tile className="mt-5">
            <EmptyState
              title="No buyer memory yet"
              description="Buyers added by voice or matching appear here by urgency."
            />
          </Tile>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {model.hotBuyers.map(({ buyer, verification, topMatch }) => {
              const listing = topMatch
                ? getListingById(topMatch.listingId, segment)
                : undefined;
              const tone = getVerificationTone(
                verification?.status ?? "Needs Review",
              );
              const fit = topMatch?.fitScore ?? 0;
              return (
                <Link
                  className="group relative flex flex-col gap-4 rounded-[20px] border border-[#E7E7E2] bg-white p-5 transition-all hover:-translate-y-[2px] hover:border-[#003C33] hover:shadow-[0_18px_45px_-22px_rgba(23,23,28,0.18)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c6ee6]"
                  href={`/buyers/${buyer.id}`}
                  key={buyer.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14.5px] font-medium text-[#171719] group-hover:text-[#003C33]">
                        {buyer.name}
                      </p>
                      <p className="mt-1 text-[12px] text-[#8E918B]">
                        {buyer.urgency} · {buyer.currentStage}
                      </p>
                    </div>
                    <FitRing size={48} stroke={4} tone="green" value={fit} />
                  </div>

                  <div className="rounded-xl bg-[#F1F2EE] p-3">
                    <p className="text-[11.5px] font-medium text-[#5F625E]">
                      {listing?.name ?? "No active match"}
                    </p>
                    {topMatch?.rationale ? (
                      <p className="mt-1 line-clamp-2 text-[11.5px] leading-5 text-[#8E918B]">
                        {topMatch.rationale}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                    <Badge className={tone.className}>
                      <StatusDot className={tone.dotClassName} />
                      {verification?.status ?? "Needs Review"}
                    </Badge>
                    <span className="text-[11px] text-[#8E918B]">
                      {buyer.sizeRangeFt[0]}–{buyer.sizeRangeFt[1]}ft
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* === Hidden opportunities + Owner reporting — secondary row === */}
      <section className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Matching condensed to top 2 */}
        <Card className="lg:col-span-2 flex flex-col overflow-hidden">
          <CardHeader
            title="Hidden opportunities"
            action={
              <Link
                className="text-[12.5px] font-medium text-[#1863dc] hover:underline"
                href="/matching"
              >
                Open matcher →
              </Link>
            }
          />
          {model.matchResults.length === 0 ? (
            <EmptyState
              title="No matches generated yet"
              description="Add buyers and listings, then run the matcher."
              action={
                <Link
                  className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#D9DAD4] bg-white px-4 text-[13px] font-medium text-[#171719] hover:border-[#003C33]"
                  href="/matching"
                >
                  Open the matcher
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-[#E7E7E2]">
              {model.matchResults.slice(0, 3).map((match) => {
                const buyer = getBuyerById(match.buyerId, segment);
                const listing = getListingById(match.listingId, segment);
                return (
                  <li className="px-6 py-5" key={match.id}>
                    <Link
                      className="group flex flex-wrap items-center gap-4"
                      href="/matching"
                    >
                      <FitRing size={52} stroke={5} tone="green" value={match.fitScore} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[14.5px] font-medium text-[#171719] group-hover:text-[#003C33]">
                            {buyer?.name}
                          </span>
                          <Badge tone="info">{match.category}</Badge>
                        </div>
                        <p className="mt-1 text-[12.5px] text-[#8E918B]">
                          {listing?.builder} {listing?.model} ·{" "}
                          {listing ? getListingSpecSummary(listing) : ""}
                        </p>
                        <p className="mt-2 line-clamp-1 text-[12.5px] leading-5 text-[#5F625E]">
                          {match.talkingPoints[0]}
                        </p>
                      </div>
                      <ArrowRight
                        className="h-3.5 w-3.5 shrink-0 text-[#8E918B] transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Owner reporting — condensed */}
        <Card className="flex flex-col overflow-hidden">
          <CardHeader
            title={model.sellerReport?.title ?? "Owner reports"}
            action={
              <Link
                className="text-[12.5px] font-medium text-[#1863dc] hover:underline"
                href="/reports"
              >
                Reports →
              </Link>
            }
          />
          {model.sellerReport ? (
            <div className="min-h-0 overflow-y-auto px-6 py-5">
              <p className="text-[13px] leading-6 text-[#5F625E]">
                {model.sellerReport.summary}
              </p>
              <dl className="mt-4 grid gap-3">
                {model.sellerReport.sections.slice(0, 3).map((section) => (
                  <div className="border-l-2 border-[#003C33] pl-3" key={section.label}>
                    <dt className="bb-mono-label">{section.label}</dt>
                    <dd className="mt-1 text-[12.5px] leading-5 text-[#5F625E]">
                      {section.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <EmptyState
              title="No owner reports queued"
              description="Add seller context to draft owner updates."
            />
          )}
        </Card>
      </section>

      {/* === Listings + Deal rooms — quiet tertiary === */}
      <section className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
        <Card className="flex max-h-[420px] flex-col overflow-hidden">
          <CardHeader
            title="Listings needing attention"
            action={
              <Link
                className="text-[12.5px] font-medium text-[#1863dc] hover:underline"
                href="/listings"
              >
                All →
              </Link>
            }
          />
          {model.listings.length === 0 ? (
            <EmptyState
              title="No listings on file"
              description="Add a listing to surface missing docs, comps, and outreach angles."
            />
          ) : (
            <ul className="min-h-0 divide-y divide-[#E7E7E2] overflow-y-auto">
              {model.listings.slice(0, 4).map((listing) => (
                <li className="px-6 py-4" key={listing.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <Link
                      className="text-[14px] font-medium text-[#171719] hover:text-[#1863dc]"
                      href={`/listings/${listing.id}`}
                    >
                      {listing.name}
                    </Link>
                    <p className="font-mono text-[12.5px] font-medium text-[#171719]">
                      {formatCurrency(listing.priceEur)}
                    </p>
                  </div>
                  <p className="mt-1 text-[12px] leading-5 text-[#8E918B]">
                    {listing.builder} {listing.model} ·{" "}
                    {getListingSpecSummary(listing)}
                  </p>
                  {listing.missingInfo.length ? (
                    <p className="mt-2 text-[11.5px] font-medium text-[#A86642]">
                      Missing: {listing.missingInfo.join(", ")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex max-h-[420px] flex-col overflow-hidden">
          <CardHeader
            title="Buyer-safe rooms"
            action={
              <Link
                className="text-[12.5px] font-medium text-[#1863dc] hover:underline"
                href="/deal-rooms"
              >
                All →
              </Link>
            }
          />
          {model.dealRooms.length === 0 ? (
            <EmptyState
              title="No deal rooms yet"
              description="Create a private room after buyer verification."
            />
          ) : (
            <ul className="min-h-0 divide-y divide-[#E7E7E2] overflow-y-auto">
              {model.dealRooms.slice(0, 4).map((room) => {
                const buyer = getBuyerById(room.buyerId, segment);
                const tone = getVerificationTone(room.verificationStatus);
                return (
                  <li className="px-6 py-4" key={room.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-[#171719]">
                          {room.title}
                        </p>
                        <p className="mt-1 text-[12px] text-[#8E918B]">
                          {buyer?.name} · {room.status}
                        </p>
                      </div>
                      <Badge className={tone.className}>
                        {room.verificationStatus}
                      </Badge>
                    </div>
                    <p className="mt-2 text-[12px] leading-5 text-[#5F625E]">
                      {room.listingIds.length} listings ·{" "}
                      {room.approvedDocumentIds.length} approved docs ·{" "}
                      {room.brokerApprovalStatus.toLowerCase()} approval
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>

      {/* === Workflow signals — single thin strip, not 4 boxes === */}
      <section className="mt-8">
        <Tile className="!p-0">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E7E7E2] px-6 py-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[#A86642]" aria-hidden="true" />
              <p className="bb-mono-label">Workflow signals</p>
            </div>
            <p className="text-[12px] text-[#8E918B]">
              Quiet check before you close the laptop.
            </p>
          </div>
          <ul className="grid divide-y divide-[#E7E7E2] md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-4">
            <SignalPill
              detail={
                model.missingDocuments.length
                  ? model.missingDocuments
                      .map((item) => `${item.listing.name}: ${item.missing}`)
                      .slice(0, 2)
                      .join(" · ")
                  : "No outstanding document gaps."
              }
              icon={AlertTriangle}
              label="Missing docs"
              value={`${model.missingDocuments.length}`}
            />
            <SignalPill
              detail={
                conversationsNeedingSummary
                  ? `${conversationsNeedingSummary} calls without a written summary.`
                  : "All captured calls have a summary on file."
              }
              icon={Clock}
              label="Calls to summarise"
              value={`${conversationsNeedingSummary}`}
            />
            <SignalPill
              detail={
                model.ownerUpdates.length
                  ? model.ownerUpdates
                      .slice(0, 2)
                      .map(
                        (item) =>
                          `${item.seller.name}: ${dueLabel(item.seller.nextOwnerUpdateDueAt)}`,
                      )
                      .join(" · ")
                  : "No owner reports are due this week."
              }
              icon={Calendar}
              label="Owner updates"
              value={`${model.ownerUpdates.length}`}
            />
            <SignalPill
              detail={
                model.followUpDrafts.length
                  ? `${model.followUpDrafts.length} drafts in the approval loop.`
                  : "No drafts. Voice notes & call summaries create them."
              }
              icon={CheckCircle}
              label="Approved drafts"
              value={`${approvedDrafts}`}
            />
          </ul>
        </Tile>
      </section>

      {/* Below-the-fold loud-list fallback — keeps overdue list reachable
          (kept short; anchor tile owns the primary surface). */}
      {model.overdueTasks.length > 1 ? (
        <section className="mt-8">
          <Card>
            <CardHeader
              title="Every overdue item"
              action={
                <Badge tone="coral">
                  {model.overdueTasks.length} total
                </Badge>
              }
            />
            <ul className="divide-y divide-[#E7E7E2]">
              {model.overdueTasks.map((task) => {
                const buyer = task.buyerId
                  ? getBuyerById(task.buyerId, segment)
                  : undefined;
                const listing = task.listingId
                  ? getListingById(task.listingId, segment)
                  : undefined;
                return (
                  <li
                    className="grid gap-3 px-6 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                    key={task.id}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={getTaskTone(task)}>{task.priority}</Badge>
                        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#8E918B]">
                          {dueLabel(task.dueAt)}
                        </span>
                      </div>
                      <h3 className="mt-1.5 text-[14.5px] font-medium text-[#171719]">
                        {task.title}
                      </h3>
                      <p className="mt-1 text-[12.5px] leading-5 text-[#5F625E]">
                        {task.reason}
                      </p>
                      {(buyer || listing) && (
                        <p className="mt-1.5 text-[12px] text-[#8E918B]">
                          {[buyer?.name, listing?.name]
                            .filter(Boolean)
                            .join(" / ")}
                        </p>
                      )}
                    </div>
                    <TaskActionButton label={task.actionLabel} taskId={task.id} />
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      ) : null}
    </div>
  );
}

/* Map a task to the page where the broker would actually work on it. The
   primary action button on the focal card uses this so its label ("Open
   matcher", "Review verification", "Approve update") leads to the right
   workspace instead of just toggling a done flag. */
function taskActionHref(
  kind:
    | "Follow-Up"
    | "Owner Update"
    | "Verification"
    | "Document"
    | "Matching"
    | "Viewing"
    | "CRM",
  buyerId?: string,
  listingId?: string,
  sellerId?: string,
): string {
  switch (kind) {
    case "Matching":
      return buyerId ? `/buyers/${buyerId}` : "/matching";
    case "Verification":
      return "/verification";
    case "Document":
      return listingId ? `/listings/${listingId}` : "/listings";
    case "Owner Update":
      return sellerId ? `/sellers/${sellerId}` : "/listings";
    case "Viewing":
      return buyerId ? `/buyers/${buyerId}` : "/buyers";
    case "Follow-Up":
      return buyerId ? `/buyers/${buyerId}` : "/buyers";
    case "CRM":
      return buyerId
        ? `/voice-crm?buyer=${encodeURIComponent(buyerId)}`
        : "/voice-crm";
    default:
      return "/dashboard";
  }
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function PipelineCompositionStat({
  detail,
  href,
  label,
  tone,
  value,
}: {
  detail: string;
  href: string;
  label: string;
  tone: "green" | "ink" | "coral";
  value: number;
}) {
  const dotClass =
    tone === "green"
      ? "bg-[#003C33]"
      : tone === "ink"
        ? "bg-[#171719]"
        : "bg-[#A86642]";
  return (
    <Link
      className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[#F1F2EE]"
      href={href}
    >
      <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
      <span className="bb-display text-[1.6rem] font-medium tabular-nums leading-none text-[#171719]">
        {value}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block bb-mono-label">{label}</span>
        <span className="mt-1 block truncate text-[11.5px] leading-4 text-[#8E918B]">
          {detail}
        </span>
      </span>
      <ArrowUpRight
        aria-hidden="true"
        className="h-3.5 w-3.5 shrink-0 text-[#A9ABA5] transition-colors group-hover:text-[#003C33]"
      />
    </Link>
  );
}

function SignalPill({
  detail,
  icon: Icon,
  label,
  value,
}: {
  detail: string;
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <li className="px-6 py-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-[#171719]" aria-hidden="true" />
          <p className="bb-mono-label">{label}</p>
        </div>
        <p className="bb-display text-lg font-medium tabular-nums text-[#171719]">
          {value}
        </p>
      </div>
      <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-[#5F625E]">
        {detail}
      </p>
    </li>
  );
}

/* First-run dashboard — kept lightly refreshed to match the new visual
   language (cream accent, deep-green anchor chip). */
function FirstRunDashboard() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <PageHeader
        title="Start with your first signal"
        description="Add a call, buyer, or listing to build memory, matches, and follow-ups."
        actions={
          <Link
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#003C33] px-5 text-sm font-medium text-white hover:bg-[#0B4A3F]"
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
              className="bb-display mt-2 text-xl font-medium text-[#171719]"
              id="quick-start-heading"
            >
              Three ways to seed the brain
            </h2>
          </div>
          <p className="hidden text-[13px] text-[#8E918B] sm:block">
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
        <CardHeader eyebrow="How the brain works" title="Core workflow" />
        <ul className="divide-y divide-[#E7E7E2]">
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
      className="group flex h-full flex-col justify-between gap-5 rounded-2xl border border-[#E7E7E2] bg-white p-6 transition-colors hover:border-[#003C33]"
      href={href}
    >
      <div>
        <div className="flex items-center justify-between">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#003C33] text-[#F2EADC]">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="bb-mono-label">{step}</span>
        </div>
        <h3 className="bb-display mt-5 text-lg font-medium text-[#171719]">{title}</h3>
        <p className="mt-2 text-[13px] leading-6 text-[#5F625E]">{description}</p>
      </div>
      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#171719]">
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
      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E7E7E2] bg-white text-[#003C33]">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-[14px] font-medium text-[#171719]">{title}</p>
        <p className="mt-1 text-[13px] leading-6 text-[#5F625E]">{description}</p>
      </div>
    </li>
  );
}
