import { AppShell } from "@/components/app-shell";
import { VoiceToCrmWorkspace } from "@/components/voice-to-crm";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { isDemoModeEnabled } from "@/lib/demo-mode-server";
import { getStoredBuyersForSegment } from "@/lib/supabase/buyers";

export const metadata = {
  title: "Voice CRM · BroBroker",
  description: "Turn call notes into memory, tasks, and follow-ups.",
};

export default async function VoiceCrmPage({
  searchParams,
}: {
  searchParams: Promise<{ buyer?: string | string[] }>;
}) {
  const segment = await getActiveBrokerSegment();
  const includeDemo = await isDemoModeEnabled();
  const storedBuyers = await getStoredBuyersForSegment(segment);
  const params = await searchParams;
  const prefillBuyerId = Array.isArray(params.buyer) ? params.buyer[0] : params.buyer;

  return (
    <AppShell active="Voice CRM">
      <VoiceToCrmWorkspace
        key={segment}
        includeDemo={includeDemo}
        prefillBuyerId={prefillBuyerId}
        segment={segment}
        storedBuyers={storedBuyers}
      />
    </AppShell>
  );
}
