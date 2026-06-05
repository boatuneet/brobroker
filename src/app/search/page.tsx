import { AppShell } from "@/components/app-shell";
import { GlobalSearch } from "@/components/global-search";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { isDemoModeEnabled } from "@/lib/demo-mode-server";

export const metadata = {
  title: "Search · BroBroker",
  description: "Search buyers, listings, owners, tasks, and document gaps.",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = Array.isArray(params.q) ? params.q[0] : params.q;
  const segment = await getActiveBrokerSegment();
  const includeDemo = await isDemoModeEnabled();

  return (
    <AppShell active="Dashboard" pageTitle="Search">
      <GlobalSearch includeDemo={includeDemo} query={query} segment={segment} />
    </AppShell>
  );
}
