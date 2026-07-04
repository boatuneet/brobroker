import { AppShell } from "@/components/app-shell";
import { DealRoomCreate } from "@/components/deal-room-create";
import { PageBreadcrumb } from "@/components/ui/page-breadcrumb";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { isDemoModeEnabled } from "@/lib/demo-mode-server";
import { getStoredBuyersForSegment } from "@/lib/supabase/buyers";
import { getStoredListingsForSegment } from "@/lib/supabase/listings";

export const metadata = {
  title: "New deal room · BroBroker",
  description: "Curate a private buyer-safe shortlist and open a deal room.",
};

export default async function NewDealRoomPage({
  searchParams,
}: {
  searchParams: Promise<{ buyer?: string | string[]; listing?: string | string[] }>;
}) {
  const params = await searchParams;
  const initialBuyerId = Array.isArray(params.buyer) ? params.buyer[0] : params.buyer;
  const initialListingId = Array.isArray(params.listing) ? params.listing[0] : params.listing;
  const segment = await getActiveBrokerSegment();
  const includeDemo = await isDemoModeEnabled();
  const [storedBuyers, storedListings] = await Promise.all([
    getStoredBuyersForSegment(segment),
    getStoredListingsForSegment(segment),
  ]);

  return (
    <AppShell
      active="Deal Rooms"
      breadcrumb={
        <PageBreadcrumb
          items={[
            { label: "Deal rooms", href: "/deal-rooms" },
            { label: "New room" },
          ]}
        />
      }
    >
      <DealRoomCreate
        key={segment}
        includeDemo={includeDemo}
        initialBuyerId={initialBuyerId}
        initialListingId={initialListingId}
        segment={segment}
        storedBuyers={storedBuyers}
        storedListings={storedListings}
      />
    </AppShell>
  );
}
