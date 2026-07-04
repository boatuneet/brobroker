import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BuyerMemoryProfile } from "@/components/client-memory";
import { PageBreadcrumb } from "@/components/ui/page-breadcrumb";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { isDemoModeEnabled } from "@/lib/demo-mode-server";
import { getBuyerMemoryProfile } from "@/lib/services";
import { getStoredBuyerById } from "@/lib/supabase/buyers";
import { getStoredConversationsForBuyer } from "@/lib/supabase/conversations";
import { getStoredDealRooms } from "@/lib/supabase/deal-rooms";
import { getStoredFollowUpDraftsForBuyer } from "@/lib/supabase/follow-up-drafts";
import { getStoredListingsForSegment } from "@/lib/supabase/listings";

// Render dynamically — buyers come from Supabase at request time. Returning an
// empty array signals "no build-time prerender" so we don't have to keep a
// static ID list in sync, and it sidesteps a Turbopack module-graph quirk that
// flags getBuyerIds() as a client function during dev.
export function generateStaticParams() {
  return [];
}

/* Force dynamic rendering. Without this, Vercel's build pipeline has been
   observed to mis-classify this route as static (because generateStaticParams
   returned no params), which leads to a 500 on every request — the page tries
   to read cookies and Supabase data at request time, but the runtime treats
   it as a static page that should already be rendered. Setting force-dynamic
   tells Next to always render at request time. */
export const dynamic = "force-dynamic";

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

const VALID_TABS = new Set(["memory", "matches", "drafts", "timeline", "trust"] as const);
type ProfileTab = "memory" | "matches" | "drafts" | "timeline" | "trust";

/* Each Supabase helper is internally guarded (returns [] / undefined on
   error), but a single unexpected throw — e.g. a network blip during
   getStoredListingsForSegment — would 500 the entire page. Wrapping each
   call lets one bad query degrade gracefully instead of taking the page
   down. */
async function safeAwait<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    console.warn("buyer detail: a data fetch threw, using fallback", error);
    return fallback;
  }
}

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
  const [storedBuyer, storedListings, storedConversations, storedDrafts, allDealRooms] = await Promise.all([
    profile
      ? Promise.resolve(undefined)
      : safeAwait(getStoredBuyerById(id), undefined),
    safeAwait(getStoredListingsForSegment(segment), []),
    safeAwait(getStoredConversationsForBuyer(id), []),
    safeAwait(getStoredFollowUpDraftsForBuyer(id), []),
    safeAwait(getStoredDealRooms(), []),
  ]);
  // Deal rooms live in a shared table — pick the one attached to this buyer.
  // Newest wins (getStoredDealRooms already orders by updated_at desc).
  const storedDealRoom = allDealRooms.find((room) => room.buyerId === id);

  if (!profile && !storedBuyer) {
    notFound();
  }

  const buyerName = profile?.buyer.name ?? storedBuyer?.name ?? "Buyer";

  return (
    <AppShell
      active="Buyers"
      breadcrumb={
        <PageBreadcrumb
          items={[
            { label: "Buyers", href: "/buyers" },
            { label: buyerName },
          ]}
        />
      }
    >
      <BuyerMemoryProfile
        buyerId={id}
        buyerOverride={storedBuyer}
        includeDemo={includeDemo}
        initialTab={initialTab}
        segment={segment}
        storedListings={storedListings}
        storedConversations={storedConversations}
        storedDrafts={storedDrafts}
        storedDealRoom={storedDealRoom}
      />
    </AppShell>
  );
}
