import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BuyerMemoryProfile } from "@/components/client-memory";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { isDemoModeEnabled } from "@/lib/demo-mode-server";
import { getBuyerMemoryProfile } from "@/lib/services";
import { getStoredBuyerById } from "@/lib/supabase/buyers";
import { getStoredConversationsForBuyer } from "@/lib/supabase/conversations";
import { getStoredFollowUpDraftsForBuyer } from "@/lib/supabase/follow-up-drafts";
import { getStoredListingsForSegment } from "@/lib/supabase/listings";

// Render dynamically — buyers come from Supabase at request time. Returning an
// empty array signals "no build-time prerender" so we don't have to keep a
// static ID list in sync, and it sidesteps a Turbopack module-graph quirk that
// flags getBuyerIds() as a client function during dev.
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const includeDemo = await isDemoModeEnabled();
  const profile = includeDemo ? getBuyerMemoryProfile(id) : undefined;
  const storedBuyer = profile ? undefined : await getStoredBuyerById(id);

  if (!profile && !storedBuyer) {
    return {
      title: "Buyer not found / BroBroker",
    };
  }

  return {
    title: `${profile?.buyer.name ?? storedBuyer?.name} · BroBroker`,
    description: "Buyer memory, matches, and next actions.",
  };
}

const VALID_TABS = new Set(["memory", "matches", "drafts"] as const);
type ProfileTab = "memory" | "matches" | "drafts";

export default async function BuyerMemoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const rawTab = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  const initialTab: ProfileTab | undefined =
    rawTab && VALID_TABS.has(rawTab as ProfileTab) ? (rawTab as ProfileTab) : undefined;
  const segment = await getActiveBrokerSegment();
  const includeDemo = await isDemoModeEnabled();
  const profile = includeDemo ? getBuyerMemoryProfile(id, segment) : undefined;
  const [storedBuyer, storedListings, storedConversations, storedDrafts] = await Promise.all([
    profile ? Promise.resolve(undefined) : getStoredBuyerById(id),
    getStoredListingsForSegment(segment),
    getStoredConversationsForBuyer(id),
    getStoredFollowUpDraftsForBuyer(id),
  ]);

  if (!profile && !storedBuyer) {
    notFound();
  }

  return (
    <AppShell active="Buyers">
      <BuyerMemoryProfile
        buyerId={id}
        buyerOverride={storedBuyer}
        includeDemo={includeDemo}
        initialTab={initialTab}
        segment={segment}
        storedListings={storedListings}
        storedConversations={storedConversations}
        storedDrafts={storedDrafts}
      />
    </AppShell>
  );
}
