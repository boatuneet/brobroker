import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Calendar,
  CheckCircle,
  Clock,
  Compass,
  FileText,
  Gauge,
  MessageSquareText,
  Radio,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { BrokerSegment } from "@/lib/broker-segments";
import type { BrokerTask, BuyerProfile, YachtListing } from "@/lib/types";
import { formatViewingLabel } from "@/lib/viewings";
import type { UpcomingViewing } from "@/lib/supabase/room-viewings-server";
import {
  getBuyerById,
  getDashboardModel,
  getListingById,
  getTaskTone,
} from "@/lib/services";
import { cn, daysUntil, formatCurrencyCompact } from "@/lib/utils";
import {
  Badge,
  Card,
  CardHeader,
  PageHeader,
} from "./ui";
import { StatRow } from "./ui/stat-row";
import { TaskActionButton } from "./task-action-button";
import { TaskQuickActions } from "./dashboard/task-quick-actions";
import { DashboardPulsePreview } from "./pulse/dashboard-pulse-preview";
import { PipelineFunnel } from "./dashboard/pipeline-funnel";

function dueLabel(date: string) {
  const delta = daysUntil(date);
  if (delta < 0) return `${Math.abs(delta)}d overdue`;
  if (delta === 0) return "Due today";
  if (delta === 1) return "Due tomorrow";
  return `Due in ${delta}d`;
}

