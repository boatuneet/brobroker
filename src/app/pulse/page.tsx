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
import { isDemoModeEnabled } from "@/lib/demo-mode-server";
import { getStoredBuyersForSegment } from "@/lib/supabase/buyers";

export const metadata: Metadata = {
  title: "Pulse · BroBroker",
  description: "Live timeline of every deal in motion — what's coming, what's late.",
};

export default async function PulsePage() {
  const segment = await getActiveBrokerSegment();
  const includeDemo = await isDemoModeEnabled();
  const [storedBuyers] = await Promise.all([getStoredBuyersForSegment(segment)]);
  /* When demo mode is off, the broker sees only their Supabase-backed
     pipeline — no Daniel Brenner / Helena Rossi seeds. */
  const demoBuyers = includeDemo ? getBuyersForSegment(segment) : [];
  const tasks = includeDemo ? getTasksForSegment(segment) : [];
  const conversations = includeDemo ? getConversationsForSegment(segment) : [];
  const drafts = includeDemo ? getFollowUpDraftsForSegment(segment) : [];
  const listings = includeDemo ? getListingsForSegment(segment) : [];

  return (
    <AppShell active="Pulse" pageTitle="Pulse">
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
