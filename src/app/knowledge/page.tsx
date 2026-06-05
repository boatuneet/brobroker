import { AppShell } from "@/components/app-shell";
import { ImportKnowledgeButton } from "@/components/knowledge/import-knowledge-button";
import { KnowledgeWorkspace } from "@/components/knowledge/knowledge-workspace";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { isDemoModeEnabled } from "@/lib/demo-mode-server";
import { getNotesForOwner, notesByPageId, notesToPages } from "@/lib/knowledge-notes";
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
  const [storedListings, storedBuyers, notes] = await Promise.all([
    getStoredListingsForSegment(segment),
    getStoredBuyersForSegment(segment),
    getNotesForOwner(),
  ]);
  const model = buildKnowledgeVault(segment, {
    storedListings,
    storedBuyers,
    includeDemo,
  });
  const notesByPage = notesByPageId(notes);
  const notePages = notesToPages(notes, segment);

  return (
    <AppShell active="Knowledge" pageActions={<ImportKnowledgeButton />} pageTitle="Knowledge">
      <KnowledgeWorkspace model={model} notePages={notePages} notesByPage={notesByPage} />
    </AppShell>
  );
}
