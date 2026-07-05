import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, UserPlus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Dashboard } from "@/components/dashboard";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { isDemoModeEnabled } from "@/lib/demo-mode-server";
import { hasCompletedOnboarding } from "@/lib/onboarding-server";
import { getStoredTasks } from "@/lib/supabase/broker-tasks";
import { getStoredBuyersForSegment } from "@/lib/supabase/buyers";
import { getOpenRoomQuestionSummary } from "@/lib/supabase/deal-room-questions";
import { getStoredListingsForSegment } from "@/lib/supabase/listings";

export const metadata = {
  title: "Today · BroBroker",
  description: "Track urgent tasks, buyer momentum, verification, and owner updates.",
};

/* Top-bar action cluster for the dashboard. Lifted up to the page so it
   can be passed into AppShell's `pageActions` slot — the sticky top bar
   renders them on the right, sized smaller than the old in-content
   PageHeader version so multiple fit cleanly inline with the breadcrumb
   row. */
function DashboardTopActions() {
  return (
    <>
      <Link
        className="inline-flex min-h-9 items-center gap-1.5 rounded-[8px] border border-[#D9DAD4] bg-white px-3 text-[13px] font-medium text-[#171719] transition-colors hover:border-[#003C33] hover:bg-[#F1F2EE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]"
        href="/buyers/new"
      >
        <UserPlus className="h-4 w-4" aria-hidden="true" />
        Add inquiry
      </Link>
      <Link
        className="inline-flex min-h-9 items-center gap-1.5 rounded-[8px] bg-[#003C33] px-3 text-[13px] font-medium text-white transition-colors hover:bg-[#0B4A3F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]"
        href="/deal-rooms/new"
      >
        <FileText className="h-4 w-4" aria-hidden="true" />
        New deal room
      </Link>
    </>
  );
}

export default async function DashboardPage() {
  const segment = await getActiveBrokerSegment();
  const includeDemo = await isDemoModeEnabled();
  /* Pull the broker's real Supabase rows — buyers, TASK ROWS (not just
     counts, so the hero/queue run on real work), listings (to resolve
     task-linked assets), and the open buyer-question summary for the risk
     queue. Demo data merges in when the investor-demo toggle is on. */
  const [storedBuyers, storedTasks, storedListings, openQuestions, onboarded] =
    await Promise.all([
      getStoredBuyersForSegment(segment),
      getStoredTasks(),
      getStoredListingsForSegment(segment),
      getOpenRoomQuestionSummary(),
      hasCompletedOnboarding(),
    ]);

  /* A truly fresh broker (no real records, hasn't finished or skipped the
     welcome flow) gets the focused onboarding instead of a dashboard —
     demo data on by default made day one feel like someone else's desk. */
  if (
    !onboarded &&
    storedBuyers.length === 0 &&
    storedTasks.length === 0 &&
    storedListings.length === 0
  ) {
    redirect("/welcome");
  }

  return (
    <AppShell
      active="Today"
      pageActions={<DashboardTopActions />}
      pageTitle="Today"
    >
      <Dashboard
        includeDemo={includeDemo}
        openQuestions={openQuestions}
        segment={segment}
        storedBuyers={storedBuyers}
        storedListings={storedListings}
        storedTasks={storedTasks}
      />
    </AppShell>
  );
}
