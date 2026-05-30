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
    <AppShell active="Buyers">
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
