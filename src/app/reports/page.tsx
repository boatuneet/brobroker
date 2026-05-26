import { AppShell } from "@/components/app-shell";
import { ReportsWorkspace } from "@/components/reports-workspace";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";

export const metadata = {
  title: "Reports · BroBroker",
  description: "Draft and approve owner updates.",
};

export default async function ReportsPage() {
  const segment = await getActiveBrokerSegment();

  return (
    <AppShell active="Reports">
      <ReportsWorkspace key={segment} segment={segment} />
    </AppShell>
  );
}
