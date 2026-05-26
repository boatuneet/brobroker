import { AppShell } from "@/components/app-shell";
import { VerificationWorkspace } from "@/components/verification-workspace";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";

export const metadata = {
  title: "Verification · BroBroker",
  description: "Review buyer access before sensitive sharing.",
};

export default async function VerificationPage() {
  const segment = await getActiveBrokerSegment();

  return (
    <AppShell active="Verification">
      <VerificationWorkspace key={segment} segment={segment} />
    </AppShell>
  );
}
