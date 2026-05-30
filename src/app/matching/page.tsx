import { AppShell } from "@/components/app-shell";
import { MatchingWorkspace } from "@/components/matching-workspace";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { isDemoModeEnabled } from "@/lib/demo-mode-server";
import { getStoredBuyersForSegment } from "@/lib/supabase/buyers";
import { getStoredListingsForSegment } from "@/lib/supabase/listings";

export const metadata = {
  title: "Matching · BroBroker",
  description: "Turn buyer briefs into ranked matches and hidden opportunities.",
};

export default async function MatchingPage() {
  const segment = await getActiveBrokerSegment();
  const includeDemo = await isDemoModeEnabled();
  const [storedListings, storedBuyers] = await Promise.all([
    getStoredListingsForSegment(segment),
    getStoredBuyersForSegment(segment),
  ]);

  return (
    <AppShell active="Matching">
      <MatchingWorkspace
        key={segment}
        includeDemo={includeDemo}
        segment={segment}
        storedBuyers={storedBuyers}
        storedListings={storedListings}
      />
    </AppShell>
  );
}
