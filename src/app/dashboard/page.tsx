import { AppShell } from "@/components/app-shell";
import { Dashboard } from "@/components/dashboard";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";

export const metadata = {
  title: "Dashboard · BroBroker",
  description: "Track urgent tasks, buyer momentum, verification, and owner updates.",
};

export default async function DashboardPage() {
  const segment = await getActiveBrokerSegment();

  return (
    <AppShell active="Dashboard">
      <Dashboard segment={segment} />
    </AppShell>
  );
}
