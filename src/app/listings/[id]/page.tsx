import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ListingBrain } from "@/components/listings";
import { PageBreadcrumb } from "@/components/ui/page-breadcrumb";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { isDemoModeEnabled } from "@/lib/demo-mode-server";
import { getListingBrain } from "@/lib/services";
import { getStoredListingById } from "@/lib/supabase/listings";

// Render dynamically — listings come from Supabase at request time. The
// previous implementation imported getListingIds() from a "use client"
// component, which Next 16 correctly refuses to call from a server file.
export function generateStaticParams() {
  return [];
}

/* See /buyers/[id]/page.tsx for rationale — force dynamic rendering so Vercel
   doesn't try to statically prerender a page that reads cookies + Supabase. */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const includeDemo = await isDemoModeEnabled();
  const storedListing = await getStoredListingById(id);
  const brain = storedListing
    ? { listing: storedListing }
    : includeDemo
      ? getListingBrain(id)
      : undefined;

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
  const includeDemo = await isDemoModeEnabled();
  const storedListing = await getStoredListingById(id);

  if (!storedListing && (!includeDemo || !getListingBrain(id, segment))) {
    notFound();
  }

  const listingName =
    storedListing?.name ?? (includeDemo ? getListingBrain(id, segment)?.listing.name : undefined) ?? "Listing";

  return (
    <AppShell
      active="Listings"
      breadcrumb={
        <PageBreadcrumb
          items={[
            { label: "Listings", href: "/listings" },
            { label: listingName },
          ]}
        />
      }
    >
      <ListingBrain
        activeTab={tab}
        includeDemo={includeDemo}
        listingId={id}
        listingOverride={storedListing}
        segment={segment}
      />
    </AppShell>
  );
}
