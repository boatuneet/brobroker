import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BuyerMemoryProfile, getBuyerIds } from "@/components/client-memory";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { getBuyerMemoryProfile } from "@/lib/services";
import { getStoredBuyerById } from "@/lib/supabase/buyers";

export function generateStaticParams() {
  return getBuyerIds().map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const profile = getBuyerMemoryProfile(id);
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

export default async function BuyerMemoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const segment = await getActiveBrokerSegment();
  const profile = getBuyerMemoryProfile(id, segment);
  const storedBuyer = profile ? undefined : await getStoredBuyerById(id);

  if (!profile && !storedBuyer) {
    notFound();
  }

  return (
    <AppShell active="Buyers">
      <BuyerMemoryProfile buyerId={id} buyerOverride={storedBuyer} segment={segment} />
    </AppShell>
  );
}
