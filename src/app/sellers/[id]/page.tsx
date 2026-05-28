import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SellerMemoryProfile } from "@/components/client-memory";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { getSellerMemoryProfile } from "@/lib/services";

// Same as the buyer page: render dynamically rather than precompute a static
// id list, which avoids the Turbopack module-graph quirk that flagged
// getSellerIds() as a client function.
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const profile = getSellerMemoryProfile(id);

  if (!profile) {
    return {
      title: "Seller not found / BroBroker",
    };
  }

  return {
    title: `${profile.seller.name} · BroBroker`,
    description: "Owner context, cadence, and reporting.",
  };
}

export default async function SellerMemoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const segment = await getActiveBrokerSegment();

  if (!getSellerMemoryProfile(id, segment)) {
    notFound();
  }

  return (
    <AppShell active="Listings">
      <SellerMemoryProfile sellerId={id} segment={segment} />
    </AppShell>
  );
}
