import { AppShell } from "@/components/app-shell";
import { VoiceToCrmWorkspace } from "@/components/voice-to-crm";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { getStoredBuyersForSegment } from "@/lib/supabase/buyers";

export const metadata = {
  title: "Voice CRM · BroBroker",
  description: "Turn call notes into memory, tasks, and follow-ups.",
};

export default async function VoiceCrmPage() {
  const segment = await getActiveBrokerSegment();
  const storedBuyers = await getStoredBuyersForSegment(segment);

  return (
    <AppShell active="Voice CRM">
      <VoiceToCrmWorkspace key={segment} segment={segment} storedBuyers={storedBuyers} />
    </AppShell>
  );
}
