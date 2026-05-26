import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getListingIds, ListingBrain } from "@/components/listings";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { getListingBrain } from "@/lib/services";
import { getStoredListingById } from "@/lib/supabase/listings";

export function generateStaticParams() {
  return getListingIds().map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const storedListing = await getStoredListingById(id);
  const brain = storedListing ? { listing: storedListing } : getListingBrain(id);

  if (!brain) {
    return {
      title: "Listing not found / BroBroker",
    };
  }

  return {
    title: `${brain.listing.name} · BroBroker`,
    description: `${brain.listing.builder} ${brain.listing.model} listing intelligence.`,
  };
}

export default async function ListingBrainPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const tab = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  const segment = await getActiveBrokerSegment();
  const storedListing = await getStoredListingById(id);

  if (!storedListing && !getListingBrain(id, segment)) {
    notFound();
  }

  return (
    <AppShell active="Listings">
      <ListingBrain activeTab={tab} listingId={id} listingOverride={storedListing} segment={segment} />
    </AppShell>
  );
}
