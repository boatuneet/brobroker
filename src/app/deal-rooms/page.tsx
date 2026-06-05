import { AppShell } from "@/components/app-shell";
import { DealRoomsWorkspace } from "@/components/deal-rooms-workspace";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { isDemoModeEnabled } from "@/lib/demo-mode-server";

export const metadata = {
  title: "Deal Rooms · BroBroker",
  description: "Create private buyer-safe shortlists.",
};

export default async function DealRoomsPage() {
  const segment = await getActiveBrokerSegment();
  const includeDemo = await isDemoModeEnabled();

  return (
    <AppShell active="Deal Rooms" pageTitle="Deal rooms">
      <DealRoomsWorkspace key={segment} includeDemo={includeDemo} segment={segment} />
    </AppShell>
  );
}