export function Dashboard({
  includeDemo = true,
  openQuestions = { count: 0 },
  segment,
  storedBuyers = [],
  storedListings = [],
  storedTasks = [],
  upcomingViewings = [],
}: {
  includeDemo?: boolean;
  /* Open buyer questions across the broker's deal rooms (+ the room with
     the newest one, for the deep link). */
  openQuestions?: { count: number; roomId?: string };
  segment?: BrokerSegment;
  storedBuyers?: BuyerProfile[];
  storedListings?: YachtListing[];
  storedTasks?: BrokerTask[];
  /* Structured viewings across the broker's rooms, next 7 days, fetched
     server-side. Sorted ascending. */
  upcomingViewings?: UpcomingViewing[];
}) {
  const model = getDashboardModel(segment, { includeDemo });
  /* Merge stored (Supabase) records with the demo pools so every surface —
     hero, queue, funnel, timelines — runs on the broker's REAL data, with
     demo lanes only when the investor-demo toggle is on. Stored rows list
     first so they win id collisions. */
  const dedupeById = <T extends { id: string }>(rows: T[]): T[] => {
    const seen = new Set<string>();
    return rows.filter((row) => (seen.has(row.id) ? false : (seen.add(row.id), true)));
  };
  const allBuyers = dedupeById([...storedBuyers, ...model.buyers]);
  const allListings = dedupeById([...storedListings, ...model.listings]);
  const allTasks = dedupeById([...storedTasks, ...model.tasks]);
  const openTasks = allTasks
    .filter((task) => task.status !== "Done")
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  const storedTaskIds = new Set(storedTasks.map((task) => task.id));
  /* Local resolvers that check the broker's stored records before the demo
     pools, so stored tasks referencing stored buyers/assets resolve too. */
  const resolveBuyer = (id?: string) =>
    id ? allBuyers.find((buyer) => buyer.id === id) ?? getBuyerById(id, segment) : undefined;
  const resolveListing = (id?: string) =>
    id ? allListings.find((listing) => listing.id === id) ?? getListingById(id, segment) : undefined;

  const pulsePreviewBuyers = allBuyers;
  /* Buyers that have no open broker task — deals drifting with no next
     step. Computed from the merged task set so real tasks count. */
  const buyerIdsWithOpenTask = new Set(
    openTasks.map((task) => task.buyerId).filter((id): id is string => Boolean(id)),
  );
  const dealsWithoutTasks = allBuyers.filter(
    (buyer) => !buyerIdsWithOpenTask.has(buyer.id),
  );
  const dealsWithoutTasksValue = dealsWithoutTasks.reduce(
    (sum, buyer) => sum + (buyer.budgetMaxEur || buyer.budgetMinEur || 0),
    0,
  );
  const liveOpenTaskCount = openTasks.length;
  const dueTodayCount = openTasks.filter((task) => daysUntil(task.dueAt) === 0).length;
  const pendingDrafts = model.followUpDrafts.filter(
    (draft) => draft.status !== "Approved",
  ).length;
  const conversationsNeedingSummary = model.conversations.filter(
    (item) => item.needsSummary,
  ).length;

  /* First-run only when there's truly nothing to show — demo model AND the
     broker's real records. (Checking only the demo model made a broker with
     real data see the empty state the moment they switched demo off.) */
  const hasRealData =
    storedBuyers.length > 0 || storedTasks.length > 0 || storedListings.length > 0;
  if (!model.hasAnyData && !hasRealData) {
    return <FirstRunDashboard />;
  }

  // Derived numbers powering the visualisations.
  const pipelineCount = allBuyers.length;
  const listingCount = allListings.length;
  const verificationCount = model.verificationCases.length;
  const dealRoomCount = model.dealRooms.length;
  const overdueCount = openTasks.filter((task) => daysUntil(task.dueAt) < 0).length;

  /* The day's #1 task: earliest due date across the MERGED open set (real +
     demo), so overdue naturally leads and the hero never claims "nothing
     urgent" while open tasks exist. */
  const topTask = openTasks[0];
  const topTaskBuyer = resolveBuyer(topTask?.buyerId);
  const topTaskListing = resolveListing(topTask?.listingId);
  /* Where the primary "action" button on the focal task should navigate to,
     based on the task kind + linked IDs. Keeps the button label honest:
     "Open matcher" → /matching, "Approve update" → owner page, etc.

     We also defensively drop the href when the target buyer/listing/seller
     can't be resolved (which would otherwise produce a dead link or a 500 in
     production where demo IDs aren't backed by Supabase rows). Without an
     href, TaskActionButton falls back to a pure mark-done toggle so the
     broker isn't sent to a broken page. */
  const topTaskHref = topTask
    ? resolveTaskHref(
        topTask.kind,
        topTask.buyerId,
        topTask.listingId,
        topTask.sellerId,
        Boolean(topTaskBuyer),
        Boolean(topTaskListing),
      )
    : undefined;
  const topRiskCase = [...model.verificationCases].sort(
    (a, b) => b.score - a.score,
  )[0];
  const topRiskBuyer = topRiskCase
    ? getBuyerById(topRiskCase.buyerId, segment)
    : undefined;
  const highRiskCount = model.verificationCases.filter(
    (item) => item.status === "High Risk",
  ).length;
  const reviewCount = model.verificationCases.filter(
    (item) => item.status === "Needs Review",
  ).length;
  const activeListingCount = allListings.filter(
    (listing) => listing.status === "Active",
  ).length;
  const progressedBuyerCount = allBuyers.filter(
    (buyer) => buyer.currentStage !== "New Inquiry",
  ).length;
  /* The day's working queue: every open task sorted by due date (overdue
     first), minus the focal task already shown above. Capped so the card
     stays scannable — the tail lives on each buyer/listing record. */
  const visibleQueueTasks = openTasks
    .filter((task) => task.id !== topTask?.id)
    .slice(0, 6);

  /* Going cold: live deals (not closed) with no contact for 14+ days. The
     data already exists on every buyer — surfacing it is how money stops
     quietly dying in the pipeline. */
  const goingColdBuyers = allBuyers.filter(
    (buyer) =>
      buyer.currentStage !== "Closed Won" &&
      buyer.currentStage !== "Closed Lost" &&
      buyer.lastContactedAt &&
      daysUntil(buyer.lastContactedAt) <= -14,
  );

  /* Deep-link targets for the risk rows — land on the specific record that
     resolves the issue, not a generic index page. */
  const firstMissingDocListing = model.missingDocuments[0]?.listing;
  const firstPendingDraft = model.followUpDrafts.find((draft) => draft.status !== "Approved");

  const riskSignals: Array<{
    detail: string;
    href: string;
    icon: LucideIcon;
    label: string;
    value: string;
  }> = [
    {
      detail: openQuestions.count
        ? `${openQuestions.count} buyer question${openQuestions.count === 1 ? "" : "s"} waiting in your deal rooms.`
        : "No open buyer questions.",
      href: openQuestions.roomId ? `/deal-rooms/${openQuestions.roomId}` : "/deal-rooms",
      icon: MessageSquareText,
      label: "Buyer questions",
      value: `${openQuestions.count}`,
    },
    (() => {
      const next = upcomingViewings[0];
      if (!next) {
        return {
          detail: "No viewings scheduled.",
          href: "/deal-rooms",
          icon: Calendar,
          label: "Viewings",
          value: "0",
        };
      }
      const buyerName = resolveBuyer(next.buyerId)?.name;
      const listingName = next.listingId ? resolveListing(next.listingId)?.name : undefined;
      const parts = [formatViewingLabel(next), listingName, buyerName].filter(Boolean);
      return {
        detail: parts.join(" · "),
        href: `/deal-rooms/${next.roomId}`,
        icon: Calendar,
        label: "Viewings",
        value: `${upcomingViewings.length}`,
      };
    })(),
    {
      detail: topRiskCase
        ? `${topRiskBuyer?.name ?? "Unknown buyer"}: ${topRiskCase.recommendedAction}`
        : "Verification inbox is clear.",
      href: topRiskCase ? `/verification?buyer=${topRiskCase.buyerId}` : "/verification",
      icon: ShieldCheck,
      label: "Verification risk",
      value: highRiskCount ? `${highRiskCount} high` : `${reviewCount} review`,
    },
    {
      detail: goingColdBuyers.length
        ? `${goingColdBuyers
            .slice(0, 2)
            .map((buyer) => buyer.name)
            .join(", ")} — no contact in 14+ days.`
        : "Every live deal has recent contact.",
      href: goingColdBuyers[0] ? `/buyers/${goingColdBuyers[0].id}` : "/buyers",
      icon: Clock,
      label: "Going cold",
      value: `${goingColdBuyers.length}`,
    },
    {
      detail: model.missingDocuments.length
        ? model.missingDocuments
            .map((item) => `${item.listing.name}: ${item.missing}`)
            .slice(0, 2)
            .join(" · ")
        : "No open document gaps.",
      href: firstMissingDocListing
        ? `/listings/${firstMissingDocListing.id}?tab=docs`
        : "/listings",
      icon: FileText,
      label: "Missing docs",
      value: `${model.missingDocuments.length}`,
    },
    {
      detail: pendingDrafts
        ? `${pendingDrafts} drafts waiting for your approval.`
        : "No follow-up drafts waiting.",
      href: firstPendingDraft?.buyerId
        ? `/buyers/${firstPendingDraft.buyerId}?tab=drafts`
        : "/buyers",
      icon: CheckCircle,
      label: "Drafts to approve",
      value: `${pendingDrafts}`,
    },
    {
      detail: conversationsNeedingSummary
        ? `${conversationsNeedingSummary} captured calls need a written summary.`
        : "All captured calls have summaries.",
      href: "/voice-crm",
      icon: Bot,
      label: "Calls to summarize",
      value: `${conversationsNeedingSummary}`,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1536px] px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
      {/* Title + actions moved into the sticky top bar (see
          DashboardPage). KPI strip now leads the page content. */}

      {/* KPI strip — the three questions a broker asks at 8am: what's late,
          what's due today, and which deals are drifting with no next step.
          Vanity counters (completed-this-month, raw open totals) live in
          each workspace, not here. */}
      <div className="flex flex-wrap gap-3">
        <StatRow
          title="Overdue"
          value={overdueCount}
          trend={overdueCount > 0 ? "down" : "up"}
          trendLabel={
            overdueCount > 0
              ? `${overdueCount} need attention`
              : "Inbox zero"
          }
        />
        <StatRow
          title="Due today"
          value={dueTodayCount}
          trend={dueTodayCount > 0 ? "neutral" : "up"}
          trendLabel={
            dueTodayCount > 0
              ? `of ${liveOpenTaskCount} open tasks`
              : "Nothing due today"
          }
        />
        <StatRow
          href="/buyers?focus=no-next-step"
          title="No next step"
          value={dealsWithoutTasks.length}
          trend={dealsWithoutTasks.length > 0 ? "down" : "up"}
          trendLabel={
            dealsWithoutTasksValue > 0
              ? `${formatCurrencyCompact(dealsWithoutTasksValue)} waiting on you`
              : "Every deal has a next step"
          }
        />
      </div>

      {/* Pipeline funnel — the executive-view band, spans the full row. */}
      <PipelineFunnel buyers={allBuyers} className="mt-5" />

      {/* items-start lets each card keep its content height — otherwise the
          hero stretches to match the risk queue and shows a hollow middle
          when the broker has only a couple of open tasks. */}
      <section
        aria-label="Dashboard briefing"
        className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.42fr)_minmax(320px,0.78fr)] lg:items-start"
      >
        <Card className="flex flex-col p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <AlertTriangle
                  className={cn(
                    "h-4 w-4",
                    overdueCount > 0 ? "text-[#A86642]" : "text-[#0F8F62]",
                  )}
                  aria-hidden="true"
                />
                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#8E918B]">
                  Needs me now
                </p>
              </div>
              <h2 className="mt-3 max-w-2xl text-[26px] font-semibold leading-tight tracking-normal text-[#171719]">
                {topTask ? topTask.title : "No urgent broker actions right now."}
              </h2>
              <p className="mt-3 max-w-2xl text-[15px] leading-7 text-[#5F625E]">
                {topTask
                  ? topTask.reason
                  : "Everything critical is up to date. Use the next few minutes to add an inquiry or capture a fresh voice note."}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              <Badge
                className={cn("rounded-[8px]", overdueCount > 0 && "border-[#F0DDD0] bg-[#F0DDD0] text-[#A86642]")}
                tone={overdueCount > 0 ? "coral" : "success"}
              >
                {overdueCount > 0 ? `${overdueCount} overdue` : "Clear"}
              </Badge>
            </div>
          </div>

          {topTask ? (
            <>
              {/* Focus chip: who + what + when. The soft #F1F2EE accent fill
                  (same as the Pipeline-snapshot hover) makes the "subject" of
                  the task the visual anchor inside the card. Avatar + name +
                  listing on one row, with the priority + due chip pinned
                  right so the eye never has to scan twice. */}
              <div className="mt-6 flex flex-wrap items-center gap-3 rounded-[8px] bg-[#F1F2EE] p-3">
                {topTaskBuyer ? (
                  <span
                    aria-hidden="true"
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-white text-[12px] font-semibold uppercase tracking-[0.06em] text-[#003C33]"
                  >
                    {initialsFor(topTaskBuyer.name)}
                  </span>
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-[#171719]">
                    {topTaskBuyer?.name ?? "Unassigned buyer"}
                  </p>
                  {topTaskListing ? (
                    <p className="mt-0.5 truncate text-[12.5px] text-[#5F625E]">
                      {topTaskListing.name}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Badge className={getTaskTone(topTask)}>{topTask.priority}</Badge>
                  <span className="inline-flex min-h-8 items-center gap-1.5 rounded-[8px] border border-[#E7E7E7] bg-white px-3 text-[12px] font-semibold text-[#5F625E]">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    {dueLabel(topTask.dueAt)}
                  </span>
                </div>
              </div>

              {/* Primary action row sits just below the focus chip — no extra
                  divider needed, the accent fill already separates concerns.
                  Done/snooze make the hero workable without leaving Today. */}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <TaskActionButton
                  href={topTaskHref}
                  label={topTask.actionLabel}
                  taskId={topTask.id}
                />
                {topTaskBuyer ? (
                  <Link
                    className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[#D9DAD4] bg-white px-4 text-[13px] font-medium text-[#171719] transition-colors hover:border-[#003C33] hover:bg-[#F1F2EE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]"
                    href={`/buyers/${topTaskBuyer.id}`}
                  >
                    Open buyer
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                ) : null}
                <TaskQuickActions isStored={storedTaskIds.has(topTask.id)} taskId={topTask.id} />
              </div>
            </>
          ) : (
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[#E7E7E7] pt-5">
              <Link
                className="inline-flex min-h-10 items-center gap-2 rounded-[8px] bg-[#003C33] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#0B4A3F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]"
                href="/buyers/new"
              >
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Add inquiry
              </Link>
              <Link
                className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[#D9DAD4] bg-white px-4 text-[13px] font-medium text-[#171719] transition-colors hover:border-[#003C33] hover:bg-[#F1F2EE]"
                href="/voice-crm"
              >
                <Bot className="h-4 w-4" aria-hidden="true" />
                Voice note
              </Link>
            </div>
          )}

          {visibleQueueTasks.length ? (
            <div className="mt-6 border-t border-[#E7E7E7] pt-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#8E918B]">
                  Next in queue
                </p>
                <span className="text-[12px] font-medium text-[#8E918B]">
                  {liveOpenTaskCount} open total
                </span>
              </div>
              {/* Each queued task is a single clickable row — title + due on
                  the left, action label + arrow on the right. The row itself
                  is the link, so clicking anywhere navigates. Hover paints
                  the row with the #F1F2EE accent, tying the section together
                  visually. When the destination can't be resolved we fall
                  back to a non-interactive row rather than rendering a dead
                  link. */}
              <ul className="mt-3 grid gap-1">
                {visibleQueueTasks.map((task) => {
                  const buyer = resolveBuyer(task.buyerId);
                  const listing = resolveListing(task.listingId);
                  const href = resolveTaskHref(
                    task.kind,
                    task.buyerId,
                    task.listingId,
                    task.sellerId,
                    Boolean(buyer),
                    Boolean(listing),
                  );

                  /* Row anatomy: the title area is the link; done/snooze sit
                     beside it as siblings (never nest buttons in anchors). */
                  const titleBlock = (
                    <>
                      <p className="truncate text-[13.5px] font-medium text-[#171719]">
                        {task.title}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[#8E918B]">
                        {dueLabel(task.dueAt)}
                        {buyer ? ` · ${buyer.name}` : ""}
                      </p>
                    </>
                  );

                  return (
                    <li
                      key={task.id}
                      className="flex items-center gap-3 rounded-[8px] px-3 py-2 transition-colors hover:bg-[#F1F2EE]"
                    >
                      {href ? (
                        <Link className="group min-w-0 flex-1" href={href}>
                          {titleBlock}
                          <span className="mt-0.5 inline-flex items-center gap-1.5 text-[12px] font-medium text-[#003C33]">
                            {task.actionLabel}
                            <ArrowRight className="h-3 w-3" aria-hidden="true" />
                          </span>
                        </Link>
                      ) : (
                        <div className="min-w-0 flex-1">{titleBlock}</div>
                      )}
                      <TaskQuickActions
                        compact
                        isStored={storedTaskIds.has(task.id)}
                        taskId={task.id}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </Card>

        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#8E918B]">
                Risk queue
              </p>
              <h2 className="mt-3 text-[22px] font-semibold leading-tight text-[#171719]">
                Trust and follow-up gaps
              </h2>
              <p className="mt-2 text-[14px] leading-6 text-[#5F625E]">
                The few checks worth seeing before the broader workspace.
              </p>
            </div>
            <ShieldCheck className="h-5 w-5 text-[#003C33]" aria-hidden="true" />
          </div>
          <ul className="mt-5 divide-y divide-[#E7E7E7] border-t border-[#E7E7E7]">
            {riskSignals.map((signal) => {
              const Icon = signal.icon;
              return (
                <li key={signal.label}>
                  <Link
                    className="group grid gap-2 py-4 transition-colors sm:grid-cols-[minmax(0,1fr)_auto]"
                    href={signal.href}
                  >
                    <span className="flex min-w-0 gap-3">
                      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[#FBFBFB] text-[#003C33]">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-semibold text-[#171719]">
                          {signal.label}
                        </span>
                        <span className="mt-1 line-clamp-2 block text-[12.5px] leading-5 text-[#8E918B]">
                          {signal.detail}
                        </span>
                      </span>
                    </span>
                    <span className="inline-flex min-h-8 items-center self-center justify-self-start rounded-[8px] border border-[#E7E7E7] bg-white px-3 text-[12px] font-semibold text-[#171719] group-hover:border-[#003C33] sm:justify-self-end">
                      {signal.value}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      </section>

      <section
        aria-label="Pulse and pipeline"
        className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.42fr)_minmax(320px,0.78fr)]"
      >
        <DashboardPulsePreview
          buyers={pulsePreviewBuyers}
          className="min-h-[320px]"
          conversations={model.conversations}
          drafts={model.followUpDrafts}
          tasks={allTasks}
        />

        <Card className="overflow-hidden p-0">
          <div className="border-b border-[#E7E7E7] px-6 py-5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#8E918B]">
              Pipeline snapshot
            </p>
            <h2 className="mt-3 text-[22px] font-semibold leading-tight text-[#171719]">
              Capacity at a glance
            </h2>
            <p className="mt-2 text-[14px] leading-6 text-[#5F625E]">
              Keep the counts here, move the details to each workspace.
            </p>
          </div>
          <div className="divide-y divide-[#E7E7E7]">
            <PipelineCompositionStat
              detail={`${progressedBuyerCount} past intake`}
              href="/buyers"
              label="Buyers"
              tone="green"
              value={pipelineCount}
            />
            <PipelineCompositionStat
              detail={`${activeListingCount} active listings`}
              href="/listings"
              label="Listings"
              tone="ink"
              value={listingCount}
            />
            <PipelineCompositionStat
              detail={`${dealRoomCount} rooms live`}
              href="/deal-rooms"
              label="Deal rooms"
              tone="green"
              value={dealRoomCount}
            />
            <PipelineCompositionStat
              detail={`${highRiskCount} high risk`}
              href="/verification"
              label="Verifications"
              tone="coral"
              value={verificationCount}
            />
          </div>
        </Card>
      </section>
    </div>
  );
}

/* Map a task to the page where the broker would actually work on it. The
   primary action button on the focal card uses this so its label ("Open
   matcher", "Review verification", "Approve update") leads to the right
   workspace instead of just toggling a done flag. */
type TaskKind =
  | "Follow-Up"
  | "Owner Update"
  | "Verification"
  | "Document"
  | "Matching"
  | "Viewing"
  | "CRM";

/* Pick the destination for the focal task button.
   - When `buyerResolved` / `listingResolved` are false we know the target
     detail page would either 404 or 500 (e.g. demo task referencing an ID
     that isn't in Supabase). In that case we return undefined so the
     TaskActionButton falls back to a pure mark-done toggle — no dead link. */
function resolveTaskHref(
  kind: TaskKind,
  buyerId: string | undefined,
  listingId: string | undefined,
  sellerId: string | undefined,
  buyerResolved: boolean,
  listingResolved: boolean,
): string | undefined {
  switch (kind) {
    case "Matching":
      if (buyerId) return buyerResolved ? `/buyers/${buyerId}?tab=matches` : undefined;
      return "/matching";
    case "Document":
      if (listingId) return listingResolved ? `/listings/${listingId}` : undefined;
      return "/listings";
    case "Owner Update":
      // Sellers are demo-only today, so we only link out when we have one and
      // it would actually resolve. With no sellerId we fall back to listings.
      return sellerId ? undefined : "/listings";
    case "Viewing":
    case "Follow-Up":
      if (buyerId) return buyerResolved ? `/buyers/${buyerId}` : undefined;
      return "/buyers";
    case "Verification":
      return "/verification";
    case "CRM":
      return buyerId
        ? `/voice-crm?buyer=${encodeURIComponent(buyerId)}`
        : "/voice-crm";
    default:
      return undefined;
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

/* First-run dashboard — kept lightly refreshed to match the new visual
   language (cream accent, deep-green anchor chip). */
function FirstRunDashboard() {
  return (
    <div className="mx-auto w-full max-w-[1536px] px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
      {/* No CTA up here — the global Capture button sits directly above in
          the top bar; duplicating it side-by-side read as two different
          actions. The three quick-start cards below carry the choices. */}
      <PageHeader
        title="Start with your first signal"
        description="Add a call, buyer, or listing to build memory, matches, and follow-ups."
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
        <ul className="divide-y divide-[#E7E7E7]">
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
      className="group flex h-full flex-col justify-between gap-5 rounded-[12px] border border-[#E7E7E7] bg-white p-6 transition-colors hover:border-[#003C33]"
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
      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E7E7E7] bg-white text-[#003C33]">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-[14px] font-medium text-[#171719]">{title}</p>
        <p className="mt-1 text-[13px] leading-6 text-[#5F625E]">{description}</p>
      </div>
    </li>
  );
}
