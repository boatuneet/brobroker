import Link from "next/link";
import { Bot, FileText, UserPlus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Dashboard } from "@/components/dashboard";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { isDemoModeEnabled } from "@/lib/demo-mode-server";
import {
  getStoredCompletedTasksThisMonth,
  getStoredOpenTasksCount,
} from "@/lib/supabase/broker-tasks";
import { getStoredBuyersForSegment } from "@/lib/supabase/buyers";

export const metadata = {
  title: "Dashboard · BroBroker",
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
        className="inline-flex min-h-9 items-center gap-1.5 rounded-[8px] border border-[#E7E7E7] bg-white px-3 text-[13px] font-medium text-[#171719] transition-colors hover:bg-[#F1F2EE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]"
        href="/voice-crm"
      >
        <Bot className="h-4 w-4" aria-hidden="true" />
        Voice note
      </Link>
      <Link
        className="inline-flex min-h-9 items-center gap-1.5 rounded-[8px] border border-[#E7E7E7] bg-white px-3 text-[13px] font-medium text-[#171719] transition-colors hover:bg-[#F1F2EE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]"
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
  /* Pull the broker's Supabase buyers + task counters so the dashboard
     pulse preview / KPI strip / funnel can surface real data alongside
     (or instead of) demo data, matching the /pulse screen behaviour. */
  const [storedBuyers, completedThisMonth, openTaskCount] = await Promise.all([
    getStoredBuyersForSegment(segment),
    getStoredCompletedTasksThisMonth(),
    getStoredOpenTasksCount(),
  ]);

  return (
    <AppShell
      active="Dashboard"
      pageActions={<DashboardTopActions />}
      pageTitle="Dashboard"
    >
      <Dashboard
        completedTasksThisMonth={completedThisMonth}
        includeDemo={includeDemo}
        openTaskCount={openTaskCount}
        segment={segment}
        storedBuyers={storedBuyers}
      />
    </AppShell>
  );
}
