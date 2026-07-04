import { AppShell } from "@/components/app-shell";
import { PrivateDealRoom } from "@/components/private-deal-room";
import { PageBreadcrumb } from "@/components/ui/page-breadcrumb";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { isDemoModeEnabled } from "@/lib/demo-mode-server";
import { getDealRoomById } from "@/lib/services";
import { getStoredBuyersForSegment } from "@/lib/supabase/buyers";
import { getStoredDealRooms } from "@/lib/supabase/deal-rooms";
import { getRoomQuestions } from "@/lib/supabase/deal-room-questions";
import { getStoredListingsForSegmentWithPreview } from "@/lib/supabase/listings";

// Render dynamically — deal-room IDs aren't known at build time and the
// previous setup triggered the same Turbopack server/client classification
// quirk seen on the buyers and sellers pages.
export function generateStaticParams() {
  return [];
}

export const dynamic = "force-dynamic";

export default async function PrivateDealRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const segment = await getActiveBrokerSegment();
  const includeDemo = await isDemoModeEnabled();
  /* Preview variant signs each listing's first photo so the room renders
     real imagery for broker-stored inventory, not placeholders. */
  const [storedBuyers, storedListings, storedRooms, roomQuestions] = await Promise.all([
    getStoredBuyersForSegment(segment),
    getStoredListingsForSegmentWithPreview(segment),
    getStoredDealRooms(),
    getRoomQuestions(id),
  ]);
  /* Resolve the room title server-side for the breadcrumb. Rooms saved only
     in the browser (localStorage drafts) share deterministic IDs with their
     generated counterparts, so this lookup covers them too; anything else
     falls back to a generic crumb. */
  const model = getDealRoomById(id, storedRooms, segment, {
    buyers: storedBuyers,
    listings: storedListings,
    includeDemo,
  });
  const roomTitle = model?.room.title ?? "Buyer room";

  return (
    <AppShell
      active="Deal Rooms"
      breadcrumb={
        <PageBreadcrumb
          items={[
            { label: "Deal rooms", href: "/deal-rooms" },
            { label: roomTitle },
          ]}
        />
      }
    >
      <PrivateDealRoom
        includeDemo={includeDemo}
        roomId={id}
        segment={segment}
        storedBuyers={storedBuyers}
        storedListings={storedListings}
        storedRooms={storedRooms}
        viewer="broker"
        initialQuestions={roomQuestions}
      />
    </AppShell>
  );
}
