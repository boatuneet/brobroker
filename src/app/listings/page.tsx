import Link from "next/link";
import { PlusCircle, UploadCloud } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ListingIndex } from "@/components/listings";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { isDemoModeEnabled } from "@/lib/demo-mode-server";
import { getStoredListingsForSegment } from "@/lib/supabase/listings";

export const metadata = {
  title: "Listings · BroBroker",
  description: "Search inventory, document readiness, buyer fit, and missing facts.",
};

/* Top-bar action cluster for the Listings index. Mirrors the
   DashboardTopActions pattern — smaller (min-h-9 / text-[13px]) so it sits
   cleanly inline with the sidebar toggle and page title in the sticky bar. */
function ListingsTopActions() {
  return (
    <>
      <Link
        className="inline-flex min-h-9 items-center gap-1.5 rounded-[8px] border border-[#E7E7E7] bg-white px-3 text-[13px] font-medium text-[#171719] transition-colors hover:bg-[#F1F2EE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]"
        href="/listings/import"
      >
        <UploadCloud className="h-4 w-4" aria-hidden="true" />
        Custom import
      </Link>
      <Link
        className="inline-flex min-h-9 items-center gap-1.5 rounded-[8px] bg-[#003C33] px-3 text-[13px] font-medium text-white transition-colors hover:bg-[#0B4A3F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]"
        href="/listings/new"
      >
        <PlusCircle className="h-4 w-4" aria-hidden="true" />
        New listing
      </Link>
    </>
  );
}

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; status?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = Array.isArray(params.q) ? params.q[0] : params.q;
  const status = Array.isArray(params.status) ? params.status[0] : params.status;
  const segment = await getActiveBrokerSegment();
  const includeDemo = await isDemoModeEnabled();
  const storedListings = await getStoredListingsForSegment(segment);

  return (
    <AppShell
      active="Listings"
      pageActions={<ListingsTopActions />}
      pageTitle="Listings"
    >
      <ListingIndex
        includeDemo={includeDemo}
        query={query}
        segment={segment}
        status={status}
        storedListings={storedListings}
      />
    </AppShell>
  );
}
