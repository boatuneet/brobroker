import { AppShell } from "@/components/app-shell";
import { KnowledgeVaultWorkspace } from "@/components/knowledge-vault";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { isDemoModeEnabled } from "@/lib/demo-mode-server";
import { buildKnowledgeVault } from "@/lib/knowledge-vault";
import { getStoredBuyersForSegment } from "@/lib/supabase/buyers";
import { getStoredListingsForSegment } from "@/lib/supabase/listings";

export const metadata = {
  title: "Knowledge Vault · BroBroker",
  description: "Inspect generated broker knowledge pages with source lineage and open gaps.",
};

export default async function KnowledgePage() {
  const segment = await getActiveBrokerSegment();
  const includeDemo = await isDemoModeEnabled();
  const [storedListings, storedBuyers] = await Promise.all([
    getStoredListingsForSegment(segment),
    getStoredBuyersForSegment(segment),
  ]);
  const model = buildKnowledgeVault(segment, {
    storedListings,
    storedBuyers,
    includeDemo,
  });

  return (
    <AppShell active="Knowledge">
      <KnowledgeVaultWorkspace model={model} />
    </AppShell>
  );
}
