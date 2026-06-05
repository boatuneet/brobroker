import { AppShell } from "@/components/app-shell";
import { BuyerIntakeFlow } from "@/components/buyer-intake/buyer-intake-flow";
import { PageBreadcrumb } from "@/components/ui/page-breadcrumb";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { normalizeBrokerSegment } from "@/lib/broker-segments";

export const metadata = {
  title: "Add buyer · BroBroker",
  description: "Create a segment-aware buyer memory profile for yachts, cars, or real estate.",
};

export default async function NewBuyerPage({
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
      active="Buyers"
      breadcrumb={
        <PageBreadcrumb
          items={[
            { label: "Buyers", href: "/buyers" },
            { label: "Add buyer" },
          ]}
        />
      }
    >
      <BuyerIntakeFlow initialSegment={segment} />
    </AppShell>
  );
}

