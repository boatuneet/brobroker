import { AppShell } from "@/components/app-shell";
import { MatchingWorkspace } from "@/components/matching-workspace";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";

export const metadata = {
  title: "Matching · BroBroker",
  description: "Turn buyer briefs into ranked matches and hidden opportunities.",
};

export default async function MatchingPage() {
  const segment = await getActiveBrokerSegment();

  return (
    <AppShell active="Matching">
      <MatchingWorkspace key={segment} segment={segment} />
    </AppShell>
  );
}
