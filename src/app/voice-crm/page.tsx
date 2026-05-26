import { AppShell } from "@/components/app-shell";
import { VoiceToCrmWorkspace } from "@/components/voice-to-crm";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";

export const metadata = {
  title: "Voice CRM · BroBroker",
  description: "Turn call notes into memory, tasks, and follow-ups.",
};

export default async function VoiceCrmPage() {
  const segment = await getActiveBrokerSegment();

  return (
    <AppShell active="Voice CRM">
      <VoiceToCrmWorkspace key={segment} segment={segment} />
    </AppShell>
  );
}
