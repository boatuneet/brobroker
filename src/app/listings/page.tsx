import { AppShell } from "@/components/app-shell";
import { ListingIndex } from "@/components/listings";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { getStoredListingsForSegment } from "@/lib/supabase/listings";

export const metadata = {
  title: "Listings · BroBroker",
  description: "Search inventory, document readiness, buyer fit, and missing facts.",
};

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; status?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = Array.isArray(params.q) ? params.q[0] : params.q;
  const status = Array.isArray(params.status) ? params.status[0] : params.status;
  const segment = await getActiveBrokerSegment();
  const storedListings = await getStoredListingsForSegment(segment);

  return (
    <AppShell active="Listings">
      <ListingIndex query={query} segment={segment} status={status} storedListings={storedListings} />
    </AppShell>
  );
}
