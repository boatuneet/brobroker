import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { PulseBoard } from "@/components/pulse/pulse-board";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import {
  getBuyersForSegment,
  getConversationsForSegment,
  getFollowUpDraftsForSegment,
  getListingsForSegment,
  getTasksForSegment,
} from "@/lib/broker-segments";
import { getStoredBuyersForSegment } from "@/lib/supabase/buyers";

export const metadata: Metadata = {
  title: "Pulse · BroBroker",
  description: "Live timeline of every deal in motion — what's coming, what's late.",
};

export default async function PulsePage() {
  const segment = await getActiveBrokerSegment();
  const [storedBuyers] = await Promise.all([getStoredBuyersForSegment(segment)]);
  const demoBuyers = getBuyersForSegment(segment);
  const tasks = getTasksForSegment(segment);
  const conversations = getConversationsForSegment(segment);
  const drafts = getFollowUpDraftsForSegment(segment);
  const listings = getListingsForSegment(segment);

  return (
    <AppShell active="Pulse">
      <PulseBoard
        conversations={conversations}
        demoBuyers={demoBuyers}
        drafts={drafts}
        listings={listings}
        segment={segment}
        storedBuyers={storedBuyers}
        tasks={tasks}
      />
    </AppShell>
  );
}
