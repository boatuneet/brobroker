import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BuyerIntakeFlow } from "@/components/buyer-intake/buyer-intake-flow";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { getBuyerMemoryProfile } from "@/lib/services";
import { getStoredBuyerById } from "@/lib/supabase/buyers";

// Render dynamically — buyer IDs include Supabase rows not known at build time.
export function generateStaticParams() {
  return [];
}

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const profile = getBuyerMemoryProfile(id);
  const storedBuyer = profile ? undefined : await getStoredBuyerById(id);
  const name = profile?.buyer.name ?? storedBuyer?.name;

  if (!name) {
    return { title: "Buyer not found · BroBroker" };
  }

  return {
    title: `Edit ${name} · BroBroker`,
    description: "Update criteria, urgency, and relationship memory for this buyer.",
  };
}

export default async function EditBuyerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const segment = await getActiveBrokerSegment();
  const profile = getBuyerMemoryProfile(id, segment);
  const storedBuyer = profile ? undefined : await getStoredBuyerById(id);
  const buyer = profile?.buyer ?? storedBuyer;

  if (!buyer) {
    notFound();
  }

  // Prefer the buyer's own asset type so edit form matches the originally
  // captured segment, falling back to the active workspace segment.
  const editingSegment = buyer.assetTypes?.[0] ?? segment;

  return (
    <AppShell active="Buyers">
      <BuyerIntakeFlow editingBuyer={buyer} initialSegment={editingSegment} />
    </AppShell>
  );
}
