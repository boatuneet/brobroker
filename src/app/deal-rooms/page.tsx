import { AppShell } from "@/components/app-shell";
import { DealRoomsWorkspace } from "@/components/deal-rooms-workspace";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";

export const metadata = {
  title: "Deal Rooms · BroBroker",
  description: "Create private buyer-safe shortlists.",
};

export default async function DealRoomsPage() {
  const segment = await getActiveBrokerSegment();

  return (
    <AppShell active="Deal Rooms">
      <DealRoomsWorkspace key={segment} segment={segment} />
    </AppShell>
  );
}
