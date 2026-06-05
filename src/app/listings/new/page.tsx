import { AppShell } from "@/components/app-shell";
import { ListingIntakeFlow } from "@/components/listing-intake/listing-intake-flow";
import { PageBreadcrumb } from "@/components/ui/page-breadcrumb";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { normalizeBrokerSegment } from "@/lib/broker-segments";

export const metadata = {
  title: "Add listing · BroBroker",
  description: "Create a segment-aware listing or internal draft for cars, yachts, or real estate.",
};

export default async function NewListingPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string | string[] }>;
}) {
  const params = await searchParams;
  const segmentParam = Array.isArray(params.segment) ? params.segment[0] : params.segment;
  const activeSegment = await getActiveBrokerSegment();
  const segment = normalizeBrokerSegment(segmentParam ?? activeSegment);

  return (
    <AppShell
      active="Listings"
      breadcrumb={
        <PageBreadcrumb
          items={[
            { label: "Listings", href: "/listings" },
            { label: "Add listing" },
          ]}
        />
      }
    >
      <ListingIntakeFlow initialSegment={segment} />
    </AppShell>
  );
}
