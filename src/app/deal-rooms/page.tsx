import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DealRoomsWorkspace } from "@/components/deal-rooms-workspace";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { isDemoModeEnabled } from "@/lib/demo-mode-server";
import { getStoredBuyersForSegment, getStoredBuyerVerificationMap } from "@/lib/supabase/buyers";
import { getStoredDealRooms } from "@/lib/supabase/deal-rooms";
import { getStoredListingsForSegment } from "@/lib/supabase/listings";

export const metadata = {
  title: "Deal Rooms · BroBroker",
  description: "Create private buyer-safe shortlists.",
};

/* Top-bar action cluster — matches the Buyers/Listings index pattern so
   "New room" is always one click away, right next to the page title. */
function DealRoomsTopActions() {
  return (
    <Link
      className="inline-flex min-h-9 items-center gap-1.5 rounded-[8px] bg-[#003C33] px-3 text-[13px] font-medium text-white transition-colors hover:bg-[#0B4A3F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]"
      href="/deal-rooms/new"
    >
      <PlusCircle className="h-4 w-4" aria-hidden="true" />
      New room
    </Link>
  );
}

export default async function DealRoomsPage() {
  const segment = await getActiveBrokerSegment();
  const includeDemo = await isDemoModeEnabled();
  const [storedBuyers, storedListings, storedRooms, verificationByBuyerId] = await Promise.all([
    getStoredBuyersForSegment(segment),
    getStoredListingsForSegment(segment),
    getStoredDealRooms(),
    getStoredBuyerVerificationMap(),
  ]);

  return (
    <AppShell
      active="Deal Rooms"
      pageActions={<DealRoomsTopActions />}
      pageTitle="Deal rooms"
    >
      <DealRoomsWorkspace
        key={segment}
        includeDemo={includeDemo}
        segment={segment}
        storedBuyers={storedBuyers}
        storedListings={storedListings}
        storedRooms={storedRooms}
        verificationByBuyerId={verificationByBuyerId}
      />
    </AppShell>
  );
}
