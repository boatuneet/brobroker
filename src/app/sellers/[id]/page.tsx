import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SellerMemoryProfile } from "@/components/client-memory";
import { PageBreadcrumb } from "@/components/ui/page-breadcrumb";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { isDemoModeEnabled } from "@/lib/demo-mode-server";
import { getSellerMemoryProfile } from "@/lib/services";

// Same as the buyer page: render dynamically rather than precompute a static
// id list, which avoids the Turbopack module-graph quirk that flagged
// getSellerIds() as a client function.
export function generateStaticParams() {
  return [];
}

/* See /buyers/[id]/page.tsx for rationale — force dynamic rendering so Vercel
   doesn't statically prerender a page that needs cookies + Supabase. */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const includeDemo = await isDemoModeEnabled();
  const profile = includeDemo ? getSellerMemoryProfile(id) : undefined;

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
  const includeDemo = await isDemoModeEnabled();

  const sellerProfile = includeDemo ? getSellerMemoryProfile(id, segment) : undefined;
  if (!sellerProfile) {
    notFound();
  }

  return (
    <AppShell
      active="Listings"
      breadcrumb={
        <PageBreadcrumb
          items={[
            { label: "Listings", href: "/listings" },
            { label: sellerProfile.seller.name },
          ]}
        />
      }
    >
      <SellerMemoryProfile sellerId={id} segment={segment} />
    </AppShell>
  );
}
