import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BuyerIndex } from "@/components/client-memory";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { isDemoModeEnabled } from "@/lib/demo-mode-server";
import { getStoredTasks } from "@/lib/supabase/broker-tasks";
import { getStoredBuyersForSegment } from "@/lib/supabase/buyers";
import { getStoredListingsForSegment } from "@/lib/supabase/listings";

export const metadata = {
  title: "Buyers · BroBroker",
  description: "Review buyer memory, urgency, fit, and next actions.",
};

/* Top-bar action cluster for the Buyers index. Sized to match the
   Dashboard pattern so it sits inline with the sidebar toggle + title. */
function BuyersTopActions() {
  return (
    <Link
      className="inline-flex min-h-9 items-center gap-1.5 rounded-[8px] bg-[#003C33] px-3 text-[13px] font-medium text-white transition-colors hover:bg-[#0B4A3F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]"
      href="/buyers/new"
    >
      <PlusCircle className="h-4 w-4" aria-hidden="true" />
      New buyer
    </Link>
  );
}

export default async function BuyersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    stage?: string | string[];
    focus?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const first = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);
  const query = first(params.q);
  /* Deep-link filters: Today's funnel tiles link ?stage=<stage>, and the
     "No next step" KPI tile links ?focus=no-next-step. */
  const initialStage = first(params.stage);
  const focus = first(params.focus);
  const segment = await getActiveBrokerSegment();
  const includeDemo = await isDemoModeEnabled();
  const [storedBuyers, storedListings, storedTasks] = await Promise.all([
    getStoredBuyersForSegment(segment),
    getStoredListingsForSegment(segment),
    getStoredTasks(),
  ]);

  return (
    <AppShell
      active="Buyers"
      pageActions={<BuyersTopActions />}
      pageTitle="Buyers"
    >
      <BuyerIndex
        focusNoNextStep={focus === "no-next-step"}
        includeDemo={includeDemo}
        initialStage={initialStage}
        query={query}
        segment={segment}
        storedBuyers={storedBuyers}
        storedListings={storedListings}
        storedTasks={storedTasks}
      />
    </AppShell>
  );
}
