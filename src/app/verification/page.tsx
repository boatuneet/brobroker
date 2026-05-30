import { AppShell } from "@/components/app-shell";
import { VerificationWorkspace } from "@/components/verification-workspace";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { isDemoModeEnabled } from "@/lib/demo-mode-server";

export const metadata = {
  title: "Verification · BroBroker",
  description: "Review buyer access before sensitive sharing.",
};

export default async function VerificationPage() {
  const segment = await getActiveBrokerSegment();
  const includeDemo = await isDemoModeEnabled();

  return (
    <AppShell active="Verification">
      <VerificationWorkspace key={segment} includeDemo={includeDemo} segment={segment} />
    </AppShell>
  );
}
