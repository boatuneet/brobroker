import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BuyerIndex } from "@/components/client-memory";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { isDemoModeEnabled } from "@/lib/demo-mode-server";
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
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = Array.isArray(params.q) ? params.q[0] : params.q;
  const segment = await getActiveBrokerSegment();
  const includeDemo = await isDemoModeEnabled();
  const [storedBuyers, storedListings] = await Promise.all([
    getStoredBuyersForSegment(segment),
    getStoredListingsForSegment(segment),
  ]);

  return (
    <AppShell
      active="Buyers"
      pageActions={<BuyersTopActions />}
      pageTitle="Buyers"
    >
      <BuyerIndex
        includeDemo={includeDemo}
        query={query}
        segment={segment}
        storedBuyers={storedBuyers}
        storedListings={storedListings}
      />
    </AppShell>
  );
}
