import { AppShell } from "@/components/app-shell";
import { ReportsWorkspace } from "@/components/reports-workspace";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { isDemoModeEnabled } from "@/lib/demo-mode-server";

export const metadata = {
  title: "Owner Updates · BroBroker",
  description: "Draft and approve owner updates.",
};

export default async function ReportsPage() {
  const segment = await getActiveBrokerSegment();
  const includeDemo = await isDemoModeEnabled();

  return (
    <AppShell active="Owner Updates" pageTitle="Owner Updates">
      <ReportsWorkspace key={segment} includeDemo={includeDemo} segment={segment} />
    </AppShell>
  );
}
